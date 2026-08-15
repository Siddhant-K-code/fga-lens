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

export type ModelDiagnostic = {
  line: number;
  message: string;
};

export type ModelSummary = {
  diagnostics: ModelDiagnostic[];
  relationCount: number;
  typeCount: number;
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

export const defaultModel = modelSource.join("\n");

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

type ParsedModel = ModelSummary & {
  rules: Record<string, Record<string, Rule[]>>;
};

function relationLabel(relation: string) {
  return relation.replaceAll("_", " ");
}

function ruleLabel(target: string, relation: string, tupleset?: string) {
  if (tupleset) {
    return `${relationLabel(target)} inherit through ${relationLabel(tupleset)}`;
  }
  return `${relationLabel(relation)} grants ${relationLabel(target)}`;
}

export function parseModel(modelText: string): ParsedModel {
  const lines = modelText.split("\n");
  const diagnostics: ModelDiagnostic[] = [];
  const rules: Record<string, Record<string, Rule[]>> = {};
  const types = new Set<string>();
  let relationCount = 0;
  let currentType = "";
  let currentRelation = "";

  const addExpression = (expression: string, line: number) => {
    if (!currentType || !currentRelation) return;

    const derivedExpression = expression.replace(/\[[^\]]*\]/g, " ");
    const terms = derivedExpression
      .split(/\s+or\s+|^\s*or\s+|\s+or\s*$/)
      .map((term) => term.trim())
      .filter(Boolean);

    for (const term of terms) {
      const fromMatch = term.match(/^([a-zA-Z_]\w*)\s+from\s+([a-zA-Z_]\w*)$/);
      let rule: Rule | null = null;

      if (fromMatch) {
        rule = {
          kind: "from",
          relation: fromMatch[1],
          tupleset: fromMatch[2],
          line,
          label: ruleLabel(currentRelation, fromMatch[1], fromMatch[2]),
        };
      } else if (/^[a-zA-Z_]\w*$/.test(term) && term !== currentRelation) {
        rule = {
          kind: "computed",
          relation: term,
          line,
          label: ruleLabel(currentRelation, term),
        };
      } else if (term !== currentRelation) {
        diagnostics.push({ line, message: `Could not parse “${term}”.` });
      }

      if (rule) {
        rules[currentType] ??= {};
        rules[currentType][currentRelation] ??= [];
        rules[currentType][currentRelation].push(rule);
      }
    }
  };

  lines.forEach((sourceLine, index) => {
    const line = index + 1;
    const trimmed = sourceLine.trim();
    const typeMatch = trimmed.match(/^type\s+([a-zA-Z_]\w*)$/);
    const defineMatch = trimmed.match(/^define\s+([a-zA-Z_]\w*)\s*:\s*(.*)$/);

    if (typeMatch) {
      currentType = typeMatch[1];
      currentRelation = "";
      types.add(currentType);
      rules[currentType] ??= {};
      return;
    }

    if (trimmed.startsWith("define ") && !defineMatch) {
      diagnostics.push({ line, message: "Expected `define relation: expression`." });
      currentRelation = "";
      return;
    }

    if (defineMatch) {
      if (!currentType) {
        diagnostics.push({ line, message: "Relation is outside a type block." });
        return;
      }
      currentRelation = defineMatch[1];
      relationCount += 1;
      rules[currentType][currentRelation] ??= [];
      addExpression(defineMatch[2], line);
      return;
    }

    if (currentRelation && trimmed && trimmed !== "relations") {
      addExpression(trimmed, line);
    }
  });

  const openBrackets = (modelText.match(/\[/g) ?? []).length;
  const closeBrackets = (modelText.match(/\]/g) ?? []).length;
  if (openBrackets !== closeBrackets) {
    diagnostics.push({ line: 1, message: "Unbalanced relationship type brackets." });
  }
  if (types.size === 0) {
    diagnostics.push({ line: 1, message: "Add at least one type definition." });
  }

  return { diagnostics, relationCount, rules, typeCount: types.size };
}

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

function ruleEvidence(rule: Rule, object: string, modelLines: string[]): Evidence {
  return {
    id: `rule-${object}-${rule.line}-${rule.relation}`,
    kind: "rule",
    title: rule.label,
    explanation:
      rule.kind === "from"
        ? `The model follows ${rule.tupleset} to another object, then checks its ${rule.relation} relation.`
        : `The model includes the computed ${rule.relation} relation in this permission.`,
    line: rule.line,
    expression: modelLines[rule.line - 1]?.trim() ?? "",
  };
}

export function evaluate(query: Query, disabled: Set<string>, modelText = defaultModel): Decision {
  let visited = 0;
  const activeTuples = tuples.filter((tuple) => !disabled.has(tuple.id));
  const modelLines = modelText.split("\n");
  const { rules } = parseModel(modelText);

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
          return { ok: true, path: [...computed.path, ruleEvidence(rule, object, modelLines)] };
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
                ruleEvidence(rule, object, modelLines),
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
