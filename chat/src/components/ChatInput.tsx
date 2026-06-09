import { useState, useRef } from "react";
import { 
  Send, 
  Paperclip, 
  X, 
  RefreshCw, 
  CornerDownLeft, 
  Loader2, 
  Folder, 
  ChevronDown, 
  Check, 
  AlertCircle, 
  Square 
} from "lucide-react";
import type { ModelEndpoint, OllamaModel, ChatMode } from "../types/chat";

interface ChatInputProps {
  endpoint: ModelEndpoint;
  isLoading: boolean;
  sendMessage: (content: string, imageBase64?: string) => void;
  input: string;
  setInput: (val: string) => void;
  modelName: string;
  setModelName: (val: string) => void;
  models: OllamaModel[];

  // Agent Mode integrations
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;
  folderPath: string;
  isValidated: boolean;
  validationError: string | null;
  filesCount: number;
  isValidating: boolean;
  handleSelectFolder: () => void;
  handleStopAgent: () => void;
}

export default function ChatInput({ 
  endpoint, 
  isLoading, 
  sendMessage,
  input,
  setInput,
  modelName,
  setModelName,
  models,
  
  // Agent Mode integrations
  chatMode,
  setChatMode,
  folderPath,
  isValidated,
  validationError,
  filesCount,
  isValidating,
  handleSelectFolder,
  handleStopAgent
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
    if (chatMode === "agent") {
      if (!input.trim() || !isValidated || isLoading) return;
      sendMessage(input);
      setInput("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      return;
    }

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
    if (chatMode === "agent") {
      return "Describe the coding task for the agent… (e.g. 'list the files', 'change react style')";
    }
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

  const isAttachmentAllowed = endpoint === "text-and-image-to-image" && chatMode !== "agent";
  const canSend = !isLoading && (
    chatMode === "agent" 
      ? (!!input.trim() && isValidated) 
      : (!!input.trim() || !!attachedImage)
  );

  const projectFolderBaseName = folderPath.trim() 
    ? folderPath.split("/").pop() || folderPath
    : "Select Project";

  return (
    <div className="p-6 border-t border-border bg-background/80 backdrop-blur-md">
      <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex flex-col gap-2">

        {/* Project folder path selection block (rendered for Agent Mode) */}
        {chatMode === "agent" && (
          <div className="flex items-center gap-2 select-none">
            <button
              type="button"
              onClick={handleSelectFolder}
              disabled={isLoading || isValidating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-[10px] font-bold text-muted-foreground hover:text-primary-foreground transition-all cursor-pointer shadow-sm uppercase tracking-wider"
            >
              {isValidating ? (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              ) : (
                <Folder className="h-3.5 w-3.5 text-primary" />
              )}
              Project: <span className="text-primary font-semibold">{projectFolderBaseName}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            
            {isValidated && (
              <span className="flex items-center gap-1 text-[9px] text-primary font-bold bg-primary/10 px-2.5 py-1 rounded-full border border-primary/30">
                <Check className="h-3 w-3" />
                Indexed {filesCount} Files
              </span>
            )}
            {validationError && (
              <span className="flex items-center gap-1 text-[9px] text-destructive font-bold bg-destructive/10 px-2.5 py-1 rounded-full border border-destructive/30" title={validationError}>
                <AlertCircle className="h-3 w-3" />
                Error Path
              </span>
            )}
          </div>
        )}

        {/* Multimodal Preview Drawer */}
        {attachedImage && (
          <div className="absolute -top-[100px] left-0 right-0 bg-card border border-border p-2.5 rounded-t-xl flex items-center justify-between shadow-2xl z-10">
            <div className="flex items-center gap-3">
              <div className="h-14 w-20 rounded border border-border overflow-hidden bg-background flex items-center justify-center">
                <img
                  src={attachedImage}
                  alt="Attachment Preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary">Image attached</p>
                <p className="text-[10px] text-muted-foreground">Will be sent with prompt</p>
              </div>
            </div>
            <button
              type="button"
              onClick={removeAttachedImage}
              className="p-1 rounded-full hover:bg-accent text-muted-foreground hover:text-primary-foreground transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Main Input box */}
        <div className={`relative flex items-end bg-card border rounded-2xl transition-all gap-0 ${
          attachedImage ? "rounded-t-none" : ""
        } ${
          isLoading
            ? "border-primary/20"
            : "border-border focus-within:border-primary/50 focus-within:shadow-[0_0_15px_rgba(139,92,246,0.1)]"
        }`}>

          {/* Attachment trigger */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`p-4 pb-3.5 text-muted-foreground hover:text-primary-foreground transition-all shrink-0 ${
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

          {/* Multiline Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={getInputPlaceholder()}
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent py-4 text-sm outline-none text-foreground placeholder-gray-500 resize-none overflow-y-auto leading-relaxed"
            style={{ maxHeight: "160px", minHeight: "24px" }}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-2 px-3 pb-3 pt-3 shrink-0">
            {isLoading && (
              <div className="animate-spin p-2 text-primary">
                <RefreshCw className="h-4 w-4" />
              </div>
            )}

            {/* Hint: Enter to send */}
            {!isLoading && input.trim() && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 select-none">
                <CornerDownLeft className="h-2.5 w-2.5" />
                Send
              </span>
            )}

            {/* Mode selection pill switches */}
            {endpoint === "text-to-text" && (
              <div className="flex items-center gap-1 bg-card p-0.5 rounded-full border border-border shadow-sm select-none mr-1.5">
                <button
                  type="button"
                  onClick={() => setChatMode("ask")}
                  className={`py-1 px-3.5 rounded-full text-[9px] font-bold transition-all uppercase tracking-wider cursor-pointer ${
                    chatMode === "ask"
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-muted-foreground hover:text-primary-foreground"
                  }`}
                >
                  Ask Mode
                </button>
                <button
                  type="button"
                  onClick={() => setChatMode("agent")}
                  className={`py-1 px-3.5 rounded-full text-[9px] font-bold transition-all uppercase tracking-wider cursor-pointer ${
                    chatMode === "agent"
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-muted-foreground hover:text-primary-foreground"
                  }`}
                >
                  Agent Mode
                </button>
              </div>
            )}

            {/* Dynamic model selector inside the chat box toolbar */}
            {endpoint === "text-to-text" && (
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                disabled={isLoading}
                className="max-w-[140px] sm:max-w-[185px] py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-card border border-border text-primary focus:outline-none focus:border-primary/50 transition-all cursor-pointer truncate mr-1.5"
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
                      <optgroup key={tier} label={tier} className="bg-card text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                        {group.map((model) => (
                          <option key={model.id} value={model.id} className="text-primary bg-card font-medium text-xs normal-case tracking-normal">
                            {model.friendly_label}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })
                )}
              </select>
            )}

            {isLoading && chatMode === "agent" ? (
              <button
                type="button"
                onClick={handleStopAgent}
                className="p-2.5 rounded-xl bg-destructive/15 border border-destructive/25 hover:bg-destructive/25 text-destructive transition-all flex items-center justify-center cursor-pointer shadow-sm"
                title="Stop running agent"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                className="p-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-40 disabled:bg-muted disabled:text-muted-foreground shadow-md shadow-primary/10 hover:shadow-primary/30 transition-all flex items-center justify-center cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

      </form>

      <div className="text-[10px] text-center text-muted-foreground mt-2.5 font-sans">
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-muted-foreground">Enter</kbd> to send
          <span className="mx-1 text-muted-foreground">·</span>
          <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-muted-foreground">Shift+Enter</kbd> for new line
        </span>
      </div>
    </div>
  );
}
