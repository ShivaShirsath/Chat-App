import { useEffect, useMemo, useState } from "react";
import Editor, { type BeforeMount } from "@monaco-editor/react";
import { Copy, Check } from "lucide-react";
import { copyToClipboard } from "../utils/clipboard";
import { defineMonacoCodeThemes, getCurrentCodeThemeName } from "../utils/codeThemes";
import { normalizeLanguage } from "../utils/prism";

interface CodeBlockProps {
  code: string;
  language?: string;
  hideHeader?: boolean;
}

const diffLanguages = new Set(["diff", "patch", "udiff"]);

const monacoLanguageAliases: Record<string, string> = {
  bash: "shell",
  csharp: "csharp",
  docker: "dockerfile",
  js: "javascript",
  jsx: "javascript",
  markup: "html",
  plaintext: "plaintext",
  py: "python",
  shell: "shell",
  "shell-session": "shell",
  sh: "shell",
  ts: "typescript",
  tsx: "typescript",
  yaml: "yaml",
  yml: "yaml",
};

function getEditorHeight(code: string): number {
  const lineCount = Math.max(code.split("\n").length, 1);
  return Math.min(Math.max(lineCount * 21 + 28, 92), 520);
}

function getMonacoLanguage(language: string): string {
  return monacoLanguageAliases[language] || language;
}

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

export default function CodeBlock({ code, language = "plaintext", hideHeader = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const themeName = useCodeThemeName();
  const normalizedLang = normalizeLanguage(language);
  const isDiff = diffLanguages.has(normalizedLang) || code.startsWith("diff --git") || code.includes("\n@@ ");
  const editorHeight = useMemo(() => getEditorHeight(code), [code]);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const beforeMount: BeforeMount = (monaco) => {
    defineMonacoCodeThemes(monaco);
  };

  return (
    <div className="code-block my-3 rounded-xl overflow-hidden border font-sans">
      {!hideHeader && (
        <div className="code-block__header flex items-center justify-between px-4 py-2 border-b">
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {isDiff ? "diff" : normalizedLang}
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
        <div className="code-block__editor" style={{ height: editorHeight }}>
          <Editor
            beforeMount={beforeMount}
            height={`${editorHeight}px`}
            value={code}
            language={getMonacoLanguage(normalizedLang)}
            theme={themeName}
            loading={<pre className="p-4 text-xs font-mono">{code}</pre>}
            options={{
              automaticLayout: true,
              contextmenu: false,
              domReadOnly: true,
              bracketPairColorization: { enabled: true },
              folding: false,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              fontLigatures: false,
              fontSize: 13,
              fontWeight: "500",
              glyphMargin: false,
              guides: { indentation: false },
              lineDecorationsWidth: 16,
              lineHeight: 21,
              lineNumbers: "off",
              lineNumbersMinChars: 0,
              minimap: { enabled: false },
              overviewRulerBorder: false,
              overviewRulerLanes: 0,
              padding: { top: 14, bottom: 14 },
              readOnly: true,
              renderLineHighlight: "none",
              renderValidationDecorations: "off",
              scrollBeyondLastLine: false,
              stickyScroll: { enabled: false },
              scrollbar: {
                alwaysConsumeMouseWheel: false,
                horizontal: "auto",
                horizontalScrollbarSize: 8,
                vertical: editorHeight >= 520 ? "auto" : "hidden",
                verticalScrollbarSize: 8,
              },
              selectOnLineNumbers: false,
              smoothScrolling: true,
              tabSize: 2,
              wordWrap: "off",
            }}
          />
        </div>
      )}
    </div>
  );
}
