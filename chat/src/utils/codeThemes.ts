import type * as Monaco from "monaco-editor";
import type { CodeTheme } from "../types/chat";

export const codeThemeOptions: CodeTheme[] = [
  "adaptive",
  "github-light",
  "github-dark",
  "dracula",
  "nord",
  "solarized-light",
  "solarized-dark",
];

export function isCodeTheme(value: string | null): value is CodeTheme {
  return value !== null && codeThemeOptions.includes(value as CodeTheme);
}

export function getStoredCodeTheme(): CodeTheme {
  const storedCodeTheme = localStorage.getItem("code-theme");
  return isCodeTheme(storedCodeTheme) ? storedCodeTheme : "adaptive";
}

export function getActiveCodeThemeName(codeTheme: CodeTheme, isDarkMode: boolean): string {
  if (codeTheme === "adaptive") {
    return isDarkMode ? "code-adaptive-dark" : "code-adaptive-light";
  }

  return `code-${codeTheme}`;
}

export function getCurrentCodeThemeName(): string {
  const root = document.documentElement;
  const selectedCodeTheme = root.dataset.codeTheme ?? null;
  const codeTheme: CodeTheme = isCodeTheme(selectedCodeTheme) ? selectedCodeTheme : "adaptive";
  return getActiveCodeThemeName(codeTheme, root.classList.contains("dark"));
}

export function defineMonacoCodeThemes(monaco: typeof Monaco): void {
  monaco.editor.defineTheme("code-adaptive-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "64748b", fontStyle: "italic" },
      { token: "keyword", foreground: "7c3aed", fontStyle: "bold" },
      { token: "string", foreground: "16a34a" },
      { token: "number", foreground: "ea580c" },
      { token: "type", foreground: "2563eb" },
      { token: "class", foreground: "2563eb" },
      { token: "function", foreground: "0891b2" },
      { token: "operator", foreground: "475569" },
    ],
    colors: {
      "editor.background": "#f8fafc",
      "editor.foreground": "#0f172a",
      "editorLineNumber.foreground": "#64748b",
      "editorCursor.foreground": "#2563eb",
      "editor.selectionBackground": "#bfdbfe",
      "editor.inactiveSelectionBackground": "#dbeafe",
    },
  });

  monaco.editor.defineTheme("code-adaptive-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "94a3b8", fontStyle: "italic" },
      { token: "keyword", foreground: "c4b5fd", fontStyle: "bold" },
      { token: "string", foreground: "86efac" },
      { token: "number", foreground: "fb923c" },
      { token: "type", foreground: "93c5fd" },
      { token: "class", foreground: "93c5fd" },
      { token: "function", foreground: "67e8f9" },
      { token: "operator", foreground: "cbd5e1" },
    ],
    colors: {
      "editor.background": "#111827",
      "editor.foreground": "#e5e7eb",
      "editorLineNumber.foreground": "#94a3b8",
      "editorCursor.foreground": "#93c5fd",
      "editor.selectionBackground": "#1d4ed866",
      "editor.inactiveSelectionBackground": "#1e293b",
    },
  });

  monaco.editor.defineTheme("code-github-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6e7781", fontStyle: "italic" },
      { token: "keyword", foreground: "cf222e", fontStyle: "bold" },
      { token: "string", foreground: "0a3069" },
      { token: "number", foreground: "0550ae" },
      { token: "type", foreground: "8250df" },
      { token: "class", foreground: "8250df" },
      { token: "function", foreground: "8250df" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#24292f",
      "editor.selectionBackground": "#0969da33",
      "editor.inactiveSelectionBackground": "#0969da22",
    },
  });

  monaco.editor.defineTheme("code-github-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8b949e", fontStyle: "italic" },
      { token: "keyword", foreground: "ff7b72", fontStyle: "bold" },
      { token: "string", foreground: "a5d6ff" },
      { token: "number", foreground: "79c0ff" },
      { token: "type", foreground: "ffa657" },
      { token: "class", foreground: "ffa657" },
      { token: "function", foreground: "d2a8ff" },
    ],
    colors: {
      "editor.background": "#0d1117",
      "editor.foreground": "#c9d1d9",
      "editor.selectionBackground": "#1f6feb66",
      "editor.inactiveSelectionBackground": "#1f6feb33",
    },
  });

  monaco.editor.defineTheme("code-dracula", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6272a4", fontStyle: "italic" },
      { token: "keyword", foreground: "ff79c6", fontStyle: "bold" },
      { token: "string", foreground: "f1fa8c" },
      { token: "number", foreground: "bd93f9" },
      { token: "type", foreground: "8be9fd" },
      { token: "class", foreground: "8be9fd" },
      { token: "function", foreground: "50fa7b" },
    ],
    colors: {
      "editor.background": "#282a36",
      "editor.foreground": "#f8f8f2",
      "editor.selectionBackground": "#44475a",
      "editor.inactiveSelectionBackground": "#343746",
    },
  });

  monaco.editor.defineTheme("code-nord", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "81a1c1", fontStyle: "italic" },
      { token: "keyword", foreground: "81a1c1", fontStyle: "bold" },
      { token: "string", foreground: "a3be8c" },
      { token: "number", foreground: "b48ead" },
      { token: "type", foreground: "8fbcbb" },
      { token: "class", foreground: "8fbcbb" },
      { token: "function", foreground: "88c0d0" },
    ],
    colors: {
      "editor.background": "#2e3440",
      "editor.foreground": "#d8dee9",
      "editor.selectionBackground": "#4c566a",
      "editor.inactiveSelectionBackground": "#3b4252",
    },
  });

  monaco.editor.defineTheme("code-solarized-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "93a1a1", fontStyle: "italic" },
      { token: "keyword", foreground: "859900", fontStyle: "bold" },
      { token: "string", foreground: "2aa198" },
      { token: "number", foreground: "d33682" },
      { token: "type", foreground: "b58900" },
      { token: "class", foreground: "b58900" },
      { token: "function", foreground: "268bd2" },
    ],
    colors: {
      "editor.background": "#fdf6e3",
      "editor.foreground": "#586e75",
      "editor.selectionBackground": "#eee8d5",
      "editor.inactiveSelectionBackground": "#eee8d580",
    },
  });

  monaco.editor.defineTheme("code-solarized-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "586e75", fontStyle: "italic" },
      { token: "keyword", foreground: "859900", fontStyle: "bold" },
      { token: "string", foreground: "2aa198" },
      { token: "number", foreground: "d33682" },
      { token: "type", foreground: "b58900" },
      { token: "class", foreground: "b58900" },
      { token: "function", foreground: "268bd2" },
    ],
    colors: {
      "editor.background": "#002b36",
      "editor.foreground": "#839496",
      "editor.selectionBackground": "#073642",
      "editor.inactiveSelectionBackground": "#07364280",
    },
  });
}
