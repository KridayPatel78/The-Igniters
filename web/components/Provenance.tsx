import type { ProvenanceValue } from "@/lib/types";

/** Human-readable "where this value came from" for one field. */
export function ProvenanceText({ value }: { value: ProvenanceValue | undefined }) {
  if (value === undefined) return <span className="text-faint">not recorded</span>;
  if (typeof value === "string") return <code className="break-words font-mono text-xs text-muted">{value}</code>;
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-0.5">
        {value.map((v) => (
          <li key={v}>
            <code className="break-words font-mono text-xs text-muted">{v}</code>
          </li>
        ))}
      </ul>
    );
  }
  const quotes = value.quote ? [value.quote] : (value.quotes ?? []);
  return (
    <div className="space-y-1">
      <code className="font-mono text-xs text-muted">{value.source}</code>
      {value.placeholder ? <p className="text-xs text-warn">Placeholder: {value.reason}</p> : null}
      {quotes.map((q, i) => (
        <blockquote key={i} className="border-l-2 border-line pl-2 text-xs italic text-muted">
          {q}
        </blockquote>
      ))}
    </div>
  );
}
