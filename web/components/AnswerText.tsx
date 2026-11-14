import type { ReactNode } from "react";

/** Plain-text answer -> paragraphs / bullet lists, **bold**, and [n] citation markers as links. */
export function AnswerText({ text, idPrefix }: { text: string; idPrefix: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.every((l) => /^[-*•]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^[-*•]\s+/, ""), idPrefix)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(lines.join(" "), idPrefix)}</p>;
      })}
    </div>
  );
}

function inline(text: string, idPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[(\d+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={m.index}>{m[1]}</strong>);
    else
      out.push(
        <sup key={m.index}>
          <a href={`#${idPrefix}-${m[2]}`} className="rounded px-0.5 font-mono text-xs text-ion hover:underline" aria-label={`Source ${m[2]}`}>
            [{m[2]}]
          </a>
        </sup>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
