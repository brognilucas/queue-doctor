import type { Finding, Rule, StackIR } from "../types";
import {
  ASYNC_EVENT_TYPES,
  effectiveTimeout,
  hasFailureDestination,
  isAsyncFunction,
  LEARN_MORE,
  queueForEventSource,
} from "./helpers";

const MAX_RECEIVE_COUNT_THRESHOLD = 5;
const TIMEOUT_HIGH_SECONDS = 300;

function finding(
  rule: Pick<Rule, "id" | "severity" | "title">,
  partial: Omit<Finding, "ruleId" | "severity" | "title">,
): Finding {
  return {
    ruleId: rule.id,
    severity: rule.severity,
    title: rule.title,
    ...partial,
  };
}

export const asyncMissingDlq: Rule = {
  id: "async-missing-dlq",
  severity: "fail",
  title: "Async function missing DLQ / onFailure",
  run(stack) {
    return stack.functions
      .filter((fn) => isAsyncFunction(fn) && !hasFailureDestination(fn))
      .map((fn) =>
        finding(asyncMissingDlq, {
          summary: `\`${fn.id}\` is triggered asynchronously but has no dead-letter or onFailure destination.`,
          detail:
            "Poison messages and invocation failures can be retried forever or dropped silently. Async paths need a DLQ, onFailure destination, or queue redrive so failures are visible and recoverable.",
          remediation: `# Serverless Framework
functions:
  ${fn.id}:
    destinations:
      onFailure: arn:aws:sqs:REGION:ACCOUNT:my-dlq
    # or for async invoke:
    # deadLetter:
    #   targetArn: arn:aws:sqs:REGION:ACCOUNT:my-dlq

# SAM
${fn.id}:
  Type: AWS::Serverless::Function
  Properties:
    EventInvokeConfig:
      DestinationConfig:
        OnFailure:
          Type: SQS
          Destination: !GetAtt MyDlq.Arn`,
          resources: [fn.id],
          learnMoreUrl: LEARN_MORE.dlq,
        }),
      );
  },
};

function isDeadLetterTarget(stack: StackIR, queueId: string): boolean {
  return stack.queues.some(
    (q) =>
      q.redrivePolicy &&
      (q.redrivePolicy.deadLetterTarget === queueId ||
        q.redrivePolicy.deadLetterTarget.includes(queueId)),
  );
}

export const sqsMissingRedrive: Rule = {
  id: "sqs-missing-redrive",
  severity: "fail",
  title: "SQS queue missing RedrivePolicy",
  run(stack) {
    return stack.queues
      .filter((q) => !q.redrivePolicy && !isDeadLetterTarget(stack, q.id))
      .filter((q) => !/dlq|dead[-_]?letter/i.test(q.id))
      .map((q) =>
        finding(sqsMissingRedrive, {
          summary: `\`${q.id}\` has no RedrivePolicy — failed messages may retry indefinitely.`,
          detail:
            "Without a dead-letter queue and maxReceiveCount, consumers can loop on poison messages, burning cost and blocking the queue.",
          remediation: `${q.id}:
  Type: AWS::SQS::Queue
  Properties:
    RedrivePolicy:
      deadLetterTargetArn: !GetAtt ${q.id}Dlq.Arn
      maxReceiveCount: 3

${q.id}Dlq:
  Type: AWS::SQS::Queue`,
          resources: [q.id],
          learnMoreUrl: LEARN_MORE.dlq,
        }),
      );
  },
};

