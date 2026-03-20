const features = [
  "Next.js + React + TypeScript",
  "Tailwind CSS baseline",
  "Supabase, tRPC, Zustand, and WorkOS ready",
  "Monorepo-friendly apps/web layout",
  "Lint, format, and typecheck commands at the workspace root",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-50">
      <div className="mx-auto flex max-w-4xl flex-col gap-10">
        <section className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
            __APP_NAME__
          </p>
          <h1 className="text-5xl font-semibold tracking-tight">
            Repo-owned web-nextjs starter
          </h1>
          <p className="max-w-2xl text-lg text-slate-300">
            This scaffold is generated from harness-template&apos;s
            deterministic bootstrap template so monorepo setup, formatting,
            linting, and CI start from a consistent baseline.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <p className="text-base text-slate-200">{feature}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
