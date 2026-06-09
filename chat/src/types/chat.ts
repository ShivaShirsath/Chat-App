export type MessageRole = "system" | "user" | "assistant";
export type MediaType = "text" | "image" | "video";

export interface FileDiffs {
  [filename: string]: string;
}

export interface PermissionRequest {
  question: string;
  options: string[];
  answeredChoice?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  isStreaming?: boolean;
  
  // Agent additions
  thoughts?: string[];
  terminalLogs?: string;
  diffs?: FileDiffs;
  permissionRequest?: PermissionRequest;
  thinkingTime?: number;
}

export type ModelEndpoint = "text-to-text" | "text-to-image" | "text-and-image-to-image" | "text-to-video";
export type ConnectionType = "websocket" | "http-sse";
export type ActiveTab = "chat" | "readme";
export type ChatMode = "ask" | "agent";
export type CodeTheme = "adaptive" | "github-light" | "github-dark" | "dracula" | "nord" | "solarized-light" | "solarized-dark";

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface OllamaModel {
  id: string;
  name: string;
  friendly_label: string;
  family: string;
  tier: string;
  is_uncensored: boolean;
  size_bytes: number;
  parameter_size: string;
  quantization_level: string;
}