export const sqsMaxReceiveTooHigh: Rule = {
  id: "sqs-max-receive-too-high",
  severity: "warn",
  title: "maxReceiveCount is high",
  run(stack) {
    return stack.queues
      .filter(
        (q) =>
          q.redrivePolicy &&
          q.redrivePolicy.maxReceiveCount > MAX_RECEIVE_COUNT_THRESHOLD,
      )
      .map((q) =>
        finding(sqsMaxReceiveTooHigh, {
          summary: `\`${q.id}\` maxReceiveCount is ${q.redrivePolicy!.maxReceiveCount} (threshold: ${MAX_RECEIVE_COUNT_THRESHOLD}).`,
          detail:
            "High maxReceiveCount delays poison-message isolation. Prefer a low count (often 3–5) so bad messages land in the DLQ quickly.",
          remediation: `RedrivePolicy:
  deadLetterTargetArn: !GetAtt MyDlq.Arn
  maxReceiveCount: 3`,
          resources: [q.id],
          learnMoreUrl: LEARN_MORE.retries,
        }),
      );
  },
};

export const sqsVisibilityVsTimeout: Rule = {
  id: "sqs-visibility-vs-timeout",
  severity: "fail",
  title: "Visibility timeout shorter than function timeout",
  run(stack) {
    const findings: Finding[] = [];

    for (const fn of stack.functions) {
      const fnTimeout = effectiveTimeout(fn, stack);

      for (const event of fn.events) {
        if (event.type !== "sqs") continue;
        const queue = queueForEventSource(stack, event.source);
        if (!queue || queue.visibilityTimeout === undefined) continue;
        if (queue.visibilityTimeout < fnTimeout) {
          findings.push(
            finding(sqsVisibilityVsTimeout, {
              summary: `\`${queue.id}\` visibility (${queue.visibilityTimeout}s) < \`${fn.id}\` timeout (${fnTimeout}s).`,
              detail:
                "If the function runs longer than the visibility timeout, the message becomes visible again and another consumer may process it — classic duplicate-processing storms.",
              remediation: `# Set visibility timeout >= function timeout (often 6x for batching)
${queue.id}:
  Type: AWS::SQS::Queue
  Properties:
    VisibilityTimeout: ${fnTimeout * 6}`,
              resources: [fn.id, queue.id],
              learnMoreUrl: LEARN_MORE.retries,
            }),
          );
        }
      }
    }

    return findings;
  },
};

export const retryUnbounded: Rule = {
  id: "retry-unbounded",
  severity: "warn",
  title: "Retry path has no max / no DLQ",
  run(stack) {
    return stack.functions
      .filter((fn) => {
        const asyncEvents = fn.events.filter((e) =>
          ASYNC_EVENT_TYPES.includes(e.type),
        );
        if (asyncEvents.length === 0) return false;
        if (hasFailureDestination(fn)) return false;

        const hasBoundedRetry = asyncEvents.some(
          (e) => e.maximumRetryAttempts !== undefined,
        );
        const sqsWithRedrive = asyncEvents.some((e) => {
          if (e.type !== "sqs") return false;
          const q = queueForEventSource(stack, e.source);
          return Boolean(q?.redrivePolicy);
        });

        return !hasBoundedRetry && !sqsWithRedrive;
      })
      .map((fn) =>
        finding(retryUnbounded, {
          summary: `\`${fn.id}\` async retries are unbounded (no max attempts and no DLQ).`,
          detail:
            "Under partial failure, unbounded retries amplify load on downstreams and inflate cost. Cap retries and send failures to a DLQ.",
          remediation: `# EventBridge / async invoke
EventInvokeConfig:
  MaximumRetryAttempts: 2
  DestinationConfig:
    OnFailure:
      Type: SQS
      Destination: !GetAtt MyDlq.Arn

# SQS: set RedrivePolicy.maxReceiveCount on the queue`,
          resources: [fn.id],
          learnMoreUrl: LEARN_MORE.retries,
        }),
      );
  },
};

