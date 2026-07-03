export type Severity = "fail" | "warn" | "info";

export type ScoreBand = "Healthy" | "Needs work" | "Risky";

export type InputFormat =
  | "serverless-framework"
  | "sam-cfn-yaml"
  | "sam-cfn-json"
  | "unknown";

export type EventType =
  | "sqs"
  | "sns"
  | "eventBridge"
  | "s3"
  | "http"
  | "schedule"
  | "other";

export type EventIR = {
  type: EventType;
  source?: string;
  hasAuthorizer?: boolean;
  batchSize?: number;
  maximumRetryAttempts?: number;
  functionResponseType?: string;
};

export type FunctionIR = {
  id: string;
  timeout?: number;
  timeoutExplicit?: boolean;
  memory?: number;
  reservedConcurrency?: number;
  events: EventIR[];
  deadLetter?: { type: "sqs" | "sns"; target: string };
  onFailure?: { type: "sqs" | "sns"; target: string };
  environment?: Record<string, string>;
  logging?: { format?: string };
  tracing?: boolean;
  runtime?: string;
};

export type QueueIR = {
  id: string;
  visibilityTimeout?: number;
  redrivePolicy?: { deadLetterTarget: string; maxReceiveCount: number };
};

export type TopicIR = {
  id: string;
};

export type EventBusIR = {
  id: string;
};

export type AlarmIR = {
  id: string;
  metricName?: string;
  namespace?: string;
};

export type StackGlobals = {
  timeout?: number;
  memory?: number;
  runtime?: string;
  tracing?: boolean;
  logFormat?: string;
};

export type StackIR = {
  functions: FunctionIR[];
  queues: QueueIR[];
  topics: TopicIR[];
  eventBuses: EventBusIR[];
  alarms: AlarmIR[];
  globals: StackGlobals;
  format: InputFormat;
};

export type Finding = {
  ruleId: string;
  severity: Severity;
  title: string;
  summary: string;
  detail: string;
  remediation: string;
  resources: string[];
  learnMoreUrl?: string;
};

export type AnalysisResult = {
  format: InputFormat;
  score: number;
  band: ScoreBand;
  findings: Finding[];
  stack: StackIR;
};

export type ParseError = {
  message: string;
  line?: number;
};

export type ParseResult =
  | { ok: true; stack: StackIR }
  | { ok: false; error: ParseError; format: InputFormat };

export type Rule = {
  id: string;
  severity: Severity;
  title: string;
  run: (stack: StackIR) => Finding[];
};
