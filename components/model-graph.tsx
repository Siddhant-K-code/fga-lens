"use client";

import {
  Background,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useNodesState,
  useReactFlow,
  useViewport,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Asterisk,
  Box,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FoldVertical,
  KeyRound,
  Link2,
  LocateFixed,
  Minus,
  Move,
  Plus,
  RefreshCw,
  UnfoldVertical,
  Users,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GraphRelation, GraphType, ModelGraph } from "@/lib/fga-model";
import { focusedTypeIds, layoutGraphTypes } from "@/lib/graph-layout";

type TypeNodeData = {
  collapsed: boolean;
  modelType: GraphType;
  onSelect: (relation: GraphRelation) => void;
  onToggle: (typeId: string) => void;
  selectedRelationId: string | null;
} & Record<string, unknown>;

type FgaTypeNode = Node<TypeNodeData, "fgaType">;

function TypeNodeCard({ data }: NodeProps<FgaTypeNode>) {
  const { collapsed, modelType, onSelect, onToggle, selectedRelationId } = data;
  const isPrincipal = modelType.relations.length === 0;

  return (
    <article className={`fga-type-node ${isPrincipal ? "principal" : ""} ${collapsed ? "collapsed" : ""}`}>
      <Handle id="in:$type" position={Position.Left} type="target" />
      <Handle id="out:$type" position={Position.Right} type="source" />
      <header
        className="fga-type-header"
        onDoubleClick={() => !isPrincipal && onToggle(modelType.id)}
        title={isPrincipal ? undefined : "Drag to move · Double-click to collapse"}
      >
        <Move className="node-drag-mark" size={12} aria-hidden="true" />
        <span className="fga-type-icon">{isPrincipal ? <Users size={15} /> : <Box size={15} />}</span>
        <span className="fga-type-name">
          <small>type</small>
          <strong>{modelType.name}</strong>
        </span>
        {isPrincipal && <span className="principal-badge">Principal</span>}
        <code>L{modelType.line}</code>
        {!isPrincipal && (
          <button
            aria-label={`${collapsed ? "Expand" : "Collapse"} ${modelType.name}`}
            className="node-collapse nodrag"
            onClick={(event) => {
              event.stopPropagation();
              onToggle(modelType.id);
            }}
            title={`${collapsed ? "Expand" : "Collapse"} relations`}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </header>

      {modelType.relations.length > 0 && !collapsed ? (
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
      ) : !isPrincipal ? (
        <button className="collapsed-summary nodrag" onClick={() => onToggle(modelType.id)}>
          {modelType.relations.length} {modelType.relations.length === 1 ? "relation" : "relations"}
          <span>Show</span>
        </button>
      ) : null}
      {collapsed && modelType.relations.map((relation) => (
        <Fragment key={relation.id}>
          <Handle
            className="collapsed-relation-handle"
            id={`in:${relation.name}`}
            position={Position.Left}
            style={{ top: 75 }}
            type="target"
          />
          <Handle
            className="collapsed-relation-handle"
            id={`out:${relation.name}`}
            position={Position.Right}
            style={{ top: 75 }}
            type="source"
          />
        </Fragment>
      ))}
    </article>
  );
}

const nodeTypes = { fgaType: TypeNodeCard };

function buildElements(
  graph: ModelGraph,
  collapsedTypes: Set<string>,
  focusRelated: boolean,
  selectedRelationId: string | null,
  onSelect: (relation: GraphRelation) => void,
  onToggle: (typeId: string) => void,
) {
  const nodes: FgaTypeNode[] = [];
  const selectedRelation = graph.types
    .flatMap((type) => type.relations)
    .find((relation) => relation.id === selectedRelationId);
  const relatedDependencies = selectedRelation
    ? graph.dependencies.filter((dependency) => (
      `${dependency.targetType}.${dependency.targetRelation}` === selectedRelation.id
      || `${dependency.sourceType}.${dependency.sourceRelation ?? ""}` === selectedRelation.id
    ))
    : [];
  const relatedTypes = new Set<string>();
  if (selectedRelation) relatedTypes.add(`type:${selectedRelation.type}`);
  relatedDependencies.forEach((dependency) => {
    relatedTypes.add(`type:${dependency.sourceType}`);
    relatedTypes.add(`type:${dependency.targetType}`);
  });
  const visibleTypeIds = selectedRelation && focusRelated
    ? focusedTypeIds(graph, selectedRelation.id)
    : undefined;

  layoutGraphTypes(graph, collapsedTypes, visibleTypeIds).forEach(({ type, x, y }) => {
      const collapsed = collapsedTypes.has(type.id);
      nodes.push({
        data: { collapsed, modelType: type, onSelect, onToggle, selectedRelationId },
        dragHandle: ".fga-type-header",
        id: type.id,
        position: { x, y },
        type: "fgaType",
        zIndex: relatedTypes.has(type.id) ? 2 : 1,
      });
  });

  const edgeColors = {
    computed: "#7256bd",
    direct: "#4169e1",
    inherited: "#0a8a61",
    negative: "#c44343",
  };
  const edges: Edge[] = graph.dependencies.map((dependency) => {
    const related = !selectedRelation || relatedDependencies.some((candidate) => candidate.id === dependency.id);
    const endpointsVisible = !visibleTypeIds
      || (visibleTypeIds.has(`type:${dependency.sourceType}`) && visibleTypeIds.has(`type:${dependency.targetType}`));
    const edgeLabel = related && selectedRelation && (
      dependency.kind === "inherited" || dependency.kind === "negative" || dependency.label !== "direct"
    )
      ? dependency.label
      : undefined;
    return {
    animated: related && Boolean(selectedRelation) && dependency.kind === "inherited",
    className: `fga-edge ${dependency.kind}`,
    hidden: !endpointsVisible || Boolean(selectedRelation && focusRelated && !related),
    id: dependency.id,
    label: edgeLabel,
    labelBgBorderRadius: 4,
    labelBgPadding: [5, 3],
    labelBgStyle: { fill: "#f9fbfa", fillOpacity: 0.94 },
    labelStyle: { fill: "#65716c", fontSize: 10, fontWeight: 650 },
    markerEnd: { color: edgeColors[dependency.kind], height: 14, type: MarkerType.ArrowClosed, width: 14 },
    source: `type:${dependency.sourceType}`,
    sourceHandle: dependency.sourceRelation ? `out:${dependency.sourceRelation}` : "out:$type",
    style: {
      opacity: related ? (selectedRelation ? 1 : 0.7) : 0.08,
      stroke: edgeColors[dependency.kind],
      strokeWidth: related && selectedRelation ? 2.2 : dependency.kind === "inherited" ? 1.65 : 1.25,
    },
    target: `type:${dependency.targetType}`,
    targetHandle: `in:${dependency.targetRelation}`,
    type: "smoothstep",
  }});

  return { edges, nodes };
}

function GraphControlDock({
  allCollapsed,
  focusRelated,
  hasSelection,
  onRelayout,
  onToggleAll,
  onToggleFocus,
}: {
  allCollapsed: boolean;
  focusRelated: boolean;
  hasSelection: boolean;
  onRelayout: () => void;
  onToggleAll: () => void;
  onToggleFocus: () => void;
}) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { zoom } = useViewport();
  const fit = () => fitView({ duration: 280, maxZoom: 1.12, padding: 0.19 });
  const relayout = () => {
    onRelayout();
    window.setTimeout(fit, 40);
  };
  const toggleAll = () => {
    onToggleAll();
    window.setTimeout(fit, 80);
  };

  return (
    <Panel className="graph-control-dock" position="top-left">
      <div className="graph-control-group">
        <button onClick={() => zoomOut({ duration: 180 })} title="Zoom out" aria-label="Zoom out"><Minus size={14} /></button>
        <span className="zoom-value">{Math.round(zoom * 100)}%</span>
        <button onClick={() => zoomIn({ duration: 180 })} title="Zoom in" aria-label="Zoom in"><Plus size={14} /></button>
      </div>
      <i className="control-divider" />
      <div className="graph-control-group labeled">
        <button onClick={fit} title="Fit the whole model in view"><LocateFixed size={14} /><span>Fit</span></button>
        <button onClick={relayout} title="Restore the automatic layout"><RefreshCw size={13} /><span>Layout</span></button>
        <button onClick={toggleAll} title={allCollapsed ? "Expand every type" : "Collapse every type"}>
          {allCollapsed ? <UnfoldVertical size={14} /> : <FoldVertical size={14} />}
          <span>{allCollapsed ? "Expand" : "Compact"}</span>
        </button>
        <button
          aria-pressed={hasSelection && focusRelated}
          className={focusRelated && hasSelection ? "active" : ""}
          disabled={!hasSelection}
          onClick={onToggleFocus}
          title={hasSelection ? "Show or hide unrelated parts of the model" : "Select a relation to focus its connections"}
        >
          {focusRelated ? <Eye size={14} /> : <EyeOff size={14} />}
          <span>Focus</span>
        </button>
      </div>
      <span className="drag-help"><Move size={12} /> Drag cards to rearrange</span>
    </Panel>
  );
}

function FitGraph({ signature }: { signature: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const timeout = window.setTimeout(() => fitView({ duration: 280, maxZoom: 1.05, padding: 0.18 }), 260);
    return () => window.clearTimeout(timeout);
  }, [fitView, signature]);

  return null;
}

