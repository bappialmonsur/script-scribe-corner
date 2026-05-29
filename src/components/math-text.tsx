import "katex/dist/katex.min.css";
import katex from "katex";
import React from "react";

const CMDS = [
  "frac","sqrt","cap","cup","leq","geq","neq","subset","supset","subseteq","supseteq",
  "cdot","times","div","pm","mp","infty","rightarrow","leftarrow","Rightarrow","Leftarrow",
  "left","right","alpha","beta","gamma","delta","theta","lambda","mu","pi","sigma","phi","omega",
  "sin","cos","tan","log","ln","sum","prod","int","lim","hspace","emptyset","mathbb","setminus","varnothing","le","ge",
];

function cleanArtifacts(s: string): string {
  return s
    .replace(/<!--.*?-->/g, " ")
    .replace(/\[[^\]]*বো\.[^\]]*\]/g, " ")
    .replace(/\[[^\]]*board[^\]]*\]/gi, " ")
    .replace(/\\?hspace\{[^}]*\}/g, " ")
    .replace(/[\r\f]/g, "")
    .replace(/ight/g, "right")
    .replace(/\bfracrac\b/g, "\\frac")
    .replace(/\bfleft\b/g, "\\left")
    .replace(/\\{2,}(frac|left|right|cup|cap|leq|geq|le|ge|setminus|phi|sqrt|times|div|infty|emptyset|varnothing|mathbb|subset|supset|subseteq|supseteq|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega)/g, "\\$1")
    .replace(/(?<![\\])left\(/g, "\\left(")
    .replace(/(?<![\\])right\)/g, "\\right)")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMath(s: string): string {
  let t = cleanArtifacts(s)
    .replace(/\f/g, "\\frac")
    .replace(/\t/g, "\\times")
    .replace(/\\hspace\{[^}]*\}/g, " ");
  // Add backslash to bare LaTeX command words
  for (const c of CMDS) {
    t = t.replace(new RegExp(`(?<![\\\\A-Za-z])${c}\\b`, "g"), `\\${c}`);
  }
  // "in" needs special care (very common English word) — only escape when surrounded by math-y context
  t = t.replace(/(?<![\\A-Za-z])in(?=\s*[A-Za-z\\{(])/g, "\\in");
  // Escape set-literal braces: { not preceded by a letter, backslash, or } and content has no backslash
  t = t.replace(/(?<![A-Za-z}\\])\{([^{}\\]*)\}/g, (_m, inner) => `\\{${inner}\\}`);
  return t;
}

function renderMath(src: string): { html: string; ok: boolean } {
  const normalized = normalizeMath(src);
  try {
    const html = katex.renderToString(normalized, { throwOnError: true, output: "html" });
    return { html, ok: true };
  } catch {
    return { html: "", ok: false };
  }
}

function cleanPlain(s: string): string {
  return cleanArtifacts(s)
    .replace(/[\s\\&]+$/g, "")
    .replace(/\$\{([^{}]+)\}\$/g, "$\\{$1\\}$");
}

/**
 * Renders text that may contain LaTeX math wrapped in $...$ or $$...$$.
 * Robust against messy PDF-extracted content: normalizes common pseudo-commands,
 * escapes set-literal braces, and falls back to plain text on KaTeX errors.
 */
export function MathText({ children, className }: { children: string | null | undefined; className?: string }) {
  const raw = cleanPlain(children ?? "");
  if (!raw) return null;
  if (!raw.includes("$")) return <span className={className}>{raw}</span>;

  const parts: React.ReactNode[] = [];
  const regex = /(\$\$[^$]+\$\$|\$[^$\n]+\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{raw.slice(lastIndex, match.index)}</span>);
    }
    const token = match[0];
    const inner = token.startsWith("$$") ? token.slice(2, -2).trim() : token.slice(1, -1).trim();
    const { html, ok } = renderMath(inner);
    if (ok) {
      parts.push(
        <span
          key={key++}
          className="katex-inline"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } else {
      // Fallback: show inner content as plain text (without $ wrappers)
      parts.push(<span key={key++}>{inner}</span>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < raw.length) parts.push(<span key={key++}>{raw.slice(lastIndex)}</span>);
  return <span className={className}>{parts}</span>;
}