export const timeoutDefaultOnly: Rule = {
  id: "timeout-default-only",
  severity: "warn",
  title: "Async handler uses default timeout",
  run(stack) {
    return stack.functions
      .filter((fn) => isAsyncFunction(fn) && !fn.timeoutExplicit)
      .map((fn) =>
        finding(timeoutDefaultOnly, {
          summary: `\`${fn.id}\` has no explicit timeout (provider/runtime default applies).`,
          detail:
            "Hidden defaults (often 3s or 6s) are easy to miss and rarely match real downstream latency. Set an explicit timeout aligned with the work and the queue visibility timeout.",
          remediation: `# Serverless Framework
functions:
  ${fn.id}:
    timeout: 30

# SAM
Properties:
  Timeout: 30`,
          resources: [fn.id],
        }),
      );
  },
};

export const timeoutTooHigh: Rule = {
  id: "timeout-too-high",
  severity: "info",
  title: "High timeout without reserved concurrency",
  run(stack) {
    return stack.functions
      .filter((fn) => {
        const timeout = effectiveTimeout(fn, stack);
        return (
          timeout >= TIMEOUT_HIGH_SECONDS &&
          fn.reservedConcurrency === undefined
        );
      })
      .map((fn) => {
        const timeout = effectiveTimeout(fn, stack);
        return finding(timeoutTooHigh, {
          summary: `\`${fn.id}\` timeout is ${timeout}s with no reserved concurrency.`,
          detail:
            "Long-running functions without concurrency limits can hang and burn cost, or starve other functions in the account when they scale out.",
          remediation: `functions:
  ${fn.id}:
    timeout: ${timeout}
    reservedConcurrency: 5`,
          resources: [fn.id],
        });
      });
  },
};

export const noReservedConcurrency: Rule = {
  id: "no-reserved-concurrency",
  severity: "info",
  title: "Critical async function has no reserved concurrency",
  run(stack) {
    return stack.functions
      .filter(
        (fn) => isAsyncFunction(fn) && fn.reservedConcurrency === undefined,
      )
      .map((fn) =>
        finding(noReservedConcurrency, {
          summary: `\`${fn.id}\` is async-triggered with no reserved concurrency.`,
          detail:
            "Without a reserve, a traffic spike or retry storm can consume account concurrency and become a noisy neighbor to other workloads.",
          remediation: `functions:
  ${fn.id}:
    reservedConcurrency: 10`,
          resources: [fn.id],
        }),
      );
  },
};

export const noAlarms: Rule = {
  id: "no-alarms",
  severity: "warn",
  title: "No CloudWatch alarms detected",
  run(stack) {
    if (stack.alarms.length > 0) return [];
    if (stack.functions.length === 0 && stack.queues.length === 0) return [];

    return [
      finding(noAlarms, {
        summary:
          "No CloudWatch alarm resources found for errors or DLQ depth.",
        detail:
          "Without alarms on Lambda errors, throttles, and DLQ message counts, production failures stay invisible until users report them.",
        remediation: `ErrorAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmDescription: Lambda errors
    Namespace: AWS/Lambda
    MetricName: Errors
    Statistic: Sum
    Period: 60
    EvaluationPeriods: 1
    Threshold: 1
    ComparisonOperator: GreaterThanOrEqualToThreshold
    Dimensions:
      - Name: FunctionName
        Value: !Ref MyFunction

DlqDepthAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    Namespace: AWS/SQS
    MetricName: ApproximateNumberOfMessagesVisible
    Statistic: Sum
    Period: 60
    EvaluationPeriods: 1
    Threshold: 1
    ComparisonOperator: GreaterThanOrEqualToThreshold`,
        resources: stack.functions.map((f) => f.id).slice(0, 5),
        learnMoreUrl: LEARN_MORE.observability,
      }),
    ];
  },
};