export function ModelGraphCanvas({
  graph,
  onClearSelection,
  onSelect,
  selectedRelationId,
  viewKey = "default",
}: {
  graph: ModelGraph;
  onClearSelection: () => void;
  onSelect: (relation: GraphRelation) => void;
  selectedRelationId: string | null;
  viewKey?: string;
}) {
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(() => new Set());
  const [focusRelated, setFocusRelated] = useState(true);
  const toggleType = useCallback((typeId: string) => {
    setCollapsedTypes((current) => {
      const next = new Set(current);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
  }, []);
  const elements = useMemo(
    () => buildElements(graph, collapsedTypes, focusRelated, selectedRelationId, onSelect, toggleType),
    [collapsedTypes, focusRelated, graph, onSelect, selectedRelationId, toggleType],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<FgaTypeNode>(elements.nodes);
  const layoutSignature = elements.nodes.map((node) => [
    node.id,
    node.position.x,
    node.position.y,
    node.data.collapsed,
    node.data.modelType.relations.map((relation) => relation.id).join(","),
  ].join(":" )).join("|");
  const signature = `${layoutSignature}:${viewKey}`;
  const previousLayoutSignature = useRef(layoutSignature);
  const allCollapsed = graph.types
    .filter((type) => type.relations.length > 0)
    .every((type) => collapsedTypes.has(type.id));

  useEffect(() => {
    setNodes((currentNodes) => {
      const shouldRelayout = previousLayoutSignature.current !== layoutSignature;
      const currentById = new Map(currentNodes.map((node) => [node.id, node]));
      return elements.nodes.map((node) => ({
        ...node,
        position: shouldRelayout ? node.position : currentById.get(node.id)?.position ?? node.position,
      }));
    });
    previousLayoutSignature.current = layoutSignature;
  }, [elements.nodes, layoutSignature, setNodes]);

  const toggleAll = useCallback(() => {
    setCollapsedTypes(allCollapsed
      ? new Set()
      : new Set(graph.types.filter((type) => type.relations.length > 0).map((type) => type.id)));
  }, [allCollapsed, graph.types]);

  const relayout = useCallback(() => {
    setNodes(elements.nodes);
  }, [elements.nodes, setNodes]);

  return (
    <ReactFlow<FgaTypeNode, Edge>
      colorMode="light"
      defaultEdgeOptions={{ interactionWidth: 18 }}
      edges={elements.edges}
      elementsSelectable
      fitView
      fitViewOptions={{ maxZoom: 1.12, padding: 0.19 }}
      maxZoom={2}
      minZoom={0.2}
      nodeTypes={nodeTypes}
      nodes={nodes}
      nodesConnectable={false}
      nodesDraggable
      onNodesChange={onNodesChange}
      onPaneClick={onClearSelection}
      panOnDrag
      panOnScroll
      selectionOnDrag={false}
    >
      <FitGraph signature={signature} />
      <Background color="#aab8b1" gap={20} size={1} />
      <GraphControlDock
        allCollapsed={allCollapsed}
        focusRelated={focusRelated}
        hasSelection={Boolean(selectedRelationId)}
        onRelayout={relayout}
        onToggleAll={toggleAll}
        onToggleFocus={() => setFocusRelated((current) => !current)}
      />
      {graph.types.length > 3 && (
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
