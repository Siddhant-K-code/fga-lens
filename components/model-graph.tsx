"use client";

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Asterisk, Box, KeyRound, Link2, Users } from "lucide-react";
import { useEffect, useMemo } from "react";

import type { GraphRelation, GraphType, ModelGraph } from "@/lib/fga-model";

type TypeNodeData = {
  modelType: GraphType;
  onSelect: (relation: GraphRelation) => void;
  selectedRelationId: string | null;
} & Record<string, unknown>;

type FgaTypeNode = Node<TypeNodeData, "fgaType">;

function TypeNodeCard({ data }: NodeProps<FgaTypeNode>) {
  const { modelType, onSelect, selectedRelationId } = data;
  const isPrincipal = modelType.relations.length === 0;

  return (
    <article className={`fga-type-node ${isPrincipal ? "principal" : ""}`}>
      <Handle id="in:$type" position={Position.Left} type="target" />
      <Handle id="out:$type" position={Position.Right} type="source" />
      <header className="fga-type-header">
        <span className="fga-type-icon">{isPrincipal ? <Users size={15} /> : <Box size={15} />}</span>
        <span>
          <small>type</small>
          <strong>{modelType.name}</strong>
        </span>
        <code>L{modelType.line}</code>
      </header>

      {modelType.relations.length > 0 ? (
        <div className="fga-relation-list">
          {modelType.relations.map((relation) => (
            <button
              className={`fga-relation-row ${relation.kind} ${selectedRelationId === relation.id ? "selected" : ""}`}
              key={relation.id}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(relation);
              }}
            >
              <Handle id={`in:${relation.name}`} position={Position.Left} type="target" />
              <span className="relation-glyph">
                {relation.kind === "permission" ? <KeyRound size={12} /> : <Link2 size={12} />}
              </span>
              <span className="relation-copy">
                <strong>{relation.name}</strong>
                <small>{relation.kind}</small>
              </span>
              {relation.directSubjects.some((subject) => subject.wildcard) && (
                <span className="wildcard-mark" title="Allows a wildcard subject"><Asterisk size={10} /></span>
              )}
              <Handle id={`out:${relation.name}`} position={Position.Right} type="source" />
            </button>
          ))}
        </div>
      ) : (
        <p className="principal-note">Principal type</p>
      )}
    </article>
  );
}

const nodeTypes = { fgaType: TypeNodeCard };

function graphDepths(graph: ModelGraph) {
  const names = graph.types.map((type) => type.name);
  const incoming = new Map(names.map((name) => [name, 0]));
  const outgoing = new Map(names.map((name) => [name, new Set<string>()]));

  graph.dependencies.forEach((dependency) => {
    if (dependency.sourceType === dependency.targetType) return;
    const targets = outgoing.get(dependency.sourceType);
    if (!targets || targets.has(dependency.targetType) || !incoming.has(dependency.targetType)) return;
    targets.add(dependency.targetType);
    incoming.set(dependency.targetType, (incoming.get(dependency.targetType) ?? 0) + 1);
  });

  const depth = new Map(names.map((name) => [name, 0]));
  const queue = names.filter((name) => incoming.get(name) === 0);
  const visited = new Set<string>();

  while (queue.length) {
    const source = queue.shift()!;
    visited.add(source);
    outgoing.get(source)?.forEach((target) => {
      depth.set(target, Math.max(depth.get(target) ?? 0, (depth.get(source) ?? 0) + 1));
      incoming.set(target, (incoming.get(target) ?? 1) - 1);
      if (incoming.get(target) === 0) queue.push(target);
    });
  }

  names.filter((name) => !visited.has(name)).forEach((name, index) => depth.set(name, index % 2));
  return depth;
}