export const noStructuredLogging: Rule = {
  id: "no-structured-logging",
  severity: "info",
  title: "No structured logging hints detected",
  run(stack) {
    const hasGlobalFormat = Boolean(stack.globals.logFormat);
    if (hasGlobalFormat) return [];

    const offenders = stack.functions.filter((fn) => {
      const format = fn.logging?.format;
      if (format && /json/i.test(format)) return false;
      const env = fn.environment ?? {};
      const envHints = Object.entries(env).some(
        ([k, v]) =>
          /powertools|log_level|log_format/i.test(k) ||
          /powertools/i.test(v),
      );
      return !envHints;
    });

    if (offenders.length === 0) return [];

    return offenders.slice(0, 8).map((fn) =>
      finding(noStructuredLogging, {
        summary: `\`${fn.id}\` has no detectable JSON / Powertools logging config.`,
        detail:
          "Structured JSON logs make incidents searchable and correlate request IDs across async hops. Prefer Lambda JSON log format or Powertools.",
        remediation: `# SAM LoggingConfig
Properties:
  LoggingConfig:
    LogFormat: JSON

# Or Powertools env
Environment:
  Variables:
    POWERTOOLS_SERVICE_NAME: my-service
    LOG_LEVEL: INFO`,
        resources: [fn.id],
        learnMoreUrl: LEARN_MORE.observability,
      }),
    );
  },
};

export const httpNoAuthHint: Rule = {
  id: "http-no-auth-hint",
  severity: "info",
  title: "HTTP event has no authorizer",
  run(stack) {
    const findings: Finding[] = [];
    for (const fn of stack.functions) {
      for (const event of fn.events) {
        if (event.type !== "http") continue;
        if (event.hasAuthorizer) continue;
        findings.push(
          finding(httpNoAuthHint, {
            summary: `\`${fn.id}\` exposes an HTTP event without a detectable authorizer.`,
            detail:
              "Public endpoints are sometimes intentional, but missing auth is a common ship-time oversight. Confirm the route should be open or attach an authorizer.",
            remediation: `# Serverless Framework
events:
  - httpApi:
      path: /orders
      method: post
      authorizer:
        id: myJwtAuthorizer

# SAM
Auth:
  Authorizer: MyAuthorizer`,
            resources: [fn.id],
          }),
        );
      }
    }
    return findings;
  },
};

export const missingTracing: Rule = {
  id: "missing-tracing",
  severity: "info",
  title: "No X-Ray / tracing config",
  run(stack) {
    if (stack.globals.tracing) return [];

    const offenders = stack.functions.filter((fn) => !fn.tracing);
    if (offenders.length === 0) return [];

    // One finding for the stack if none have tracing
    if (offenders.length === stack.functions.length) {
      return [
        finding(missingTracing, {
          summary: "No X-Ray tracing configuration detected on functions.",
          detail:
            "Tracing helps follow a request across Lambda, SQS, and downstream calls during incidents. Enable Active tracing where the format supports it.",
          remediation: `# Serverless Framework
provider:
  tracing:
    lambda: true

# SAM
Properties:
  Tracing: Active`,
          resources: offenders.map((f) => f.id).slice(0, 5),
          learnMoreUrl: LEARN_MORE.observability,
        }),
      ];
    }

    return offenders.map((fn) =>
      finding(missingTracing, {
        summary: `\`${fn.id}\` has no tracing enabled.`,
        detail:
          "Tracing helps follow a request across Lambda, SQS, and downstream calls during incidents.",
        remediation: `Properties:
  Tracing: Active`,
        resources: [fn.id],
        learnMoreUrl: LEARN_MORE.observability,
      }),
    );
  },
};

export const rules: Rule[] = [
  asyncMissingDlq,
  sqsMissingRedrive,
  sqsMaxReceiveTooHigh,
  sqsVisibilityVsTimeout,
  retryUnbounded,
  timeoutDefaultOnly,
  timeoutTooHigh,
  noReservedConcurrency,
  noAlarms,
  noStructuredLogging,
  httpNoAuthHint,
  missingTracing,
];

export function runRules(stack: StackIR): Finding[] {
  const findings = rules.flatMap((rule) => rule.run(stack));
  const severityOrder = { fail: 0, warn: 1, info: 2 } as const;
  return findings.sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      a.ruleId.localeCompare(b.ruleId) ||
      a.resources.join().localeCompare(b.resources.join()),
  );
}
