"use client";

import type { Finding } from "queue-doctor";
import { useState } from "react";
import { SeverityBadge } from "./SeverityBadge";

export function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-xl border border-[var(--color-line)] bg-white/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <SeverityBadge severity={finding.severity} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="font-semibold text-[var(--color-ink)]">{finding.title}</h3>
            <code className="font-mono text-xs text-[var(--color-muted)]">
              {finding.ruleId}
            </code>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{finding.summary}</p>
          {finding.resources.length > 0 && (
            <p className="mt-1 font-mono text-xs text-[var(--color-ink)]/70">
              {finding.resources.join(" · ")}
            </p>
          )}
        </div>
        <span className="mt-1 shrink-0 text-[var(--color-muted)]" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] px-4 py-3">
          <div>
            <h4 className="text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
              Why it matters
            </h4>
            <p className="mt-1 text-sm leading-relaxed">{finding.detail}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
              Remediation
            </h4>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-[var(--color-ink)] p-3 font-mono text-xs leading-relaxed text-[var(--color-paper)]">
              {finding.remediation}
            </pre>
          </div>
          {finding.learnMoreUrl && (
            <a
              href={finding.learnMoreUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-sm font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
            >
              Read more →
            </a>
          )}
        </div>
      )}
    </article>
  );
}
