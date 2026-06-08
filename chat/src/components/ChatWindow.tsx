import { useEffect, useRef } from "react";
import { MessageSquare, Image as ImageIcon, Sparkles, Video } from "lucide-react";
import type { Message, ModelEndpoint } from "../types/chat";
import MessageBubble from "./MessageBubble";

interface ChatWindowProps {
  messages: Message[];
  applyTemplate: (prompt: string, modelType: ModelEndpoint) => void;
  sessionId: string | null;
}

export default function ChatWindow({ messages, applyTemplate, sessionId }: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-8">
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
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} sessionId={sessionId} />
        ))}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
