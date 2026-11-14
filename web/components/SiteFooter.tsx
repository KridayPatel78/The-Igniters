export function SiteFooter() {
  return (
    <footer className="border-t border-line/80">
      <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted sm:px-6">
        Data:{" "}
        <a className="underline decoration-line underline-offset-4 hover:text-ink" href="https://psi.nasa.gov/physci/repo/search?q=combustion">
          NASA Physical Sciences Informatics (PSI)
        </a>{" "}
        · Built for NASA Space Apps 2026 · The Igniters
      </p>
    </footer>
  );
}
