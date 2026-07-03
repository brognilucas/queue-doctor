import type { Severity } from "queue-doctor";

const styles: Record<Severity, string> = {
  fail: "bg-[var(--color-fail-soft)] text-[var(--color-fail)]",
  warn: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
  info: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
};

const labels: Record<Severity, string> = {
  fail: "Fail",
  warn: "Warn",
  info: "Info",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide uppercase ${styles[severity]}`}
    >
      {labels[severity]}
    </span>
  );
}
