import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { CHALLENGE_URL } from "@/lib/format";
import { ExternalLink } from "./ui";

export const KNOWN_GAPS_TEXT =
  "No combustion experiments in NASA's PSI repository were run in real Moon gravity. The closest is PSI-22 (ACME E-FIELD Flames), which used an electric field to mimic partial gravity. NASA plans partial-gravity fire experiments such as LUCI and FM2. Until that data exists, microgravity and Earth-gravity results can bound what happens in between.";

/** The fixed Known-gaps note (Explore, Ask, Context), with its three sources. */
export function KnownGaps({ compact = false }: { compact?: boolean }) {
  return (
    <aside aria-label="Known gaps" className="border-2 border-flame-fill p-4">
      <div className="flex gap-3">
        <TriangleAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-flame" />
        <div className="space-y-2">
          <p className="font-semibold text-ink">Known gap: no real partial-gravity fire data</p>
          <p className={`text-ink ${compact ? "text-sm" : ""}`}>{KNOWN_GAPS_TEXT}</p>
          <p className="text-sm text-muted">
            Sources:{" "}
            <Link href="/method#coverage" className="text-ion underline decoration-ion/40 underline-offset-4">
              PSI coverage (24 investigations)
            </Link>
            {" · "}
            <Link href="/investigations/PSI-22" className="text-ion underline decoration-ion/40 underline-offset-4">
              PSI-22 ACME E-FIELD Flames
            </Link>
            {" · "}
            <ExternalLink href={CHALLENGE_URL}>NASA Space Apps challenge page (LUCI, FM2)</ExternalLink>
          </p>
        </div>
      </div>
    </aside>
  );
}
