import { useEffect, useRef, useState, useMemo } from "react";
import mermaid from "mermaid";
import { Copy, Check, Code, Eye, AlertCircle } from "lucide-react";
import CodeBlock from "./CodeBlock";
import { copyToClipboard } from "../utils/clipboard";

// Initialize mermaid with a dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "var(--font-sans)",
});

interface MermaidDiagramProps {
  code: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// cleanMermaidCode
// Fixes the most common output mistakes that local LLMs (Llama 3.2 etc.) make
// when generating Mermaid diagrams.
// ─────────────────────────────────────────────────────────────────────────────
function cleanMermaidCode(raw: string): string {
  let clean = raw.trim();

  // 1. Strip @startXxx / @endXxx wrappers (PlantUML-style, not Mermaid)
  clean = clean.replace(/@start\w+\s*/gi, "");
  clean = clean.replace(/@end\w+\s*/gi, "");

  // 2. Strip JS-style // comments, but preserve http:// and https://
  clean = clean
    .split("\n")
    .map((line) => {
      const m = line.match(/^(.*?)(?<!https?:)\/\/.*$/);
      return m ? m[1].trimEnd() : line;
    })
    .join("\n");

  // 3. Fix sequence-diagram arrow types used inside flowchart/graph blocks
  //    -->>  →  -->   (Llama often uses sequence-diagram double-angle arrows)
  //    <<--  →  <--
  clean = clean
    .replace(/-->>/g, "-->")
    .replace(/<<--/g, "<--")
    .replace(/->>(?!>)/g, "->")
    .replace(/<<-(?!-)/g, "<-");

  // 4. If the LLM concatenated multiple diagrams in one code fence, keep only
  //    the FIRST complete diagram (stop at the second "graph"/"flowchart"/etc.)
  const DIAGRAM_KEYWORD =
    /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|gitGraph|journey|mindmap|xychart-beta|block-beta|architecture-beta)\b/i;

  const allLines = clean.split("\n");
  let diagramCount = 0;
  const keptLines: string[] = [];
  for (const line of allLines) {
    if (DIAGRAM_KEYWORD.test(line.trim())) {
      diagramCount++;
      if (diagramCount > 1) break; // drop everything after second diagram header
    }
    keptLines.push(line);
  }
  clean = keptLines.join("\n");

  // 5. Fix trailing semicolons on diagram-type lines: "graph LR;" → "graph LR"
  clean = clean.replace(
    /^((?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|mindmap)(?:\s+\w+)?)\s*;/im,
    "$1"
  );

