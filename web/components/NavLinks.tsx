"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Explore" },
  { href: "/compare", label: "Compare" },
  { href: "/ask", label: "Ask" },
  { href: "/context", label: "Context" },
  { href: "/method", label: "Method & Sources" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="-mx-2 flex flex-wrap gap-1 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" || pathname.startsWith("/investigations") : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2 py-1.5 transition-colors ${
              active ? "bg-panel-2 text-ink" : "text-muted hover:bg-panel hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
