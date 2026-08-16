import {
  defaultModel,
  parseAuthorizationModel,
  type ModelGraph,
  type ParseResult,
} from "@/lib/fga-model";

export type RestoredModelSession = {
  lastValidGraph: ModelGraph;
  lastValidModelText: string;
  modelText: string;
  parsed: ParseResult;
};

export function restoreModelSession(
  savedDraft: string | null,
  savedLastValidModel: string | null,
): RestoredModelSession {
  const modelText = savedDraft ?? defaultModel;
  const parsed = parseAuthorizationModel(modelText);
  if (parsed.graph) {
    return {
      lastValidGraph: parsed.graph,
      lastValidModelText: modelText,
      modelText,
      parsed,
    };
  }

  const savedLastValid = savedLastValidModel
    ? parseAuthorizationModel(savedLastValidModel)
    : null;
  const fallback = savedLastValid?.graph
    ? { graph: savedLastValid.graph, model: savedLastValidModel! }
    : { graph: parseAuthorizationModel(defaultModel).graph!, model: defaultModel };

  return {
    lastValidGraph: fallback.graph,
    lastValidModelText: fallback.model,
    modelText,
    parsed,
  };
}