  // 6. Strip node labels from style statements
  //    "style A[JavaScript] fill:..." → "style A fill:..."
  clean = clean.replace(/\bstyle\s+(\w+)\[[^\]]*\]\s*/gi, "style $1 ");

  // 7. Fix "style B text fill:#fff" → "style B color:#fff"  (LLM mistake)
  clean = clean.replace(
    /\bstyle\s+(\w+)\s+text\s+fill\s*:\s*([^;,\n]+)/gi,
    "style $1 color:$2"
  );

  // 8. Drop style lines that reference node IDs not actually declared as nodes.
  //    LLMs sometimes emit: "style JavaScript fill:..." where "JavaScript" is a
  //    label, not a declared node ID — Mermaid rejects this.
  const declaredNodes = new Set<string>();
  // Collect node IDs from edge definitions and explicit node defs
  for (const line of clean.split("\n")) {
    // Edge: A --> B  or  A -->|label| B
    const edge = line.match(
      /^\s*(\w[\w-]*)\s*(?:-->|---|==>|-\.-?>|-x|--o)/
    );
    if (edge) declaredNodes.add(edge[1]);
    const rhsEdge = line.match(
      /(?:-->|---|==>|-\.-?>|-x|--o)\s*\|?[^|]*\|?\s*(\w[\w-]*)/
    );
    if (rhsEdge) declaredNodes.add(rhsEdge[1]);
    // Explicit node def: A[label] A(label) A{label} A((label))
    const nodeDef = line.match(/^\s*(\w[\w-]*)\s*[\[\(\{<]/);
    if (nodeDef) declaredNodes.add(nodeDef[1]);
  }
  if (declaredNodes.size > 0) {
    clean = clean
      .split("\n")
      .filter((line) => {
        const sm = line.match(/^\s*style\s+(\w[\w-]*)\s+/i);
        if (!sm) return true; // not a style line — keep
        return declaredNodes.has(sm[1]); // keep only if that node was declared
      })
      .join("\n");
  }

  // 9. Fix curly braces inside square-bracket labels: B[{text}] → B["text"]
  clean = clean.replace(/\[\{([^}]*)\}\]/g, (_m, inner) => `["${inner.trim()}"]`);

  // 10. Auto-quote bracket labels that contain chars that break the parser
  clean = clean.replace(/\[([^"\[\]][^\[\]]*)\]/g, (match, label) => {
    if (/[!@#$%^&*(),;:<>]/.test(label) && !label.startsWith('"')) {
      return `["${label.replace(/"/g, "'")}"]`;
    }
    return match;
  });

  // 11. Collapse 3+ blank lines → 1
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();

  return clean;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MermaidDiagram({ code }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const renderIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const cleanCode = useMemo(() => cleanMermaidCode(code), [code]);

  useEffect(() => {
    mountedRef.current = true;
    if (!cleanCode) return;

    const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    renderIdRef.current = uniqueId;
    setError(null);
    setSvg("");

    const renderChart = async () => {
      const stale = document.getElementById(uniqueId);
      if (stale) stale.remove();
      try {
        const { svg: renderedSvg } = await mermaid.render(uniqueId, cleanCode);
        if (mountedRef.current) setSvg(renderedSvg);
      } catch (e: any) {
        console.error("Mermaid parsing error:", e);
        if (mountedRef.current) setError(e.message || "Failed to render diagram.");
        document.getElementById(uniqueId)?.remove();
      }
    };

    renderChart();

    return () => {
      mountedRef.current = false;
      if (renderIdRef.current) document.getElementById(renderIdRef.current)?.remove();
    };
  }, [cleanCode]);

  const handleCopy = async () => {
    const success = await copyToClipboard(code); // copy the ORIGINAL code, not the cleaned version
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (error) {
    return (
      <div className="my-3 space-y-2 font-sans text-left">
        <div className="p-3 rounded-xl border border-red-500/20 bg-red-950/10 text-xs font-mono text-red-400">
          <div className="flex items-center gap-1.5 font-bold mb-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <span>Mermaid Render Error</span>
          </div>
          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed opacity-80">{error}</pre>
        </div>
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
          <button
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-white transition-all bg-[#1b1c28] px-2 py-1 rounded border border-[#2b2d3c] cursor-pointer"
          >
            {showCode ? (
              <><Eye className="h-3 w-3 text-indigo-400" />Show Diagram</>
            ) : (
              <><Code className="h-3 w-3 text-indigo-400" />Show Code</>
            )}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 hover:text-white transition-all bg-[#1b1c28] px-2 py-1 rounded border border-[#2b2d3c] cursor-pointer"
          >
            {copied ? (
              <><Check className="h-3 w-3 text-emerald-400" />Copied!</>
            ) : (
              <><Copy className="h-3 w-3" />Copy Code</>
            )}
          </button>
        </div>
      </div>

      {/* Render panel */}
      {showCode ? (
        <CodeBlock code={cleanCode} language="mermaid" hideHeader />
      ) : (
        <div className="p-5 flex justify-center overflow-x-auto bg-[#08090d] select-text min-h-[80px]">
          {svg ? (
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <span className="text-xs text-gray-500 animate-pulse self-center">
              Rendering diagram…
            </span>
          )}
        </div>
      )}
    </div>
  );
}
