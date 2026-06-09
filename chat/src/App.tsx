import { useState, useEffect, useRef } from "react";
import { Terminal, HelpCircle, Copy, Share2, Check } from "lucide-react";
import { copyToClipboard } from "./utils/clipboard";
import { useChat } from "./hooks/useChat";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import ReadmeViewer from "./components/ReadmeViewer";
import type { ActiveTab, ModelEndpoint } from "./types/chat";
import "./App.css";

// @ts-ignore
import tomorrowTheme from "prismjs/themes/prism-tomorrow.css?inline";
// @ts-ignore
import okaidiaTheme from "prismjs/themes/prism-okaidia.css?inline";
// @ts-ignore
import twilightTheme from "prismjs/themes/prism-twilight.css?inline";
// @ts-ignore
import defaultTheme from "prismjs/themes/prism.css?inline";

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
    createNewChat
  } = useChat();

  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [input, setInput] = useState("");
  const [codeTheme, setCodeTheme] = useState<string>(() => localStorage.getItem("code-theme") || "tomorrow");

  const [chatCopied, setChatCopied] = useState(false);
  const [sessionCopied, setSessionCopied] = useState(false);

  // Holds the message ID to scroll-to after a deep-linked session finishes loading
  const pendingMsgIdRef = useRef<string | null>(null);

  // Dynamic CSS stylesheet injector
  useEffect(() => {
    let themeCss = "";
    switch (codeTheme) {
      case "tomorrow":
        themeCss = tomorrowTheme;
        break;
      case "okaidia":
        themeCss = okaidiaTheme;
        break;
      case "twilight":
        themeCss = twilightTheme;
        break;
      case "default":
        themeCss = defaultTheme;
        break;
      default:
        themeCss = tomorrowTheme;
    }

    let styleEl = document.getElementById("prism-theme");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "prism-theme";
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = themeCss;
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
      return `ws://localhost:8001/api/v1/ws (Type: ${endpoint})`;
    } else {
      return `http://localhost:8001/api/v1/${endpoint}/chat`;
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
    <div className="flex h-screen w-screen bg-[#07080c] text-gray-100 overflow-hidden font-sans">
      
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
      />

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col bg-[#07080b] relative">
        
        {/* HEADER */}
        <div className="h-16 border-b border-[#1a1c23] px-6 flex items-center justify-between bg-[#0b0c11]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
            <Terminal className="h-4 w-4 text-violet-400" />
            <span className="text-gray-500">ENDPOINT:</span>
            <span className="text-indigo-300 font-semibold bg-[#12131a] px-2.5 py-1 rounded-md border border-[#1c1d29] max-w-[200px] sm:max-w-[400px] truncate">
              {getApiUrlInfo()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "chat" && messages.length > 0 && (
              <>
                <button
                  onClick={handleCopyChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141520] hover:bg-[#1e202f] border border-[#2b2d3c] text-[10px] font-bold text-gray-300 hover:text-white transition-all uppercase cursor-pointer"
                  title="Copy whole chat conversation"
                >
                  {chatCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141520] hover:bg-[#1e202f] border border-[#2b2d3c] text-[10px] font-bold text-indigo-300 hover:text-white transition-all uppercase cursor-pointer"
                    title="Share chat link"
                  >
                    {sessionCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
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

            <span className="text-xs text-gray-500 flex items-center gap-1 ml-2">
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
            <ChatWindow messages={messages} applyTemplate={applyTemplate} sessionId={sessionId} />

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
            />
          </>
        )}
      </div>
    </div>
  );
}
