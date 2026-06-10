import type { CodeTheme } from "../types/chat";

export const lightThemes: CodeTheme[] = [
  "github-light",
  "solarized-light",
  "one-light",
  "vs-light",
  "light-owl",
  "gruvbox-light",
  "ayu-light",
  "tomorrow-light",
  "darcula-light",
];

export const darkThemes: CodeTheme[] = [
  "github-dark",
  "dracula",
  "nord",
  "solarized-dark",
  "monokai",
  "one-dark",
  "vs-dark",
  "synthwave84",
  "night-owl",
  "shades-of-purple",
  "gruvbox-dark",
  "ayu-dark",
  "ayu-mirage",
  "cobalt2",
  "cyberpunk",
  "tomorrow-night",
  "darcula-dark",
];

export const codeThemeOptions: CodeTheme[] = [
  "adaptive",
  ...lightThemes,
  ...darkThemes,
];

export const codeThemeLabels: Record<CodeTheme, string> = {
  "adaptive": "Adaptive (Matches App)",
  "github-light": "GitHub Light",
  "github-dark": "GitHub Dark",
  "dracula": "Dracula",
  "nord": "Nord",
  "solarized-light": "Solarized Light",
  "solarized-dark": "Solarized Dark",
  "monokai": "Monokai",
  "one-dark": "One Dark",
  "one-light": "One Light",
  "vs-dark": "VS Dark",
  "vs-light": "VS Light",
  "synthwave84": "SynthWave '84",
  "night-owl": "Night Owl",
  "light-owl": "Light Owl",
  "shades-of-purple": "Shades of Purple",
  "gruvbox-dark": "Gruvbox Dark",
  "gruvbox-light": "Gruvbox Light",
  "ayu-light": "Ayu Light",
  "ayu-dark": "Ayu Dark",
  "ayu-mirage": "Ayu Mirage",
  "cobalt2": "Cobalt2",
  "cyberpunk": "Cyberpunk",
  "tomorrow-night": "Tomorrow Night",
  "tomorrow-light": "Tomorrow Light",
  "darcula-dark": "Darcula Dark (IntelliJ)",
  "darcula-light": "Darcula Light (IntelliJ)",
};

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

export function getCodeThemeCounterpart(codeTheme: CodeTheme, targetDarkMode: boolean): CodeTheme | null {
  const pairs: [CodeTheme, CodeTheme][] = [
    ["github-light", "github-dark"],
    ["solarized-light", "solarized-dark"],
    ["one-light", "one-dark"],
    ["vs-light", "vs-dark"],
    ["light-owl", "night-owl"],
    ["gruvbox-light", "gruvbox-dark"],
    ["ayu-light", "ayu-dark"],
    ["tomorrow-light", "tomorrow-night"],
    ["darcula-light", "darcula-dark"],
  ];

  for (const [light, dark] of pairs) {
    if (targetDarkMode && codeTheme === light) {
      return dark;
    }
    if (!targetDarkMode && codeTheme === dark) {
      return light;
    }
  }
  return null;
}

export function getCodeMirrorThemeName(themeName: string): string {
  const base = themeName.replace(/^code-/, "");
  
  if (base === "adaptive-dark") return "darcula";
  if (base === "adaptive-light") return "default";
  
  switch (base) {
    case "github-light":
      return "default";
    case "github-dark":
      return "darcula";
    case "dracula":
      return "dracula";
    case "nord":
      return "nord";
    case "solarized-light":
      return "solarized light";
    case "solarized-dark":
      return "solarized dark";
    case "monokai":
      return "monokai";
    case "one-dark":
      return "zenburn";
    case "one-light":
      return "neat";
    case "vs-dark":
      return "darcula";
    case "vs-light":
      return "default";
    case "synthwave84":
      return "dracula";
    case "night-owl":
      return "cobalt";
    case "light-owl":
      return "elegant";
    case "shades-of-purple":
      return "cobalt";
    case "gruvbox-dark":
      return "zenburn";
    case "gruvbox-light":
      return "yeti";
    case "ayu-light":
      return "neat";
    case "ayu-dark":
      return "material";
    case "ayu-mirage":
      return "twilight";
    case "cobalt2":
      return "cobalt";
    case "cyberpunk":
      return "dracula";
    case "tomorrow-night":
      return "twilight";
    case "tomorrow-light":
      return "elegant";
    case "darcula-dark":
      return "darcula";
    case "darcula-light":
      return "default";
    default:
      return "default";
  }
}
