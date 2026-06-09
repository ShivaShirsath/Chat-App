import Prism from "prismjs";

import "prismjs/components/prism-clike";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-shell-session";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-php";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-diff";
import "prismjs/components/prism-git";
import "prismjs/components/prism-powershell";

const languageAliases: Record<string, string> = {
  "c++": "cpp",
  "c#": "csharp",
  cmd: "bash",
  console: "shell-session",
  dockerfile: "docker",
  html: "markup",
  js: "javascript",
  md: "markdown",
  none: "plaintext",
  ps: "powershell",
  ps1: "powershell",
  py: "python",
  rb: "ruby",
  shell: "bash",
  sh: "bash",
  text: "plaintext",
  ts: "typescript",
  yml: "yaml",
};

export function normalizeLanguage(language?: string): string {
  const normalized = (language || "plaintext").trim().toLowerCase();
  return languageAliases[normalized] || normalized || "plaintext";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readMatch(source: string, index: number, pattern: RegExp): string | null {
  const match = pattern.exec(source.slice(index));
  return match && match.index === 0 ? match[0] : null;
}

function wrapToken(type: string, value: string): string {
  return `<span class="token ${type}">${escapeHtml(value)}</span>`;
}

function highlightCodeLikeFallback(code: string, language: string): string {
  const keywords = /^(?:abstract|assert|async|await|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|export|extends|false|final|finally|float|for|from|function|goto|if|implements|import|in|instanceof|int|interface|let|long|native|new|null|package|private|protected|public|return|short|static|string|super|switch|this|throw|throws|true|try|type|var|void|volatile|while|yield)\b/;
  let highlighted = "";
  let index = 0;

  while (index < code.length) {
    const lineComment = readMatch(code, index, /^\/\/[^\n\r]*/);
    if (lineComment) {
      highlighted += wrapToken("comment", lineComment);
      index += lineComment.length;
      continue;
    }

    const blockComment = readMatch(code, index, /^\/\*[\s\S]*?\*\//);
    if (blockComment) {
      highlighted += wrapToken("comment", blockComment);
      index += blockComment.length;
      continue;
    }

    const string = readMatch(code, index, /^"(?:\\.|[^"\\])*"|^'(?:\\.|[^'\\])*'/);
    if (string) {
      highlighted += wrapToken("string", string);
      index += string.length;
      continue;
    }

    const keyword = readMatch(code, index, keywords);
    if (keyword) {
      highlighted += wrapToken("keyword", keyword);
      index += keyword.length;
      continue;
    }

    const number = readMatch(code, index, /^\b\d+(?:\.\d+)?\b/);
    if (number) {
      highlighted += wrapToken("number", number);
      index += number.length;
      continue;
    }

    const identifier = readMatch(code, index, /^[$A-Z_a-z][$\w]*/);
    if (identifier) {
      const afterIdentifier = code.slice(index + identifier.length);
      if (/^\s*\(/.test(afterIdentifier)) {
        highlighted += wrapToken("function", identifier);
      } else if (/^[A-Z]/.test(identifier) || ["java", "csharp", "kotlin", "swift"].includes(language) && ["String", "System"].includes(identifier)) {
        highlighted += wrapToken("class-name", identifier);
      } else {
        highlighted += escapeHtml(identifier);
      }
      index += identifier.length;
      continue;
    }

    const operator = readMatch(code, index, /^(?:=>|->|::|&&|\|\||[+\-*/%=!<>?:~&|^]+)/);
    if (operator) {
      highlighted += wrapToken("operator", operator);
      index += operator.length;
      continue;
    }

    const punctuation = readMatch(code, index, /^[{}[\]();.,]/);
    if (punctuation) {
      highlighted += wrapToken("punctuation", punctuation);
      index += punctuation.length;
      continue;
    }

    highlighted += escapeHtml(code[index]);
    index += 1;
  }

  return highlighted;
}

function highlightShellFallback(code: string): string {
  let highlighted = "";
  let index = 0;

  while (index < code.length) {
    const comment = readMatch(code, index, /^#[^\n\r]*/);
    if (comment) {
      highlighted += wrapToken("comment", comment);
      index += comment.length;
      continue;
    }

    const string = readMatch(code, index, /^"(?:\\.|[^"\\])*"|^'(?:\\.|[^'\\])*'/);
    if (string) {
      highlighted += wrapToken("string", string);
      index += string.length;
      continue;
    }

    const flag = readMatch(code, index, /^--?[\w-]+/);
    if (flag) {
      highlighted += wrapToken("keyword", flag);
      index += flag.length;
      continue;
    }

    const command = readMatch(code, index, /^\b(?:cd|chmod|chown|cp|curl|echo|export|find|git|grep|java|javac|ls|mkdir|mv|npm|npx|pnpm|rm|sudo|touch|yarn)\b/);
    if (command) {
      highlighted += wrapToken("function", command);
      index += command.length;
      continue;
    }

    highlighted += escapeHtml(code[index]);
    index += 1;
  }

  return highlighted;
}

function highlightWithFallback(code: string, language: string): string {
  if (["java", "javascript", "jsx", "typescript", "tsx", "c", "cpp", "csharp", "go", "rust", "kotlin", "swift", "php"].includes(language)) {
    return highlightCodeLikeFallback(code, language);
  }

  if (["bash", "shell-session", "powershell"].includes(language)) {
    return highlightShellFallback(code);
  }

  return escapeHtml(code);
}

export function highlightCode(code: string, language?: string): { highlighted: string; language: string } {
  const normalizedLanguage = normalizeLanguage(language);
  const grammar = Prism.languages[normalizedLanguage];

  if (grammar) {
    try {
      const highlighted = Prism.highlight(code, grammar, normalizedLanguage);
      if (highlighted.includes('class="token ')) {
        return { highlighted, language: normalizedLanguage };
      }
    } catch (error) {
      console.error("Prism highlight parse error:", error);
    }
  }

  return {
    highlighted: highlightWithFallback(code, normalizedLanguage),
    language: normalizedLanguage,
  };
}
