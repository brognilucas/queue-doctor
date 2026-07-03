import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, type Finding, type Severity } from "./index";

const here = dirname(fileURLToPath(import.meta.url));

const EXIT_OK = 0;
const EXIT_FINDINGS = 1;
const EXIT_USAGE = 2;

type CliOptions = {
  file?: string;
  markdown: boolean;
  json: boolean;
  help: boolean;
  version: boolean;
};

function printHelp(): void {
  process.stdout.write(`queue-doctor — serverless production readiness report

Usage:
  queue-doctor <file> [options]
  queue-doctor [options] <file>

Analyze a Serverless Framework or SAM/CloudFormation config for DLQs,
retries, timeouts, alarms, and other production gaps.

Options:
  -m, --markdown   Print Markdown report only
  -j, --json       Print full analysis JSON
  -h, --help       Show help
  -v, --version    Show version

Exit codes:
  0  No fail-severity findings (warn/info may still be present)
  1  One or more fail findings, or analysis could not run
  2  Invalid usage

Examples:
  queue-doctor serverless.yml
  queue-doctor template.yaml --markdown > report.md
  npx queue-doctor ./infra/sam.yaml
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    markdown: false,
    json: false,
    help: false,
    version: false,
  };

  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "-v" || arg === "--version") options.version = true;
    else if (arg === "-m" || arg === "--markdown") options.markdown = true;
    else if (arg === "-j" || arg === "--json") options.json = true;
    else if (arg.startsWith("-")) {
      process.stderr.write(`Unknown option: ${arg}\n\n`);
      printHelp();
      process.exit(EXIT_USAGE);
    } else if (!options.file) {
      options.file = arg;
    } else {
      process.stderr.write(`Unexpected argument: ${arg}\n\n`);
      printHelp();
      process.exit(EXIT_USAGE);
    }
  }

  return options;
}

function severityIcon(severity: Severity): string {
  if (severity === "fail") return "✖";
  if (severity === "warn") return "⚠";
  return "ℹ";
}

function printFinding(finding: Finding): void {
  const resources =
    finding.resources.length > 0 ? finding.resources.join(", ") : "stack";
  process.stdout.write(
    `  ${severityIcon(finding.severity)} [${finding.ruleId}] ${resources}\n`,
  );
  process.stdout.write(`    ${finding.summary}\n`);
}

function printHumanReport(
  score: number,
  band: string,
  format: string,
  findings: Finding[],
): void {
  process.stdout.write(`\nQueueDoctor — score ${score} (${band})\n`);
  process.stdout.write(`Format: ${format}\n\n`);

  if (findings.length === 0) {
    process.stdout.write(
      "No issues found for rules we support — still review IAM and business logic.\n\n",
    );
    return;
  }

  for (const severity of ["fail", "warn", "info"] as Severity[]) {
    const group = findings.filter((f) => f.severity === severity);
    if (group.length === 0) continue;
    const label =
      severity === "fail"
        ? "Failures"
        : severity === "warn"
          ? "Warnings"
          : "Info";
    process.stdout.write(`${label} (${group.length})\n`);
    for (const finding of group) printFinding(finding);
    process.stdout.write("\n");
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(EXIT_OK);
  }

  if (options.version) {
    try {
      const pkgPath = resolve(here, "../package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        version?: string;
      };
      process.stdout.write(`${pkg.version ?? "0.0.0"}\n`);
    } catch {
      process.stdout.write("0.1.0\n");
    }
    process.exit(EXIT_OK);
  }

  if (!options.file) {
    printHelp();
    process.exit(EXIT_USAGE);
  }

  const filePath = resolve(process.cwd(), options.file);
  let source: string;
  try {
    source = readFileSync(filePath, "utf8");
  } catch {
    process.stderr.write(`Could not read file: ${filePath}\n`);
    process.exit(EXIT_FINDINGS);
  }

  const outcome = analyze(source);
  if (!outcome.ok) {
    process.stderr.write(`Error: ${outcome.error.message}\n`);
    if (outcome.error.line !== undefined) {
      process.stderr.write(`Line: ${outcome.error.line}\n`);
    }
    process.exit(EXIT_FINDINGS);
  }

  const { result, markdown } = outcome;

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          score: result.score,
          band: result.band,
          format: result.format,
          findings: result.findings,
        },
        null,
        2,
      )}\n`,
    );
  } else if (options.markdown) {
    process.stdout.write(markdown);
    if (!markdown.endsWith("\n")) process.stdout.write("\n");
  } else {
    printHumanReport(
      result.score,
      result.band,
      result.format,
      result.findings,
    );
  }

  const hasFails = result.findings.some((f) => f.severity === "fail");
  process.exit(hasFails ? EXIT_FINDINGS : EXIT_OK);
}

main();
