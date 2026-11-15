import type { ReactNode } from "react";
import { PHASE_LABEL, PILLAR_LABEL } from "@/lib/format";
import type { FuelPhase, Pillar } from "@/lib/types";

export function Chip({ children, tone = "default", title }: { children: ReactNode; tone?: "default" | "pillar" | "warn"; title?: string }) {
  const tones = {
    default: "border-line bg-panel-2 text-muted",
    pillar: "border-pillar/40 bg-pillar/10 text-pillar",
    warn: "border-warn/40 bg-warn/10 text-warn",
  };
  return (
    <span title={title} className={`inline-flex items-center border px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function PillarChips({ pillars }: { pillars: Pillar[] }) {
  if (!pillars.length) return <Chip title="No fire-safety pillar supported by the PSI text">No pillar</Chip>;
  return (
    <>
      {pillars.map((p) => (
        <Chip key={p} tone="pillar">
          {PILLAR_LABEL[p]}
        </Chip>
      ))}
    </>
  );
}

export function PhaseChip({ phase, unknown }: { phase: FuelPhase; unknown?: boolean }) {
  return unknown ? (
    <Chip title="PSI text does not establish the fuel phase">Fuel phase unknown</Chip>
  ) : (
    <Chip>{PHASE_LABEL[phase]}</Chip>
  );
}

export function UncheckedBadge() {
  return (
    <Chip tone="warn" title="Some fields were extracted by IgniterX from NASA text and are not yet hand-checked">
      IgniterX-extracted, not hand-checked
    </Chip>
  );
}

export function SectionTitle({ children, id, sub }: { children: ReactNode; id?: string; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 id={id} className="scroll-mt-24 text-xl font-semibold tracking-tight text-ink">
        {children}
      </h2>
      {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`border border-rule bg-panel ${className}`}>{children}</div>;
}

export function ExternalLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`text-ion underline decoration-ion/40 underline-offset-4 hover:decoration-ion ${className}`}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
