export type MessageRole = "system" | "user" | "assistant";
export type MediaType = "text" | "image" | "video";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  isStreaming?: boolean;
}

export type ModelEndpoint = "text-to-text" | "text-to-image" | "text-and-image-to-image" | "text-to-video";
export type ConnectionType = "websocket" | "http-sse";
export type ActiveTab = "chat" | "readme" | "agent";

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
