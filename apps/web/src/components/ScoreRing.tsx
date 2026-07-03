import type { ScoreBand } from "queue-doctor";

const bandColor: Record<ScoreBand, string> = {
  Healthy: "var(--color-ok)",
  "Needs work": "var(--color-warn)",
  Risky: "var(--color-fail)",
};

const bandBg: Record<ScoreBand, string> = {
  Healthy: "var(--color-ok-soft)",
  "Needs work": "var(--color-warn-soft)",
  Risky: "var(--color-fail-soft)",
};

export function ScoreRing({
  score,
  band,
}: {
  score: number;
  band: ScoreBand;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = bandColor[band];

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="10"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums leading-none">{score}</span>
          <span className="mt-1 text-[10px] font-medium tracking-wider text-[var(--color-muted)] uppercase">
            / 100
          </span>
        </div>
      </div>
      <div>
        <span
          className="inline-flex rounded-full px-3 py-1 text-sm font-semibold"
          style={{ background: bandBg[band], color }}
        >
          {band}
        </span>
        <p className="mt-2 max-w-[16rem] text-sm text-[var(--color-muted)]">
          Production readiness for failure handling, retries, and observability.
        </p>
      </div>
    </div>
  );
}
