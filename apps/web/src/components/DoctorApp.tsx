"use client";

import {
  analyze,
  detectFormat,
  type AnalysisResult,
  type InputFormat,
} from "queue-doctor";
import { useCallback, useEffect, useMemo, useState } from "react";
import { examples } from "@/lib/examples";
import { FindingCard } from "./FindingCard";
import { ScoreRing } from "./ScoreRing";

const FORMAT_LABELS: Record<InputFormat, string> = {
  "serverless-framework": "Serverless Framework",
  "sam-cfn-yaml": "SAM / CloudFormation YAML",
  "sam-cfn-json": "SAM / CloudFormation JSON",
  unknown: "Unknown",
};

type ViewState =
  | { status: "idle" }
  | { status: "error"; message: string; format: InputFormat }
  | { status: "ready"; result: AnalysisResult; markdown: string };

export function DoctorApp() {
  const [config, setConfig] = useState("");
  const [view, setView] = useState<ViewState>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  const detectedFormat = useMemo(
    () => (config.trim() ? detectFormat(config) : "unknown"),
    [config],
  );

  const runAnalyze = useCallback((source: string) => {
    const outcome = analyze(source);
    if (!outcome.ok) {
      setView({
        status: "error",
        message: outcome.error.message,
        format: outcome.format,
      });
      return;
    }
    setView({
      status: "ready",
      result: outcome.result,
      markdown: outcome.markdown,
    });
  }, []);

  useEffect(() => {
    if (!config.trim()) {
      setView({ status: "idle" });
      return;
    }
    const handle = window.setTimeout(() => runAnalyze(config), 400);
    return () => window.clearTimeout(handle);
  }, [config, runAnalyze]);

  async function copyMarkdown() {
    if (view.status !== "ready") return;
    try {
      await navigator.clipboard.writeText(view.markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const area = document.createElement("textarea");
      area.value = view.markdown;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  function loadExample(source: string) {
    setConfig(source.trim() + "\n");
  }

  const failCount =
    view.status === "ready"
      ? view.result.findings.filter((f) => f.severity === "fail").length
      : 0;
  const warnCount =
    view.status === "ready"
      ? view.result.findings.filter((f) => f.severity === "warn").length
      : 0;
  const infoCount =
    view.status === "ready"
      ? view.result.findings.filter((f) => f.severity === "info").length
      : 0;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-2 lg:gap-10 lg:px-6 lg:py-12">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Paste your config</h2>
            <p className="text-sm text-[var(--color-muted)]">
              serverless.yml, SAM, or CloudFormation YAML/JSON
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[var(--color-line)] bg-white/80 px-2.5 py-1 font-mono text-xs text-[var(--color-muted)]">
              {FORMAT_LABELS[detectedFormat]}
            </span>
            <button
              type="button"
              onClick={() => runAnalyze(config)}
              disabled={!config.trim()}
              className="rounded-lg bg-[var(--color-ink)] px-3 py-1.5 text-sm font-medium text-[var(--color-paper)] transition hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Analyze
            </button>
          </div>
        </div>

        <textarea
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          spellCheck={false}
          placeholder={"# Paste serverless.yml or SAM template here\nservice: my-api\n..."}
          className="min-h-[22rem] w-full resize-y rounded-xl border border-[var(--color-line)] bg-white/80 p-4 font-mono text-sm leading-relaxed text-[var(--color-ink)] shadow-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)] lg:min-h-[28rem]"
          aria-label="Serverless configuration"
        />

        <p className="text-xs text-[var(--color-muted)]">
          Privacy: analysis runs entirely in your browser. Nothing is uploaded.
        </p>

        {!config.trim() && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Try an example</h3>
            <div className="grid gap-2">
              {examples.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  onClick={() => loadExample(example.source)}
                  className="rounded-xl border border-[var(--color-line)] bg-white/60 px-3 py-2.5 text-left transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{example.label}</span>
                    <span className="font-mono text-[10px] text-[var(--color-muted)]">
                      {example.format}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                    {example.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Report</h2>
          {view.status === "ready" && (
            <button
              type="button"
              onClick={copyMarkdown}
              className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm font-medium transition hover:border-[var(--color-accent)]"
            >
              {copied ? "Copied" : "Copy Markdown"}
            </button>
          )}
        </div>

        {view.status === "idle" && (
          <div className="rounded-xl border border-dashed border-[var(--color-line)] bg-white/40 px-5 py-10 text-center">
            <p className="font-medium">No report yet</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Paste a config or load an example to see pass / warn / fail findings.
            </p>
          </div>
        )}

        {view.status === "error" && (
          <div className="rounded-xl border border-[var(--color-fail)]/30 bg-[var(--color-fail-soft)] px-4 py-4">
            <p className="font-semibold text-[var(--color-fail)]">Couldn’t analyze</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink)]">
              {view.message}
            </p>
          </div>
        )}

        {view.status === "ready" && (
          <>
            <div className="rounded-xl border border-[var(--color-line)] bg-white/80 p-5 shadow-sm">
              <ScoreRing score={view.result.score} band={view.result.band} />
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--color-muted)]">
                <span>
                  <strong className="text-[var(--color-fail)]">{failCount}</strong> fail
                </span>
                <span>
                  <strong className="text-[var(--color-warn)]">{warnCount}</strong> warn
                </span>
                <span>
                  <strong className="text-[var(--color-info)]">{infoCount}</strong> info
                </span>
                <span className="font-mono text-xs">
                  {FORMAT_LABELS[view.result.format]}
                </span>
              </div>
            </div>

            {view.result.findings.length === 0 ? (
              <div className="rounded-xl border border-[var(--color-ok)]/30 bg-[var(--color-ok-soft)] px-4 py-4 text-sm">
                No issues found for rules we support — still review IAM and business
                logic.
              </div>
            ) : (
              <div className="space-y-2">
                {view.result.findings.map((finding, index) => (
                  <FindingCard
                    key={`${finding.ruleId}-${finding.resources.join("-")}-${index}`}
                    finding={finding}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
