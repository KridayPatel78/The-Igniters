import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 pt-10">
      <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">Page not found</h1>
      <p className="text-muted">That page doesn&apos;t exist. The 24 investigations are listed on the Explore page.</p>
      <Link href="/" className="inline-block rounded-lg bg-flame px-4 py-2 font-semibold text-bg">
        Go to Explore
      </Link>
    </div>
  );
}
