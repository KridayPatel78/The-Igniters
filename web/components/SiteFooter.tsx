import Link from "next/link";
import { BrandTile } from "./TopBar";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t-2 border-rule">
      <div className="mx-auto grid max-w-[90rem] gap-6 px-4 py-8 text-sm text-body sm:px-6 md:grid-cols-[auto_1fr_1fr_auto] md:gap-10 lg:px-10">
        <div className="flex items-start gap-3">
          <BrandTile />
          <p className="leading-relaxed">
            <span className="block font-semibold text-ink">Flame in Freefall</span>
            NASA Space Apps 2026 · The Igniters
          </p>
        </div>
        <p className="leading-relaxed">
          <span className="block font-semibold text-ink">Data</span>
          <a className="text-ion underline underline-offset-2" href="https://psi.nasa.gov/physci/repo/search?q=combustion">
            NASA Physical Sciences Informatics (PSI)
          </a>
          , CC0. Cite each investigation by its DOI.{" "}
          <Link href="/method#sources" className="text-ion underline underline-offset-2">
            All 10 sources
          </Link>
        </p>
        <p className="leading-relaxed">
          <span className="block font-semibold text-ink">Scope</span>
          Fire safety in crewed habitats. Rocket and propellant fires are out of scope: inside rocket engines the flow is so fast
          that gravity hardly matters.
        </p>
        <div className="leading-relaxed">
          <p className="font-semibold text-ink">Team members</p>
          <ul>
            <li>Kriday Patel</li>
            <li>Khushmeet Kaur Bade</li>
            <li>Abhay Verma</li>
            <li>Narshini Chuckowry</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
