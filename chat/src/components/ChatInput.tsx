import { useState, useRef } from "react";
import { Send, Paperclip, X, RefreshCw } from "lucide-react";
import type { ModelEndpoint } from "../types/chat";

interface ChatInputProps {
  endpoint: ModelEndpoint;
  isLoading: boolean;
  sendMessage: (content: string, imageBase64?: string) => void;
  input: string;
  setInput: (val: string) => void;
}

export default function ChatInput({ 
  endpoint, 
  isLoading, 
  sendMessage,
  input,
  setInput
}: ChatInputProps) {
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const getInputPlaceholder = () => {
    switch (endpoint) {
      case "text-to-text":
        return "Type your message...";
      case "text-to-image":
        return "Describe the image you want to generate...";
      case "text-and-image-to-image":
        return "Attach an image and describe edits...";
      case "text-to-video":
        return "Describe the video scene you want to generate...";
      default:
        return "Type your message...";
    }
  };

  const isAttachmentAllowed = endpoint === "text-and-image-to-image";

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
          
          {/* Attachment trigger (Only allowed for editing mode) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`p-4 text-gray-400 hover:text-white transition-all ${
              !isAttachmentAllowed 
                ? "opacity-30 cursor-not-allowed" 
                : "opacity-100"
            }`}
            title={isAttachmentAllowed ? "Attach image" : "Attach image (Requires image-to-image mode)"}
            disabled={!isAttachmentAllowed}
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
            placeholder={getInputPlaceholder()}
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
  );
}
