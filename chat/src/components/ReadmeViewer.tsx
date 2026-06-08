import { useState, useEffect } from "react";
import { RefreshCw, MessageSquare } from "lucide-react";
import { formatMarkdown } from "../services/markdownService";

interface ReadmeViewerProps {
  onBackToChat: () => void;
}

export default function ReadmeViewer({ onBackToChat }: ReadmeViewerProps) {
  const [readmeContent, setReadmeContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setIsLoading(true);
    fetch("http://localhost:8001/api/v1/readme")
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

  const renderReadme = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("# ")) {
        return (
          <h1 key={idx} className="text-xl font-extrabold text-white mt-6 mb-3 border-b border-[#1c1d29] pb-2 font-outfit">
            {trimmed.slice(2)}
          </h1>
        );
      }
      if (trimmed.startsWith("## ")) {
        return (
          <h2 key={idx} className="text-lg font-bold text-indigo-300 mt-5 mb-2.5 font-outfit">
            {trimmed.slice(3)}
          </h2>
        );
      }
      if (trimmed.startsWith("### ")) {
        return (
          <h3 key={idx} className="text-base font-semibold text-purple-300 mt-4 mb-2 font-outfit">
            {trimmed.slice(4)}
          </h3>
        );
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

  return (
    <div className="flex-grow overflow-y-auto px-6 py-8 bg-[#07080b]">
      <div className="max-w-4xl mx-auto bg-[#0c0d14]/70 border border-[#191a24] rounded-2xl p-6 backdrop-blur-md shadow-2xl relative">
        <div className="absolute top-6 right-6">
          <button
            onClick={onBackToChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141520] hover:bg-[#1e202f] border border-[#2b2d3c] text-[10px] font-bold text-indigo-300 transition-all uppercase"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Back to Chat
          </button>
        </div>

        {isLoading ? (
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
  );
}
