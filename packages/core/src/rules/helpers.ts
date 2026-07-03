import type { EventType, FunctionIR, StackIR } from "../types";

export const ASYNC_EVENT_TYPES: EventType[] = [
  "sqs",
  "sns",
  "eventBridge",
  "s3",
];

/** Effective timeout including provider/runtime defaults. */
export function effectiveTimeout(fn: FunctionIR, stack: StackIR): number {
  if (fn.timeout !== undefined) return fn.timeout;
  if (stack.globals.timeout !== undefined) return stack.globals.timeout;
  // Serverless Framework default is 6s; Lambda/SAM default is 3s.
  return stack.format === "serverless-framework" ? 6 : 3;
}

export function isAsyncFunction(fn: FunctionIR): boolean {
  return fn.events.some((e) => ASYNC_EVENT_TYPES.includes(e.type));
}

export function hasFailureDestination(fn: FunctionIR): boolean {
  return Boolean(fn.deadLetter || fn.onFailure);
}

export function queueForEventSource(
  stack: StackIR,
  source?: string,
): StackIR["queues"][number] | undefined {
  if (!source) return undefined;
  return stack.queues.find(
    (q) =>
      q.id === source ||
      source.includes(q.id) ||
      source.endsWith(`:${q.id}`) ||
      source.endsWith(`/${q.id}`),
  );
}

export const LEARN_MORE = {
  dlq: "https://brogni.dev",
  retries: "https://brogni.dev",
  observability: "https://brogni.dev",
} as const;
