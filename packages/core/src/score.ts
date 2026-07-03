import type { Finding, ScoreBand, Severity } from "./types";

const DEDUCTIONS: Record<Severity, number> = {
  fail: 15,
  warn: 5,
  info: 2,
};

/** Cap total info deductions so stacks aren't "broken" by many soft signals. */
const MAX_INFO_DEDUCTION = 10;

export function scoreFindings(findings: Finding[]): {
  score: number;
  band: ScoreBand;
} {
  let failDeduction = 0;
  let warnDeduction = 0;
  let infoDeduction = 0;

  for (const finding of findings) {
    if (finding.severity === "fail") failDeduction += DEDUCTIONS.fail;
    else if (finding.severity === "warn") warnDeduction += DEDUCTIONS.warn;
    else infoDeduction += DEDUCTIONS.info;
  }

  infoDeduction = Math.min(infoDeduction, MAX_INFO_DEDUCTION);
  const score = Math.max(0, 100 - failDeduction - warnDeduction - infoDeduction);

  return { score, band: bandForScore(score) };
}

export function bandForScore(score: number): ScoreBand {
  if (score >= 80) return "Healthy";
  if (score >= 50) return "Needs work";
  return "Risky";
}
