import { useState, useEffect } from "react";
import { RefreshCw, MessageSquare } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import { API_BASE_URL } from "../utils/api";

interface ReadmeViewerProps {
  onBackToChat: () => void;
}

export default function ReadmeViewer({ onBackToChat }: ReadmeViewerProps) {
  const [readmeContent, setReadmeContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${API_BASE_URL}/api/v1/readme`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        setReadmeContent(data.content || "No content found.");
      })
      .catch(err => {
        setReadmeContent(`Failed to load README: ${err.message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="flex-grow overflow-y-auto px-6 py-8 bg-background">
      <div className="max-w-4xl mx-auto bg-card/70 border border-border rounded-2xl p-6 backdrop-blur-md shadow-2xl relative">
        <div className="absolute top-6 right-6 z-10">
          <button
            onClick={onBackToChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent border border-border text-[10px] font-bold text-primary transition-all uppercase cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Back to Chat
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="animate-spin text-primary">
              <RefreshCw className="h-6 w-6" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Fetching README.md from gateway...</p>
          </div>
        ) : (
          <div className="text-left select-text">
            <MarkdownRenderer content={readmeContent} />
          </div>
        )}
      </div>
    </div>
  );
}
