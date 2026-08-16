import { describe, expect, it } from "vitest";

import { defaultModel } from "@/lib/fga-model";
import { restoreModelSession } from "@/lib/model-session";

const customModel = `model
  schema 1.1

type user

type photo
  relations
    define viewer: [user]
`;

describe("restoreModelSession", () => {
  it("restores the user's last valid graph behind an invalid draft", () => {
    const invalidDraft = `${customModel}\n    define broken:`;
    const restored = restoreModelSession(invalidDraft, customModel);

    expect(restored.modelText).toBe(invalidDraft);
    expect(restored.parsed.graph).toBeNull();
    expect(restored.lastValidModelText).toBe(customModel);
    expect(restored.lastValidGraph.types.map((type) => type.name)).toEqual(["user", "photo"]);
    expect(restored.lastValidGraph.relationCount).toBe(1);
  });

  it("falls back safely when both persisted values are invalid", () => {
    const restored = restoreModelSession("not a model", "also invalid");

    expect(restored.parsed.graph).toBeNull();
    expect(restored.lastValidModelText).toBe(defaultModel);
    expect(restored.lastValidGraph.types).toHaveLength(4);
  });
});
