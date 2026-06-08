import { useState } from "react";
import { Zap, Link, Check, Copy, ClipboardCheck } from "lucide-react";
import type { Message } from "../types/chat";
import MarkdownRenderer from "./MarkdownRenderer";
import MediaRenderer from "./MediaRenderer";
import { copyToClipboard } from "../utils/clipboard";

interface MessageBubbleProps {
  msg: Message;
  sessionId: string | null;
}

export default function MessageBubble({ msg, sessionId }: MessageBubbleProps) {
  const isUser = msg.role === "user";
  const [blockCopied, setBlockCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Copy the raw text content of this single message block
  const handleCopyBlock = async () => {
    if (!msg.content) return;
    const success = await copyToClipboard(msg.content);
    if (success) {
      setBlockCopied(true);
      setTimeout(() => setBlockCopied(false), 2000);
    }
  };

  // Copy a deep-link URL that points directly to this message
  const handleCopyLink = async () => {
    if (!sessionId) return;
    const shareUrl = `${window.location.origin}?session=${sessionId}&msg=${msg.id}`;
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  return (
    <div
      className={`flex gap-3 chat-bubble-animation group/row ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {/* Avatar left for assistant */}
      {!isUser && (
        <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md mt-1">
          <Zap className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Bubble + Action Container */}
      <div className={`flex flex-col gap-1.5 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Message Bubble */}
        <div
          id={`msg-${msg.id}`}
          className={`rounded-2xl p-4 space-y-3 border transition-all ${
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
            <MarkdownRenderer content={msg.content} isUser={isUser} />
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

        {/* Action Bar — always visible on hover, always clickable */}
        {msg.content && (
          <div
            className={`flex items-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity duration-150 ${
              isUser ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {/* Copy Block Button */}
            <button
              onClick={handleCopyBlock}
              title="Copy this message"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e0f18] hover:bg-[#161724] border border-[#1e2030] text-[10px] font-semibold text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              {blockCopied ? (
                <>
                  <ClipboardCheck className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy Block
                </>
              )}
            </button>

            {/* Copy Link Button (only if session is saved) */}
            {sessionId && (
              <button
                onClick={handleCopyLink}
                title="Copy a link to this specific message"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e0f18] hover:bg-[#161724] border border-[#1e2030] text-[10px] font-semibold text-gray-400 hover:text-indigo-300 transition-all cursor-pointer"
              >
                {linkCopied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Link className="h-3 w-3" />
                    Copy Link
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Avatar right for user */}
      {isUser && (
        <div className="h-8 w-8 rounded-lg bg-[#242635] flex items-center justify-center shrink-0 border border-[#303347] font-semibold text-xs text-indigo-300 mt-1">
          U
        </div>
      )}
    </div>
  );
}
