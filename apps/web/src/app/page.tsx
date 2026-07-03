import { DoctorApp } from "@/components/DoctorApp";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-line)] bg-[var(--color-paper)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 lg:px-6">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-ink)] font-mono text-sm font-bold text-[var(--color-paper)]"
              aria-hidden
            >
              QD
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight">QueueDoctor</p>
              <p className="text-xs text-[var(--color-muted)]">
                Serverless production readiness
              </p>
            </div>
          </div>
          <p className="max-w-md text-sm text-[var(--color-muted)]">
            Paste a config. Get a checklist for DLQs, retries, timeouts, and
            observability — the gaps demos skip and production punishes.
          </p>
        </div>
      </header>

      <main>
        <DoctorApp />
      </main>

      <footer className="border-t border-[var(--color-line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-[var(--color-muted)] lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <p>
            Free tool. No AWS credentials. Analysis stays in your browser.
          </p>
          <p>
            Built for{" "}
            <a
              href="https://brogni.dev"
              className="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
            >
              Practical Serverless
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
