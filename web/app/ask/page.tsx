import type { Metadata } from "next";
import { Ask } from "@/components/Ask";
import { getDemoAnswers, getRagConfig } from "@/lib/data";
import { numberCitations } from "@/lib/rag/answer";

export const metadata: Metadata = {
  title: "Ask",
  description: "Ask questions answered only from NASA sources, with a citation on every claim.",
};

export default function AskPage() {
  const cfg = getRagConfig();
  const demo = getDemoAnswers().map(numberCitations);
  return (
    <div className="space-y-6">
      <header className="max-w-3xl space-y-2 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Ask the NASA fire-safety librarian</h1>
        <p className="text-muted">
          Answers come only from NASA&apos;s PSI investigations and the challenge&apos;s NASA resources. Every claim is cited:
          PSI numbers link to the investigation, other facts to the NASA page. If our sources don&apos;t cover a
          question, it says so instead of guessing.
        </p>
      </header>
      <Ask demo={demo} maxChars={cfg.answer.max_question_chars} gapTriggers={cfg.known_gaps.trigger_keywords} />
    </div>
  );
}
