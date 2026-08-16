import { describe, expect, it } from "vitest";

import { parseAuthorizationModel } from "@/lib/fga-model";
import { sampleModels } from "@/lib/sample-models";

function relation(model: string, id: string) {
  const result = parseAuthorizationModel(model);
  expect(result.diagnostics).toEqual([]);
  const found = result.graph?.types.flatMap((type) => type.relations).find((item) => item.id === id);
  expect(found).toBeDefined();
  return found!;
}

const nestedModel = `model
  schema 1.1

type user

type doc
  relations
    define a: [user]
    define b: [user]
    define c: [user]
    define d: [user]
    define complex: (a or b) and (c or d)
    define denied: a but not (b or c)
`;

describe("parseAuthorizationModel", () => {
  it("preserves nested union and intersection groups", () => {
    const complex = relation(nestedModel, "doc.complex");

    expect(complex.rewrite).toMatchObject({
      children: [
        {
          children: [
            { kind: "computed", relation: "a" },
            { kind: "computed", relation: "b" },
          ],
          kind: "union",
        },
        {
          children: [
            { kind: "computed", relation: "c" },
            { kind: "computed", relation: "d" },
          ],
          kind: "union",
        },
      ],
      kind: "intersection",
    });
    expect(complex.dependencies.map((dependency) => dependency.expressionPath)).toEqual([
      ["and", "or"],
      ["and", "or"],
      ["and", "or"],
      ["and", "or"],
    ]);
  });

  it("preserves exclusion around a nested union", () => {
    const denied = relation(nestedModel, "doc.denied");

    expect(denied.rewrite).toMatchObject({
      base: { kind: "computed", relation: "a" },
      kind: "difference",
      subtract: {
        children: [
          { kind: "computed", relation: "b" },
          { kind: "computed", relation: "c" },
        ],
        kind: "union",
      },
    });
    expect(denied.dependencies.map(({ expressionPath, kind }) => ({ expressionPath, kind }))).toEqual([
      { expressionPath: [], kind: "computed" },
      { expressionPath: ["but not", "or"], kind: "negative" },
      { expressionPath: ["but not", "or"], kind: "negative" },
    ]);
  });

  it("does not append a condition body to the relation source", () => {
    const conditionalModel = `model
  schema 1.1

type user

type doc
  relations
    define viewer: [user with non_expired]

condition non_expired(current_time: timestamp, grant_time: timestamp) {
  current_time < grant_time
}`;
    const viewer = relation(conditionalModel, "doc.viewer");

    expect(viewer.expression).toBe("[user with non_expired]");
    expect(viewer.directSubjects).toEqual([
      { condition: "non_expired", relation: undefined, type: "user", wildcard: false },
    ]);
  });

  it.each(sampleModels)("parses the $label sample with its declared counts", (sample) => {
    const result = parseAuthorizationModel(sample.model);
    expect(result.diagnostics).toEqual([]);
    expect(result.graph?.types).toHaveLength(sample.typeCount);
    expect(result.graph?.relationCount).toBe(sample.relationCount);
  });
});
