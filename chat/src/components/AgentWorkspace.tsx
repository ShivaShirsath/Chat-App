import { useState, useEffect, useRef } from "react";
import { 
  Folder, 
  Square, 
  Check, 
  AlertCircle, 
  Cpu,
  FileCode,
  Terminal as TerminalIcon,
  ChevronDown,
  ChevronRight,
  X,
  Send,
  Loader2
} from "lucide-react";
import type { OllamaModel } from "../types/chat";
import { API_BASE_URL, WS_BASE_URL } from "../utils/api";

interface AgentWorkspaceProps {
  modelName: string;
  setModelName: (val: string) => void;
  models: OllamaModel[];
}

interface FileDiffs {
  [filename: string]: string;
}

interface PermissionRequest {
  question: string;
  options: string[];
  answeredChoice?: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  thinkingTime?: number;
  thoughts?: string[];
  terminalLogs?: string;
  diffs?: FileDiffs;
  permissionRequest?: PermissionRequest;
  isStreaming?: boolean;
}

export default function AgentWorkspace({ modelName, setModelName, models }: AgentWorkspaceProps) {
  const [folderPath, setFolderPath] = useState(() => localStorage.getItem("agent-folder-path") || "");
  const [promptText, setPromptText] = useState("");
  const [isValidated, setIsValidated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  
  // Chat History
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // Running state
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [openThinkingId, setOpenThinkingId] = useState<string | null>(null);

  // Overlay Diffs Drawer state
  const [drawerOpenFile, setDrawerOpenFile] = useState<string | null>(null);
  const [drawerDiffs, setDrawerDiffs] = useState<FileDiffs>({});
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Cache folder path in local storage
  useEffect(() => {
    localStorage.setItem("agent-folder-path", folderPath);
    if (folderPath.trim()) {
      validateSpecificPath(folderPath.trim(), false);
    }
  }, [folderPath]);

  // Timer for execution duration
  useEffect(() => {
    if (isRunning) {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isRunning]);

  const validateSpecificPath = async (path: string, showSuccess = true) => {
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
  };

  const handleSelectFolder = async () => {
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
  };

  const handleSendPrompt = () => {
    if (!promptText.trim() || !isValidated || isRunning) return;

    const currentPrompt = promptText.trim();
    setPromptText("");
    setIsRunning(true);

    // 1. Add User Message
    const userMsgId = `user-${Date.now()}`;
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: currentPrompt
    };

    // 2. Add Pending Agent Message
    const agentMsgId = `agent-${Date.now()}`;
    const newAgentMsg: ChatMessage = {
      id: agentMsgId,
      sender: "agent",
      text: "",
      thoughts: ["Connecting to agent loop..."],
      terminalLogs: "",
      diffs: {},
      isStreaming: true
    };

    setChatMessages((prev) => [...prev, newUserMsg, newAgentMsg]);

    // 3. Establish WebSocket connection
    const wsUrl = `${WS_BASE_URL}/api/v1/agent/run`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({
        folder_path: folderPath.trim(),
        instruction: currentPrompt,
        model_name: modelName
      }));
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        setChatMessages((prev) => {
          const list = [...prev];
          const idx = list.findIndex(m => m.id === agentMsgId);
          if (idx === -1) return prev;
          const msg = { ...list[idx] };

          if (message.type === "thought") {
            msg.thoughts = [...(msg.thoughts || []), message.content];
          } else if (message.type === "terminal") {
            msg.terminalLogs = (msg.terminalLogs || "") + message.content;
          } else if (message.type === "diff") {
            msg.diffs = message.diffs || {};
          } else if (message.type === "permission_request") {
            msg.permissionRequest = {
              question: message.question,
              options: message.options || ["Yes", "No"]
            };
          } else if (message.type === "done") {
            msg.text = message.summary;
            msg.isStreaming = false;
            msg.thinkingTime = elapsedTime;
            setIsRunning(false);
            socket.close();
            validateSpecificPath(folderPath.trim(), false); // Refresh files tree
          } else if (message.type === "error") {
            msg.text = `Error: ${message.message}`;
            msg.isStreaming = false;
            msg.thinkingTime = elapsedTime;
            setIsRunning(false);
            socket.close();
          }

          list[idx] = msg;
          return list;
        });
      } catch (err) {
        console.error("Failed to parse agent socket message:", err);
      }
    };

    socket.onclose = () => {
      setIsRunning(false);
      setChatMessages((prev) => {
        const list = [...prev];
        const idx = list.findIndex(m => m.id === agentMsgId);
        if (idx !== -1 && list[idx].isStreaming) {
          list[idx].isStreaming = false;
          list[idx].thinkingTime = elapsedTime;
        }
        return list;
      });
    };

    socket.onerror = (err) => {
      console.error("Agent socket error:", err);
      setIsRunning(false);
      setChatMessages((prev) => {
        const list = [...prev];
        const idx = list.findIndex(m => m.id === agentMsgId);
        if (idx !== -1) {
          list[idx].text = "Error: Connection lost or server error occurred.";
          list[idx].isStreaming = false;
          list[idx].thinkingTime = elapsedTime;
        }
        return list;
      });
    };
  };

  const handleSendPermissionChoice = (agentMsgId: string, choice: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "permission_response",
        choice: choice
      }));

      // Update the chat message to mark the selection
      setChatMessages((prev) => {
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
  };

  const handleStopAgent = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    setIsRunning(false);
  };

  const openDiffReview = (filename: string, fileDiffs: FileDiffs) => {
    setDrawerDiffs(fileDiffs);
    setSelectedDiffFile(filename);
    setDrawerOpenFile(filename);
  };

  const renderDiffLine = (line: string, index: number) => {
    let bgColor = "text-muted-foreground";
    if (line.startsWith("+") && !line.startsWith("+++")) {
      bgColor = "bg-primary/10 text-primary border-l-2 border-primary/70 px-2";
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      bgColor = "bg-destructive/10 text-destructive border-l-2 border-destructive/70 px-2";
    } else if (line.startsWith("@@")) {
      bgColor = "text-primary bg-primary/10 font-bold px-2";
    } else if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) {
      bgColor = "text-muted-foreground font-semibold px-2";
    } else {
      bgColor = "text-foreground px-2";
    }

    return (
      <div key={index} className={`font-mono text-xs py-0.5 whitespace-pre-wrap select-text ${bgColor}`}>
        {line}
      </div>
    );
  };

  // Get project folder base name for prompt select header
  const projectFolderBaseName = folderPath.trim() 
    ? folderPath.split("/").pop() || folderPath
    : "Select Project";

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden relative font-sans">
      
      {/* 1. CHAT MESSAGE AREA */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scroll-smooth select-text bg-background/30">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-8">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
              <Cpu className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Local Coding Agent workspace</h2>
            <p className="text-xs text-muted-foreground max-w-sm">
              Please choose a workspace folder, select your local Ollama model, and describe the task you want the agent to build.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {chatMessages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  
                  {/* Message Bubble Container */}
                  <div className={`max-w-[85%] rounded-2xl p-4 leading-relaxed ${
                    isUser 
                      ? "bg-muted/90 border border-border text-foreground shadow-md" 
                      : "bg-background/80 border border-border text-foreground shadow-lg"
                  }`}>
                    
                    {/* User Header or Agent Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-5 w-5 rounded flex items-center justify-center ${
                        isUser ? "bg-primary" : "bg-primary"
                      }`}>
                        <Cpu className="h-3 w-3 text-primary-foreground" />
                      </div>
                      <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                        {isUser ? "You" : "Coder Agent"}
                      </span>
                    </div>

                    {/* USER PROMPT TEXT */}
                    {isUser && <p className="text-xs whitespace-pre-wrap">{msg.text}</p>}

                    {/* AGENT COMPONENT RENDER */}
                    {!isUser && (
                      <div className="space-y-4">
                        
                        {/* A. Collapsible Faded Thinking Block */}
                        {(msg.thoughts && msg.thoughts.length > 0) && (
                          <div className="border border-border rounded-xl overflow-hidden bg-muted/30">
                            <button
                              onClick={() => setOpenThinkingId(openThinkingId === msg.id ? null : msg.id)}
                              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-muted-foreground hover:text-muted-foreground transition-all cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5 font-mono">
                                <Loader2 className={`h-3 w-3 text-primary ${msg.isStreaming ? "animate-spin" : ""}`} />
                                {msg.isStreaming 
                                  ? `Thinking... (${elapsedTime}s)` 
                                  : `Worked for ${msg.thinkingTime || 0}s`
                                }
                              </span>
                              {openThinkingId === msg.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>

                            {openThinkingId === msg.id && (
                              <div className="border-t border-border p-3 bg-muted/50 space-y-3">
                                {/* Steps Thoughts list */}
                                <div className="space-y-1.5">
                                  {msg.thoughts.map((thought, tidx) => (
                                    <div key={tidx} className="text-[11px] text-muted-foreground leading-normal border-l border-border pl-2 py-0.5">
                                      {thought}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Terminal Command Logs - Always visible outside thinking */}
                        {msg.terminalLogs && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                              <TerminalIcon className="h-3 w-3" />
                              Shell Command Logs
                            </div>
                            <div className="p-2.5 rounded bg-background/60 font-mono text-[10px] text-primary border border-border overflow-x-auto max-h-[180px] whitespace-pre-wrap">
                              {msg.terminalLogs}
                            </div>
                          </div>
                        )}

                        {/* B. Final Text Response */}
                        {msg.text && (
                          <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap border-l border-primary/20 pl-3">
                            {msg.text}
                          </p>
                        )}

                        {/* C. Dynamic Permission Request Card */}
                        {msg.permissionRequest && (
                          <div className="p-3.5 bg-primary/10 border border-primary/30 rounded-xl space-y-3 shadow shadow-primary/5">
                            <div className="flex items-start gap-2.5">
                              <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Clarification Required</p>
                                <p className="text-xs text-foreground">{msg.permissionRequest.question}</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 pt-1 pl-6.5">
                              {msg.permissionRequest.options.map((opt) => {
                                const isSelected = msg.permissionRequest?.answeredChoice === opt;
                                const hasAnswered = !!msg.permissionRequest?.answeredChoice;
                                return (
                                  <button
                                    key={opt}
                                    disabled={hasAnswered}
                                    onClick={() => handleSendPermissionChoice(msg.id, opt)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                      isSelected
                                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                        : hasAnswered
                                        ? "bg-transparent border-border text-muted-foreground cursor-not-allowed"
                                        : "bg-card border-border text-foreground hover:text-primary-foreground hover:border-primary/60 hover:bg-accent cursor-pointer"
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* D. Files Changed Summary Card */}
                        {msg.diffs && Object.keys(msg.diffs).length > 0 && (
                          <div className="flex items-center justify-between bg-muted/50 border border-border rounded-xl p-3.5 shadow-md">
                            <div className="flex items-center gap-2.5">
                              <FileCode className="h-4 w-4 text-primary" />
                              <div>
                                <p className="text-xs text-foreground font-semibold">
                                  {Object.keys(msg.diffs).length} file{Object.keys(msg.diffs).length > 1 ? "s" : ""} modified
                                </p>
                                <p className="text-[10px] text-muted-foreground">Unified code diffs generated</p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const firstFile = Object.keys(msg.diffs || {})[0];
                                openDiffReview(firstFile, msg.diffs || {});
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-[10px] font-bold hover:bg-primary/25 transition-all cursor-pointer uppercase tracking-wider"
                            >
                              Review
                            </button>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Loading Indicator for Agent */}
            {isRunning && !chatMessages[chatMessages.length - 1]?.text && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Agent is writing code and executing commands...
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* 2. FLOATING PROMPTER BAR */}
      <div className="p-6 border-t border-border bg-background/80 backdrop-blur-md shrink-0 flex justify-center">
        <div className="w-full max-w-2xl flex flex-col space-y-2.5">
          
          {/* Target Project Dropdown above prompt bar */}
          <div className="flex justify-start">
            <button
              onClick={handleSelectFolder}
              disabled={isRunning || isValidating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-[10px] font-bold text-muted-foreground hover:text-primary-foreground transition-all cursor-pointer shadow-sm uppercase tracking-wider"
            >
              {isValidating ? (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              ) : (
                <Folder className="h-3.5 w-3.5 text-primary" />
              )}
              Project: <span className="text-primary font-semibold">{projectFolderBaseName}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            
            {isValidated && (
              <span className="flex items-center gap-1 text-[9px] text-primary font-bold ml-2 bg-primary/10 px-2.5 py-1 rounded-full border border-primary/30">
                <Check className="h-3 w-3" />
                Indexed {files.length} Files
              </span>
            )}
            {validationError && (
              <span className="flex items-center gap-1 text-[9px] text-destructive font-bold ml-2 bg-destructive/10 px-2.5 py-1 rounded-full border border-destructive/30">
                <AlertCircle className="h-3 w-3" />
                Error Path
              </span>
            )}
          </div>

          {/* Prompt Box container */}
          <div className={`bg-card border rounded-2xl p-2.5 transition-all flex flex-col relative ${
            isRunning 
              ? "border-primary/20" 
              : "border-border focus-within:border-primary/50 focus-within:shadow-[0_0_15px_rgba(139,92,246,0.06)]"
          }`}>
            
            {/* Input textarea */}
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendPrompt();
                }
              }}
              placeholder="Ask anything, @ to mention, / for actions"
              disabled={isRunning || !isValidated}
              rows={2}
              className="w-full bg-transparent px-3 py-2 text-xs outline-none text-foreground placeholder-gray-600 resize-none leading-relaxed"
            />

            {/* Bottom Actions toolbar */}
            <div className="flex items-center justify-between border-t border-border/60 pt-2 px-1">
              
              {/* Left Pills (Model selection, Location context) */}
              <div className="flex items-center gap-2">
                
                {/* Model pill selector */}
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  disabled={isRunning}
                  className="bg-card border border-border rounded-full px-3 py-1 text-[9px] text-muted-foreground font-semibold focus:outline-none hover:border-primary/40 cursor-pointer shadow-sm max-w-[150px] truncate"
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.friendly_label}</option>
                  ))}
                </select>

                {/* Local environment context pill */}
                <span className="flex items-center gap-1 bg-card border border-border rounded-full px-3 py-1 text-[9px] text-muted-foreground font-semibold shadow-sm select-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Local Environment
                </span>

              </div>

              {/* Right Send/Stop actions */}
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <button
                    onClick={handleStopAgent}
                    className="p-2 rounded-xl bg-destructive/15 border border-destructive/20 hover:bg-destructive/25 text-destructive transition-all flex items-center justify-center cursor-pointer shadow-sm"
                    title="Stop running agent"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={handleSendPrompt}
                    disabled={!promptText.trim() || !isValidated}
                    className="p-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-35 disabled:bg-muted disabled:text-muted-foreground shadow-md shadow-primary/10 hover:shadow-primary/35 transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* 3. OVERLAY SIDE-DRAWER CODE DIFF REVIEW */}
      {drawerOpenFile && (
        <div className="absolute inset-0 z-50 flex overflow-hidden">
          
          {/* Backdrop */}
          <div 
            onClick={() => setDrawerOpenFile(null)}
            className="absolute inset-0 bg-background/75 backdrop-blur-sm transition-opacity" 
          />

          {/* Drawer Panel */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-card border-l border-border flex flex-col shadow-2xl animate-slide-in select-text">
            
            {/* Header */}
            <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-card shrink-0">
              <div className="flex items-center gap-3">
                <FileCode className="h-4.5 w-4.5 text-primary" />
                <span className="text-xs font-bold text-foreground">Review Code Modifications</span>
              </div>
              
              <button 
                onClick={() => setDrawerOpenFile(null)}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-primary-foreground transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Active selectors toolbar */}
            <div className="h-11 border-b border-border px-6 flex items-center justify-between bg-muted shrink-0 text-xs text-muted-foreground">
              <span>File changed list:</span>
              
              <select
                value={selectedDiffFile || ""}
                onChange={(e) => setSelectedDiffFile(e.target.value)}
                className="py-1 px-2.5 rounded-md text-[10px] bg-card border border-border text-primary cursor-pointer focus:outline-none max-w-[250px] truncate"
              >
                {Object.keys(drawerDiffs).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Diff content view */}
            <div className="flex-1 overflow-auto p-6 bg-background/60">
              {selectedDiffFile && drawerDiffs[selectedDiffFile] ? (
                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  <div className="bg-secondary border-b border-border px-4 py-2 text-[10px] font-mono text-muted-foreground">
                    {selectedDiffFile}
                  </div>
                  <div className="py-3 overflow-x-auto">
                    {drawerDiffs[selectedDiffFile].split("\n").map((line, idx) => renderDiffLine(line, idx))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic text-center py-24 select-none">
                  No diff records loaded for this file.
                </div>
              )}
            </div>

            {/* Bottom Accept panel */}
            <div className="h-16 border-t border-border px-6 flex items-center justify-end bg-card shrink-0">
              <button
                onClick={() => setDrawerOpenFile(null)}
                className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-all cursor-pointer shadow-md uppercase tracking-wider"
              >
                Done Review
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
