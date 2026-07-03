import type {
  EventIR,
  EventType,
  FunctionIR,
  QueueIR,
  StackIR,
} from "../types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function resolveRef(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return undefined;
  if (typeof value.Ref === "string") return value.Ref;
  if (Array.isArray(value["Fn::GetAtt"]) && typeof value["Fn::GetAtt"][0] === "string") {
    return value["Fn::GetAtt"][0];
  }
  return undefined;
}

function mapEventType(key: string): EventType {
  const k = key.toLowerCase();
  if (k === "sqs") return "sqs";
  if (k === "sns") return "sns";
  if (k === "eventbridge" || k === "eventbus" || k === "cloudwatchevent") {
    return "eventBridge";
  }
  if (k === "s3") return "s3";
  if (k === "http" || k === "httpapi" || k === "websocket") return "http";
  if (k === "schedule" || k === "cloudwatchlog") return "schedule";
  return "other";
}

function parseEvents(raw: unknown): EventIR[] {
  if (!Array.isArray(raw)) return [];

  const events: EventIR[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    for (const [key, value] of Object.entries(item)) {
      const type = mapEventType(key);
      const cfg = isRecord(value) ? value : {};
      const event: EventIR = { type };

      if (type === "sqs") {
        event.source =
          resolveRef(cfg.arn) ?? asString(cfg.queueName) ?? asString(value);
        event.batchSize = asNumber(cfg.batchSize);
        event.functionResponseType = asString(cfg.functionResponseType);
        event.maximumRetryAttempts = asNumber(cfg.maximumRetryAttempts);
      } else if (type === "sns") {
        event.source =
          resolveRef(cfg.arn) ?? asString(cfg.topicName) ?? asString(value);
      } else if (type === "eventBridge") {
        event.source =
          resolveRef(cfg.eventBus) ??
          asString(cfg.eventBusName) ??
          asString(cfg.source);
        event.maximumRetryAttempts = asNumber(cfg.maximumRetryAttempts);
      } else if (type === "s3") {
        event.source =
          resolveRef(cfg.bucket) ?? asString(cfg.existing) ?? asString(value);
      } else if (type === "http") {
        event.hasAuthorizer =
          cfg.authorizer !== undefined ||
          cfg.authorizers !== undefined ||
          asString(cfg.private) === "true" ||
          cfg.private === true;
      }

      events.push(event);
    }
  }
  return events;
}

function parseDeadLetter(raw: unknown): FunctionIR["deadLetter"] | undefined {
  if (!isRecord(raw)) return undefined;
  const target =
    asString(raw.targetArn) ??
    asString(raw.sqs) ??
    asString(raw.sns) ??
    asString(raw.target);
  if (!target) return undefined;
  const type: "sqs" | "sns" =
    raw.sns !== undefined || /sns/i.test(target) ? "sns" : "sqs";
  return { type, target };
}

function parseFunction(
  id: string,
  raw: unknown,
  providerTimeout?: number,
): FunctionIR {
  const cfg = isRecord(raw) ? raw : {};
  const timeout = asNumber(cfg.timeout);
  const timeoutExplicit = timeout !== undefined;
  const env = isRecord(cfg.environment)
    ? Object.fromEntries(
        Object.entries(cfg.environment).map(([k, v]) => [k, String(v)]),
      )
    : undefined;

  const destinations = isRecord(cfg.destinations) ? cfg.destinations : undefined;
  const onFailureRaw = destinations?.onFailure;
  let onFailure: FunctionIR["onFailure"];
  if (typeof onFailureRaw === "string") {
    onFailure = {
      type: /sns/i.test(onFailureRaw) ? "sns" : "sqs",
      target: onFailureRaw,
    };
  } else if (isRecord(onFailureRaw)) {
    const target =
      resolveRef(onFailureRaw) ??
      asString(onFailureRaw.arn) ??
      resolveRef(onFailureRaw.arn) ??
      asString(onFailureRaw.destination) ??
      resolveRef(onFailureRaw.destination) ??
      asString(onFailureRaw.sqs) ??
      asString(onFailureRaw.sns);
    if (target) {
      onFailure = {
        type: onFailureRaw.sns !== undefined || /sns/i.test(target) ? "sns" : "sqs",
        target,
      };
    }
  }

  const logging = isRecord(cfg.logging)
    ? { format: asString(cfg.logging.format) }
    : undefined;

  return {
    id,
    timeout: timeout ?? providerTimeout,
    timeoutExplicit,
    memory: asNumber(cfg.memorySize) ?? asNumber(cfg.memory),
    reservedConcurrency: asNumber(cfg.reservedConcurrency),
    events: parseEvents(cfg.events),
    deadLetter: parseDeadLetter(cfg.deadLetter) ?? parseDeadLetter(cfg.onError),
    onFailure,
    environment: env,
    logging,
    tracing:
      cfg.tracing === true ||
      asString(cfg.tracing) === "Active" ||
      asString(cfg.tracing) === "PassThrough",
    runtime: asString(cfg.runtime),
  };
}

