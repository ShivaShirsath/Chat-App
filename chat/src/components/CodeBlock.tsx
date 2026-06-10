import { useEffect, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import { copyToClipboard } from "../utils/clipboard";
import { getCurrentCodeThemeName, getCodeMirrorThemeName } from "../utils/codeThemes";
import { normalizeLanguage } from "../utils/prism";

// CodeMirror core
import * as CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";

// Import all themes
import "codemirror/theme/darcula.css";
import "codemirror/theme/dracula.css";
import "codemirror/theme/nord.css";
import "codemirror/theme/solarized.css";
import "codemirror/theme/monokai.css";
import "codemirror/theme/cobalt.css";
import "codemirror/theme/material.css";
import "codemirror/theme/eclipse.css";
import "codemirror/theme/neat.css";
import "codemirror/theme/elegant.css";
import "codemirror/theme/twilight.css";
import "codemirror/theme/yeti.css";
import "codemirror/theme/zenburn.css";

// Import modes
import "codemirror/mode/xml/xml";
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/css/css";
import "codemirror/mode/htmlmixed/htmlmixed";
import "codemirror/mode/python/python";
import "codemirror/mode/shell/shell";
import "codemirror/mode/sql/sql";
import "codemirror/mode/markdown/markdown";
import "codemirror/mode/clike/clike";
import "codemirror/mode/rust/rust";
import "codemirror/mode/go/go";
import "codemirror/mode/yaml/yaml";

interface CodeBlockProps {
  code: string;
  language?: string;
  hideHeader?: boolean;
}

const diffLanguages = new Set(["diff", "patch", "udiff"]);

function useCodeThemeName(): string {
  const [themeName, setThemeName] = useState(getCurrentCodeThemeName);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setThemeName(getCurrentCodeThemeName()));
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-code-theme"] });
    return () => observer.disconnect();
  }, []);

  return themeName;
}

function getDiffLineClass(line: string): string {
  if (line.startsWith("+++ ") || line.startsWith("--- ")) {
    return "code-diff__line--file";
  }
  if (line.startsWith("@@")) {
    return "code-diff__line--hunk";
  }
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return "code-diff__line--added";
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return "code-diff__line--removed";
  }
  return "";
}

function DiffCode({ code }: { code: string }) {
  return (
    <pre className="code-diff overflow-x-auto p-0 text-xs font-mono leading-relaxed select-text">
      {code.split("\n").map((line, index) => (
        <div key={`${index}-${line}`} className={`code-diff__line ${getDiffLineClass(line)}`}>
          {line || " "}
        </div>
      ))}
    </pre>
  );
}

function getCodeMirrorMode(language: string): string {
  const normalized = language.toLowerCase();
  switch (normalized) {
    case "javascript":
    case "js":
    case "jsx":
      return "javascript";
    case "typescript":
    case "ts":
    case "tsx":
      return "text/typescript";
    case "python":
    case "py":
      return "python";
    case "html":
    case "markup":
      return "htmlmixed";
    case "xml":
      return "xml";
    case "css":
      return "css";
    case "bash":
    case "sh":
    case "shell":
      return "shell";
    case "sql":
      return "text/x-sql";
    case "markdown":
    case "md":
      return "markdown";
    case "c":
    case "cpp":
    case "c++":
      return "text/x-c++src";
    case "java":
      return "text/x-java";
    case "csharp":
    case "cs":
      return "text/x-csharp";
    case "rust":
    case "rs":
      return "rust";
    case "go":
      return "go";
    case "yaml":
    case "yml":
      return "yaml";
    case "json":
      return "application/json";
    default:
      return "plaintext";
  }
}

export default function CodeBlock({ code, language = "plaintext", hideHeader = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const themeName = useCodeThemeName();
  const normalizedLang = normalizeLanguage(language);
  const isDiff = diffLanguages.has(normalizedLang) || code.startsWith("diff --git") || code.includes("\n@@ ");

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (isDiff || !containerRef.current) return;

    // Clear previous editor container content
    containerRef.current.innerHTML = "";

    const textarea = document.createElement("textarea");
    textarea.value = code;
    containerRef.current.appendChild(textarea);

    const cmTheme = getCodeMirrorThemeName(themeName);

    const editor = CodeMirror.fromTextArea(textarea, {
      mode: getCodeMirrorMode(normalizedLang),
      theme: cmTheme,
      readOnly: true,
      lineNumbers: false,
      lineWrapping: true,
      viewportMargin: Infinity,
    });

    // Match parent card styles to the active CodeMirror theme
    const wrapper = editor.getWrapperElement();
    const computedBg = window.getComputedStyle(wrapper).backgroundColor;
    const computedColor = window.getComputedStyle(wrapper).color;
    
    if (cardRef.current) {
      if (computedBg && computedBg !== "rgba(0, 0, 0, 0)" && computedBg !== "transparent") {
        cardRef.current.style.backgroundColor = computedBg;
        cardRef.current.style.borderColor = "rgba(255, 255, 255, 0.1)";
      }
      if (computedColor) {
        cardRef.current.style.color = computedColor;
      }
    }

    return () => {
      editor.toTextArea();
    };
  }, [code, normalizedLang, themeName, isDiff]);

  return (
    <div ref={cardRef} className="code-block my-3 rounded-xl overflow-hidden border font-sans">
      {!hideHeader && (
        <div className="code-block__header flex items-center justify-between px-4 py-2 border-b">
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {isDiff ? "diff" : (normalizedLang === "markup" ? "html" : normalizedLang)}
          </span>
          <button
            onClick={handleCopy}
            className="code-block__copy-button flex items-center gap-1.5 text-[10px] font-semibold transition-all px-2 py-1 rounded border cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
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

      {isDiff ? (
        <DiffCode code={code} />
      ) : (
        <div className="code-block__editor">
          <div ref={containerRef} />
        </div>
      )}
    </div>
  );
}
