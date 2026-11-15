import type { Metadata } from "next";
import { ArrowRight, PlayCircle } from "lucide-react";
import { ExternalLink, Panel, SectionTitle } from "@/components/ui";
import { getRubric, getSources, readText } from "@/lib/data";
import { Markdown } from "@/lib/markdown";

export const metadata: Metadata = {
  title: "Method & Sources",
  description: "How the ranking is computed, how the data flows, and all 10 NASA sources used.",
};

const PIPELINE = [
  ["Download", "24 PSI investigations + 22 experimental-table CSVs, fetched once and committed."],
  ["Clean", "Each CSV row is checked: footnotes, flow-visualization references, note-only rows, unmeasured 'same conditions' rows and exact duplicates are set aside, and typos are flagged. Cells are never edited."],
  ["Organize", "Contract fields from PSI JSON, numbers only from cleaned CSV rows, IgniterX only for text fields - each with a verbatim quote."],
  ["Score", "A transparent 0–100 rubric in Python, precomputed for all 32 scenario × focus × ventilation combinations."],
  ["Index", "378 passages from PSI and 8 NASA pages, embedded with Gemini for the question box."],
  ["Export", "Everything the website shows is written to static files; the site never re-scores."],
];

function coverageText(): string {
  const index = JSON.parse(readText("rag_index.json")) as { chunks: { id: string; text: string }[] };
  return index.chunks.find((c) => c.id === "coverage:gravity")?.text ?? "";
}

export default function MethodPage() {
  const sources = getSources();
  const coverage = coverageText().split("\n");
  return (
    <div className="space-y-12">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">Method &amp; sources</h1>
        <p className="text-muted">
          IgniterX explains, rules decide. Every score is plain arithmetic on values that trace to NASA&apos;s data, and every
          point comes with its reason.
        </p>
      </header>

      <section aria-labelledby="principles" className="grid gap-4 md:grid-cols-3">
        <h2 id="principles" className="sr-only">Principles</h2>
        {[
          ["Evidence only", "We only award points for evidence in NASA's data. \"Not reported\" scores 0, and the reason says so."],
          ["IgniterX explains, rules decide", "Rankings come from the rubric below. IgniterX writes explanations from the rubric's own reasons and answers questions only from cited NASA passages."],
          ["Cited by DOI", "Every investigation is cited by its PSI DOI (PSI policy, CC0 data). Other facts link to the NASA page they came from."],
        ].map(([title, text]) => (
          <Panel key={title} className="p-5">
            <h3 className="font-semibold text-flame">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
          </Panel>
        ))}
      </section>

      <section aria-labelledby="pipeline">
        <SectionTitle id="pipeline">How the data flows</SectionTitle>
        <ol className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {PIPELINE.map(([step, text], i) => (
            <li key={step} className="relative border border-rule bg-panel p-4">
              <p className="font-mono text-xs text-faint">{i + 1}</p>
              <p className="font-semibold">{step}</p>
              <p className="mt-1 text-sm text-muted">{text}</p>
              {i < PIPELINE.length - 1 ? <ArrowRight aria-hidden className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-faint xl:block" /> : null}
            </li>
          ))}
        </ol>
      </section>

      <section id="rubric" aria-labelledby="rubric-scoring-rubric-exact-formulas" className="scroll-mt-24">
        <Panel className="p-5 sm:p-6 [&>div>*:first-child]:mt-0">
          <Markdown source={getRubric()} idPrefix="rubric" />
        </Panel>
      </section>

      <section aria-labelledby="coverage">
        <SectionTitle id="coverage" sub="Computed from investigations.json; this is the passage IgniterX cites for gravity questions.">
          PSI Combustion Science coverage
        </SectionTitle>
        <Panel className="space-y-1 p-5 text-sm">
          {coverage.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </Panel>
      </section>

      <section aria-labelledby="sources">
        <SectionTitle id="sources" sub="All 10 resources from the NASA Space Apps challenge page.">
          Data sources
        </SectionTitle>
        <ol className="space-y-3">
          {sources.map((s, i) => (
            <li key={s.id} className="border border-rule bg-panel p-4">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-sm text-faint">{i + 1}</span>
                <ExternalLink href={s.url} className="font-semibold">{s.title}</ExternalLink>
                <span className="text-xs font-semibold text-muted">{s.type.replace("_", " ")}</span>
              </div>
              {s.id === "psi-combustion" ? (
                <p className="mt-1 text-sm text-muted">Core dataset: 24 investigations, cited by DOI; numbers in this site come only from here.</p>
              ) : null}
              {s.summary ? <p className="mt-1 text-sm text-muted">{s.summary}</p> : null}
              {s.pdf_url ? (
                <p className="mt-1 text-sm">
                  <ExternalLink href={s.pdf_url}>Full guide (PDF)</ExternalLink>
                </p>
              ) : null}
              {s.type === "video" ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm text-ion underline decoration-ion/40 underline-offset-4">
                  <PlayCircle aria-hidden className="h-4 w-4" /> Watch on YouTube (3.6 min)
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