function parseResourcesQueues(resources: unknown): QueueIR[] {
  if (!isRecord(resources) || !isRecord(resources.Resources)) return [];
  const queues: QueueIR[] = [];

  for (const [id, resource] of Object.entries(resources.Resources)) {
    if (!isRecord(resource)) continue;
    if (resource.Type !== "AWS::SQS::Queue") continue;
    const props = isRecord(resource.Properties) ? resource.Properties : {};
    const redrive = isRecord(props.RedrivePolicy) ? props.RedrivePolicy : undefined;
    queues.push({
      id,
      visibilityTimeout: asNumber(props.VisibilityTimeout),
      redrivePolicy: redrive
        ? {
            deadLetterTarget:
              resolveRef(redrive.deadLetterTargetArn) ??
              resolveRef(redrive.DeadLetterTargetArn) ??
              "unknown",
            maxReceiveCount:
              asNumber(redrive.maxReceiveCount) ??
              asNumber(redrive.MaxReceiveCount) ??
              0,
          }
        : undefined,
    });
  }
  return queues;
}

function parseCustomQueues(resources: unknown): QueueIR[] {
  // serverless-plugin / resources.Resources already handled; also accept
  // top-level custom.queues style maps if present (ignored if not queues).
  if (!isRecord(resources)) return [];
  return [];
}

export function parseServerlessFramework(doc: unknown): StackIR {
  const root = isRecord(doc) ? doc : {};
  const provider = isRecord(root.provider) ? root.provider : {};
  const providerTimeout = asNumber(provider.timeout);
  const providerMemory = asNumber(provider.memorySize);
  const providerRuntime = asString(provider.runtime);
  const providerTracing =
    provider.tracing === true ||
    (isRecord(provider.tracing) && provider.tracing.lambda === true) ||
    asString(provider.tracing) === "Active";

  const logFormat =
    (isRecord(provider.logs) &&
      isRecord(provider.logs.lambda) &&
      asString(provider.logs.lambda.logFormat)) ||
    (isRecord(provider.logs) && asString(provider.logs.format)) ||
    undefined;

  const functionsRaw = isRecord(root.functions) ? root.functions : {};
  const functions = Object.entries(functionsRaw).map(([id, cfg]) =>
    parseFunction(id, cfg, providerTimeout),
  );

  const resources = root.resources;
  const queues = [
    ...parseResourcesQueues(resources),
    ...parseCustomQueues(resources),
  ];

  // Also detect queues referenced only via CFN-style resources under resources
  const alarms: StackIR["alarms"] = [];
  if (isRecord(resources) && isRecord(resources.Resources)) {
    for (const [id, resource] of Object.entries(resources.Resources)) {
      if (!isRecord(resource)) continue;
      if (resource.Type === "AWS::CloudWatch::Alarm") {
        const props = isRecord(resource.Properties) ? resource.Properties : {};
        alarms.push({
          id,
          metricName: asString(props.MetricName),
          namespace: asString(props.Namespace),
        });
      }
    }
  }

  return {
    functions,
    queues,
    topics: [],
    eventBuses: [],
    alarms,
    globals: {
      timeout: providerTimeout,
      memory: providerMemory,
      runtime: providerRuntime,
      tracing: providerTracing,
      logFormat,
    },
    format: "serverless-framework",
  };
}
