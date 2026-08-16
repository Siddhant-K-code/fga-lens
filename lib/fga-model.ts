import { transformer, validator } from "@openfga/syntax-transformer";

import { googleDriveModel } from "@/lib/sample-models";

export type ModelDiagnostic = {
  column: number;
  line: number;
  message: string;
  type: string;
};

export type SubjectReference = {
  condition?: string;
  relation?: string;
  type: string;
  wildcard: boolean;
};

export type GraphDependency = {
  expressionPath: Array<"and" | "but not" | "or">;
  id: string;
  kind: "computed" | "direct" | "inherited" | "negative";
  label: string;
  sourceRelation?: string;
  sourceType: string;
  targetRelation: string;
  targetType: string;
};

export type GraphExpression =
  | { dependencyIds: string[]; kind: "computed"; relation: string }
  | { dependencyIds: string[]; kind: "direct"; subjects: SubjectReference[] }
  | { children: GraphExpression[]; kind: "intersection" }
  | { dependencyIds: string[]; kind: "inherited"; relation: string; sourceTypes: string[]; tupleset: string }
  | { children: GraphExpression[]; kind: "union" }
  | { base: GraphExpression; kind: "difference"; subtract: GraphExpression };

export type GraphRelation = {
  dependencies: GraphDependency[];
  directSubjects: SubjectReference[];
  expression: string;
  id: string;
  kind: "permission" | "relation";
  line: number;
  name: string;
  rewrite: GraphExpression;
  type: string;
};

export type GraphType = {
  id: string;
  line: number;
  name: string;
  relations: GraphRelation[];
};

export type ModelGraph = {
  dependencies: GraphDependency[];
  relationCount: number;
  schemaVersion: string;
  types: GraphType[];
};

export type ParseResult = {
  diagnostics: ModelDiagnostic[];
  graph: ModelGraph | null;
};

type Rewrite = {
  computedUserset?: { relation?: string };
  difference?: { base?: Rewrite; subtract?: Rewrite };
  intersection?: { child?: Rewrite[] };
  this?: Record<string, never>;
  tupleToUserset?: {
    computedUserset?: { relation?: string };
    tupleset?: { relation?: string };
  };
  union?: { child?: Rewrite[] };
};

type RelationMetadata = {
  directly_related_user_types?: Array<{
    condition?: string;
    relation?: string;
    type: string;
    wildcard?: Record<string, never>;
  }>;
};

type TypeDefinition = {
  metadata?: { relations?: Record<string, RelationMetadata> } | null;
  relations?: Record<string, Rewrite>;
  type: string;
};

type AuthorizationModel = {
  schema_version?: string;
  type_definitions?: TypeDefinition[];
};

type SourceLocation = {
  expression: string;
  line: number;
};

type SourceMap = {
  relations: Map<string, SourceLocation>;
  types: Map<string, number>;
};

export const defaultModel = googleDriveModel;

function buildSourceMap(modelText: string): SourceMap {
  const lines = modelText.split("\n");
  const types = new Map<string, number>();
  const relations = new Map<string, SourceLocation>();
  let currentType = "";
  let currentRelation = "";

  lines.forEach((sourceLine, index) => {
    const line = index + 1;
    const trimmed = sourceLine.trim();
    const typeMatch = trimmed.match(/^type\s+([^\s]+)\s*$/);
    const relationMatch = trimmed.match(/^define\s+([^\s:]+)\s*:\s*(.*)$/);

    if (typeMatch) {
      currentType = typeMatch[1];
      currentRelation = "";
      types.set(currentType, line);
      return;
    }

    if (/^condition\s+/.test(trimmed)) {
      currentRelation = "";
      return;
    }

    if (relationMatch && currentType) {
      currentRelation = relationMatch[1];
      relations.set(`${currentType}.${currentRelation}`, {
        expression: relationMatch[2].trim(),
        line,
      });
      return;
    }

    if (currentType && currentRelation && trimmed) {
      const key = `${currentType}.${currentRelation}`;
      const existing = relations.get(key);
      if (existing) existing.expression = `${existing.expression} ${trimmed}`.trim();
    }
  });

  return { relations, types };
}

function diagnosticsFromError(error: unknown): ModelDiagnostic[] {
  const candidate = error as {
    errors?: Array<{
      column?: { start?: number };
      line?: { start?: number };
      msg?: string;
      type?: string;
    }>;
    message?: string;
  };

  if (candidate.errors?.length) {
    return candidate.errors.map((item) => ({
      column: (item.column?.start ?? 0) + 1,
      line: item.line?.start ?? 1,
      message: item.msg ?? "Invalid authorization model.",
      type: item.type ?? "model",
    }));
  }

  return [{ column: 1, line: 1, message: candidate.message ?? "Invalid authorization model.", type: "model" }];
}

function directSubjects(metadata: RelationMetadata | undefined): SubjectReference[] {
  return (metadata?.directly_related_user_types ?? []).map((subject) => ({
    condition: subject.condition,
    relation: subject.relation,
    type: subject.type,
    wildcard: Boolean(subject.wildcard),
  }));
}

function relationMetadata(type: TypeDefinition, relation: string) {
  return type.metadata?.relations?.[relation];
}

