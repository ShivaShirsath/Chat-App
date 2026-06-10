import { useState, useEffect, useRef, useCallback } from "react";
import type { Message, ModelEndpoint, ConnectionType, ChatSession, OllamaModel, ChatMode } from "../types/chat";
import { API_BASE_URL, WS_BASE_URL } from "../utils/api";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [endpoint, setEndpoint] = useState<ModelEndpoint>("text-to-text");
  const [connectionType, setConnectionType] = useState<ConnectionType>("websocket");
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [isLoading, setIsLoading] = useState(false);
  const [modelName, setModelName] = useState<string>("llama3.2:latest");
  const [models, setModels] = useState<OllamaModel[]>([]);

  // Persisted SQLite Session states
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeAgentSessions, setActiveAgentSessions] = useState<string[]>([]);

  // Coder Agent States
  const [chatMode, setChatMode] = useState<ChatMode>("ask");
  const [folderPath, setFolderPath] = useState(() => localStorage.getItem("agent-folder-path") || "");
  const [isValidated, setIsValidated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [agentElapsedTime, setAgentElapsedTime] = useState(0);

  const agentTimerRef = useRef<any>(null);
  const agentSocketRef = useRef<WebSocket | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  
  // Keep refs updated for access inside listener callbacks
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Cache folder path in local storage & validate on change
  useEffect(() => {
    localStorage.setItem("agent-folder-path", folderPath);
    if (folderPath.trim()) {
      validateSpecificPath(folderPath.trim(), false);
    }
  }, [folderPath]);

  // Timer for agent execution duration
  useEffect(() => {
    if (isLoading && chatMode === "agent") {
      setAgentElapsedTime(0);
      agentTimerRef.current = setInterval(() => {
        setAgentElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (agentTimerRef.current) {
        clearInterval(agentTimerRef.current);
      }
    }
    return () => {
      if (agentTimerRef.current) clearInterval(agentTimerRef.current);
    };
  }, [isLoading, chatMode]);

  const validateSpecificPath = useCallback(async (path: string, showSuccess = true) => {
    if (!path.trim()) return;
    setIsValidating(true);
    setValidationError(null);
    if (!showSuccess) setIsValidated(false);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/agent/validate-path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.exists && data.is_directory) {
          setIsValidated(true);
          setFiles(data.files);
        } else if (data.exists) {
          setValidationError("Specified path is a file, not a directory.");
        } else {
          setValidationError("Path does not exist on local disk.");
        }
      }
    } catch (e) {
      setValidationError("Failed to contact backend API server.");
    } finally {
      setIsValidating(false);
    }
  }, []);

  const handleSelectFolder = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/agent/select-folder`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.path) {
          setFolderPath(data.path);
          validateSpecificPath(data.path, true);
        }
      }
    } catch (e) {
      console.error("Failed to choose folder:", e);
    }
  }, [validateSpecificPath]);

  const handleSendPermissionChoice = useCallback((agentMsgId: string, choice: string) => {
    if (agentSocketRef.current && agentSocketRef.current.readyState === WebSocket.OPEN) {
      agentSocketRef.current.send(JSON.stringify({
        type: "permission_response",
        choice: choice
      }));

      // Update the chat message to mark the selection
      setMessages((prev) => {
        const list = [...prev];
        const idx = list.findIndex(m => m.id === agentMsgId);
        if (idx !== -1) {
          const msg = { ...list[idx] };
          if (msg.permissionRequest) {
            msg.permissionRequest.answeredChoice = choice;
          }
          list[idx] = msg;
        }
        return list;
      });
    }
  }, []);

  const handleStopAgent = useCallback(() => {
    if (agentSocketRef.current) {
      if (agentSocketRef.current.readyState === WebSocket.OPEN) {
        agentSocketRef.current.send(JSON.stringify({ type: "stop_agent" }));
      }
      agentSocketRef.current.close();
    }
    setIsLoading(false);
  }, []);

  // Fetch list of active chat sessions from gateway
  const fetchSessions = useCallback(async () => {
    try {
      const [sessRes, activeRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/sessions`),
        fetch(`${API_BASE_URL}/api/v1/agent/active`)
      ]);
      
      if (sessRes.ok) {
        const data = await sessRes.json();
        setSessions(data);
      }
      
      if (activeRes.ok) {
        const activeIds = await activeRes.json();
        setActiveAgentSessions(activeIds);
      }
    } catch (e) {
      console.error("Failed to fetch sessions:", e);
    }
  }, []);

  // Poll sessions and active agents status every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchSessions();
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchSessions]);

  // Fetch list of active Ollama models from gateway
  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/text-to-text/models`);
      if (res.ok) {
        const data = await res.json();
        setModels(data);
        if (data.length > 0) {
          // If the default model (llama3.2:latest) is not available, default to the first one in the list
          const hasDefault = data.some((m: any) => m.id === "llama3.2:latest" || m.name === "llama3.2:latest");
          if (!hasDefault) {
            setModelName(data[0].id);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch models:", e);
    }
  }, []);

  // Fetch sessions and models on component load
  useEffect(() => {
    fetchSessions();
    fetchModels();
  }, [fetchSessions, fetchModels]);

  const connectAgentWebSocket = useCallback((
    sessId: string,
    msgId: string,
    folder?: string,
    inst?: string,
    model?: string
  ) => {
    if (agentSocketRef.current) {
      agentSocketRef.current.close();
    }
    
    let currentSessId = sessId;
    setIsLoading(true);
    const wsUrl = `${WS_BASE_URL}/api/v1/agent/run`;
    const socket = new WebSocket(wsUrl);
    agentSocketRef.current = socket;
    
    socket.onopen = () => {
      if (folder && inst) {
        socket.send(JSON.stringify({
          folder_path: folder,
          instruction: inst,
          model_name: model || modelName,
          session_id: sessId,
          agent_msg_id: msgId
        }));
      } else {
        // Reconnect handshake
        socket.send(JSON.stringify({
          session_id: sessId,
          reconnect: true
        }));
      }
    };
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === "session_created" || message.event === "session_created") {
          currentSessId = message.session_id;
          sessionIdRef.current = message.session_id;
          setSessionId(message.session_id);
          fetchSessions();
          return;
        }
        
        setMessages((prev) => {
          if (sessionIdRef.current !== currentSessId) return prev;
          
          const list = [...prev];
          const idx = list.findIndex(m => m.id === msgId);
          if (idx === -1) return prev;
          const msg = { ...list[idx] };
          
          if (message.type === "thought") {
            const currentThoughts = msg.thoughts || [];
            if (message.replay) {
              if (!currentThoughts.includes(message.content)) {
                msg.thoughts = [...currentThoughts, message.content];
              }
            } else {
              msg.thoughts = [...currentThoughts, message.content];
            }
          } else if (message.type === "terminal") {
            if (message.replay) {
              msg.terminalLogs = message.content;
            } else {
              msg.terminalLogs = (msg.terminalLogs || "") + message.content;
            }
          } else if (message.type === "diff") {
            msg.diffs = message.diffs || {};
          } else if (message.type === "permission_request") {
            msg.permissionRequest = {
              question: message.question,
              options: message.options || ["Yes", "No"]
            };
          } else if (message.type === "permission_response") {
            if (msg.permissionRequest) {
              msg.permissionRequest.answeredChoice = message.choice;
            }
          } else if (message.type === "done") {
            msg.content = message.summary;
            msg.isStreaming = false;
            msg.thinkingTime = message.thinking_time || agentElapsedTime;
            setIsLoading(false);
            socket.close();
            if (folder) {
              validateSpecificPath(folder, false);
            }
            fetchSessions();
          } else if (message.type === "error") {
            msg.content = `Error: ${message.message}`;
            msg.isStreaming = false;
            msg.thinkingTime = message.thinking_time || agentElapsedTime;
            setIsLoading(false);
            socket.close();
            fetchSessions();
          }
          
          list[idx] = msg;
          return list;
        });
      } catch (err) {
        console.error("Failed to parse agent socket message:", err);
      }
    };
    
    socket.onclose = () => {
      if (sessionIdRef.current === currentSessId) {
        setIsLoading(false);
        setMessages((prev) => {
          const list = [...prev];
          const idx = list.findIndex(m => m.id === msgId);
          if (idx !== -1 && list[idx].isStreaming) {
            list[idx].isStreaming = false;
            list[idx].thinkingTime = agentElapsedTime;
          }
          return list;
        });
      }
    };
    
    socket.onerror = (err) => {
      console.error("Agent socket error:", err);
      if (sessionIdRef.current === currentSessId) {
        setIsLoading(false);
        setMessages((prev) => {
          const list = [...prev];
          const idx = list.findIndex(m => m.id === msgId);
          if (idx !== -1) {
            list[idx].content = "Error: Connection lost or server error occurred.";
            list[idx].isStreaming = false;
            list[idx].thinkingTime = agentElapsedTime;
          }
          return list;
        });
      }
    };
  }, [modelName, agentElapsedTime, fetchSessions, validateSpecificPath]);

  // Load message logs of a specific session
  const loadSession = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/sessions/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        // Map backend schema (snake_case) to frontend schema (camelCase)
        const mapped: Message[] = data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          // Prepend server host to relative storage paths
          mediaUrl: m.media_url ? `${API_BASE_URL}${m.media_url}` : undefined,
          mediaType: m.media_type || undefined,
          isStreaming: m.is_streaming || undefined,
          thoughts: m.thoughts || undefined,
          terminalLogs: m.terminal_logs || undefined,
          diffs: m.diffs || undefined,
          permissionRequest: m.permission_request || undefined,
          thinkingTime: m.thinking_time || undefined
        }));
        setMessages(mapped);
        setSessionId(id);
        
        // Reconnect if the last message shows an active running agent
        const lastMsg = mapped[mapped.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && lastMsg.isStreaming) {
          connectAgentWebSocket(id, lastMsg.id);
        } else {
          if (agentSocketRef.current) {
            agentSocketRef.current.close();
            agentSocketRef.current = null;
          }
        }
      }
    } catch (e) {
      console.error(`Failed to load messages for session ${id}:`, e);
    } finally {
      setIsLoading(false);
    }
  }, [connectAgentWebSocket]);

  // Delete session from history
  const deleteSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/sessions/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchSessions();
        // If the active session is deleted, clear state
        if (sessionIdRef.current === id) {
          setSessionId(null);
          setMessages([]);
        }
      }
    } catch (e) {
      console.error(`Failed to delete session ${id}:`, e);
    }
  }, [fetchSessions]);

  // Start a fresh chat session
  const createNewChat = useCallback(() => {
    if (agentSocketRef.current) {
      agentSocketRef.current.close();
      agentSocketRef.current = null;
    }
    setSessionId(null);
    setMessages([]);
  }, []);

  // Connect and manage WebSocket lifecycle cleanly
  useEffect(() => {
    if (connectionType !== "websocket") {
      setWsStatus("disconnected");
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimeoutId: any = null;
    let isCleanup = false;

    const connect = () => {
      if (isCleanup) return;

      setWsStatus("connecting");
      const wsUrl = `${WS_BASE_URL}/api/v1/ws`;
      socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (isCleanup) {
          socket?.close();
          return;
        }
        setWsStatus("connected");
        console.log("WebSocket connected");
      };

      socket.onmessage = (event) => {
        if (isCleanup) return;
        try {
          const message = JSON.parse(event.data);
          
          if (message.error) {
            console.error("WS error event:", message.error);
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const list = [...prev];
              const idx = list.length - 1;
              const last = list[idx];
              if (last && last.role === "assistant" && last.isStreaming) {
                list[idx] = {
                  ...last,
                  content: `Error: ${message.error}`,
                  isStreaming: false
                };
              }
              return list;
            });
            setIsLoading(false);
            return;
          }

          // SQLite session creation event notification
          if (message.event === "session_created") {
            setSessionId(message.session_id);
            fetchSessions();
            return;
          }

          if (message.event === "chunk") {
            const chunkData = message.data;
            const deltaContent = chunkData.choices?.[0]?.delta?.content || "";
            const mediaUrl = chunkData.media_url;
            const mediaType = chunkData.media_type;

            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const list = [...prev];
              const idx = list.length - 1;
              const last = list[idx];
              if (last && last.role === "assistant" && last.isStreaming) {
                list[idx] = {
                  ...last,
                  content: last.content + deltaContent,
                  mediaUrl: mediaUrl ? `${API_BASE_URL}${mediaUrl}` : last.mediaUrl,
                  mediaType: mediaType || last.mediaType
                };
              }
              return list;
            });
          } else if (message.event === "done") {
            const mediaUrl = message.media_url;
            const mediaType = message.media_type;

            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const list = [...prev];
              const idx = list.length - 1;
              const last = list[idx];
              if (last && last.role === "assistant") {
                list[idx] = {
                  ...last,
                  mediaUrl: mediaUrl ? `${API_BASE_URL}${mediaUrl}` : last.mediaUrl,
                  mediaType: mediaType || last.mediaType,
                  isStreaming: false
                };
              }
              return list;
            });
            setIsLoading(false);
            fetchSessions(); // Refresh list to update title / active time
          } else if (message.event === "response") {
            const resData = message.data;
            const assistantContent = resData.choices?.[0]?.message?.content || "";
            const mediaUrl = resData.media_url;
            const mediaType = resData.media_type;

            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const list = [...prev];
              const idx = list.length - 1;
              const last = list[idx];
              if (last && last.role === "assistant") {
                list[idx] = {
                  ...last,
                  content: assistantContent,
                  mediaUrl: mediaUrl ? `${API_BASE_URL}${mediaUrl}` : last.mediaUrl,
                  mediaType: mediaType || last.mediaType,
                  isStreaming: false
                };
              }
              return list;
            });
            setIsLoading(false);
            fetchSessions();
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      socket.onclose = () => {
        if (isCleanup) return;
        setWsStatus("disconnected");
        console.log("WebSocket disconnected, scheduling reconnect...");
        reconnectTimeoutId = setTimeout(connect, 3000);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    };

    connect();

    return () => {
      isCleanup = true;
      if (socket) {
        socket.close();
      }
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
      socketRef.current = null;
    };
  }, [connectionType, fetchSessions]);

  // SSE Send Helper
  const sendHttpSse = async (chatMessages: Message[], userText: string, imageBase64?: string) => {
    setIsLoading(true);
    
    // Add temporary assistant streaming card
    const assistantMsgId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: "assistant", content: "", isStreaming: true }
    ]);

    try {
      const history = chatMessages.map(m => ({
        role: m.role,
        content: m.content,
        // Send relative URL back to server
        image_url: m.mediaUrl && m.mediaType === "image" ? m.mediaUrl.replace(API_BASE_URL, "") : undefined
      }));
      
      // Add the new user message
      history.push({
        role: "user",
        content: userText,
        image_url: imageBase64 || undefined
      });

      const response = await fetch(`${API_BASE_URL}/api/v1/${endpoint}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          stream: true,
          temperature: 0.7,
          model: endpoint === "text-to-text" ? modelName : undefined,
          session_id: sessionIdRef.current || undefined // Persist session ID
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      if (!response.body) {
        throw new Error("ReadableStream not supported by browser.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine || !cleanLine.startsWith("data:")) continue;
          
          const rawData = cleanLine.replace("data:", "").trim();
          if (rawData === "[DONE]") {
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const list = [...prev];
              const idx = list.length - 1;
              const last = list[idx];
              if (last && last.id === assistantMsgId) {
                list[idx] = {
                  ...last,
                  isStreaming: false
                };
              }
              return list;
            });
            setIsLoading(false);
            fetchSessions();
            break;
          }

          try {
            const parsed = JSON.parse(rawData);

            // Handle HTTP SSE session creation notification
            if (parsed.event === "session_created") {
              setSessionId(parsed.session_id);
              fetchSessions();
              continue;
            }

            const contentDelta = parsed.choices?.[0]?.delta?.content || "";
            const mediaUrl = parsed.media_url;
            const mediaType = parsed.media_type;

            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const list = [...prev];
              const idx = list.length - 1;
              const last = list[idx];
              if (last && last.id === assistantMsgId) {
                list[idx] = {
                  ...last,
                  content: last.content + contentDelta,
                  mediaUrl: mediaUrl ? `${API_BASE_URL}${mediaUrl}` : last.mediaUrl,
                  mediaType: mediaType || last.mediaType
                };
              }
              return list;
            });
          } catch (e) {
            console.error("Error parsing SSE JSON:", e);
          }
        }
      }
    } catch (error: any) {
      console.error("SSE request failed:", error);
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const list = [...prev];
        const idx = list.length - 1;
        const last = list[idx];
        if (last && last.id === assistantMsgId) {
          list[idx] = {
            ...last,
            content: `Error: ${error.message || "Failed to fetch response"}`,
            isStreaming: false
          };
        }
        return list;
      });
      setIsLoading(false);
    }
  };

  // Main sendMessage exposed function
  const sendMessage = useCallback(async (content: string, imageBase64?: string) => {
    if (!content.trim() && !imageBase64) return;

    // A. Agent Mode Execution Path
    if (chatMode === "agent") {
      if (!isValidated || isLoading) return;
      setIsLoading(true);

      const userMsgId = `user-${Date.now()}`;
      const newUserMsg: Message = {
        id: userMsgId,
        role: "user",
        content
      };

      const agentMsgId = `agent-${Date.now()}`;
      const newAgentMsg: Message = {
        id: agentMsgId,
        role: "assistant",
        content: "",
        thoughts: ["Connecting to agent loop..."],
        terminalLogs: "",
        diffs: {},
        isStreaming: true
      };

      setMessages((prev) => [...prev, newUserMsg, newAgentMsg]);
      
      connectAgentWebSocket(
        sessionIdRef.current || `temp-${Date.now()}`,
        agentMsgId,
        folderPath.trim(),
        content,
        modelName
      );

      return;
    }

    // B. Normal Ask Mode Execution Path
    const userMsgId = `user-${Date.now()}`;
    const newUserMsg: Message = {
      id: userMsgId,
      role: "user",
      content,
      mediaUrl: imageBase64,
      mediaType: imageBase64 ? "image" : undefined
    };

    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);

    if (connectionType === "http-sse") {
      await sendHttpSse(messages, content, imageBase64);
    } else {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-err-${Date.now()}`,
            role: "assistant",
            content: "Error: WebSocket is disconnected. Reconnecting..."
          }
        ]);
        return;
      }

      setIsLoading(true);
      
      const assistantMsgId = `assistant-ws-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "assistant", content: "", isStreaming: true }
      ]);

      const history = updatedMessages.map(m => ({
        role: m.role,
        content: m.content,
        image_url: m.mediaUrl && m.mediaType === "image" ? m.mediaUrl.replace(API_BASE_URL, "") : undefined
      }));

      socketRef.current.send(JSON.stringify({
        type: endpoint,
        payload: {
          messages: history,
          stream: true,
          temperature: 0.7,
          model: endpoint === "text-to-text" ? modelName : undefined,
          session_id: sessionIdRef.current || undefined // Persist session ID
        }
      }));
    }
  }, [messages, endpoint, connectionType, modelName, chatMode, folderPath, isValidated, isLoading, agentElapsedTime, fetchSessions, validateSpecificPath]);

  const clearChat = useCallback(() => {
    if (agentSocketRef.current) {
      agentSocketRef.current.close();
      agentSocketRef.current = null;
    }
    // If there is an active session, delete it from the DB
    if (sessionIdRef.current) {
      deleteSession(sessionIdRef.current);
    } else {
      setMessages([]);
    }
    setIsLoading(false);
  }, [deleteSession]);

  return {
    messages,
    endpoint,
    setEndpoint,
    connectionType,
    setConnectionType,
    wsStatus,
    isLoading,
    sendMessage,
    clearChat,
    modelName,
    setModelName,
    models,
    
    // persistence exports
    sessionId,
    sessions,
    loadSession,
    deleteSession,
    createNewChat,
    activeAgentSessions,

    // Coder Agent exports
    chatMode,
    setChatMode,
    folderPath,
    setFolderPath,
    isValidated,
    validationError,
    files,
    isValidating,
    handleSelectFolder,
    handleSendPermissionChoice,
    handleStopAgent,
    agentElapsedTime
  };
}
