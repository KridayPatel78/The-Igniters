"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { BookOpen, CircleSlash, LoaderCircle, MessageSquareText, Send } from "lucide-react";
import { mentionsKnownGap } from "@/lib/rag/config";
import type { AskResponse } from "@/lib/types";
import { AnswerText } from "./AnswerText";
import { KnownGaps } from "./KnownGaps";

interface Props {
  demo: AskResponse[];
  maxChars: number;
  gapTriggers: string[];
}

const MODE = {
  llm: { label: "IgniterX answer from NASA sources", Icon: MessageSquareText, cls: "border-good/40 bg-good/10 text-good" },
  passages: { label: "Most relevant NASA passages", Icon: BookOpen, cls: "border-ion/40 bg-ion/10 text-ion" },
  not_covered: { label: "Not covered by our NASA sources", Icon: CircleSlash, cls: "border-line bg-panel-2 text-muted" },
} as const;

export function Ask({ demo, maxChars, gapTriggers }: Props) {
  // ?q= (from "Ask IgniterX" chips elsewhere): demo questions answer instantly, others are asked once.
  const params = useSearchParams();
  const initialQ = (params.get("q") ?? "").trim().slice(0, maxChars);
  const initialDemo = initialQ ? demo.find((d) => d.question.toLowerCase() === initialQ.toLowerCase()) ?? null : null;
  const [question, setQuestion] = useState(initialDemo?.question ?? initialQ);
  const [result, setResult] = useState<AskResponse | null>(initialDemo);
  const [cached, setCached] = useState(Boolean(initialDemo));
  const asked = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idPrefix = useId().replace(/:/g, "");
  const gaps = { known_gaps: { trigger_keywords: gapTriggers, note: "" } };

  function showDemo(d: AskResponse) {
    setQuestion(d.question);
    setResult(d);
    setCached(true);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    await ask(question.trim());
  }

  async function ask(q: string) {
    if (!q) return setError("Please type a question.");
    const demoHit = demo.find((d) => d.question.toLowerCase() === q.toLowerCase());
    if (demoHit) return showDemo(demoHit);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong. Please try again.");
      setResult(data as AskResponse);
      setCached(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not reach IgniterX. Try a demo question below.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (asked.current || !initialQ || initialDemo) return;
    asked.current = true;
    void ask(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the ?q= question
  }, []);

  const mode = result ? MODE[result.mode] : null;
  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-2">
        <label htmlFor="question" className="block text-sm font-medium text-muted">
          Ask about NASA&apos;s microgravity fire experiments
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={maxChars}
            placeholder="e.g. Which experiments tested oxygen levels above 30%?…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-4 py-3 text-base text-ink placeholder:text-faint"
            aria-describedby="question-help"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-flame px-5 py-3 font-semibold text-bg hover:bg-flame/90 disabled:opacity-60"
          >
            {loading ? <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> : <Send aria-hidden className="h-4 w-4" />}
            Ask
          </button>
        </div>
        <p id="question-help" className="text-xs text-faint">
          {question.length}/{maxChars} characters · Answers use only NASA sources and cite every claim.
        </p>
      </form>

      <div>
        <p className="mb-2 text-sm font-medium text-muted">Try a demo question (instant)</p>
        <ul className="flex flex-wrap gap-2">
          {demo.map((d) => (
            <li key={d.question}>
              <button
                type="button"
                onClick={() => showDemo(d)}
                className="border border-rule bg-panel px-3 py-1.5 text-left text-sm text-ink hover:bg-panel-2"
              >
                {d.question}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div aria-live="polite" className="space-y-4">
        {loading ? (
          <p role="status" className="flex items-center gap-2 border border-rule bg-panel p-5 text-muted">
            <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> Searching 378 NASA passages and writing a cited answer…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-warn">
            {error}
          </p>
        ) : null}
        {result && mode ? (
          <article className="space-y-4 border border-rule bg-panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-semibold ${mode.cls}`}>
                <mode.Icon aria-hidden className="h-3.5 w-3.5" /> {mode.label}
              </span>
              {cached ? <span className="text-xs text-faint">Precomputed demo answer</span> : null}
            </div>
            <h2 className="text-lg font-semibold">{result.question}</h2>
            <AnswerText text={result.answer} idPrefix={idPrefix} />
            {result.citations.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">Sources</h3>
                <ol className="space-y-1 text-sm">
                  {result.citations.map((c) => (
                    <li key={c.n} id={`${idPrefix}-${c.n}`} className="flex gap-2">
                      <span className="font-mono text-faint">[{c.n}]</span>
                      {c.href.startsWith("/") ? (
                        <Link href={c.href} className="text-ion underline decoration-ion/40 underline-offset-4">
                          {c.label}
                        </Link>
                      ) : (
                        <a href={c.href} target="_blank" rel="noopener noreferrer" className="break-all text-ion underline decoration-ion/40 underline-offset-4">
                          {c.label}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </article>
        ) : null}
        {result && mentionsKnownGap(result.question, gaps) ? <KnownGaps compact /> : null}
      </div>
    </div>
  );
}
