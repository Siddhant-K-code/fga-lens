export type Query = {
  user: string;
  relation: Relation;
  object: string;
};

export type Relation = "admin" | "maintainer" | "writer" | "triager" | "reader";

export type Tuple = {
  id: string;
  user: string;
  relation: string;
  object: string;
};

export type Evidence = {
  id: string;
  kind: "tuple" | "rule";
  title: string;
  explanation: string;
  sourceId?: string;
  line?: number;
  expression: string;
};

export type Attempt = {
  id: string;
  title: string;
  detail: string;
  line?: number;
};

export type Decision = {
  allowed: boolean;
  path: Evidence[];
  attempts: Attempt[];
  visited: number;
};

export const modelSource = [
  "model",
  "  schema 1.1",
  "",
  "type user",
  "",
  "type organization",
  "  relations",
  "    define member: [user] or owner",
  "    define owner: [user]",
  "    define repo_admin: [user, organization#member]",
  "    define repo_reader: [user, organization#member]",
  "    define repo_writer: [user, organization#member]",
  "",
  "type repo",
  "  relations",
  "    define admin: [user, team#member] or repo_admin from owner",
  "    define maintainer: [user, team#member] or admin",
  "    define owner: [organization]",
  "    define reader: [user, team#member] or triager or",
  "      repo_reader from owner",
  "    define triager: [user, team#member] or writer",
  "    define writer: [user, team#member] or maintainer or",
  "      repo_writer from owner",
  "",
  "type team",
  "  relations",
  "    define member: [user, team#member]",
];

export const tuples: Tuple[] = [
  { id: "t1", user: "user:erik", relation: "member", object: "organization:openfga" },
  {
    id: "t2",
    user: "organization:openfga#member",
    relation: "repo_admin",
    object: "organization:openfga",
  },
  {
    id: "t3",
    user: "team:openfga/core#member",
    relation: "admin",
    object: "repo:openfga/openfga",
  },
  {
    id: "t4",
    user: "organization:openfga",
    relation: "owner",
    object: "repo:openfga/openfga",
  },
  { id: "t5", user: "user:anne", relation: "reader", object: "repo:openfga/openfga" },
  { id: "t6", user: "user:beth", relation: "writer", object: "repo:openfga/openfga" },
  { id: "t7", user: "user:diane", relation: "member", object: "team:openfga/backend" },
  {
    id: "t8",
    user: "team:openfga/backend#member",
    relation: "member",
    object: "team:openfga/core",
  },
  { id: "t9", user: "user:charles", relation: "member", object: "team:openfga/core" },
];

export const users = ["user:erik", "user:anne", "user:beth", "user:diane", "user:charles"];
export const relations: Relation[] = ["admin", "maintainer", "writer", "triager", "reader"];

type Rule =
  | { kind: "computed"; relation: string; line: number; label: string }
  | { kind: "from"; relation: string; tupleset: string; line: number; label: string };

const rules: Record<string, Record<string, Rule[]>> = {
  organization: {
    member: [{ kind: "computed", relation: "owner", line: 8, label: "Owners are also members" }],
  },
  repo: {
    admin: [
      {
        kind: "from",
        relation: "repo_admin",
        tupleset: "owner",
        line: 16,
        label: "Repository admins inherit from the owner organization",
      },
    ],
    maintainer: [
      { kind: "computed", relation: "admin", line: 17, label: "Repository admins are maintainers" },
    ],
    writer: [
      { kind: "computed", relation: "maintainer", line: 22, label: "Maintainers can write" },
      {
        kind: "from",
        relation: "repo_writer",
        tupleset: "owner",
        line: 23,
        label: "Writers can inherit from the owner organization",
      },
    ],
    triager: [
      { kind: "computed", relation: "writer", line: 21, label: "Repository writers can triage" },
    ],
    reader: [
      { kind: "computed", relation: "triager", line: 19, label: "Repository triagers can read" },
      {
        kind: "from",
        relation: "repo_reader",
        tupleset: "owner",
        line: 20,
        label: "Readers can inherit from the owner organization",
      },
    ],
  },
};

type ResolveResult = {
  ok: boolean;
  path: Evidence[];
};

function parseUserset(value: string): { object: string; relation: string } | null {
  const marker = value.lastIndexOf("#");
  if (marker === -1) return null;
  return { object: value.slice(0, marker), relation: value.slice(marker + 1) };
}

