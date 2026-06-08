import { marked } from "marked";
import CodeBlock from "./CodeBlock";
import MermaidDiagram from "./MermaidDiagram";

interface MarkdownRendererProps {
  content: string;
  /** True for user messages — applies slightly lighter styling and preserves line breaks */
  isUser?: boolean;
}

export default function MarkdownRenderer({ content, isUser = false }: MarkdownRendererProps) {
  if (!content) return null;

  try {
    // breaks:true converts single newlines → <br> tokens, which is critical for
    // multiline user messages that don't use double-newline paragraph spacing
    const tokens = marked.lexer(content, { breaks: true, gfm: true });
    return (
      <div className="prose prose-invert font-sans max-w-none text-left select-text">
        {tokens.map((token, idx) => renderToken(token, idx, isUser))}
      </div>
    );
  } catch (e) {
    console.error("Failed to tokenize markdown:", e);
    // Fallback: render plain text preserving line breaks
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">
        {content}
      </div>
    );
  }
}

/** Render a sequence of inline tokens (bold, em, code, links, line breaks, text) */
function renderInline(tokens?: any[], isUser?: boolean): React.ReactNode {
  if (!tokens) return null;
  return tokens.map((token, idx) => {
    switch (token.type) {
      case "strong":
        return (
          <strong key={idx} className={isUser ? "text-white font-bold" : "text-indigo-300 font-bold"}>
            {renderInline(token.tokens, isUser)}
          </strong>
        );
      case "em":
        return (
          <em key={idx} className="italic text-gray-300">
            {renderInline(token.tokens, isUser)}
          </em>
        );
      case "codespan":
        return (
          <code key={idx} className="bg-[#181920] text-purple-300 px-1.5 py-0.5 rounded text-xs font-mono">
            {token.text}
          </code>
        );
      case "br":
        return <br key={idx} />;
      case "link":
        return (
          <a
            key={idx}
            href={token.href}
            target="_blank"
            rel="noreferrer"
            className="text-violet-400 hover:text-violet-300 hover:underline"
          >
            {renderInline(token.tokens, isUser)}
          </a>
        );
      case "text":
        // Preserve inline newlines that may come through even with breaks:true
        return renderTextWithBreaks(token.text, idx);
      default:
        return token.raw || token.text || null;
    }
  });
}

/** Split a text node on literal \n and insert <br> between lines */
function renderTextWithBreaks(text: string, key: number): React.ReactNode {
  // Decode HTML entities first
  const decoded = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  if (!decoded.includes("\n")) return decoded;

  return decoded.split("\n").map((line, i, arr) => (
    <span key={`${key}-${i}`}>
      {line}
      {i < arr.length - 1 && <br />}
    </span>
  ));
}

/** Render a top-level block token */
function renderToken(token: any, idx: number, isUser: boolean): React.ReactNode {
  const textColor = isUser ? "text-gray-100" : "text-gray-300";

  switch (token.type) {
    case "heading": {
      const Tag = `h${token.depth}` as any;
      const classMap: Record<number, string> = {
        1: "text-xl font-extrabold text-white mt-4 mb-2 border-b border-[#1c1d29] pb-2",
        2: "text-lg font-bold text-indigo-300 mt-4 mb-2",
        3: "text-base font-semibold text-purple-300 mt-3 mb-1.5",
        4: "text-sm font-semibold text-purple-300 mt-2.5 mb-1",
        5: "text-xs font-semibold text-purple-400 mt-2 mb-1",
        6: "text-xs font-semibold text-purple-400 mt-1.5 mb-1",
      };
      return (
        <Tag key={idx} className={classMap[token.depth] || classMap[6]}>
          {renderInline(token.tokens, isUser)}
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p key={idx} className={`text-sm ${textColor} my-2 leading-relaxed`}>
          {renderInline(token.tokens, isUser)}
        </p>
      );

    case "code":
      if (token.lang === "mermaid") {
        return <MermaidDiagram key={idx} code={token.text} />;
      }
      return <CodeBlock key={idx} code={token.text} language={token.lang} />;

    case "blockquote":
      return (
        <blockquote
          key={idx}
          className="border-l-4 border-violet-500 bg-[#12131b] p-3 rounded-r-lg text-xs text-gray-400 my-3 leading-relaxed italic"
        >
          {token.tokens.map((subToken: any, subIdx: number) =>
            renderToken(subToken, subIdx, isUser)
          )}
        </blockquote>
      );

    case "list": {
      const Tag = token.ordered ? "ol" : "ul";
      const listClass = token.ordered ? "list-decimal ml-5 my-2" : "list-disc ml-5 my-2";
      return (
        <Tag key={idx} className={listClass}>
          {token.items.map((item: any, itemIdx: number) => (
            <li key={itemIdx} className={`text-sm ${textColor} my-0.5 leading-relaxed`}>
              {item.tokens.map((subToken: any, subIdx: number) =>
                renderToken(subToken, subIdx, isUser)
              )}
            </li>
          ))}
        </Tag>
      );
    }

    case "table":
      return (
        <div key={idx} className="overflow-x-auto my-4 rounded-xl border border-[#1a1c23]">
          <table className="min-w-full divide-y divide-[#1c1d29] bg-transparent">
            <thead className="bg-[#12131b]">
              <tr>
                {token.header.map((cell: any, cellIdx: number) => (
                  <th
                    key={cellIdx}
                    className="px-4 py-2 text-left text-xs font-semibold text-indigo-300 uppercase tracking-wider"
                  >
                    {renderInline(cell.tokens, isUser)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#16171f]">
              {token.rows.map((row: any[], rowIdx: number) => (
                <tr key={rowIdx} className="hover:bg-white/5 transition-all">
                  {row.map((cell: any, cellIdx: number) => (
                    <td key={cellIdx} className="px-4 py-2.5 text-xs text-gray-300">
                      {renderInline(cell.tokens, isUser)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "hr":
      return <hr key={idx} className="border-[#1e202b] my-4" />;

    case "space":
      return null;

    default:
      // Fallback: show raw token content
      if (token.raw?.trim()) {
        return (
          <div key={idx} className={`text-sm ${textColor} my-1`}>
            {renderTextWithBreaks(token.raw, idx)}
          </div>
        );
      }
      return null;
  }
}
