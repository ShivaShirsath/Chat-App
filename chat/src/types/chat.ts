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
export type ActiveTab = "chat" | "readme";

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}