function objectType(object: string) {
  return object.slice(0, object.indexOf(":"));
}

function tupleEvidence(tuple: Tuple, nested = false): Evidence {
  const subject = tuple.user.replace("user:", "");
  const target = tuple.object.replace(/^[^:]+:/, "");
  const userset = parseUserset(tuple.user);
  return {
    id: `evidence-${tuple.id}`,
    kind: "tuple",
    title:
      nested && userset
        ? `Members of ${displayName(userset.object)} become ${tuple.relation} of ${displayName(tuple.object)}`
        : `${subject} is ${tuple.relation} of ${target}`,
    explanation: nested
      ? "This userset tuple carries every member of the source group into the target relation."
      : "This relationship is stored directly as a tuple.",
    sourceId: tuple.id,
    expression: `${tuple.user}  ${tuple.relation}  ${tuple.object}`,
  };
}

function ruleEvidence(rule: Rule, object: string): Evidence {
  return {
    id: `rule-${object}-${rule.line}-${rule.relation}`,
    kind: "rule",
    title: rule.label,
    explanation:
      rule.kind === "from"
        ? `The model follows ${rule.tupleset} to another object, then checks its ${rule.relation} relation.`
        : `The model includes the computed ${rule.relation} relation in this permission.`,
    line: rule.line,
    expression: modelSource[rule.line - 1].trim(),
  };
}

export function evaluate(query: Query, disabled: Set<string>): Decision {
  let visited = 0;
  const activeTuples = tuples.filter((tuple) => !disabled.has(tuple.id));

  const resolve = (
    user: string,
    relation: string,
    object: string,
    stack: Set<string> = new Set(),
  ): ResolveResult => {
    const key = `${user}|${relation}|${object}`;
    if (stack.has(key)) return { ok: false, path: [] };
    const nextStack = new Set(stack);
    nextStack.add(key);
    visited += 1;

    const direct = activeTuples.filter(
      (tuple) => tuple.relation === relation && tuple.object === object,
    );

    for (const tuple of direct) {
      if (tuple.user === user) {
        return { ok: true, path: [tupleEvidence(tuple)] };
      }

      const userset = parseUserset(tuple.user);
      if (userset) {
        const nested = resolve(user, userset.relation, userset.object, nextStack);
        if (nested.ok) {
          return { ok: true, path: [...nested.path, tupleEvidence(tuple, true)] };
        }
      }
    }

    const typeRules = rules[objectType(object)]?.[relation] ?? [];
    for (const rule of typeRules) {
      if (rule.kind === "computed") {
        const computed = resolve(user, rule.relation, object, nextStack);
        if (computed.ok) {
          return { ok: true, path: [...computed.path, ruleEvidence(rule, object)] };
        }
      } else {
        const relatedObjects = activeTuples.filter(
          (tuple) => tuple.relation === rule.tupleset && tuple.object === object,
        );
        for (const related of relatedObjects) {
          if (parseUserset(related.user)) continue;
          const inherited = resolve(user, rule.relation, related.user, nextStack);
          if (inherited.ok) {
            return {
              ok: true,
              path: [
                ...inherited.path,
                tupleEvidence(related),
                ruleEvidence(rule, object),
              ],
            };
          }
        }
      }
    }

    return { ok: false, path: [] };
  };

  const result = resolve(query.user, query.relation, query.object);
  const targetType = objectType(query.object);
  const candidateRules = rules[targetType]?.[query.relation] ?? [];
  const directActive = activeTuples.some(
    (tuple) => tuple.relation === query.relation && tuple.object === query.object,
  );

  const attempts: Attempt[] = [
    {
      id: "attempt-direct",
      title: "Direct assignment",
      detail: directActive
        ? "Matching tuples exist, but none resolve to this subject."
        : `No active ${query.relation} tuple exists on this object.`,
    },
    ...candidateRules.map((rule, index) => ({
      id: `attempt-rule-${index}`,
      title: rule.label,
      detail:
        rule.kind === "from"
          ? `The ${rule.tupleset} relationship resolves, but no ${rule.relation} path reaches ${query.user}.`
          : `${query.user} does not resolve through the computed ${rule.relation} relation.`,
      line: rule.line,
    })),
  ];

  return { allowed: result.ok, path: result.path, attempts, visited };
}

export function displayName(value: string) {
  return value.replace(/^[^:]+:/, "").replace("openfga/", "");
}
