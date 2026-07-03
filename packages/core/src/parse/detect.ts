import type { InputFormat } from "../types";

function looksLikeJson(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

export function detectFormat(input: string): InputFormat {
  const trimmed = input.trim();
  if (!trimmed) return "unknown";

  if (looksLikeJson(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (isSamOrCfn(parsed)) return "sam-cfn-json";
      if (isServerlessFramework(parsed)) return "serverless-framework";
      return "unknown";
    } catch {
      return "unknown";
    }
  }

  // YAML heuristics before full parse
  if (/^\s*service\s*:/m.test(trimmed) && /^\s*provider\s*:/m.test(trimmed)) {
    return "serverless-framework";
  }
  if (
    /AWS::Serverless::Function|AWS::Lambda::Function|AWS::SQS::Queue|Transform:\s*AWS::Serverless/i.test(
      trimmed,
    )
  ) {
    return "sam-cfn-yaml";
  }
  if (/^\s*Resources\s*:/m.test(trimmed) && /Type\s*:/m.test(trimmed)) {
    return "sam-cfn-yaml";
  }
  if (/^\s*functions\s*:/m.test(trimmed)) {
    return "serverless-framework";
  }

  return "unknown";
}

function isSamOrCfn(doc: Record<string, unknown>): boolean {
  if (doc.Resources && typeof doc.Resources === "object") return true;
  if (doc.Transform === "AWS::Serverless-2016-10-31") return true;
  return false;
}

function isServerlessFramework(doc: Record<string, unknown>): boolean {
  return (
    typeof doc.service === "string" ||
    (doc.provider !== undefined && doc.functions !== undefined)
  );
}
