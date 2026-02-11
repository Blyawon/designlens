import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-32 min-h-screen flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-5">
        <span className="w-1.5 h-1.5 rounded-full bg-ds-red" />
        <span className="text-sm font-medium text-ds-red tracking-wide">
          404 — Not found
        </span>
      </div>

      <h1 className="text-6xl md:text-7xl font-serif tracking-tight text-ds-primary leading-[0.95]">
        This page has
        <br />
        <span className="text-ds-tertiary">0 CSS variables.</span>
      </h1>

      <p className="text-lg text-ds-secondary mt-6 max-w-md leading-relaxed">
        Mostly because it doesn&apos;t exist. Even we can&apos;t lint
        something out of nothing — and we tried.
      </p>

      <div className="mt-10">
        <Link
          href="/"
          className="inline-flex h-12 px-6 items-center rounded-xl bg-ds-olive text-white text-base font-semibold hover:bg-ds-olive/90 transition-colors shadow-sm"
        >
          Back to auditing real pages
        </Link>
      </div>

      <p className="text-xs text-ds-tertiary mt-16 font-mono">
        Grade: F · Consistency: N/A · Elements sampled: 0 · Findings: page missing
      </p>
    </div>
  );
}
