import { useState, useEffect, useRef, useCallback } from "react";

export type MessageRole = "system" | "user" | "assistant";
export type MediaType = "text" | "image" | "video";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  isStreaming?: boolean;
}

export type ModelEndpoint = "text-to-text" | "text-to-image" | "text-and-image-to-image" | "text-to-video";
export type ConnectionType = "websocket" | "http-sse";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [endpoint, setEndpoint] = useState<ModelEndpoint>("text-to-text");
  const [connectionType, setConnectionType] = useState<ConnectionType>("websocket");
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [isLoading, setIsLoading] = useState(false);
  const [modelName, setModelName] = useState<string>("llama3.2:latest");

  const socketRef = useRef<WebSocket | null>(null);
  const messagesRef = useRef<Message[]>([]);
  
  // Keep messagesRef updated to read inside callbacks
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Connect and manage WebSocket lifecycle cleanly (prevents StrictMode double connection)
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
      const wsUrl = "ws://localhost:8001/api/v1/ws";
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
                  mediaUrl: mediaUrl || last.mediaUrl,
                  mediaType: mediaType || last.mediaType
                };
              }
              return list;
            });
          } else if (message.event === "done") {
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const list = [...prev];
              const idx = list.length - 1;
              const last = list[idx];
              if (last && last.role === "assistant") {
                list[idx] = {
                  ...last,
                  isStreaming: false
                };
              }
              return list;
            });
            setIsLoading(false);
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
                  mediaUrl: mediaUrl || last.mediaUrl,
                  mediaType: mediaType || last.mediaType,
                  isStreaming: false
                };
              }
              return list;
            });
            setIsLoading(false);
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
  }, [connectionType]);

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
        image_url: m.mediaUrl && m.mediaType === "image" ? m.mediaUrl : undefined
      }));
      
      // Add the new user message
      history.push({
        role: "user",
        content: userText,
        image_url: imageBase64 || undefined
      });

      const response = await fetch(`http://localhost:8001/api/v1/${endpoint}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          stream: true,
          temperature: 0.7,
          model: endpoint === "text-to-text" ? modelName : undefined
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
        // Keep the last partial line in buffer
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
            break;
          }

          try {
            const parsed = JSON.parse(rawData);
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
                  mediaUrl: mediaUrl || last.mediaUrl,
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
      
      // Append temporary streaming card
      const assistantMsgId = `assistant-ws-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "assistant", content: "", isStreaming: true }
      ]);

      const history = updatedMessages.map(m => ({
        role: m.role,
        content: m.content,
        image_url: m.mediaUrl && m.mediaType === "image" ? m.mediaUrl : undefined
      }));

      socketRef.current.send(JSON.stringify({
        type: endpoint,
        payload: {
          messages: history,
          stream: true,
          temperature: 0.7,
          model: endpoint === "text-to-text" ? modelName : undefined
        }
      }));
    }
  }, [messages, endpoint, connectionType, modelName]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setIsLoading(false);
  }, []);

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
    setModelName
  };
}
