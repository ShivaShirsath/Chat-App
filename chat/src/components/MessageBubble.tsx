import { Zap } from "lucide-react";
import type { Message } from "../types/chat";
import { formatMarkdown } from "../services/markdownService";
import MediaRenderer from "./MediaRenderer";

interface MessageBubbleProps {
  msg: Message;
}

export default function MessageBubble({ msg }: MessageBubbleProps) {
  const isUser = msg.role === "user";

  return (
    <div
      className={`flex gap-4 chat-bubble-animation ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {/* Avatar left for assistant */}
      {!isUser && (
        <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
          <Zap className="h-4.5 w-4.5 text-white" />
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={`max-w-[85%] rounded-2xl p-4 space-y-3 border ${
          isUser
            ? "bg-[#181922] border-[#292c3a] text-gray-100"
            : "bg-[#0c0d14]/70 border-[#191a24] text-gray-100 backdrop-blur-md"
        }`}
      >
        {/* Multimodal user image preview */}
        {isUser && msg.mediaUrl && (
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

        {/* Media Output Renderer (Images/Videos from Assistant) */}
        {msg.mediaUrl && !isUser && msg.mediaType && (
          <div className="pt-2">
            <MediaRenderer mediaUrl={msg.mediaUrl} mediaType={msg.mediaType} />
          </div>
        )}
      </div>

      {/* Avatar right for user */}
      {isUser && (
        <div className="h-8 w-8 rounded-lg bg-[#242635] flex items-center justify-center shrink-0 border border-[#303347] font-semibold text-xs text-indigo-300">
          U
        </div>
      )}
    </div>
  );
}
