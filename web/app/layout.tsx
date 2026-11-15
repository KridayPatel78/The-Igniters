import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

// DESIGN.md (Chart of the Evidence): Archivo with its width axis (condensed for chart lettering),
// JetBrains Mono only for identifiers.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Flame in Freefall · NASA fire-safety dashboard", template: "%s · Flame in Freefall" },
  description:
    "Rank, compare and question NASA's 24 microgravity combustion investigations (PSI) for fire safety in spacecraft, space stations, Moon bases and spacesuits. Every number traces to NASA data.",
};

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-panel focus:px-4 focus:py-2 focus:shadow-pop"
        >
          Skip to content
        </a>
        <TopBar />
        <div className="flex min-h-full flex-1 flex-col">
          <main id="main" className="mx-auto w-full max-w-[90rem] flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
