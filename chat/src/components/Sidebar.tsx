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
  Sun,
  Moon
} from "lucide-react";
import type { ModelEndpoint, ConnectionType, ActiveTab, ChatSession, Message, OllamaModel, CodeTheme } from "../types/chat";
import { THEMES, useThemeStore, type ThemeId } from "../store/themeStore";
import { codeThemeLabels, lightThemes, darkThemes, getCodeThemeCounterpart } from "../utils/codeThemes";

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
  codeTheme: CodeTheme;
  setCodeTheme: (theme: CodeTheme) => void;

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
  const themeId = useThemeStore((state) => state.themeId);
  const darkMode = useThemeStore((state) => state.darkMode);
  const setTheme = useThemeStore((state) => state.setTheme);
  const setDarkMode = useThemeStore((state) => state.setDarkMode);

  const handleToggleDarkMode = (newDark: boolean) => {
    setDarkMode(newDark);
    const counterpart = getCodeThemeCounterpart(codeTheme, newDark);
    if (counterpart) {
      setCodeTheme(counterpart);
    }
  };

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
    <div className="w-[300px] border-r border-border bg-background flex flex-col shrink-0">
      
      {/* LOGO */}
      <div className="p-6 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Multimodal Hub
            </h1>
            <p className="text-xs text-muted-foreground">FastAPI Gateway</p>
          </div>
        </div>
        
        {/* NEW CHAT BUTTON */}
        <button
          onClick={createNewChat}
          className="h-8 w-8 rounded-lg bg-card border border-border hover:bg-secondary hover:text-foreground flex items-center justify-center text-foreground transition-all cursor-pointer"
          title="New Conversation"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* NAVIGATION CARD */}
      <div className="p-4 border-b border-border space-y-2">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
          Workspace Nav
        </label>
        <div className="space-y-1">
          <button
            onClick={() => setActiveTab("chat")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left cursor-pointer ${
              activeTab === "chat"
                ? "bg-primary/10 border border-primary/30 text-primary"
                : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Chat workspace
          </button>
          <button
            onClick={() => setActiveTab("readme")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left cursor-pointer ${
              activeTab === "readme"
                ? "bg-primary/10 border border-primary/30 text-primary"
                : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Terminal className="h-4 w-4" />
            Readme Doc Viewer
          </button>
        </div>
      </div>

      {/* CONNECTION & APPEARANCE SETTINGS */}
      <div className="p-4 border-b border-border space-y-4 overflow-y-auto max-h-[350px]">
        {/* PROTOCOL SELECTOR */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Protocol Selector
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-card rounded-lg border border-border">
            <button
              onClick={() => setConnectionType("websocket")}
              className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all cursor-pointer ${
                connectionType === "websocket"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              WebSockets
            </button>
            <button
              onClick={() => setConnectionType("http-sse")}
              className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all cursor-pointer ${
                connectionType === "http-sse"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              HTTP (SSE)
            </button>
          </div>
        </div>

        {/* STATUS BLOCK */}
        <div className="flex items-center justify-between bg-card p-3 rounded-lg border border-border">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-muted-foreground" />
            Gateway Status
          </span>
          <div className="flex items-center gap-1.5">
            {connectionType === "websocket" ? (
              <>
                <span className={`h-2 w-2 rounded-full ${
                  wsStatus === "connected" 
                    ? "bg-primary animate-pulse" 
                    : wsStatus === "connecting"
                    ? "bg-primary/70 animate-pulse"
                    : "bg-destructive"
                }`} />
                <span className="text-xs font-semibold text-foreground uppercase">
                  {wsStatus}
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-xs font-semibold text-foreground uppercase">
                  HTTP Ready
                </span>
              </>
            )}
          </div>
        </div>

        {/* APPEARANCE MODE TOGGLER */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Appearance Mode
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-card rounded-lg border border-border">
            <button
              onClick={() => handleToggleDarkMode(false)}
              className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                !darkMode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              Light
            </button>
            <button
              onClick={() => handleToggleDarkMode(true)}
              className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                darkMode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              Dark
            </button>
          </div>
        </div>

        {/* APP COLOR THEME SELECTOR */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            App Color Theme
          </label>
          <select
            value={themeId}
            onChange={(e) => setTheme(e.target.value as ThemeId)}
            className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-card border border-border text-foreground focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
          >
            {THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>{theme.name}</option>
            ))}
          </select>
        </div>

        {/* OLLAMA MODEL SELECTOR */}
        {endpoint === "text-to-text" && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Active Ollama Model
            </label>
            <select
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-card border border-border text-foreground focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
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
                    <optgroup key={tier} label={tier} className="bg-card text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                      {group.map((model) => (
                        <option key={model.id} value={model.id} className="text-foreground bg-card font-medium text-xs normal-case tracking-normal">
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
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Code Block Theme
          </label>
          <select
            value={codeTheme}
            onChange={(e) => setCodeTheme(e.target.value as CodeTheme)}
            className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-card border border-border text-foreground focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
          >
            <option value="adaptive">{codeThemeLabels["adaptive"]}</option>
            {darkMode ? (
              <>
                <optgroup label="Dark Themes" className="bg-card text-muted-foreground font-semibold">
                  {darkThemes.map((option) => (
                    <option key={option} value={option} className="text-foreground font-medium bg-card">
                      {codeThemeLabels[option]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Light Themes" className="bg-card text-muted-foreground font-semibold">
                  {lightThemes.map((option) => (
                    <option key={option} value={option} className="text-foreground font-medium bg-card">
                      {codeThemeLabels[option]}
                    </option>
                  ))}
                </optgroup>
              </>
            ) : (
              <>
                <optgroup label="Light Themes" className="bg-card text-muted-foreground font-semibold">
                  {lightThemes.map((option) => (
                    <option key={option} value={option} className="text-foreground font-medium bg-card">
                      {codeThemeLabels[option]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Dark Themes" className="bg-card text-muted-foreground font-semibold">
                  {darkThemes.map((option) => (
                    <option key={option} value={option} className="text-foreground font-medium bg-card">
                      {codeThemeLabels[option]}
                    </option>
                  ))}
                </optgroup>
              </>
            )}
          </select>
        </div>
      </div>

      {/* CHAT SESSION HISTORY */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 border-b border-border">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Chat History persisted
          </label>
          {sessions.length === 0 ? (
            <div className="text-[10px] text-muted-foreground text-center py-4 italic">
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
                        ? "bg-primary/10 border border-primary/30 text-primary font-semibold" 
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <button
                      onClick={() => loadSession(sess.id)}
                      className="flex-1 text-left truncate pr-2 cursor-pointer"
                      title={sess.title}
                    >
                      {sess.title}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(sess.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-opacity cursor-pointer"
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
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Endpoints / Models
          </label>
          <div className="space-y-1.5">
            
            {/* Text to Text */}
            <button
              onClick={() => setEndpoint("text-to-text")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left cursor-pointer ${
                endpoint === "text-to-text"
                  ? "bg-primary/10 border border-primary/40 text-primary"
                  : "bg-transparent border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
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
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left cursor-pointer ${
                endpoint === "text-to-image"
                  ? "bg-primary/10 border border-primary/40 text-primary"
                  : "bg-transparent border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
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
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left cursor-pointer ${
                endpoint === "text-and-image-to-image"
                  ? "bg-primary/10 border border-primary/40 text-primary"
                  : "bg-transparent border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
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
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left cursor-pointer ${
                endpoint === "text-to-video"
                  ? "bg-primary/10 border border-primary/40 text-primary"
                  : "bg-transparent border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
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
      <div className="p-4 border-t border-border space-y-2 shrink-0">
        {messages.length > 0 && (
          <button
            onClick={handleCopyChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-border bg-card text-foreground hover:bg-secondary hover:text-foreground transition-all cursor-pointer"
          >
            {chatCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-primary" />
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
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear Conversation
        </button>
      </div>

    </div>
  );
}
