import type {
  EventIR,
  EventType,
  FunctionIR,
  QueueIR,
  StackIR,
  InputFormat,
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
  if (isRecord(value["Fn::GetAtt"]) && typeof value["Fn::GetAtt"].Name === "string") {
    return value["Fn::GetAtt"].Name;
  }
  return undefined;
}

function mapSamEventType(type: string): EventType {
  const t = type.toLowerCase();
  if (t === "sqs") return "sqs";
  if (t === "sns") return "sns";
  if (t === "eventbridgerule" || t === "cloudwatchevent") return "eventBridge";
  if (t === "s3") return "s3";
  if (t === "api" || t === "httpapi") return "http";
  if (t === "schedule") return "schedule";
  return "other";
}

function parseSamEvents(events: unknown): EventIR[] {
  if (!isRecord(events)) return [];
  const result: EventIR[] = [];

  for (const event of Object.values(events)) {
    if (!isRecord(event)) continue;
    const type = mapSamEventType(asString(event.Type) ?? "other");
    const props = isRecord(event.Properties) ? event.Properties : {};
    const item: EventIR = { type };

    if (type === "sqs") {
      item.source = resolveRef(props.Queue) ?? asString(props.Queue);
      item.batchSize = asNumber(props.BatchSize);
      item.functionResponseType = asString(props.FunctionResponseTypes)
        ?? (Array.isArray(props.FunctionResponseTypes)
          ? String(props.FunctionResponseTypes[0])
          : undefined);
      item.maximumRetryAttempts = asNumber(props.MaximumRetryAttempts);
    } else if (type === "sns") {
      item.source = resolveRef(props.Topic) ?? asString(props.Topic);
    } else if (type === "eventBridge") {
      item.source =
        resolveRef(props.EventBusName) ??
        asString(props.EventBusName) ??
        asString(props.Source);
      item.maximumRetryAttempts = asNumber(props.RetryPolicy)
        ? asNumber((props.RetryPolicy as UnknownRecord).MaximumRetryAttempts)
        : asNumber(props.MaximumRetryAttempts);
      if (isRecord(props.RetryPolicy)) {
        item.maximumRetryAttempts = asNumber(props.RetryPolicy.MaximumRetryAttempts);
      }
    } else if (type === "s3") {
      item.source = resolveRef(props.Bucket) ?? asString(props.Bucket);
    } else if (type === "http") {
      const auth = props.Auth;
      item.hasAuthorizer =
        auth !== undefined ||
        props.Authorizer !== undefined ||
        (isRecord(auth) && "Authorizer" in auth);
    }

    result.push(item);
  }
  return result;
}

function parseDeadLetterConfig(props: UnknownRecord): FunctionIR["deadLetter"] | undefined {
  const dlc = isRecord(props.DeadLetterConfig) ? props.DeadLetterConfig : undefined;
  if (!dlc) return undefined;
  const target = resolveRef(dlc.TargetArn) ?? asString(dlc.TargetArn);
  if (!target) return undefined;
  return { type: /sns/i.test(target) ? "sns" : "sqs", target };
}

function parseEventInvokeConfig(props: UnknownRecord): FunctionIR["onFailure"] | undefined {
  const eic = isRecord(props.EventInvokeConfig) ? props.EventInvokeConfig : undefined;
  if (!eic) return undefined;
  const dest = isRecord(eic.DestinationConfig) ? eic.DestinationConfig : undefined;
  const onFailure = dest && isRecord(dest.OnFailure) ? dest.OnFailure : undefined;
  if (!onFailure) return undefined;
  const target = resolveRef(onFailure.Destination) ?? asString(onFailure.Destination);
  if (!target) return undefined;
  return { type: /sns/i.test(target) ? "sns" : "sqs", target };
}

function parseFunctionResource(id: string, resource: UnknownRecord, globals?: UnknownRecord): FunctionIR {
  const props = isRecord(resource.Properties) ? resource.Properties : {};
  const globalFn = isRecord(globals?.Function) ? (globals!.Function as UnknownRecord) : {};

  const timeout = asNumber(props.Timeout) ?? asNumber(globalFn.Timeout);
  const timeoutExplicit = asNumber(props.Timeout) !== undefined;

  const envVars = isRecord(props.Environment) && isRecord(props.Environment.Variables)
    ? Object.fromEntries(
        Object.entries(props.Environment.Variables).map(([k, v]) => [k, String(v)]),
      )
    : undefined;

  const loggingConfig = isRecord(props.LoggingConfig) ? props.LoggingConfig : undefined;
  const tracing =
    asString(props.Tracing) === "Active" ||
    asString(props.Tracing) === "PassThrough" ||
    asString(globalFn.Tracing) === "Active";

  return {
    id,
    timeout,
    timeoutExplicit,
    memory: asNumber(props.MemorySize) ?? asNumber(globalFn.MemorySize),
    reservedConcurrency: asNumber(props.ReservedConcurrentExecutions),
    events: parseSamEvents(props.Events),
    deadLetter: parseDeadLetterConfig(props),
    onFailure: parseEventInvokeConfig(props),
    environment: envVars,
    logging: loggingConfig
      ? { format: asString(loggingConfig.LogFormat) }
      : undefined,
    tracing,
    runtime: asString(props.Runtime) ?? asString(globalFn.Runtime),
  };
}

