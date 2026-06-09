import { useState, useRef } from "react";
import { Send, Paperclip, X, RefreshCw, CornerDownLeft } from "lucide-react";
import type { ModelEndpoint, OllamaModel } from "../types/chat";

interface ChatInputProps {
  endpoint: ModelEndpoint;
  isLoading: boolean;
  sendMessage: (content: string, imageBase64?: string) => void;
  input: string;
  setInput: (val: string) => void;
  modelName: string;
  setModelName: (val: string) => void;
  models: OllamaModel[];
}

export default function ChatInput({ 
  endpoint, 
  isLoading, 
  sendMessage,
  input,
  setInput,
  modelName,
  setModelName,
  models
}: ChatInputProps) {
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() && !attachedImage) return;

    sendMessage(input, attachedImage || undefined);
    setInput("");
    setAttachedImage(null);

    // Reset textarea height after send
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  // Shift+Enter adds a newline; plain Enter submits
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-grow textarea height as user types
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize: reset then expand to scrollHeight (capped at ~6 lines)
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
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

  const getInputPlaceholder = () => {
    switch (endpoint) {
      case "text-to-text":
        return "Type your message… (Shift+Enter for new line)";
      case "text-to-image":
        return "Describe the image you want to generate…";
      case "text-and-image-to-image":
        return "Attach an image and describe edits…";
      case "text-to-video":
        return "Describe the video scene you want to generate…";
      default:
        return "Type your message… (Shift+Enter for new line)";
    }
  };

  const isAttachmentAllowed = endpoint === "text-and-image-to-image";
  const canSend = !isLoading && (!!input.trim() || !!attachedImage);

  return (
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
              className="p-1 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Main Input box */}
        <div className={`relative flex items-end bg-[#13141b] border rounded-2xl transition-all gap-0 ${
          attachedImage ? "rounded-t-none" : ""
        } ${
          isLoading
            ? "border-violet-500/20"
            : "border-[#1e202b] focus-within:border-violet-500/50 focus-within:shadow-[0_0_15px_rgba(139,92,246,0.1)]"
        }`}>

          {/* Attachment trigger */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`p-4 pb-3.5 text-gray-400 hover:text-white transition-all shrink-0 ${
              !isAttachmentAllowed
                ? "opacity-30 cursor-not-allowed"
                : "cursor-pointer opacity-100"
            }`}
            title={isAttachmentAllowed ? "Attach image" : "Attach image (Requires image-to-image mode)"}
            disabled={!isAttachmentAllowed}
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* ✅ Multiline Textarea (Shift+Enter = newline, Enter = send) */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={getInputPlaceholder()}
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent py-4 text-sm outline-none text-gray-100 placeholder-gray-500 resize-none overflow-y-auto leading-relaxed"
            style={{ maxHeight: "160px", minHeight: "24px" }}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-2 px-3 pb-3 pt-3 shrink-0">
            {isLoading && (
              <div className="animate-spin p-2 text-violet-400">
                <RefreshCw className="h-4 w-4" />
              </div>
            )}

            {/* Hint: Enter to send */}
            {!isLoading && input.trim() && (
              <span className="text-[10px] text-gray-600 flex items-center gap-0.5 select-none">
                <CornerDownLeft className="h-2.5 w-2.5" />
                Send
              </span>
            )}

            {/* Dynamic model selector inside the chat box toolbar */}
            {endpoint === "text-to-text" && (
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="max-w-[140px] sm:max-w-[180px] py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-[#1a1c25] border border-[#2b2d3c] text-indigo-300 focus:outline-none focus:border-violet-500/50 transition-all cursor-pointer truncate"
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
            )}

            <button
              type="submit"
              disabled={!canSend}
              className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:bg-[#1f2130] disabled:text-gray-500 shadow-md shadow-violet-600/10 hover:shadow-violet-600/30 transition-all flex items-center justify-center cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

      </form>

      <div className="text-[10px] text-center text-gray-600 mt-2.5 font-sans">
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-[#1a1c23] border border-[#2a2c3a] font-mono text-gray-500">Enter</kbd> to send
          <span className="mx-1 text-gray-700">·</span>
          <kbd className="px-1 py-0.5 rounded bg-[#1a1c23] border border-[#2a2c3a] font-mono text-gray-500">Shift+Enter</kbd> for new line
        </span>
      </div>
    </div>
  );
}
