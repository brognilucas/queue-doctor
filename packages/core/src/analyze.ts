import { parseConfig } from "./parse/index";
import { runRules } from "./rules/catalog";
import { scoreFindings } from "./score";
import { toMarkdown } from "./markdown";
import type { AnalysisResult, ParseError, InputFormat } from "./types";

export type AnalyzeSuccess = {
  ok: true;
  result: AnalysisResult;
  markdown: string;
};

export type AnalyzeFailure = {
  ok: false;
  format: InputFormat;
  error: ParseError;
};

export type AnalyzeOutcome = AnalyzeSuccess | AnalyzeFailure;

export function analyze(input: string): AnalyzeOutcome {
  const parsed = parseConfig(input);
  if (!parsed.ok) {
    return {
      ok: false,
      format: parsed.format,
      error: parsed.error,
    };
  }

  const findings = runRules(parsed.stack);
  const { score, band } = scoreFindings(findings);
  const result: AnalysisResult = {
    format: parsed.stack.format,
    score,
    band,
    findings,
    stack: parsed.stack,
  };

  return {
    ok: true,
    result,
    markdown: toMarkdown(result),
  };
}
