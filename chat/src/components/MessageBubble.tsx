import { useState } from "react";
import { 
  Zap, 
  Link, 
  Check, 
  Copy, 
  ClipboardCheck, 
  Loader2, 
  Terminal as TerminalIcon, 
  AlertCircle, 
  FileCode, 
  ChevronDown, 
  ChevronRight 
} from "lucide-react";
import type { Message, FileDiffs } from "../types/chat";
import MarkdownRenderer from "./MarkdownRenderer";
import MediaRenderer from "./MediaRenderer";
import { copyToClipboard } from "../utils/clipboard";

interface MessageBubbleProps {
  msg: Message;
  sessionId: string | null;
  handleSendPermissionChoice?: (msgId: string, choice: string) => void;
  onOpenDiffs?: (filename: string, fileDiffs: FileDiffs) => void;
}

export default function MessageBubble({ 
  msg, 
  sessionId, 
  handleSendPermissionChoice, 
  onOpenDiffs 
}: MessageBubbleProps) {
  const isUser = msg.role === "user";
  const [blockCopied, setBlockCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

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
        <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-md mt-1">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
      )}

      {/* Bubble + Action Container */}
      <div className={`flex flex-col gap-1.5 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Message Bubble */}
        <div
          id={`msg-${msg.id}`}
          className={`rounded-2xl p-4 space-y-3 border transition-all ${
            isUser
              ? "bg-card border-border text-foreground"
              : "bg-card/70 border-border text-foreground backdrop-blur-md"
          }`}
        >
          {/* Multimodal user image preview */}
          {isUser && msg.mediaUrl && (
            <div className="relative rounded-lg overflow-hidden border border-border max-w-xs shadow-md">
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
          ) : msg.isStreaming && !msg.thoughts ? (
            <div className="flex items-center gap-2 py-1.5">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-xs text-muted-foreground font-medium animate-pulse">
                Generating payload...
              </span>
            </div>
          ) : null}

          {/* Coder Agent Specific Components */}
          {!isUser && (
            <div className="space-y-3 pt-1">
              
              {/* A. Collapsible Faded Thinking Block */}
              {msg.thoughts && msg.thoughts.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden bg-muted/30">
                  <button
                    onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                    className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-muted-foreground hover:text-muted-foreground transition-all cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      <Loader2 className={`h-3 w-3 text-primary ${msg.isStreaming ? "animate-spin" : ""}`} />
                      {msg.isStreaming 
                        ? "Thinking..." 
                        : `Worked for ${msg.thinkingTime || 0}s`
                      }
                    </span>
                    {isThinkingExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>

                  {isThinkingExpanded && (
                    <div className="border-t border-border p-3 bg-muted/50 space-y-1.5 max-h-[250px] overflow-y-auto">
                      {msg.thoughts.map((thought, tidx) => (
                        <div key={tidx} className="text-[11px] text-muted-foreground leading-normal border-l border-border pl-2 py-0.5">
                          {thought}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* B. Terminal Command Logs (always visible) */}
              {msg.terminalLogs && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    <TerminalIcon className="h-3 w-3" />
                    Shell Command Logs
                  </div>
                  <div className="p-2.5 rounded bg-background/60 font-mono text-[10px] text-primary border border-border overflow-x-auto max-h-[180px] whitespace-pre-wrap">
                    {msg.terminalLogs}
                  </div>
                </div>
              )}

              {/* C. Dynamic Permission Request Card */}
              {msg.permissionRequest && handleSendPermissionChoice && (
                <div className="p-3.5 bg-primary/10 border border-primary/30 rounded-xl space-y-3 shadow shadow-primary/5">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Clarification Required</p>
                      <p className="text-xs text-foreground">{msg.permissionRequest.question}</p>
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
                              ? "bg-primary border-primary text-primary-foreground shadow-sm"
                              : hasAnswered
                              ? "bg-transparent border-border text-muted-foreground cursor-not-allowed"
                              : "bg-card border-border text-foreground hover:text-primary-foreground hover:border-primary/60 hover:bg-accent cursor-pointer"
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
              {msg.diffs && Object.keys(msg.diffs).length > 0 && onOpenDiffs && (
                <div className="flex items-center justify-between bg-muted/50 border border-border rounded-xl p-3.5 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <FileCode className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-foreground font-semibold">
                        {Object.keys(msg.diffs).length} file{Object.keys(msg.diffs).length > 1 ? "s" : ""} modified
                      </p>
                      <p className="text-[10px] text-muted-foreground">Unified code diffs generated</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const firstFile = Object.keys(msg.diffs || {})[0];
                      onOpenDiffs(firstFile, msg.diffs || {});
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-[10px] font-bold hover:bg-primary/25 transition-all cursor-pointer uppercase tracking-wider"
                  >
                    Review
                  </button>
                </div>
              )}

            </div>
          )}

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
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card hover:bg-accent border border-border text-[10px] font-semibold text-muted-foreground hover:text-primary-foreground transition-all cursor-pointer"
            >
              {blockCopied ? (
                <>
                  <ClipboardCheck className="h-3 w-3 text-primary" />
                  <span className="text-primary">Copied!</span>
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
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card hover:bg-accent border border-border text-[10px] font-semibold text-muted-foreground hover:text-primary transition-all cursor-pointer"
              >
                {linkCopied ? (
                  <>
                    <Check className="h-3 w-3 text-primary" />
                    <span className="text-primary">Link Copied!</span>
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
        <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 border border-border font-semibold text-xs text-primary mt-1">
          U
        </div>
      )}
    </div>
  );
}
