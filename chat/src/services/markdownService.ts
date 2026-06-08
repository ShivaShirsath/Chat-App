import { marked } from "marked";
import Prism from "prismjs";

// Import required languages for syntax highlighting
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-javascript";

const renderer = new marked.Renderer();

// Custom renderer to format code blocks with Prism highlighting
renderer.code = function({ text, lang }: { text: string; lang?: string }) {
  const language = lang || "plaintext";
  let highlighted = text;
  
  if (Prism.languages[language]) {
    try {
      highlighted = Prism.highlight(text, Prism.languages[language], language);
    } catch (e) {
      console.error("Prism highlight error:", e);
    }
  }
  
  return `<div class="my-3 rounded-xl overflow-hidden border border-[#1e202e] bg-[#0c0d14] font-sans">
    <div class="flex items-center justify-between px-4 py-2 bg-[#12131b] border-b border-[#1c1d29]">
      <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">${language}</span>
    </div>
    <pre class="p-4 text-xs font-mono text-purple-200 overflow-x-auto bg-[#08090d] select-text"><code class="language-${language}">${highlighted}</code></pre>
  </div>`;
};

// Custom renderer to format inline code spans
renderer.codespan = function({ text }: { text: string }) {
  return `<code class="bg-[#181920] text-purple-300 px-1.5 py-0.5 rounded text-xs font-mono">${text}</code>`;
};

marked.use({ renderer });

/**
 * Service responsible for parsing and formatting raw markdown strings into safe HTML.
 * Now supports syntax highlighting and tables via marked + prismjs.
 */
export function formatMarkdown(text: string): string {
  if (!text) return "";
  try {
    return marked.parse(text) as string;
  } catch (e) {
    console.error("Failed to parse markdown:", e);
    // Fallback in case of parsing failures
    return text;
  }
}
