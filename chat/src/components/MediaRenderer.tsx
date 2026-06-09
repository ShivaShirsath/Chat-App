import { Eye } from "lucide-react";
import type { MediaType } from "../types/chat";

interface MediaRendererProps {
  mediaUrl: string;
  mediaType: MediaType;
}

export default function MediaRenderer({ mediaUrl, mediaType }: MediaRendererProps) {
  if (mediaType === "image") {
    return (
      <div className="relative rounded-xl overflow-hidden border border-border bg-card shadow-xl group">
        <img 
          src={mediaUrl} 
          alt="Generated Render" 
          className="max-h-96 w-full object-cover rounded-xl"
        />
        <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
          <a 
            href={mediaUrl} 
            target="_blank" 
            rel="noreferrer"
            className="p-2.5 rounded-full bg-white/10 text-primary-foreground hover:bg-white/20 backdrop-blur transition-all"
            title="Open in New Tab"
          >
            <Eye className="h-5 w-5" />
          </a>
        </div>
      </div>
    );
  }

  if (mediaType === "video") {
    return (
      <div className="rounded-xl overflow-hidden border border-border bg-background shadow-xl">
        <video 
          src={mediaUrl} 
          controls 
          loop
          className="w-full max-h-96 rounded-xl"
        />
      </div>
    );
  }

  return null;
}
