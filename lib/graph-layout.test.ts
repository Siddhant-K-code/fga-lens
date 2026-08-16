import { describe, expect, it } from "vitest";

import { parseAuthorizationModel } from "@/lib/fga-model";
import { computeGraphDepths, focusedTypeIds, layoutGraphTypes } from "@/lib/graph-layout";
import { googleDriveModel } from "@/lib/sample-models";

function graph(model: string) {
  const result = parseAuthorizationModel(model);
  expect(result.diagnostics).toEqual([]);
  return result.graph!;
}

function cycleModel(first: string, second: string) {
  return `model
  schema 1.1

type user

type ${first}
  relations
    define peer: [${second}]

type ${second}
  relations
    define peer: [${first}]
`;
}

describe("graph layout", () => {
  it("places a strongly connected component deterministically", () => {
    const forward = graph(cycleModel("alpha", "beta"));
    const reversed = graph(cycleModel("beta", "alpha"));

    expect(Object.fromEntries(computeGraphDepths(forward))).toEqual({ alpha: 0, beta: 0, user: 0 });
    expect(Object.fromEntries(computeGraphDepths(reversed))).toEqual({ alpha: 0, beta: 0, user: 0 });
    expect(layoutGraphTypes(forward, new Set()).map(({ type, x, y }) => ({ type: type.name, x, y })))
      .toEqual(layoutGraphTypes(reversed, new Set()).map(({ type, x, y }) => ({ type: type.name, x, y })));
  });

  it("lays out resized cards without overlap", () => {
    const expanded = graph(`model
  schema 1.1

type user

type alpha
  relations
    define r1: [user]
    define r2: [user]
    define r3: [user]
    define r4: [user]
    define r5: [user]
    define r6: [user]
    define r7: [user]
    define r8: [user]
    define r9: [user]
    define r10: [user]

type beta
  relations
    define viewer: [user]
`);
    const layouts = layoutGraphTypes(expanded, new Set());
    const alpha = layouts.find((layout) => layout.type.name === "alpha")!;
    const beta = layouts.find((layout) => layout.type.name === "beta")!;

    expect(alpha.column).toBe(beta.column);
    expect(beta.y).toBeGreaterThanOrEqual(alpha.y + alpha.height + 56);
  });

  it("focuses only the types that participate in the selected relation", () => {
    const model = graph(googleDriveModel);
    const focused = focusedTypeIds(model, "doc.can_read");

    expect([...focused].sort()).toEqual(["type:doc", "type:folder"]);
    expect(layoutGraphTypes(model, new Set(), focused).map((layout) => layout.type.name).sort())
      .toEqual(["doc", "folder"]);
  });
});