function buildElements(
  graph: ModelGraph,
  selectedRelationId: string | null,
  onSelect: (relation: GraphRelation) => void,
) {
  const depths = graphDepths(graph);
  const columns = new Map<number, GraphType[]>();
  graph.types.forEach((type) => {
    const column = depths.get(type.name) ?? 0;
    const columnTypes = columns.get(column) ?? [];
    columnTypes.push(type);
    columns.set(column, columnTypes);
  });

  const nodes: FgaTypeNode[] = [];
  [...columns.entries()].sort(([a], [b]) => a - b).forEach(([column, types]) => {
    let y = 0;
    types.forEach((type) => {
      nodes.push({
        data: { modelType: type, onSelect, selectedRelationId },
        id: type.id,
        position: { x: column * 330, y },
        type: "fgaType",
      });
      y += 76 + Math.max(type.relations.length, 1) * 41 + 58;
    });
  });

  const edgeColors = {
    computed: "#7256bd",
    direct: "#4169e1",
    inherited: "#0a8a61",
    negative: "#c44343",
  };
  const edges: Edge[] = graph.dependencies.map((dependency) => {
    const highlighted = !selectedRelationId || `${dependency.targetType}.${dependency.targetRelation}` === selectedRelationId;
    const edgeLabel = dependency.kind === "inherited" || dependency.kind === "negative" || dependency.label !== "direct"
      ? dependency.label
      : undefined;
    return {
    animated: highlighted && dependency.kind === "inherited",
    className: `fga-edge ${dependency.kind}`,
    id: dependency.id,
    label: edgeLabel,
    labelBgBorderRadius: 4,
    labelBgPadding: [5, 3],
    labelBgStyle: { fill: "#f9fbfa", fillOpacity: 0.94 },
    labelStyle: { fill: "#65716c", fontSize: 9, fontWeight: 650 },
    markerEnd: { color: edgeColors[dependency.kind], height: 14, type: MarkerType.ArrowClosed, width: 14 },
    source: `type:${dependency.sourceType}`,
    sourceHandle: dependency.sourceRelation ? `out:${dependency.sourceRelation}` : "out:$type",
    style: {
      opacity: highlighted ? 1 : 0.14,
      stroke: edgeColors[dependency.kind],
      strokeWidth: highlighted && selectedRelationId ? 2.2 : dependency.kind === "inherited" ? 1.7 : 1.35,
    },
    target: `type:${dependency.targetType}`,
    targetHandle: `in:${dependency.targetRelation}`,
    type: "smoothstep",
  }});

  return { edges, nodes };
}

function FitGraph({ signature }: { signature: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const timeout = window.setTimeout(() => fitView({ duration: 320, maxZoom: 1.05, padding: 0.16 }), 40);
    return () => window.clearTimeout(timeout);
  }, [fitView, signature]);

  return null;
}

export function ModelGraphCanvas({
  graph,
  onClearSelection,
  onSelect,
  selectedRelationId,
}: {
  graph: ModelGraph;
  onClearSelection: () => void;
  onSelect: (relation: GraphRelation) => void;
  selectedRelationId: string | null;
}) {
  const elements = useMemo(
    () => buildElements(graph, selectedRelationId, onSelect),
    [graph, onSelect, selectedRelationId],
  );
  const signature = `${graph.types.length}:${graph.relationCount}:${graph.dependencies.length}`;

  return (
    <ReactFlow<FgaTypeNode, Edge>
      colorMode="light"
      defaultEdgeOptions={{ interactionWidth: 18 }}
      edges={elements.edges}
      elementsSelectable
      fitView
      fitViewOptions={{ maxZoom: 1.05, padding: 0.16 }}
      maxZoom={1.6}
      minZoom={0.28}
      nodeTypes={nodeTypes}
      nodes={elements.nodes}
      nodesConnectable={false}
      nodesDraggable={false}
      onPaneClick={onClearSelection}
      panOnScroll
      selectionOnDrag={false}
    >
      <FitGraph signature={signature} />
      <Background color="#aab8b1" gap={20} size={1} />
      <Controls position="bottom-left" showInteractive={false} />
      {graph.types.length > 4 && (
        <MiniMap
          maskColor="rgb(245 248 246 / 72%)"
          nodeColor="#dfe9e4"
          pannable
          position="bottom-right"
          zoomable
        />
      )}
    </ReactFlow>
  );
}
