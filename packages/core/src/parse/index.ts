import type { InputFormat, ParseResult, StackIR } from "../types";
import { parseCfnYaml } from "./cfn-yaml";
import { detectFormat } from "./detect";
import { parseSamCfn } from "./sam";
import { parseServerlessFramework } from "./serverless";

function hasServerlessResources(stack: StackIR): boolean {
  return (
    stack.functions.length > 0 ||
    stack.queues.length > 0 ||
    stack.topics.length > 0 ||
    stack.eventBuses.length > 0
  );
}

function emptyStack(format: InputFormat): StackIR {
  return {
    functions: [],
    queues: [],
    topics: [],
    eventBuses: [],
    alarms: [],
    globals: {},
    format,
  };
}

function lineFromYamlError(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const err = error as { linePos?: Array<{ line?: number }>; line?: number };
  if (typeof err.line === "number") return err.line;
  if (Array.isArray(err.linePos) && err.linePos[0]?.line) return err.linePos[0].line;
  return undefined;
}

export function parseConfig(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      ok: false,
      format: "unknown",
      error: {
        message:
          "Paste a serverless config to analyze. Try Serverless Framework YAML or SAM/CloudFormation.",
      },
    };
  }

  const format = detectFormat(trimmed);
  const isJson = format === "sam-cfn-json" || trimmed.startsWith("{") || trimmed.startsWith("[");

  let doc: unknown;
  try {
    if (isJson) {
      doc = JSON.parse(trimmed);
    } else {
      doc = parseCfnYaml(trimmed);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not parse the config.";
    return {
      ok: false,
      format,
      error: {
        message: `Parse error: ${message}`,
        line: isJson ? undefined : lineFromYamlError(error),
      },
    };
  }

  let stack: StackIR;
  const effectiveFormat =
    format === "unknown"
      ? detectFormatFromDoc(doc, isJson)
      : format;

  if (effectiveFormat === "serverless-framework") {
    stack = parseServerlessFramework(doc);
  } else if (
    effectiveFormat === "sam-cfn-yaml" ||
    effectiveFormat === "sam-cfn-json"
  ) {
    stack = parseSamCfn(doc, effectiveFormat);
  } else {
    // Best-effort: try serverless, then SAM
    stack = parseServerlessFramework(doc);
    if (!hasServerlessResources(stack)) {
      stack = parseSamCfn(doc, isJson ? "sam-cfn-json" : "sam-cfn-yaml");
    }
  }

  if (!hasServerlessResources(stack)) {
    return {
      ok: false,
      format: effectiveFormat,
      error: {
        message:
          "Couldn't find serverless resources — try Serverless Framework (service/provider/functions) or SAM/CloudFormation (AWS::Serverless::Function, AWS::SQS::Queue).",
      },
    };
  }

  return { ok: true, stack };
}

function detectFormatFromDoc(doc: unknown, isJson: boolean): InputFormat {
  if (!doc || typeof doc !== "object") return "unknown";
  const root = doc as Record<string, unknown>;
  if (typeof root.service === "string" || root.functions !== undefined) {
    return "serverless-framework";
  }
  if (root.Resources !== undefined || root.Transform !== undefined) {
    return isJson ? "sam-cfn-json" : "sam-cfn-yaml";
  }
  return "unknown";
}

export { detectFormat, emptyStack };
