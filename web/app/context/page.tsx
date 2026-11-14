import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { KnownGaps } from "@/components/KnownGaps";
import { ExternalLink, Panel, SectionTitle } from "@/components/ui";
import { getSources } from "@/lib/data";
import type { Source } from "@/lib/types";

export const metadata: Metadata = {
  title: "Context",
  description: "Why fire safety in space matters (Apollo 1, Apollo 13, Mir), Earth spin-offs, and known gaps.",
};

const WHY = ["apollo-1", "apollo-13", "mir-fire-1997"];
const SPINOFFS = ["spinoff-air-tanks", "spinoff-fire-detector", "spinoff-fire-attire"];

function SourceCard({ source, extra }: { source: Source; extra?: ReactNode }) {
  return (
    <Panel className="flex h-full flex-col gap-3 p-5">
      <h3 className="font-semibold">{source.title}</h3>
      <p className="flex-1 leading-relaxed text-muted">{source.summary}</p>
      {extra}
      <ExternalLink href={source.url} className="text-sm">
        Read on NASA.gov
      </ExternalLink>
    </Panel>
  );
}

export default function ContextPage() {
  const sources = new Map(getSources().map((s) => [s.id, s]));
  return (
    <div className="space-y-12">
      <header className="max-w-3xl space-y-2 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Why this matters</h1>
        <p className="text-muted">
          Three real spacecraft fires shaped how NASA designs for fire safety, and the research behind them has
          reached firefighters on Earth. Summaries are generated from each NASA page and checked against a verbatim
          quote.
        </p>
      </header>

      <section aria-labelledby="incidents">
        <SectionTitle id="incidents" sub="The incidents that made spacecraft fire safety a design requirement.">
          Fires in spaceflight
        </SectionTitle>
        <ul className="grid gap-4 md:grid-cols-3">
          {WHY.map((id) => {
            const s = sources.get(id);
            return s ? (
              <li key={id}>
                <SourceCard source={s} />
              </li>
            ) : null;
          })}
        </ul>
      </section>

      <section aria-labelledby="spinoffs">
        <SectionTitle id="spinoffs" sub="NASA technology now used by firefighters and safety engineers.">
          Earth spin-offs
        </SectionTitle>
        <ul className="grid gap-4 md:grid-cols-3">
          {SPINOFFS.map((id) => {
            const s = sources.get(id);
            return s ? (
              <li key={id}>
                <SourceCard
                  source={s}
                  extra={
                    id === "spinoff-fire-detector" ? (
                      <p className="text-sm">
                        Related detection research:{" "}
                        <Link href="/investigations/PSI-102" className="text-ion underline decoration-ion/40 underline-offset-4">SAME</Link>
                        {" and "}
                        <Link href="/investigations/PSI-101" className="text-ion underline decoration-ion/40 underline-offset-4">SAME-R</Link>
                        {" "}studied how smoke behaves in microgravity.
                      </p>
                    ) : null
                  }
                />
              </li>
            ) : null;
          })}
        </ul>
      </section>

      <section aria-labelledby="gaps">
        <SectionTitle id="gaps">Known gaps</SectionTitle>
        <KnownGaps />
      </section>
    </div>
  );
}
