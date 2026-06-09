import { useState } from "react";
import { copyToClipboard } from "../utils/clipboard";
import { 
  MessageSquare, 
  Image as ImageIcon, 
  Sparkles, 
  Video, 
  Trash2, 
  Radio, 
  Zap, 
  Terminal,
  Plus,
  Copy,
  Check,
  Cpu
} from "lucide-react";
import type { ModelEndpoint, ConnectionType, ActiveTab, ChatSession, Message, OllamaModel } from "../types/chat";

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  connectionType: ConnectionType;
  setConnectionType: (type: ConnectionType) => void;
  wsStatus: "disconnected" | "connecting" | "connected";
  endpoint: ModelEndpoint;
  setEndpoint: (ep: ModelEndpoint) => void;
  modelName: string;
  setModelName: (name: string) => void;
  clearChat: () => void;
  messages: Message[];
  
  // persistence props
  sessionId: string | null;
  sessions: ChatSession[];
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
  createNewChat: () => void;
  
  // Theme settings props
  codeTheme: string;
  setCodeTheme: (theme: string) => void;

  // Dynamic Ollama models
  models: OllamaModel[];
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  connectionType,
  setConnectionType,
  wsStatus,
  endpoint,
  setEndpoint,
  modelName,
  setModelName,
  clearChat,
  messages,
  
  // persistence props
  sessionId,
  sessions,
  loadSession,
  deleteSession,
  createNewChat,

  // Theme settings props
  codeTheme,
  setCodeTheme,

  // Dynamic Ollama models
  models
}: SidebarProps) {
  const [chatCopied, setChatCopied] = useState(false);

  // Group models by tier category
  const groupedModels = models.reduce((acc, model) => {
    const tier = model.tier || "Other Models";
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(model);
    return acc;
  }, {} as Record<string, OllamaModel[]>);

  const tiersOrder = [
    "Ultra-Lightweight / Fast",
    "Balanced / Lightweight",
    "Standard / Capable",
    "Large / Advanced"
  ];
  const otherTiers = Object.keys(groupedModels).filter(t => !tiersOrder.includes(t));
  const allTiers = [...tiersOrder, ...otherTiers];

  const handleCopyChat = async () => {
    if (messages.length === 0) return;
    const formatted = messages
      .map(m => `### ${m.role === "user" ? "User" : "Assistant"}\n\n${m.content}`)
      .join("\n\n---\n\n");
    const success = await copyToClipboard(formatted);
    if (success) {
      setChatCopied(true);
      setTimeout(() => setChatCopied(false), 2000);
    }
  };
  return (
    <div className="w-[300px] border-r border-[#1a1c23] bg-[#0b0c11] flex flex-col shrink-0">
      
      {/* LOGO */}
      <div className="p-6 border-b border-[#1a1c23] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
              Multimodal Hub
            </h1>
            <p className="text-xs text-gray-500">FastAPI Gateway</p>
          </div>
        </div>
        
        {/* NEW CHAT BUTTON */}
        <button
          onClick={createNewChat}
          className="h-8 w-8 rounded-lg bg-[#14151f] border border-[#2b2d3c] hover:bg-[#1e202f] hover:text-white flex items-center justify-center text-indigo-300 transition-all"
          title="New Conversation"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* NAVIGATION CARD */}
      <div className="p-4 border-b border-[#1a1c23] space-y-2">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
          Workspace Nav
        </label>
        <div className="space-y-1">
          <button
            onClick={() => setActiveTab("chat")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
              activeTab === "chat"
                ? "bg-violet-600/15 border border-violet-500/30 text-violet-300"
                : "bg-transparent text-gray-400 hover:bg-[#14151b] hover:text-white"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Chat workspace
          </button>
          <button
            onClick={() => setActiveTab("readme")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
              activeTab === "readme"
                ? "bg-violet-600/15 border border-violet-500/30 text-violet-300"
                : "bg-transparent text-gray-400 hover:bg-[#14151b] hover:text-white"
            }`}
          >
            <Terminal className="h-4 w-4" />
            Readme Doc Viewer
          </button>
          <button
            onClick={() => setActiveTab("agent")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
              activeTab === "agent"
                ? "bg-violet-600/15 border border-violet-500/30 text-violet-300"
                : "bg-transparent text-gray-400 hover:bg-[#14151b] hover:text-white"
            }`}
          >
            <Cpu className="h-4 w-4" />
            Agent workspace
          </button>
        </div>
      </div>

      {/* CONNECTION SETTINGS */}
      <div className="p-4 border-b border-[#1a1c23] space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
            Protocol Selector
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#14151b] rounded-lg border border-[#1e202b]">
            <button
              onClick={() => setConnectionType("websocket")}
              className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                connectionType === "websocket"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              WebSockets
            </button>
            <button
              onClick={() => setConnectionType("http-sse")}
              className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                connectionType === "http-sse"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              HTTP (SSE)
            </button>
          </div>
        </div>

        {/* STATUS BLOCK */}
        <div className="flex items-center justify-between bg-[#14151b] p-3 rounded-lg border border-[#1e202b]">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-gray-500" />
            Gateway Status
          </span>
          <div className="flex items-center gap-1.5">
            {connectionType === "websocket" ? (
              <>
                <span className={`h-2 w-2 rounded-full ${
                  wsStatus === "connected" 
                    ? "bg-emerald-500 animate-pulse" 
                    : wsStatus === "connecting"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-red-500"
                }`} />
                <span className="text-xs font-semibold text-gray-300 uppercase">
                  {wsStatus}
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-gray-300 uppercase">
                  HTTP Ready
                </span>
              </>
            )}
          </div>
        </div>

        {/* OLLAMA MODEL SELECTOR */}
        {endpoint === "text-to-text" && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
              Active Ollama Model
            </label>
            <select
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-[#14151b] border border-[#1e202b] text-indigo-300 focus:outline-none focus:border-violet-500/50 transition-all cursor-pointer"
            >
              {models.length === 0 ? (
                <>
                  <option value="llama3.2:latest">Llama 3.2 (3B, Q4_K_M) - Fast & Accurate</option>
                  <option value="llama3.2:1b">Llama 3.2 (1B, Q8_0) - Ultra Fast</option>
                  <option value="sadiq-bd/llama3.2-3b-uncensored">Llama 3.2 Uncensored (3B, Q4) - Light & Uncensored</option>
                  <option value="sadiq-bd/llama3.2-1b-uncensored">Llama 3.2 Uncensored (1B, Q4) - Fast & Uncensored</option>
                  <option value="phi3.5">Phi 3.5 (3.8B) - Lightweight & Strong</option>
                  <option value="qwen2.5:0.5b">Qwen 2.5 (0.5B) - Extremely Lightweight</option>
                </>
              ) : (
                allTiers.map((tier) => {
                  const group = groupedModels[tier];
                  if (!group || group.length === 0) return null;
                  return (
                    <optgroup key={tier} label={tier} className="bg-[#14151b] text-gray-500 font-bold text-[10px] uppercase tracking-wider">
                      {group.map((model) => (
                        <option key={model.id} value={model.id} className="text-indigo-300 bg-[#14151b] font-medium text-xs normal-case tracking-normal">
                          {model.friendly_label}
                        </option>
                      ))}
                    </optgroup>
                  );
                })
              )}
            </select>
          </div>
        )}

        {/* CODE THEME SELECTOR */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
            Code Block Theme
          </label>
          <select
            value={codeTheme}
            onChange={(e) => setCodeTheme(e.target.value)}
            className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-[#14151b] border border-[#1e202b] text-indigo-300 focus:outline-none focus:border-violet-500/50 transition-all cursor-pointer"
          >
            <option value="tomorrow">Tomorrow (Dark Classic)</option>
            <option value="okaidia">Okaidia (High Contrast)</option>
            <option value="twilight">Twilight (Retro Muted)</option>
            <option value="default">Default (Light/Original)</option>
          </select>
        </div>
      </div>

      {/* CHAT SESSION HISTORY */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 border-b border-[#1a1c23]">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
            Chat History persisted
          </label>
          {sessions.length === 0 ? (
            <div className="text-[10px] text-gray-600 text-center py-4 italic">
              No saved threads. Start typing to persist.
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((sess) => {
                const isActive = sess.id === sessionId;
                return (
                  <div
                    key={sess.id}
                    className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive 
                        ? "bg-violet-600/10 border border-violet-500/30 text-violet-300 font-semibold" 
                        : "text-gray-400 hover:bg-[#14151b] hover:text-white"
                    }`}
                  >
                    <button
                      onClick={() => loadSession(sess.id)}
                      className="flex-1 text-left truncate pr-2"
                      title={sess.title}
                    >
                      {sess.title}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(sess.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-500 hover:text-red-400 transition-opacity"
                      title="Delete Thread"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ENDPOINTS / MODELS */}
      <div className="h-[200px] overflow-y-auto p-4 space-y-4 shrink-0">
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
            Endpoints / Models
          </label>
          <div className="space-y-1.5">
            
            {/* Text to Text */}
            <button
              onClick={() => setEndpoint("text-to-text")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left ${
                endpoint === "text-to-text"
                  ? "bg-violet-600/15 border border-violet-500/40 text-violet-300"
                  : "bg-transparent border border-transparent text-gray-400 hover:bg-[#14151b] hover:text-white"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <div className="flex-1 truncate">
                <p className="font-medium">text-to-text/chat</p>
              </div>
            </button>

            {/* Text to Image */}
            <button
              onClick={() => setEndpoint("text-to-image")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left ${
                endpoint === "text-to-image"
                  ? "bg-violet-600/15 border border-violet-500/40 text-violet-300"
                  : "bg-transparent border border-transparent text-gray-400 hover:bg-[#14151b] hover:text-white"
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              <div className="flex-1 truncate">
                <p className="font-medium">text-to-image/chat</p>
              </div>
            </button>

            {/* Text & Image to Image */}
            <button
              onClick={() => setEndpoint("text-and-image-to-image")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left ${
                endpoint === "text-and-image-to-image"
                  ? "bg-violet-600/15 border border-violet-500/40 text-violet-300"
                  : "bg-transparent border border-transparent text-gray-400 hover:bg-[#14151b] hover:text-white"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <div className="flex-1 truncate">
                <p className="font-medium">text-image-to-image</p>
              </div>
            </button>

            {/* Text to Video */}
            <button
              onClick={() => setEndpoint("text-to-video")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left ${
                endpoint === "text-to-video"
                  ? "bg-violet-600/15 border border-violet-500/40 text-violet-300"
                  : "bg-transparent border border-transparent text-gray-400 hover:bg-[#14151b] hover:text-white"
              }`}
            >
              <Video className="h-4 w-4" />
              <div className="flex-1 truncate">
                <p className="font-medium">text-to-video/chat</p>
              </div>
            </button>

          </div>
        </div>
      </div>

      {/* BOTTOM UTILS */}
      <div className="p-4 border-t border-[#1a1c23] space-y-2 shrink-0">
        {messages.length > 0 && (
          <button
            onClick={handleCopyChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-[#2b2d3c] bg-[#14151f] text-indigo-300 hover:bg-[#1e202f] hover:text-white transition-all cursor-pointer"
          >
            {chatCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Copied Conversation!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Conversation
              </>
            )}
          </button>
        )}
        <button
          onClick={clearChat}
          disabled={messages.length === 0}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-red-500/30 text-red-400 hover:bg-red-950/20 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear Conversation
        </button>
      </div>

    </div>
  );
}