function parseLambdaFunction(id: string, resource: UnknownRecord): FunctionIR {
  const props = isRecord(resource.Properties) ? resource.Properties : {};
  const timeout = asNumber(props.Timeout);
  const envVars = isRecord(props.Environment) && isRecord(props.Environment.Variables)
    ? Object.fromEntries(
        Object.entries(props.Environment.Variables).map(([k, v]) => [k, String(v)]),
      )
    : undefined;
  const loggingConfig = isRecord(props.LoggingConfig) ? props.LoggingConfig : undefined;

  return {
    id,
    timeout,
    timeoutExplicit: timeout !== undefined,
    memory: asNumber(props.MemorySize),
    reservedConcurrency: asNumber(props.ReservedConcurrentExecutions),
    events: [],
    deadLetter: parseDeadLetterConfig(props),
    environment: envVars,
    logging: loggingConfig
      ? { format: asString(loggingConfig.LogFormat) }
      : undefined,
    tracing:
      asString(props.TracingConfig && isRecord(props.TracingConfig)
        ? (props.TracingConfig as UnknownRecord).Mode
        : undefined) === "Active",
    runtime: asString(props.Runtime),
  };
}

function parseQueue(id: string, resource: UnknownRecord): QueueIR {
  const props = isRecord(resource.Properties) ? resource.Properties : {};
  const redrive = isRecord(props.RedrivePolicy) ? props.RedrivePolicy : undefined;
  return {
    id,
    visibilityTimeout: asNumber(props.VisibilityTimeout),
    redrivePolicy: redrive
      ? {
          deadLetterTarget:
            resolveRef(redrive.deadLetterTargetArn) ??
            resolveRef(redrive.DeadLetterTargetArn) ??
            asString(redrive.deadLetterTargetArn) ??
            asString(redrive.DeadLetterTargetArn) ??
            "unknown",
          maxReceiveCount:
            asNumber(redrive.maxReceiveCount) ??
            asNumber(redrive.MaxReceiveCount) ??
            0,
        }
      : undefined,
  };
}

function attachEventSourceMappings(stack: StackIR, resources: UnknownRecord): void {
  for (const [id, resource] of Object.entries(resources)) {
    if (!isRecord(resource)) continue;
    if (resource.Type !== "AWS::Lambda::EventSourceMapping") continue;
    const props = isRecord(resource.Properties) ? resource.Properties : {};
    const fnId = resolveRef(props.FunctionName) ?? asString(props.FunctionName);
    const source = resolveRef(props.EventSourceArn) ?? asString(props.EventSourceArn);
    if (!fnId) continue;

    let fn = stack.functions.find((f) => f.id === fnId);
    if (!fn) {
      fn = {
        id: fnId,
        events: [],
        timeoutExplicit: false,
      };
      stack.functions.push(fn);
    }

    const isSqs = source ? /sqs/i.test(source) || stack.queues.some((q) => q.id === source) : true;
    fn.events.push({
      type: isSqs ? "sqs" : "other",
      source: source ?? id,
      batchSize: asNumber(props.BatchSize),
      maximumRetryAttempts: asNumber(props.MaximumRetryAttempts),
      functionResponseType: Array.isArray(props.FunctionResponseTypes)
        ? String(props.FunctionResponseTypes[0])
        : asString(props.FunctionResponseTypes),
    });
  }
}

export function parseSamCfn(doc: unknown, format: InputFormat): StackIR {
  const root = isRecord(doc) ? doc : {};
  const resources = isRecord(root.Resources) ? root.Resources : {};
  const globals = isRecord(root.Globals) ? root.Globals : undefined;

  const functions: FunctionIR[] = [];
  const queues: QueueIR[] = [];
  const topics: StackIR["topics"] = [];
  const eventBuses: StackIR["eventBuses"] = [];
  const alarms: StackIR["alarms"] = [];

  for (const [id, resource] of Object.entries(resources)) {
    if (!isRecord(resource)) continue;
    const type = asString(resource.Type);
    if (type === "AWS::Serverless::Function") {
      functions.push(parseFunctionResource(id, resource, globals));
    } else if (type === "AWS::Lambda::Function") {
      functions.push(parseLambdaFunction(id, resource));
    } else if (type === "AWS::SQS::Queue") {
      queues.push(parseQueue(id, resource));
    } else if (type === "AWS::SNS::Topic") {
      topics.push({ id });
    } else if (type === "AWS::Events::EventBus") {
      eventBuses.push({ id });
    } else if (type === "AWS::CloudWatch::Alarm") {
      const props = isRecord(resource.Properties) ? resource.Properties : {};
      alarms.push({
        id,
        metricName: asString(props.MetricName),
        namespace: asString(props.Namespace),
      });
    }
  }

  const stack: StackIR = {
    functions,
    queues,
    topics,
    eventBuses,
    alarms,
    globals: {
      timeout: isRecord(globals?.Function)
        ? asNumber((globals!.Function as UnknownRecord).Timeout)
        : undefined,
      memory: isRecord(globals?.Function)
        ? asNumber((globals!.Function as UnknownRecord).MemorySize)
        : undefined,
      runtime: isRecord(globals?.Function)
        ? asString((globals!.Function as UnknownRecord).Runtime)
        : undefined,
      tracing: isRecord(globals?.Function)
        ? asString((globals!.Function as UnknownRecord).Tracing) === "Active"
        : undefined,
    },
    format,
  };

  attachEventSourceMappings(stack, resources);
  return stack;
}
