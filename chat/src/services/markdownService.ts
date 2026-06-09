import { marked } from "marked";
import { escapeHtml, highlightCode } from "../utils/prism";

const renderer = new marked.Renderer();

// Custom renderer to format code blocks with Prism highlighting
renderer.code = function({ text, lang }: { text: string; lang?: string }) {
  const { highlighted, language } = highlightCode(text, lang);
  
  return `<div class="code-block my-3 rounded-xl overflow-hidden border font-sans">
    <div class="code-block__header flex items-center justify-between px-4 py-2 border-b">
      <span class="text-[10px] font-bold uppercase tracking-wider">${language}</span>
    </div>
    <pre class="p-4 text-xs font-mono overflow-x-auto select-text"><code class="language-${language}">${highlighted}</code></pre>
  </div>`;
};

// Custom renderer to format inline code spans
renderer.codespan = function({ text }: { text: string }) {
  return `<code class="code-inline px-1.5 py-0.5 rounded text-xs font-mono">${escapeHtml(text)}</code>`;
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
