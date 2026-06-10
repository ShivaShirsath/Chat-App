import { useState, useEffect, useRef } from "react";
import { Terminal, HelpCircle, Copy, Share2, Check, FileCode, X } from "lucide-react";
import { copyToClipboard } from "./utils/clipboard";
import { useChat } from "./hooks/useChat";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import ReadmeViewer from "./components/ReadmeViewer";
import type { ActiveTab, ModelEndpoint, FileDiffs, CodeTheme } from "./types/chat";
import { getStoredCodeTheme } from "./utils/codeThemes";
import { useThemeStore } from "./store/themeStore";
import "./App.css";

import { API_BASE_URL, WS_BASE_URL } from "./utils/api";

export default function App() {
  const {
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
    sessionId,
    sessions,
    loadSession,
    deleteSession,
    createNewChat,
    activeAgentSessions,

    // Coder Agent integrations
    chatMode,
    setChatMode,
    folderPath,
    isValidated,
    validationError,
    files,
    isValidating,
    handleSelectFolder,
    handleSendPermissionChoice,
    handleStopAgent
  } = useChat();

  const themeId = useThemeStore((state) => state.themeId);
  const darkMode = useThemeStore((state) => state.darkMode);

  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [input, setInput] = useState("");
  const [codeTheme, setCodeTheme] = useState<CodeTheme>(getStoredCodeTheme);

  // Sync centralized theme stylesheet and dark mode class to document root
  useEffect(() => {
    let link = document.getElementById("theme-link") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "theme-link";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = `${import.meta.env.BASE_URL}themes/theme-${themeId}.css`;

    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [themeId, darkMode]);

  // Overlay Diffs Drawer state
  const [drawerOpenFile, setDrawerOpenFile] = useState<string | null>(null);
  const [drawerDiffs, setDrawerDiffs] = useState<FileDiffs>({});
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);

  const openDiffReview = (filename: string, fileDiffs: FileDiffs) => {
    setDrawerDiffs(fileDiffs);
    setSelectedDiffFile(filename);
    setDrawerOpenFile(filename);
  };

  const renderDiffLine = (line: string, index: number) => {
    let bgColor: string;
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
      <div key={index} className={`font-mono text-[11px] py-0.5 whitespace-pre-wrap select-text ${bgColor}`}>
        {line}
      </div>
    );
  };

  const [chatCopied, setChatCopied] = useState(false);
  const [sessionCopied, setSessionCopied] = useState(false);

  // Holds the message ID to scroll-to after a deep-linked session finishes loading
  const pendingMsgIdRef = useRef<string | null>(null);

  // Sync code theme selection to CSS variables
  useEffect(() => {
    document.getElementById("prism-theme")?.remove();
    document.documentElement.dataset.codeTheme = codeTheme;
    localStorage.setItem("code-theme", codeTheme);
  }, [codeTheme]);

  // On first mount: parse URL params and kick off session load + remember target message
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get("session");
    const msgParam = params.get("msg");

    if (sessionParam) {
      // Remember the target message (if any) so we can scroll after load
      if (msgParam) pendingMsgIdRef.current = msgParam;
      loadSession(sessionParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Sync current sessionId into the URL (without msg param — msg is only for incoming links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (sessionId) {
      params.set("session", sessionId);
      // Keep msg in URL only while we haven't scrolled yet
      if (!pendingMsgIdRef.current) params.delete("msg");
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    } else {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [sessionId]);

  // After session messages load, scroll to the pending target message
  useEffect(() => {
    if (!pendingMsgIdRef.current || messages.length === 0) return;
    const targetId = pendingMsgIdRef.current;

    const timer = setTimeout(() => {
      const el = document.getElementById(`msg-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-pulse");
        // Remove highlight after animation
        setTimeout(() => el.classList.remove("highlight-pulse"), 3000);
        // Clear the pending ref so we don't re-scroll on subsequent updates
        pendingMsgIdRef.current = null;
        // Clean msg from URL after scrolling
        const params = new URLSearchParams(window.location.search);
        params.delete("msg");
        window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [messages]);

  const applyTemplate = (prompt: string, modelType: ModelEndpoint) => {
    setEndpoint(modelType);
    setInput(prompt);
  };

  const getApiUrlInfo = () => {
    if (connectionType === "websocket") {
      return `${WS_BASE_URL}/api/v1/ws (Type: ${endpoint})`;
    } else {
      return `${API_BASE_URL}/api/v1/${endpoint}/chat`;
    }
  };

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

  const handleShareChat = async () => {
    if (!sessionId) return;
    const shareUrl = `${window.location.origin}?session=${sessionId}`;
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setSessionCopied(true);
      setTimeout(() => setSessionCopied(false), 2000);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans">
      
      {/* SIDEBAR PANEL */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectionType={connectionType}
        setConnectionType={setConnectionType}
        wsStatus={wsStatus}
        endpoint={endpoint}
        setEndpoint={setEndpoint}
        modelName={modelName}
        setModelName={setModelName}
        clearChat={clearChat}
        messages={messages}
        sessionId={sessionId}
        sessions={sessions}
        loadSession={loadSession}
        deleteSession={deleteSession}
        createNewChat={createNewChat}
        codeTheme={codeTheme}
        setCodeTheme={setCodeTheme}
        models={models}
        activeAgentSessions={activeAgentSessions}
      />

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col bg-background relative">
        
        {/* HEADER */}
        <div className="h-16 border-b border-border px-6 flex items-center justify-between bg-background/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">ENDPOINT:</span>
            <span className="text-primary font-semibold bg-card px-2.5 py-1 rounded-md border border-border max-w-[200px] sm:max-w-[400px] truncate">
              {getApiUrlInfo()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "chat" && messages.length > 0 && (
              <>
                <button
                  onClick={handleCopyChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent border border-border text-[10px] font-bold text-secondary-foreground hover:text-accent-foreground transition-all uppercase cursor-pointer"
                  title="Copy whole chat conversation"
                >
                  {chatCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-primary" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Chat
                    </>
                  )}
                </button>

                {sessionId && (
                  <button
                    onClick={handleShareChat}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent border border-border text-[10px] font-bold text-primary hover:text-accent-foreground transition-all uppercase cursor-pointer"
                    title="Share chat link"
                  >
                    {sessionCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-primary" />
                        Link Copied!
                      </>
                    ) : (
                      <>
                        <Share2 className="h-3.5 w-3.5" />
                        Share Chat
                      </>
                    )}
                  </button>
                )}
              </>
            )}

            <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
              <HelpCircle className="h-3.5 w-3.5" />
              Swap Endpoints in Sidebar
            </span>
          </div>
        </div>

        {/* WORKSPACE AREA */}
        {activeTab === "readme" ? (
          <ReadmeViewer onBackToChat={() => setActiveTab("chat")} />
        ) : (
          <>
            {/* MESSAGE CONTAINER */}
            <ChatWindow 
              messages={messages} 
              applyTemplate={applyTemplate} 
              sessionId={sessionId} 
              handleSendPermissionChoice={handleSendPermissionChoice}
              onOpenDiffs={openDiffReview}
            />

            {/* INPUT PANEL */}
            <ChatInput
              endpoint={endpoint}
              isLoading={isLoading}
              sendMessage={sendMessage}
              input={input}
              setInput={setInput}
              modelName={modelName}
              setModelName={setModelName}
              models={models}

              // Agent Mode integrations
              chatMode={chatMode}
              setChatMode={setChatMode}
              folderPath={folderPath}
              isValidated={isValidated}
              validationError={validationError}
              filesCount={files.length}
              isValidating={isValidating}
              handleSelectFolder={handleSelectFolder}
              handleStopAgent={handleStopAgent}
            />
          </>
        )}
      </div>

      {/* OVERLAY SIDE-DRAWER CODE DIFF REVIEW */}
      {drawerOpenFile && (
        <div className="absolute inset-0 z-50 flex overflow-hidden select-text">
          {/* Backdrop */}
          <div 
            onClick={() => setDrawerOpenFile(null)}
            className="absolute inset-0 bg-background/75 backdrop-blur-sm transition-opacity" 
          />

          {/* Drawer Panel */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-card border-l border-border flex flex-col shadow-2xl animate-slide-in">
            {/* Header */}
            <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-card shrink-0">
              <div className="flex items-center gap-3">
                <FileCode className="h-4.5 w-4.5 text-primary" />
                <span className="text-xs font-bold text-card-foreground">Review Code Modifications</span>
              </div>
              <button 
                onClick={() => setDrawerOpenFile(null)}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-all cursor-pointer"
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
                  <div className="bg-muted border-b border-border px-4 py-2 text-[10px] font-mono text-muted-foreground">
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
