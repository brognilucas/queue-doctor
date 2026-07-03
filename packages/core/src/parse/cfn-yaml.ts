import { parse as parseYaml, Scalar, YAMLMap, YAMLSeq } from "yaml";

type TagPair = { tag: string; collection?: "map" | "seq"; resolve: (data: unknown) => unknown };

function scalarString(data: unknown): string {
  if (typeof data === "string") return data;
  if (data instanceof Scalar) return String(data.value);
  return String(data);
}

function toJs(data: unknown): unknown {
  if (data instanceof Scalar) return data.value;
  if (data instanceof YAMLMap) {
    const obj: Record<string, unknown> = {};
    for (const item of data.items) {
      const key = String(toJs(item.key));
      obj[key] = toJs(item.value);
    }
    return obj;
  }
  if (data instanceof YAMLSeq) {
    return data.items.map((item) => toJs(item));
  }
  return data;
}

/**
 * CloudFormation/SAM short-form intrinsic tags → long-form objects.
 * Enough for QueueDoctor resource linking (Ref / GetAtt / Sub / etc.).
 */
const cfnTags: TagPair[] = [
  {
    tag: "!Ref",
    resolve: (data) => ({ Ref: scalarString(data) }),
  },
  {
    tag: "!GetAtt",
    resolve: (data) => {
      const value = scalarString(data);
      const [resource, ...rest] = value.split(".");
      return { "Fn::GetAtt": [resource, rest.join(".") || "Arn"] };
    },
  },
  {
    tag: "!Sub",
    resolve: (data) => {
      const js = toJs(data);
      return { "Fn::Sub": js };
    },
  },
  {
    tag: "!Join",
    collection: "seq",
    resolve: (data) => ({ "Fn::Join": toJs(data) }),
  },
  {
    tag: "!Select",
    collection: "seq",
    resolve: (data) => ({ "Fn::Select": toJs(data) }),
  },
  {
    tag: "!Split",
    collection: "seq",
    resolve: (data) => ({ "Fn::Split": toJs(data) }),
  },
  {
    tag: "!FindInMap",
    collection: "seq",
    resolve: (data) => ({ "Fn::FindInMap": toJs(data) }),
  },
  {
    tag: "!If",
    collection: "seq",
    resolve: (data) => ({ "Fn::If": toJs(data) }),
  },
  {
    tag: "!Equals",
    collection: "seq",
    resolve: (data) => ({ "Fn::Equals": toJs(data) }),
  },
  {
    tag: "!And",
    collection: "seq",
    resolve: (data) => ({ "Fn::And": toJs(data) }),
  },
  {
    tag: "!Or",
    collection: "seq",
    resolve: (data) => ({ "Fn::Or": toJs(data) }),
  },
  {
    tag: "!Not",
    collection: "seq",
    resolve: (data) => ({ "Fn::Not": toJs(data) }),
  },
  {
    tag: "!ImportValue",
    resolve: (data) => ({ "Fn::ImportValue": toJs(data) }),
  },
  {
    tag: "!Condition",
    resolve: (data) => ({ Condition: scalarString(data) }),
  },
];

export function parseCfnYaml(input: string): unknown {
  return parseYaml(input, {
    customTags: cfnTags,
    // Keep unknown tags from crashing the parse.
    prettyErrors: true,
  });
}
