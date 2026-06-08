import { useEffect, useRef, useState, useMemo } from "react";
import mermaid from "mermaid";
import { Copy, Check, Code, Eye, AlertCircle } from "lucide-react";
import CodeBlock from "./CodeBlock";
import { copyToClipboard } from "../utils/clipboard";

// Initialize mermaid configurations for a dark theme matching the app layout
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "var(--font-sans)",
});

interface MermaidDiagramProps {
  code: string;
}

function cleanMermaidCode(raw: string): string {
  let clean = raw.trim();

  // Remove custom wrappers like @startgraph/@endgraph
  clean = clean.replace(/@startgraph\s*/g, "");
  clean = clean.replace(/@endgraph\s*/g, "");

  // Strip JS-style // comments but preserve URLs (http:// https://)
  clean = clean
    .split("\n")
    .map((line) => {
      // Use regex to find // that's NOT part of a URL
      const match = line.match(/^(.*?)(?<!https?:)\/\/.*$/);
      if (match) {
        return match[1].trimEnd();
      }
      return line;
    })
    .join("\n");

  // Fix semicolons after diagram type declarations: "graph LR;" → "graph LR"
  clean = clean.replace(
    /^((?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|mindmap)(?:\s+\w+)?)\s*;/im,
    "$1"
  );

  // Fix LLM mistake: "style A[JavaScript] fill:..." → "style A fill:..."
  // Mermaid style statements only accept the node ID, not the label
  clean = clean.replace(/\bstyle\s+(\w+)\[[^\]]*\]\s+/gi, "style $1 ");

  // Fix common LLM styling mistakes: "style B text fill:#fff" → "style B color:#fff"
  clean = clean.replace(
    /style\s+(\w+)\s+text\s+fill\s*:\s*([^;,\n]+)/gi,
    "style $1 color:$2"
  );

  // Fix curly braces inside square-bracket node labels: B[{Hello, World!}] → B["Hello, World!"]
  // In Mermaid, {..} inside [] is not valid and causes parse errors
  clean = clean.replace(/\[\{([^}]*)\}\]/g, (_match, inner) => `["${inner.trim()}"]`);

  // Auto-quote square-bracket node labels that contain special chars: B[Hello!] → B["Hello!"]
  // Special chars that break Mermaid parsing: !, @, #, $, %, ^, &, *, (, ), ,, ;, :
  // Only quote if the label is not already quoted (doesn't start with ")
  clean = clean.replace(/\[([^"\[\]][^\[\]]*)\]/g, (match, label) => {
    // If label contains special characters that aren't already handled, wrap in quotes
    if (/[!@#$%^&*(),;:]/.test(label) && !label.startsWith('"')) {
      return `["${label.replace(/"/g, "'")}"]`;
    }
    return match;
  });

  // Collapse excessive blank lines
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();

  return clean;
}

export default function MermaidDiagram({ code }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const renderIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Memoize cleanCode so effect only re-runs when the actual code changes
  const cleanCode = useMemo(() => cleanMermaidCode(code), [code]);

  useEffect(() => {
    mountedRef.current = true;

    if (!cleanCode) return;

    // Create a stable unique ID for this render
    const uniqueId = `mermaid-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    renderIdRef.current = uniqueId;

    setError(null);
    setSvg("");

    const renderChart = async () => {
      // Clean up any stale mermaid element from previous attempts
      const stale = document.getElementById(uniqueId);
      if (stale) stale.remove();

      try {
        const { svg: renderedSvg } = await mermaid.render(uniqueId, cleanCode);
        if (mountedRef.current) {
          setSvg(renderedSvg);
        }
      } catch (e: any) {
        console.error("Mermaid parsing error:", e);
        if (mountedRef.current) {
          setError(e.message || "Failed to render Mermaid diagram.");
        }
        // Clean up bad nodes to prevent ID collision issues
        const badEl = document.getElementById(uniqueId);
        if (badEl) badEl.remove();
      }
    };

    renderChart();

    return () => {
      mountedRef.current = false;
      // Clean up mermaid DOM artifacts on unmount
      if (renderIdRef.current) {
        const el = document.getElementById(renderIdRef.current);
        if (el) el.remove();
      }
    };
  }, [cleanCode]);

  const handleCopy = async () => {
    const success = await copyToClipboard(cleanCode);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // If there's an error, show BOTH the error box AND the code block
  if (error) {
    return (
      <div className="my-3 space-y-3 font-sans text-left">
        {/* Error box */}
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-950/10 text-xs font-mono text-red-400">
          <div className="flex items-center gap-1.5 font-bold mb-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>Mermaid Render Error:</span>
          </div>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>

        {/* Code block showing what went wrong */}
        <CodeBlock code={cleanCode} language="mermaid" />
      </div>
    );
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#1e202e] bg-[#0c0d14] font-sans text-left">
      {/* Header toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#12131b] border-b border-[#1c1d29]">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          Mermaid Diagram
        </span>
        <div className="flex items-center gap-2">
          {/* Show Code Toggle */}
          <button
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-white transition-all bg-[#1b1c28] px-2 py-1 rounded border border-[#2b2d3c] cursor-pointer"
          >
            {showCode ? (
              <>
                <Eye className="h-3 w-3 text-indigo-400" />
                Show Diagram
              </>
            ) : (
              <>
                <Code className="h-3 w-3 text-indigo-400" />
                Show Code
              </>
            )}
          </button>

          {/* Copy Code */}
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
      </div>

      {/* Render Panel */}
      {showCode ? (
        <CodeBlock code={cleanCode} language="mermaid" hideHeader={true} />
      ) : (
        <div className="p-5 flex justify-center overflow-x-auto bg-[#08090d] select-text min-h-[80px]">
          {svg ? (
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <span className="text-xs text-gray-500 animate-pulse self-center">
              Rendering diagram...
            </span>
          )}
        </div>
      )}
    </div>
  );
}
