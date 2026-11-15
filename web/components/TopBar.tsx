"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Flame, Menu, X } from "lucide-react";

const LINKS: { href: string; label: string; match?: string[] }[] = [
  { href: "/", label: "Evidence chart", match: ["/investigations"] },
  { href: "/explorer", label: "Data Explorer" },
  { href: "/controls", label: "Fire-safety controls" },
  { href: "/compare", label: "Compare" },
  { href: "/ask", label: "Ask IgniterX" },
  { href: "/context", label: "Why it matters" },
  { href: "/method", label: "Method & sources" },
];

function isActive(pathname: string, href: string, match: string[] = []): boolean {
  if (href === "/") return pathname === "/" || match.some((m) => pathname.startsWith(m));
  return pathname.startsWith(href);
}

/** The brand as a chart cell: "Ff", 24 investigations in the atomic-number corner. */
export function BrandTile({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-12 w-12" : "h-10 w-10";
  return (
    <span aria-hidden className={`relative grid ${box} shrink-0 place-items-center border border-rule bg-flame-fill text-white`}>
      <span className="tabular absolute left-0.5 top-0.5 text-[9px] font-semibold leading-none">24</span>
      <Flame aria-hidden className="absolute right-0.5 top-0.5 h-2.5 w-2.5" strokeWidth={2.5} />
      <span className="font-cond text-lg font-bold leading-none">Ff</span>
    </span>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="Flame in Freefall, evidence chart">
      <BrandTile />
      <span className="leading-tight">
        <span className="block text-base font-semibold tracking-tight text-ink">Flame in Freefall</span>
        <span className="block text-xs text-muted">NASA microgravity fire evidence</span>
      </span>
    </Link>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  // Menu sheet: focus moves in, Tab stays inside, Escape closes, focus returns to the menu button.
  useEffect(() => {
    if (!open) return;
    const root = panel.current;
    const focusables = () => [...(root?.querySelectorAll<HTMLElement>("a[href], button") ?? [])];
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key !== "Tab") return;
      const items = focusables();
      if (e.shiftKey && document.activeElement === items[0]) {
        e.preventDefault();
        items[items.length - 1]?.focus();
      } else if (!e.shiftKey && document.activeElement === items[items.length - 1]) {
        e.preventDefault();
        items[0]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const button = opener.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      button?.focus();
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-rule bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-6 px-4 py-2.5 sm:px-6 lg:px-10">
        <Brand />
        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {LINKS.map(({ href, label, match }) => {
              const active = isActive(pathname, href, match);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-10 items-center border-b-2 px-2.5 text-sm font-medium transition-colors ${
                      active ? "border-rule text-ink" : "border-transparent text-muted hover:border-line hover:text-ink"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <button
          ref={opener}
          type="button"
          onClick={() => setOpen(true)}
          className="grid h-11 w-11 place-items-center border border-rule text-ink hover:bg-panel-2 xl:hidden"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          <Menu aria-hidden className="h-5 w-5" />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 xl:hidden" id="mobile-nav" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" tabIndex={-1} aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div ref={panel} className="absolute inset-y-0 right-0 w-80 max-w-[88vw] overflow-y-auto overscroll-contain border-l-2 border-rule bg-bg px-5 py-4">
            <div className="mb-6 flex items-center justify-between">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center border border-rule hover:bg-panel-2" aria-label="Close menu">
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Main">
              <ul className="divide-y divide-line border-y border-line">
                {LINKS.map(({ href, label, match }) => {
                  const active = isActive(pathname, href, match);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-12 items-center justify-between text-base ${active ? "font-semibold text-ink" : "text-body"}`}
                      >
                        {label}
                        {active ? <span aria-hidden className="h-2 w-2 bg-flame-fill" /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
