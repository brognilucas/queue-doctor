import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyze, detectFormat, rules, scoreFindings, toMarkdown } from "../src/index";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function load(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

describe("detectFormat", () => {
  it("detects Serverless Framework YAML", () => {
    expect(detectFormat(load("serverless-bad.yml"))).toBe("serverless-framework");
  });

  it("detects SAM YAML", () => {
    expect(detectFormat(load("sam-bad.yml"))).toBe("sam-cfn-yaml");
  });

  it("detects SAM JSON", () => {
    const json = JSON.stringify({
      Transform: "AWS::Serverless-2016-10-31",
      Resources: {
        Fn: { Type: "AWS::Serverless::Function", Properties: { Handler: "a.b" } },
      },
    });
    expect(detectFormat(json)).toBe("sam-cfn-json");
  });
});

describe("analyze serverless", () => {
  it("flags production gaps on a bad stack", () => {
    const outcome = analyze(load("serverless-bad.yml"));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const ids = new Set(outcome.result.findings.map((f) => f.ruleId));
    expect(ids.has("async-missing-dlq")).toBe(true);
    expect(ids.has("sqs-missing-redrive")).toBe(true);
    expect(ids.has("sqs-visibility-vs-timeout")).toBe(true);
    expect(ids.has("timeout-default-only")).toBe(true);
    expect(ids.has("no-alarms")).toBe(true);
    expect(ids.has("http-no-auth-hint")).toBe(true);
    expect(outcome.result.score).toBeLessThan(50);
    expect(outcome.result.band).toBe("Risky");
  });

  it("scores a healthy stack highly", () => {
    const outcome = analyze(load("serverless-good.yml"));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const fails = outcome.result.findings.filter((f) => f.severity === "fail");
    expect(fails).toHaveLength(0);
    expect(outcome.result.score).toBeGreaterThanOrEqual(80);
    expect(outcome.result.band).toBe("Healthy");
  });
});

describe("analyze SAM", () => {
  it("parses and flags a bad SAM stack", () => {
    const outcome = analyze(load("sam-bad.yml"));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.format).toBe("sam-cfn-yaml");
    const ids = new Set(outcome.result.findings.map((f) => f.ruleId));
    expect(ids.has("async-missing-dlq")).toBe(true);
    expect(ids.has("sqs-missing-redrive")).toBe(true);
    expect(ids.has("sqs-visibility-vs-timeout")).toBe(true);
  });

  it("parses a good SAM stack without failures", () => {
    const outcome = analyze(load("sam-good.yml"));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const fails = outcome.result.findings.filter((f) => f.severity === "fail");
    expect(fails).toHaveLength(0);
    expect(outcome.result.score).toBeGreaterThanOrEqual(80);
  });

  it("parses SAM JSON", () => {
    const yaml = load("sam-bad.yml");
    // Minimal JSON equivalent
    const json = `{
      "Transform": "AWS::Serverless-2016-10-31",
      "Resources": {
        "ProcessOrder": {
          "Type": "AWS::Serverless::Function",
          "Properties": {
            "Handler": "app.handler",
            "Runtime": "nodejs20.x",
            "Timeout": 30,
            "Events": {
              "OrderQueue": {
                "Type": "SQS",
                "Properties": {
                  "Queue": { "Fn::GetAtt": ["OrdersQueue", "Arn"] },
                  "BatchSize": 10
                }
              }
            }
          }
        },
        "OrdersQueue": {
          "Type": "AWS::SQS::Queue",
          "Properties": { "VisibilityTimeout": 10 }
        }
      }
    }`;
    const outcome = analyze(json);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.format).toBe("sam-cfn-json");
    expect(outcome.result.findings.some((f) => f.ruleId === "sqs-missing-redrive")).toBe(
      true,
    );
    void yaml;
  });
});

describe("error handling", () => {
  it("returns a clear error for empty input", () => {
    const outcome = analyze("");
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.message).toMatch(/paste/i);
  });

  it("returns a clear error when no resources found", () => {
    const outcome = analyze("foo: bar\nbaz: 1\n");
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.message).toMatch(/couldn't find serverless/i);
  });

  it("returns a parse error for invalid YAML", () => {
    const outcome = analyze("functions:\n  foo: [");
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.message).toMatch(/parse error/i);
  });
});

describe("scoring and markdown", () => {
  it("caps info deductions", () => {
    const findings = Array.from({ length: 20 }, (_, i) => ({
      ruleId: `info-${i}`,
      severity: "info" as const,
      title: "Info",
      summary: "s",
      detail: "d",
      remediation: "r",
      resources: [`r${i}`],
    }));
    const { score } = scoreFindings(findings);
    expect(score).toBe(90);
  });

  it("exports markdown report", () => {
    const outcome = analyze(load("serverless-bad.yml"));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.markdown).toMatch(/^# QueueDoctor report — score \d+/);
    expect(outcome.markdown).toContain("## Failures");
    expect(toMarkdown(outcome.result)).toBe(outcome.markdown);
  });
});

describe("rules catalog", () => {
  it("implements at least 8 rules", () => {
    expect(rules.length).toBeGreaterThanOrEqual(8);
  });
});
