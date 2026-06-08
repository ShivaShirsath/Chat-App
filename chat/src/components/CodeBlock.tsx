import { useState } from "react";
import { Copy, Check } from "lucide-react";
import Prism from "prismjs";
import { copyToClipboard } from "../utils/clipboard";

// Load languages
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-javascript";

interface CodeBlockProps {
  code: string;
  language?: string;
  hideHeader?: boolean;
}

export default function CodeBlock({ code, language = "plaintext", hideHeader = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  let highlighted = code;
  const normalizedLang = (language || "plaintext").toLowerCase();
  
  if (Prism.languages[normalizedLang]) {
    try {
      highlighted = Prism.highlight(code, Prism.languages[normalizedLang], normalizedLang);
    } catch (e) {
      console.error("Prism highlights parse error:", e);
    }
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#1e202e] bg-[#0c0d14] font-sans">
      
      {/* Header bar */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#12131b] border-b border-[#1c1d29]">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          {normalizedLang}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 hover:text-white transition-all bg-[#1b1c28] px-2 py-1 rounded border border-[#2b2d3c] cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy Code
            </>
          )}
        </button>
      </div>
      )}

      {/* Code body */}
      <pre className="p-4 text-xs font-mono overflow-x-auto bg-[#08090d] select-text leading-relaxed">
        <code 
          className={`language-${normalizedLang}`} 
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
      
    </div>
  );
}
