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
      const res = await fetch("http://localhost:8001/api/v1/agent/validate-path", {
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
      const res = await fetch("http://localhost:8001/api/v1/agent/select-folder", {
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
    const wsUrl = "ws://localhost:8001/api/v1/agent/run";
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
    let bgColor = "text-gray-400";
    if (line.startsWith("+") && !line.startsWith("+++")) {
      bgColor = "bg-emerald-950/30 text-emerald-400 border-l-2 border-emerald-500/80 px-2";
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      bgColor = "bg-rose-950/30 text-rose-400 border-l-2 border-rose-500/80 px-2";
    } else if (line.startsWith("@@")) {
      bgColor = "text-indigo-400 bg-indigo-950/10 font-bold px-2";
    } else if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) {
      bgColor = "text-gray-500 font-semibold px-2";
    } else {
      bgColor = "text-gray-300 px-2";
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
    <div className="flex-1 flex flex-col bg-[#07080b] h-full overflow-hidden relative font-sans">
      
      {/* 1. CHAT MESSAGE AREA */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scroll-smooth select-text bg-[#07080c]/30">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-8">
            <div className="h-12 w-12 rounded-2xl bg-violet-600/10 flex items-center justify-center border border-violet-500/20 shadow-lg shadow-violet-500/5">
              <Cpu className="h-6 w-6 text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-200">Local Coding Agent workspace</h2>
            <p className="text-xs text-gray-500 max-w-sm">
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
                      ? "bg-[#1f2130]/90 border border-[#2b2d3c] text-gray-200 shadow-md" 
                      : "bg-[#0b0c11]/80 border border-[#1a1c25] text-gray-300 shadow-lg"
                  }`}>
                    
                    {/* User Header or Agent Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-5 w-5 rounded flex items-center justify-center ${
                        isUser ? "bg-indigo-600" : "bg-violet-600"
                      }`}>
                        <Cpu className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-[10px] font-bold tracking-wider uppercase text-gray-500">
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
                          <div className="border border-[#1a1c26] rounded-xl overflow-hidden bg-[#12131b]/30">
                            <button
                              onClick={() => setOpenThinkingId(openThinkingId === msg.id ? null : msg.id)}
                              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-gray-500 hover:text-gray-400 transition-all cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5 font-mono">
                                <Loader2 className={`h-3 w-3 text-violet-400 ${msg.isStreaming ? "animate-spin" : ""}`} />
                                {msg.isStreaming 
                                  ? `Thinking... (${elapsedTime}s)` 
                                  : `Worked for ${msg.thinkingTime || 0}s`
                                }
                              </span>
                              {openThinkingId === msg.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>

                            {openThinkingId === msg.id && (
                              <div className="border-t border-[#1a1c26] p-3 bg-[#0d0e14]/50 space-y-3">
                                {/* Steps Thoughts list */}
                                <div className="space-y-1.5">
                                  {msg.thoughts.map((thought, tidx) => (
                                    <div key={tidx} className="text-[11px] text-gray-400 leading-normal border-l border-[#242637] pl-2 py-0.5">
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
                            <div className="flex items-center gap-1 text-[9px] font-bold text-gray-600 uppercase tracking-wider">
                              <TerminalIcon className="h-3 w-3" />
                              Shell Command Logs
                            </div>
                            <div className="p-2.5 rounded bg-black/60 font-mono text-[10px] text-emerald-400 border border-[#161722] overflow-x-auto max-h-[180px] whitespace-pre-wrap">
                              {msg.terminalLogs}
                            </div>
                          </div>
                        )}

                        {/* B. Final Text Response */}
                        {msg.text && (
                          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap border-l border-violet-500/20 pl-3">
                            {msg.text}
                          </p>
                        )}

                        {/* C. Dynamic Permission Request Card */}
                        {msg.permissionRequest && (
                          <div className="p-3.5 bg-amber-950/10 border border-amber-900/30 rounded-xl space-y-3 shadow shadow-amber-900/5">
                            <div className="flex items-start gap-2.5">
                              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Clarification Required</p>
                                <p className="text-xs text-gray-300">{msg.permissionRequest.question}</p>
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
                                        ? "bg-amber-600 border-amber-500 text-white shadow-sm"
                                        : hasAnswered
                                        ? "bg-transparent border-[#1a1c26] text-gray-600 cursor-not-allowed"
                                        : "bg-[#181923] border-[#2b2d3c] text-gray-300 hover:text-white hover:border-gray-500 hover:bg-[#202230] cursor-pointer"
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
                          <div className="flex items-center justify-between bg-[#12131b]/50 border border-[#1a1c26] rounded-xl p-3.5 shadow-md">
                            <div className="flex items-center gap-2.5">
                              <FileCode className="h-4 w-4 text-emerald-400" />
                              <div>
                                <p className="text-xs text-gray-200 font-semibold">
                                  {Object.keys(msg.diffs).length} file{Object.keys(msg.diffs).length > 1 ? "s" : ""} modified
                                </p>
                                <p className="text-[10px] text-gray-500">Unified code diffs generated</p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const firstFile = Object.keys(msg.diffs || {})[0];
                                openDiffReview(firstFile, msg.diffs || {});
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold hover:bg-emerald-600/25 transition-all cursor-pointer uppercase tracking-wider"
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
                <div className="flex items-center gap-2 text-xs text-gray-500 italic">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                  Agent is writing code and executing commands...
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* 2. FLOATING PROMPTER BAR */}
      <div className="p-6 border-t border-[#1a1c23] bg-[#0b0c11]/80 backdrop-blur-md shrink-0 flex justify-center">
        <div className="w-full max-w-2xl flex flex-col space-y-2.5">
          
          {/* Target Project Dropdown above prompt bar */}
          <div className="flex justify-start">
            <button
              onClick={handleSelectFolder}
              disabled={isRunning || isValidating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#12131b] border border-[#1e202b] text-[10px] font-bold text-gray-400 hover:text-white transition-all cursor-pointer shadow-sm uppercase tracking-wider"
            >
              {isValidating ? (
                <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
              ) : (
                <Folder className="h-3.5 w-3.5 text-indigo-400" />
              )}
              Project: <span className="text-indigo-300 font-semibold">{projectFolderBaseName}</span>
              <ChevronDown className="h-3 w-3 text-gray-500" />
            </button>
            
            {isValidated && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold ml-2 bg-emerald-950/10 px-2.5 py-1 rounded-full border border-emerald-950/30">
                <Check className="h-3 w-3" />
                Indexed {files.length} Files
              </span>
            )}
            {validationError && (
              <span className="flex items-center gap-1 text-[9px] text-red-400 font-bold ml-2 bg-red-950/10 px-2.5 py-1 rounded-full border border-red-950/30">
                <AlertCircle className="h-3 w-3" />
                Error Path
              </span>
            )}
          </div>

          {/* Prompt Box container */}
          <div className={`bg-[#13141b] border rounded-2xl p-2.5 transition-all flex flex-col relative ${
            isRunning 
              ? "border-violet-500/20" 
              : "border-[#1e202b] focus-within:border-violet-500/50 focus-within:shadow-[0_0_15px_rgba(139,92,246,0.06)]"
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
              className="w-full bg-transparent px-3 py-2 text-xs outline-none text-gray-100 placeholder-gray-600 resize-none leading-relaxed"
            />

            {/* Bottom Actions toolbar */}
            <div className="flex items-center justify-between border-t border-[#1a1c26]/60 pt-2 px-1">
              
              {/* Left Pills (Model selection, Location context) */}
              <div className="flex items-center gap-2">
                
                {/* Model pill selector */}
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  disabled={isRunning}
                  className="bg-[#181923] border border-[#232534] rounded-full px-3 py-1 text-[9px] text-gray-400 font-semibold focus:outline-none hover:border-violet-500/40 cursor-pointer shadow-sm max-w-[150px] truncate"
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.friendly_label}</option>
                  ))}
                </select>

                {/* Local environment context pill */}
                <span className="flex items-center gap-1 bg-[#181923] border border-[#232534] rounded-full px-3 py-1 text-[9px] text-gray-400 font-semibold shadow-sm select-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Local Environment
                </span>

              </div>

              {/* Right Send/Stop actions */}
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <button
                    onClick={handleStopAgent}
                    className="p-2 rounded-xl bg-red-650/15 border border-red-500/20 hover:bg-red-650/25 text-red-400 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                    title="Stop running agent"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={handleSendPrompt}
                    disabled={!promptText.trim() || !isValidated}
                    className="p-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-35 disabled:bg-[#1f2130] disabled:text-gray-500 shadow-md shadow-violet-600/10 hover:shadow-violet-600/35 transition-all flex items-center justify-center cursor-pointer"
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
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
          />

          {/* Drawer Panel */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-[#090a10] border-l border-[#1a1c27] flex flex-col shadow-2xl animate-slide-in select-text">
            
            {/* Header */}
            <div className="h-14 border-b border-[#1a1c27] px-6 flex items-center justify-between bg-[#11131a] shrink-0">
              <div className="flex items-center gap-3">
                <FileCode className="h-4.5 w-4.5 text-emerald-400" />
                <span className="text-xs font-bold text-gray-200">Review Code Modifications</span>
              </div>
              
              <button 
                onClick={() => setDrawerOpenFile(null)}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Active selectors toolbar */}
            <div className="h-11 border-b border-[#1a1c27] px-6 flex items-center justify-between bg-[#0e1017] shrink-0 text-xs text-gray-400">
              <span>File changed list:</span>
              
              <select
                value={selectedDiffFile || ""}
                onChange={(e) => setSelectedDiffFile(e.target.value)}
                className="py-1 px-2.5 rounded-md text-[10px] bg-[#1a1c25] border border-[#2b2d3c] text-indigo-300 cursor-pointer focus:outline-none max-w-[250px] truncate"
              >
                {Object.keys(drawerDiffs).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Diff content view */}
            <div className="flex-1 overflow-auto p-6 bg-black/20">
              {selectedDiffFile && drawerDiffs[selectedDiffFile] ? (
                <div className="rounded-xl border border-[#1a1c27] overflow-hidden bg-black/40">
                  <div className="bg-[#141520] border-b border-[#1a1c27] px-4 py-2 text-[10px] font-mono text-gray-400">
                    {selectedDiffFile}
                  </div>
                  <div className="py-3 overflow-x-auto">
                    {drawerDiffs[selectedDiffFile].split("\n").map((line, idx) => renderDiffLine(line, idx))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-600 italic text-center py-24 select-none">
                  No diff records loaded for this file.
                </div>
              )}
            </div>

            {/* Bottom Accept panel */}
            <div className="h-16 border-t border-[#1a1c27] px-6 flex items-center justify-end bg-[#11131a] shrink-0">
              <button
                onClick={() => setDrawerOpenFile(null)}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all cursor-pointer shadow-md uppercase tracking-wider"
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
