import React, { useState, useRef, useEffect } from "react";
import { 
  MessageSquare, 
  Image as ImageIcon, 
  Sparkles, 
  Video, 
  Send, 
  Trash2, 
  Radio, 
  RefreshCw, 
  Paperclip, 
  X, 
  Terminal,
  Zap,
  HelpCircle,
  Eye
} from "lucide-react";
import { useChat } from "./hooks/useChat";
import type { ModelEndpoint } from "./hooks/useChat";
import "./App.css";

// Simple markdown formatter helper to keep project package count low
function formatMarkdown(text: string) {
  if (!text) return "";
  
  // Escape HTML characters
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  interface Part {
    type: "text" | "code-block";
    content?: string;
    lang?: string;
    code?: string;
    isStreaming?: boolean;
  }

  const parts: Part[] = [];
  let currentIndex = 0;
  
  while (currentIndex < escaped.length) {
    const nextTriple = escaped.indexOf("```", currentIndex);
    if (nextTriple === -1) {
      parts.push({
        type: "text",
        content: escaped.substring(currentIndex)
      });
      break;
    }
    
    if (nextTriple > currentIndex) {
      parts.push({
        type: "text",
        content: escaped.substring(currentIndex, nextTriple)
      });
    }
    
    const closeTriple = escaped.indexOf("```", nextTriple + 3);
    if (closeTriple === -1) {
      const afterOpening = escaped.substring(nextTriple + 3);
      const firstNewline = afterOpening.indexOf("\n");
      let lang = "code";
      let code = afterOpening;
      
      if (firstNewline !== -1) {
        const potentialLang = afterOpening.substring(0, firstNewline).trim();
        if (potentialLang.length > 0 && potentialLang.length < 15 && !potentialLang.includes(" ")) {
          lang = potentialLang;
          code = afterOpening.substring(firstNewline + 1);
        }
      }
      
      parts.push({
        type: "code-block",
        lang: lang,
        code: code,
        isStreaming: true
      });
      break;
    }
    
    const afterOpening = escaped.substring(nextTriple + 3, closeTriple);
    const firstNewline = afterOpening.indexOf("\n");
    let lang = "code";
    let code = afterOpening;
    
    if (firstNewline !== -1) {
      const potentialLang = afterOpening.substring(0, firstNewline).trim();
      if (potentialLang.length > 0 && potentialLang.length < 15 && !potentialLang.includes(" ")) {
        lang = potentialLang;
        code = afterOpening.substring(firstNewline + 1);
      }
    }
    
    parts.push({
      type: "code-block",
      lang: lang,
      code: code,
      isStreaming: false
    });
    
    currentIndex = closeTriple + 3;
  }
  
  let html = "";
  for (const part of parts) {
    if (part.type === "code-block") {
      const displayCode = part.code || "";
      html += `<div class="my-3 rounded-xl overflow-hidden border border-[#1e202e] bg-[#0c0d14] font-sans">
        <div class="flex items-center justify-between px-4 py-2 bg-[#12131b] border-b border-[#1c1d29]">
          <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">${part.lang}${part.isStreaming ? " (streaming)" : ""}</span>
        </div>
        <pre class="p-4 text-xs font-mono text-purple-200 overflow-x-auto whitespace-pre-wrap text-left bg-[#08090d] select-text">${displayCode.trim()}</pre>
      </div>`;
    } else {
      const textContent = part.content || "";
      let processedText = "";
      let textIndex = 0;
      while (textIndex < textContent.length) {
        const nextBacktick = textContent.indexOf("`", textIndex);
        if (nextBacktick === -1) {
          processedText += textContent.substring(textIndex);
          break;
        }
        processedText += textContent.substring(textIndex, nextBacktick);
        
        const closeBacktick = textContent.indexOf("`", nextBacktick + 1);
        if (closeBacktick === -1) {
          processedText += "`";
          textIndex = nextBacktick + 1;
        } else {
          const codeContent = textContent.substring(nextBacktick + 1, closeBacktick);
          if (codeContent.includes("\n")) {
            const firstNewline = codeContent.indexOf("\n");
            let lang = "code";
            let displayCode = codeContent;
            const potentialLang = codeContent.substring(0, firstNewline).trim();
            if (potentialLang.length > 0 && potentialLang.length < 15 && !potentialLang.includes(" ")) {
              lang = potentialLang;
              displayCode = codeContent.substring(firstNewline + 1);
            }
            processedText += `<div class="my-3 rounded-xl overflow-hidden border border-[#1e202e] bg-[#0c0d14] font-sans">
              <div class="flex items-center justify-between px-4 py-2 bg-[#12131b] border-b border-[#1c1d29]">
                <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">${lang}</span>
              </div>
              <pre class="p-4 text-xs font-mono text-purple-200 overflow-x-auto whitespace-pre-wrap text-left bg-[#08090d] select-text">${displayCode.trim()}</pre>
            </div>`;
          } else {
            processedText += `<code class="bg-[#181920] text-purple-300 px-1.5 py-0.5 rounded text-xs font-mono">${codeContent}</code>`;
          }
          textIndex = closeBacktick + 1;
        }
      }
      
      processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-300 font-bold">$1</strong>');
      processedText = processedText.replace(/\n/g, "<br />");
      html += processedText;
    }
  }
  
  return html;
}

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
    setModelName
  } = useChat();

  const [input, setInput] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<"chat" | "readme">("chat");
  const [readmeContent, setReadmeContent] = useState<string>("");
  const [isReadmeLoading, setIsReadmeLoading] = useState<boolean>(false);

  useEffect(() => {
    if (activeTab === "readme" && !readmeContent) {
      setIsReadmeLoading(true);
      fetch("http://localhost:8001/api/v1/readme")
        .then(res => res.json())
        .then(data => {
          setReadmeContent(data.content || "No content found.");
        })
        .catch(err => {
          setReadmeContent(`Failed to load README: ${err.message}`);
        })
        .finally(() => {
          setIsReadmeLoading(false);
        });
    }
  }, [activeTab, readmeContent]);

  const renderReadme = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("# ")) {
        return <h1 key={idx} className="text-xl font-extrabold text-white mt-6 mb-3 border-b border-[#1c1d29] pb-2 font-outfit">{trimmed.slice(2)}</h1>;
      }
      if (trimmed.startsWith("## ")) {
        return <h2 key={idx} className="text-lg font-bold text-indigo-300 mt-5 mb-2.5 font-outfit">{trimmed.slice(3)}</h2>;
      }
      if (trimmed.startsWith("### ")) {
        return <h3 key={idx} className="text-base font-semibold text-purple-300 mt-4 mb-2 font-outfit">{trimmed.slice(4)}</h3>;
      }
      if (trimmed === "---") {
        return <hr key={idx} className="my-5 border-[#1c1d29]" />;
      }
      if (trimmed.startsWith("- ")) {
        return (
          <li key={idx} className="ml-5 list-disc text-xs text-gray-300 my-1 leading-relaxed">
            <span dangerouslySetInnerHTML={{ __html: formatMarkdown(trimmed.slice(2)) }} />
          </li>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const content = trimmed.replace(/^\d+\.\s/, "");
        return (
          <li key={idx} className="ml-5 list-decimal text-xs text-gray-300 my-1 leading-relaxed">
            <span dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }} />
          </li>
        );
      }
      if (trimmed.startsWith("> ")) {
        return (
          <blockquote key={idx} className="border-l-4 border-violet-500 bg-[#12131b] p-3 rounded-r-lg text-xs text-gray-400 my-3 leading-relaxed italic">
            {trimmed.slice(2).replace("[!IMPORTANT]", "⚠️ IMPORTANT:").replace("[!NOTE]", "ℹ️ NOTE:")}
          </blockquote>
        );
      }
      if (!trimmed) return <div key={idx} className="h-2" />;
      return (
        <p key={idx} className="text-xs text-gray-300 my-1.5 leading-relaxed">
          <span dangerouslySetInnerHTML={{ __html: formatMarkdown(line) }} />
        </p>
      );
    });
  };

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !attachedImage) return;

    sendMessage(input, attachedImage || undefined);
    setInput("");
    setAttachedImage(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachedImage = () => {
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Get active API URL info
  const getApiUrlInfo = () => {
    if (connectionType === "websocket") {
      return `ws://localhost:8001/api/v1/ws (Type: ${endpoint})`;
    } else {
      return `http://localhost:8001/api/v1/${endpoint}/chat`;
    }
  };

  // Render quick templates
  const applyTemplate = (prompt: string, modelType: ModelEndpoint) => {
    setEndpoint(modelType);
    setInput(prompt);
  };

  return (
    <div className="flex h-screen w-screen bg-[#07080c] text-gray-100 overflow-hidden font-sans">
      
      {/* LEFT SIDEBAR */}
      <div className="w-[300px] border-r border-[#1a1c23] bg-[#0b0c11] flex flex-col shrink-0">
        
        {/* LOGO */}
        <div className="p-6 border-b border-[#1a1c23] flex items-center gap-3">
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

          {/* OLLAMA MODEL SELECTOR (only visible when text-to-text is active) */}
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
                <option value="llama3.2:latest">Llama 3.2 (3B, Q4_K_M) - Fast & Accurate</option>
                <option value="llama3.2:1b">Llama 3.2 (1B, Q8_0) - Ultra Fast</option>
                <option value="sadiq-bd/llama3.2-3b-uncensored">Llama 3.2 Uncensored (3B, Q4) - Light & Uncensored</option>
                <option value="sadiq-bd/llama3.2-1b-uncensored">Llama 3.2 Uncensored (1B, Q4) - Fast & Uncensored</option>
                <option value="dolphin-phi">Dolphin Phi (2.7B) - Light Uncensored</option>
                <option value="hf.co/ICEPVP8977/Uncensored_gemma_2b:latest">Uncensored Gemma 2B (F16) - High RAM usage</option>
              </select>
            </div>
          )}
        </div>

        {/* MODEL DIRECTORIES / ENDPOINTS */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
              Endpoints / Models
            </label>
            <div className="space-y-1.5">
              
              {/* Text to Text */}
              <button
                onClick={() => setEndpoint("text-to-text")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                  endpoint === "text-to-text"
                    ? "bg-violet-600/15 border border-violet-500/40 text-violet-300"
                    : "bg-transparent border border-transparent text-gray-400 hover:bg-[#14151b] hover:text-white"
                }`}
              >
                <MessageSquare className="h-4.5 w-4.5" />
                <div className="flex-1">
                  <p className="font-medium">text-to-text/chat</p>
                  <p className="text-[10px] text-gray-500">Uncensored Gemma 2b</p>
                </div>
              </button>

              {/* Text to Image */}
              <button
                onClick={() => setEndpoint("text-to-image")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                  endpoint === "text-to-image"
                    ? "bg-violet-600/15 border border-violet-500/40 text-violet-300"
                    : "bg-transparent border border-transparent text-gray-400 hover:bg-[#14151b] hover:text-white"
                }`}
              >
                <ImageIcon className="h-4.5 w-4.5" />
                <div className="flex-1">
                  <p className="font-medium">text-to-image/chat</p>
                  <p className="text-[10px] text-gray-500">Stable Diffusion Stub</p>
                </div>
              </button>

              {/* Text & Image to Image */}
              <button
                onClick={() => setEndpoint("text-and-image-to-image")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                  endpoint === "text-and-image-to-image"
                    ? "bg-violet-600/15 border border-violet-500/40 text-violet-300"
                    : "bg-transparent border border-transparent text-gray-400 hover:bg-[#14151b] hover:text-white"
                }`}
              >
                <Sparkles className="h-4.5 w-4.5" />
                <div className="flex-1">
                  <p className="font-medium">text-image-to-image</p>
                  <p className="text-[10px] text-gray-500">Multimodal Editing Stub</p>
                </div>
              </button>

              {/* Text to Video */}
              <button
                onClick={() => setEndpoint("text-to-video")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                  endpoint === "text-to-video"
                    ? "bg-violet-600/15 border border-violet-500/40 text-violet-300"
                    : "bg-transparent border border-transparent text-gray-400 hover:bg-[#14151b] hover:text-white"
                }`}
              >
                <Video className="h-4.5 w-4.5" />
                <div className="flex-1">
                  <p className="font-medium">text-to-video/chat</p>
                  <p className="text-[10px] text-gray-500">Video Synthesis Stub</p>
                </div>
              </button>

            </div>
          </div>
        </div>

        {/* BOTTOM UTILS */}
        <div className="p-4 border-t border-[#1a1c23] space-y-2">
          <button
            onClick={clearChat}
            disabled={messages.length === 0}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-red-500/30 text-red-400 hover:bg-red-950/20 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Conversation
          </button>
        </div>

      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col bg-[#07080b] relative">
        
        {/* TOP ROUTE HEADER */}
        <div className="h-16 border-b border-[#1a1c23] px-6 flex items-center justify-between bg-[#0b0c11]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
            <Terminal className="h-4 w-4 text-violet-400" />
            <span className="text-gray-500">ENDPOINT:</span>
            <span className="text-indigo-300 font-semibold bg-[#12131a] px-2.5 py-1 rounded-md border border-[#1c1d29] max-w-[400px] truncate">
              {getApiUrlInfo()}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" />
              Change URL to Swap Models
            </span>
          </div>
        </div>

        {/* MAIN VIEWER SPLIT */}
        {activeTab === "readme" ? (
          <div className="flex-grow overflow-y-auto px-6 py-8 bg-[#07080b]">
            <div className="max-w-4xl mx-auto bg-[#0c0d14]/70 border border-[#191a24] rounded-2xl p-6 backdrop-blur-md shadow-2xl relative">
              <div className="absolute top-6 right-6">
                <button
                  onClick={() => setActiveTab("chat")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141520] hover:bg-[#1e202f] border border-[#2b2d3c] text-[10px] font-bold text-indigo-300 transition-all uppercase"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Back to Chat
                </button>
              </div>

              {isReadmeLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <div className="animate-spin text-violet-500">
                    <RefreshCw className="h-6 w-6" />
                  </div>
                  <p className="text-xs text-gray-400 font-medium">Fetching README.md from gateway...</p>
                </div>
              ) : (
                <div className="text-left select-text">
                  {renderReadme(readmeContent)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* MESSAGES LIST */}
            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-8 mt-12">
                  <div className="space-y-3">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center mx-auto shadow-xl shadow-violet-500/10">
                      <Sparkles className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white mt-4">
                      Welcome to the Multimodal Playground
                    </h2>
                    <p className="text-sm text-gray-400 max-w-md mx-auto">
                      A high-performance gateway connecting frontend interfaces to AI models over HTTP, Event Streams, and WebSockets.
                    </p>
                  </div>

                  {/* QUICK STARTERS */}
                  <div className="grid grid-cols-2 gap-4 w-full text-left">
                    
                    <button
                      onClick={() => applyTemplate("Why is the sky blue? Explain simply.", "text-to-text")}
                      className="p-4 rounded-xl border border-[#1c1d27] bg-[#0c0d12]/50 hover:bg-[#12131b] hover:border-violet-500/30 transition-all text-left space-y-1.5"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-violet-400">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Text Chat (Ollama)
                      </div>
                      <p className="text-xs text-gray-400">"Why is the sky blue? Explain simply..."</p>
                    </button>

                    <button
                      onClick={() => applyTemplate("A beautiful cyberpunk city skyline at night with neon lights.", "text-to-image")}
                      className="p-4 rounded-xl border border-[#1c1d27] bg-[#0c0d12]/50 hover:bg-[#12131b] hover:border-violet-500/30 transition-all text-left space-y-1.5"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-violet-400">
                        <ImageIcon className="h-3.5 w-3.5" />
                        Image Generation
                      </div>
                      <p className="text-xs text-gray-400">"A beautiful cyberpunk city skyline at night..."</p>
                    </button>

                    <button
                      onClick={() => applyTemplate("Add a neon red sunset glow to the skyline.", "text-and-image-to-image")}
                      className="p-4 rounded-xl border border-[#1c1d27] bg-[#0c0d12]/50 hover:bg-[#12131b] hover:border-violet-500/30 transition-all text-left space-y-1.5"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-violet-400">
                        <Sparkles className="h-3.5 w-3.5" />
                        Image Editing (I2I)
                      </div>
                      <p className="text-xs text-gray-400">"Add a neon red sunset glow to the skyline..."</p>
                    </button>

                    <button
                      onClick={() => applyTemplate("A camera flying through a vibrant forest with sunlight stream.", "text-to-video")}
                      className="p-4 rounded-xl border border-[#1c1d27] bg-[#0c0d12]/50 hover:bg-[#12131b] hover:border-violet-500/30 transition-all text-left space-y-1.5"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-violet-400">
                        <Video className="h-3.5 w-3.5" />
                        Video Synthesis
                      </div>
                      <p className="text-xs text-gray-400">"A camera flying through a vibrant forest..."</p>
                    </button>

                  </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-6">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-4 chat-bubble-animation ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      
                      {/* Avatar left for assistant */}
                      {msg.role === "assistant" && (
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                          <Zap className="h-4.5 w-4.5 text-white" />
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`max-w-[85%] rounded-2xl p-4 space-y-3 border ${
                          msg.role === "user"
                            ? "bg-[#181922] border-[#292c3a] text-gray-100"
                            : "bg-[#0c0d14]/70 border-[#191a24] text-gray-100 backdrop-blur-md"
                        }`}
                      >
                        {/* Multimodal user image preview */}
                        {msg.role === "user" && msg.mediaUrl && (
                          <div className="relative rounded-lg overflow-hidden border border-[#2b2d3c] max-w-xs shadow-md">
                            <img 
                              src={msg.mediaUrl} 
                              alt="User attachment" 
                              className="max-h-60 object-contain w-full"
                            />
                          </div>
                        )}

                        {/* Text Content */}
                        {msg.content ? (
                          <div 
                            className="text-sm leading-relaxed prose prose-invert font-sans"
                            dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                          />
                        ) : msg.isStreaming ? (
                          <div className="flex items-center gap-2 py-1.5">
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                            </span>
                            <span className="text-xs text-gray-500 font-medium animate-pulse">
                              Generating payload...
                            </span>
                          </div>
                        ) : null}

                        {/* Media Output Renderer (Images/Videos) */}
                        {msg.mediaUrl && msg.role === "assistant" && (
                          <div className="pt-2">
                            {msg.mediaType === "image" ? (
                              <div className="relative rounded-xl overflow-hidden border border-[#1e202e] bg-[#0c0c0e] shadow-xl group">
                                <img 
                                  src={msg.mediaUrl} 
                                  alt="Generated Render" 
                                  className="max-h-96 w-full object-cover rounded-xl"
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
                                  <a 
                                    href={msg.mediaUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur transition-all"
                                    title="Open in New Tab"
                                  >
                                    <Eye className="h-5 w-5" />
                                  </a>
                                </div>
                              </div>
                            ) : msg.mediaType === "video" ? (
                              <div className="rounded-xl overflow-hidden border border-[#1e202e] bg-black shadow-xl">
                                <video 
                                  src={msg.mediaUrl} 
                                  controls 
                                  loop
                                  className="w-full max-h-96 rounded-xl"
                                />
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* Avatar right for user */}
                      {msg.role === "user" && (
                        <div className="h-8 w-8 rounded-lg bg-[#242635] flex items-center justify-center shrink-0 border border-[#303347] font-semibold text-xs text-indigo-300">
                          U
                        </div>
                      )}

                    </div>
                  ))}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* FOOTER INPUT CONTAINER */}
            <div className="p-6 border-t border-[#1a1c23] bg-[#0b0c11]/80 backdrop-blur-md">
              <form onSubmit={handleSend} className="max-w-4xl mx-auto relative">
                
                {/* Multimodal Preview Drawer */}
                {attachedImage && (
                  <div className="absolute -top-[100px] left-0 right-0 bg-[#0e0f17] border border-[#1e202c] p-2.5 rounded-t-xl flex items-center justify-between shadow-2xl z-10">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-20 rounded border border-[#2d3042] overflow-hidden bg-black flex items-center justify-center">
                        <img 
                          src={attachedImage} 
                          alt="Attachment Preview" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-indigo-300">Image attached</p>
                        <p className="text-[10px] text-gray-500">Will be sent with prompt</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeAttachedImage}
                      className="p-1 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-all"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Main Input Textarea box */}
                <div className={`relative flex items-center bg-[#13141b] border rounded-2xl transition-all ${
                  attachedImage ? "rounded-t-none" : ""
                } ${
                  isLoading 
                    ? "border-violet-500/20" 
                    : "border-[#1e202b] focus-within:border-violet-500/50 focus-within:shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                }`}>
                  
                  {/* Attachment trigger (Only for editing mode) */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-4 text-gray-400 hover:text-white transition-all ${
                      endpoint !== "text-and-image-to-image" 
                        ? "opacity-30 cursor-not-allowed" 
                        : "opacity-100"
                    }`}
                    title={endpoint === "text-and-image-to-image" ? "Attach image" : "Attach image (Requires image-to-image mode)"}
                    disabled={endpoint !== "text-and-image-to-image"}
                  >
                    <Paperclip className="h-4.5 w-4.5" />
                  </button>

                  <input 
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      endpoint === "text-to-text"
                        ? "Type your message..."
                        : endpoint === "text-to-image"
                        ? "Describe the image you want to generate..."
                        : endpoint === "text-and-image-to-image"
                        ? "Attach an image and describe edits..."
                        : "Describe the video scene you want to generate..."
                    }
                    disabled={isLoading}
                    className="flex-1 bg-transparent py-4 text-sm outline-none text-gray-100 placeholder-gray-500"
                  />

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pr-3">
                    {isLoading && (
                      <div className="animate-spin p-2 text-violet-400">
                        <RefreshCw className="h-4 w-4" />
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={isLoading || (!input.trim() && !attachedImage)}
                      className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:bg-[#1f2130] disabled:text-gray-500 shadow-md shadow-violet-600/10 hover:shadow-violet-600/30 transition-all flex items-center justify-center"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>

                </div>

              </form>
              <div className="text-[10px] text-center text-gray-600 mt-2.5 font-sans">
                Created as a unified gateway implementation. Swap model by clicking options in the sidebar.
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
