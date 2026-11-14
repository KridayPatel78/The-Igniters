import Link from "next/link";
import { Flame } from "lucide-react";
import { NavLinks } from "./NavLinks";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Flame aria-hidden className="h-5 w-5 text-flame" />
          <span>Flame in Freefall</span>
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}
