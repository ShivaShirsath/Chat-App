import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeId = "9b0ab864" | "e03d68e7" | "1bfe07e5" | "34f7e1f7" | "1bf014bc" | "418a8650" | "dffd2629" | "f73e0bf6" | "737b8680";

export type Theme = {
  id: ThemeId;
  name: string;
  className: string;
  colorHex: string;
};

export const THEMES: Theme[] = [
  { id: "9b0ab864", name: "Sand (Yellow/Cream)", className: "theme-9b0ab864", colorHex: "#f7f6f0" },
  { id: "e03d68e7", name: "Ocean (Blue)", className: "theme-e03d68e7", colorHex: "#3b82f6" },
  { id: "1bfe07e5", name: "Rose (Red)", className: "theme-1bfe07e5", colorHex: "#e11d48" },
  { id: "34f7e1f7", name: "Emerald (Green)", className: "theme-34f7e1f7", colorHex: "#10b981" },
  { id: "1bf014bc", name: "Amber Minimal (Yellow)", className: "theme-1bf014bc", colorHex: "#f59e0b" },
  { id: "418a8650", name: "Vercel (Black)", className: "theme-418a8650", colorHex: "#000000" },
  { id: "dffd2629", name: "Starry Night (Indigo)", className: "theme-dffd2629", colorHex: "#4f46e5" },
  { id: "f73e0bf6", name: "Facebook (Blue)", className: "theme-f73e0bf6", colorHex: "#2563eb" },
  { id: "737b8680", name: "Soft Pop (Rose)", className: "theme-737b8680", colorHex: "#e11d48" }
];

type ThemeState = {
  themeId: ThemeId;
  darkMode: boolean;
  setTheme: (id: ThemeId) => void;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeId: "9b0ab864",
      darkMode: false,
      setTheme: (themeId) => set({ themeId }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setDarkMode: (darkMode) => set({ darkMode }),
    }),
    {
      name: "chat-theme-settings",
    }
  )
);
