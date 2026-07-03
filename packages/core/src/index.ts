export { analyze } from "./analyze";
export type { AnalyzeOutcome, AnalyzeSuccess, AnalyzeFailure } from "./analyze";
export { parseConfig, detectFormat } from "./parse/index";
export { runRules, rules } from "./rules/catalog";
export { scoreFindings, bandForScore } from "./score";
export { toMarkdown } from "./markdown";
export type {
  AnalysisResult,
  EventIR,
  Finding,
  FunctionIR,
  InputFormat,
  ParseError,
  ParseResult,
  QueueIR,
  Rule,
  ScoreBand,
  Severity,
  StackIR,
} from "./types";
