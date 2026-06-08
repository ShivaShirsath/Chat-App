import { useState } from "react";
import { Terminal, HelpCircle } from "lucide-react";
import { useChat } from "./hooks/useChat";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import ReadmeViewer from "./components/ReadmeViewer";
import type { ActiveTab, ModelEndpoint } from "./types/chat";
import "./App.css";

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
    sessionId,
    sessions,
    loadSession,
    deleteSession,
    createNewChat
  } = useChat();

  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [input, setInput] = useState("");

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
        messagesCount={messages.length}
        sessionId={sessionId}
        sessions={sessions}
        loadSession={loadSession}
        deleteSession={deleteSession}
        createNewChat={createNewChat}
      />

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col bg-[#07080b] relative">
        
        {/* HEADER */}
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

        {/* WORKSPACE AREA */}
        {activeTab === "readme" ? (
          <ReadmeViewer onBackToChat={() => setActiveTab("chat")} />
        ) : (
          <>
            {/* MESSAGE CONTAINER */}
            <ChatWindow messages={messages} applyTemplate={applyTemplate} />

            {/* INPUT PANEL */}
            <ChatInput
              endpoint={endpoint}
              isLoading={isLoading}
              sendMessage={sendMessage}
              input={input}
              setInput={setInput}
            />
          </>
        )}
      </div>
    </div>
  );
}