export function parseAuthorizationModel(modelText: string): ParseResult {
  try {
    validator.validateDSL(modelText);
    const model = transformer.transformDSLToJSONObject(modelText) as unknown as AuthorizationModel;
    const sourceMap = buildSourceMap(modelText);
    const typeDefinitions = model.type_definitions ?? [];
    const dependencies: GraphDependency[] = [];
    const dependencyIds = new Map<string, string>();

    const addDependency = (dependency: Omit<GraphDependency, "id">) => {
      const key = [
        dependency.sourceType,
        dependency.sourceRelation ?? "$type",
        dependency.targetType,
        dependency.targetRelation,
        dependency.kind,
        dependency.label,
        dependency.expressionPath.join(">"),
      ].join("|");
      const existingId = dependencyIds.get(key);
      if (existingId) return existingId;
      const id = `edge:${dependencyIds.size + 1}:${key}`;
      dependencyIds.set(key, id);
      dependencies.push({ ...dependency, id });
      return id;
    };

    const dependencyLabel = (
      path: GraphDependency["expressionPath"],
      leafLabel: string,
    ) => {
      if (path.length === 0) return leafLabel;
      return `${path.join(" › ")}${leafLabel === "uses" ? "" : ` · ${leafLabel}`}`;
    };

    const buildExpression = (
      rewrite: Rewrite | undefined,
      targetType: TypeDefinition,
      targetRelation: string,
      path: GraphDependency["expressionPath"] = [],
    ): GraphExpression => {
      if (!rewrite) return { dependencyIds: [], kind: "direct", subjects: [] };

      if (rewrite.computedUserset?.relation) {
        const relation = rewrite.computedUserset.relation;
        const dependencyId = addDependency({
          expressionPath: path,
          kind: path.includes("but not") ? "negative" : "computed",
          label: dependencyLabel(path, "uses"),
          sourceRelation: rewrite.computedUserset.relation,
          sourceType: targetType.type,
          targetRelation,
          targetType: targetType.type,
        });
        return { dependencyIds: [dependencyId], kind: "computed", relation };
      }

      const tupleToUserset = rewrite.tupleToUserset;
      if (tupleToUserset?.computedUserset?.relation && tupleToUserset.tupleset?.relation) {
        const tupleset = tupleToUserset.tupleset.relation;
        const relatedTypes = directSubjects(relationMetadata(targetType, tupleset));
        const dependencyIds = relatedTypes.map((relatedType) => (
          addDependency({
            expressionPath: path,
            kind: path.includes("but not") ? "negative" : "inherited",
            label: dependencyLabel(path, `from ${tupleset}`),
            sourceRelation: tupleToUserset.computedUserset?.relation,
            sourceType: relatedType.type,
            targetRelation,
            targetType: targetType.type,
          })
        ));
        return {
          dependencyIds,
          kind: "inherited",
          relation: tupleToUserset.computedUserset.relation,
          sourceTypes: relatedTypes.map((relatedType) => relatedType.type),
          tupleset,
        };
      }

      if (rewrite.union?.child) {
        return {
          children: rewrite.union.child.map((child) => (
            buildExpression(child, targetType, targetRelation, [...path, "or"])
          )),
          kind: "union",
        };
      }

      if (rewrite.intersection?.child) {
        return {
          children: rewrite.intersection.child.map((child) => (
            buildExpression(child, targetType, targetRelation, [...path, "and"])
          )),
          kind: "intersection",
        };
      }

      if (rewrite.difference) {
        return {
          base: buildExpression(rewrite.difference.base, targetType, targetRelation, path),
          kind: "difference",
          subtract: buildExpression(rewrite.difference.subtract, targetType, targetRelation, [...path, "but not"]),
        };
      }

      const subjects = directSubjects(relationMetadata(targetType, targetRelation));
      const ids = subjects.map((subject) => {
        const leafLabel = subject.condition
          ? `if ${subject.condition}`
          : subject.wildcard
            ? "public"
            : "direct";
        return addDependency({
          expressionPath: path,
          kind: path.includes("but not") ? "negative" : "direct",
          label: dependencyLabel(path, leafLabel),
          sourceRelation: subject.relation,
          sourceType: subject.type,
          targetRelation,
          targetType: targetType.type,
        });
      });
      return { dependencyIds: ids, kind: "direct", subjects };
    };

    const types: GraphType[] = typeDefinitions.map((typeDefinition) => {
      const relations: GraphRelation[] = Object.entries(typeDefinition.relations ?? {}).map(
        ([relationName, rewrite]) => {
          const subjects = directSubjects(relationMetadata(typeDefinition, relationName));
          const expression = buildExpression(rewrite, typeDefinition, relationName);

          const source = sourceMap.relations.get(`${typeDefinition.type}.${relationName}`);
          return {
            dependencies: [],
            directSubjects: subjects,
            expression: source?.expression ?? "",
            id: `${typeDefinition.type}.${relationName}`,
            kind: subjects.length > 0 ? "relation" : "permission",
            line: source?.line ?? sourceMap.types.get(typeDefinition.type) ?? 1,
            name: relationName,
            rewrite: expression,
            type: typeDefinition.type,
          };
        },
      );

      return {
        id: `type:${typeDefinition.type}`,
        line: sourceMap.types.get(typeDefinition.type) ?? 1,
        name: typeDefinition.type,
        relations,
      };
    });

    const relationById = new Map(types.flatMap((type) => type.relations.map((relation) => [relation.id, relation])));
    dependencies.forEach((dependency) => {
      relationById.get(`${dependency.targetType}.${dependency.targetRelation}`)?.dependencies.push(dependency);
    });

    return {
      diagnostics: [],
      graph: {
        dependencies,
        relationCount: types.reduce((total, type) => total + type.relations.length, 0),
        schemaVersion: model.schema_version ?? "1.1",
        types,
      },
    };
  } catch (error) {
    return { diagnostics: diagnosticsFromError(error), graph: null };
  }
}

export function formatSubject(subject: SubjectReference) {
  if (subject.wildcard) return `${subject.type}:*`;
  if (subject.relation) return `${subject.type}#${subject.relation}`;
  return subject.type;
}

export function findRelationByLine(graph: ModelGraph, line: number) {
  return graph.types.flatMap((type) => type.relations).find((relation) => relation.line === line) ?? null;
}
