import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, MessageSquareText } from "lucide-react";
import { askHref } from "@/lib/format";

/** Plate: a framed chart panel (DESIGN.md), square, 1px black rule, title over a 2px rule. */
export function Card({
  title,
  sub,
  action,
  children,
  className = "",
  id,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section aria-labelledby={id} className={`border border-rule bg-panel p-4 sm:p-5 ${className}`}>
      {title ? (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-rule pb-2">
          <div className="min-w-0">
            <h2 id={id} className="scroll-mt-24 text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {sub ? <p className="mt-0.5 max-w-prose text-sm leading-relaxed text-muted">{sub}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Text link with an arrow, used as a plate action. */
export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-ion underline underline-offset-2">
      {children} <ArrowRight aria-hidden className="h-3.5 w-3.5" />
    </Link>
  );
}

/** Horizontal count bars in plain HTML: one series, black ink; the text label carries identity. */
export function CountBars({ items, total }: { items: { label: string; count: number; href?: string; note?: string }[]; total: number }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="space-y-3">
      {items.map((i) => {
        const label = (
          <span className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink">{i.label}</span>
            <span className="tabular text-muted">
              <span className="font-semibold text-ink">{i.count}</span> of {total}
            </span>
          </span>
        );
        return (
          <li key={i.label}>
            {i.href ? (
              <Link href={i.href} className="block hover:underline">
                {label}
              </Link>
            ) : (
              label
            )}
            <div className="mt-1 h-2 border border-rule bg-bg" aria-hidden>
              <div className="h-full bg-rule" style={{ width: `${(i.count / max) * 100}%` }} />
            </div>
            {i.note ? <p className="mt-1 text-xs text-faint">{i.note}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Suggested questions that open IgniterX with the question filled in. */
export function AskChips({ questions, title = "Ask IgniterX" }: { questions: string[]; title?: string; dark?: boolean }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <MessageSquareText aria-hidden className="h-4 w-4" /> {title}
      </p>
      <ul className="space-y-1.5">
        {questions.map((q) => (
          <li key={q}>
            <Link href={askHref(q)} className="group flex min-h-9 items-center justify-between gap-3 border border-rule bg-bg px-3 py-1.5 text-left text-sm text-ink hover:bg-panel-3">
              <span>{q}</span>
              <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
