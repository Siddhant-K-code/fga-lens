"use client";

import {
  AlertTriangle,
  BookOpen,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  FileCode2,
  GitFork,
  Link2,
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { ModelGraphCanvas } from "@/components/model-graph";
import {
  defaultModel,
  findRelationByLine,
  formatSubject,
  parseAuthorizationModel,
  type GraphRelation,
  type ModelDiagnostic,
  type ModelGraph,
} from "@/lib/fga-model";
import { sampleModels, type SampleModel } from "@/lib/sample-models";

const initialParseResult = parseAuthorizationModel(defaultModel);
const modelDraftStorageKey = "fga-lens:model-draft:v1";

function LogoMark() {
  return (
    <div className="logo-mark" aria-hidden="true">
      <div className="logo-dot logo-dot-a" />
      <div className="logo-dot logo-dot-b" />
      <div className="logo-dot logo-dot-c" />
      <div className="logo-line logo-line-a" />
      <div className="logo-line logo-line-b" />
    </div>
  );
}

function isSameModel(first: string, second: string) {
  return first.trim() === second.trim();
}

function ExampleModelPicker({
  modelText,
  onSelect,
}: {
  modelText: string;
  onSelect: (sample: SampleModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const activeSample = sampleModels.find((sample) => isSameModel(sample.model, modelText));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="sample-picker" ref={pickerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className={`sample-picker-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="sample-picker-icon"><BookOpen size={13} /></span>
        <span className="sample-picker-copy">
          <small>Example</small>
          <strong>{activeSample?.label ?? "Custom model"}</strong>
        </span>
        <ChevronDown className="sample-picker-chevron" size={13} />
      </button>

      {open && (
        <div aria-label="Official OpenFGA sample stores" className="sample-picker-menu" role="menu">
          <div className="sample-menu-heading">
            <div><span>Official examples</span><strong>Sample stores</strong></div>
            <span>{sampleModels.length} models</span>
          </div>
          <div className="sample-menu-list">
            {sampleModels.map((sample, index) => {
              const selected = activeSample?.id === sample.id;
              return (
                <button
                  aria-checked={selected}
                  className={selected ? "selected" : ""}
                  key={sample.id}
                  onClick={() => {
                    onSelect(sample);
                    setOpen(false);
                  }}
                  role="menuitemradio"
                  type="button"
                >
                  <span className="sample-menu-marker">{selected ? <Check size={12} /> : index + 1}</span>
                  <span className="sample-menu-copy">
                    <strong>{sample.label}</strong>
                    <small>{sample.description}</small>
                  </span>
                  <code>{sample.typeCount}T · {sample.relationCount}R</code>
                </button>
              );
            })}
          </div>
          <a
            href="https://github.com/openfga/sample-stores/tree/main/stores"
            rel="noreferrer"
            target="_blank"
          >
            View source on GitHub <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  );
}

function highlightModelLine(line: string) {
  return line
    .split(/(\b(?:model|schema|type|relations|define|or|and|but|not|from|condition|with)\b|[\[\](),:#*])/g)
    .map((token, index) => {
      const keyword = /^(model|schema|type|relations|define|or|and|but|not|from|condition|with)$/.test(token);
      const punctuation = /^[\[\](),:#*]$/.test(token);
      return (
        <span
          className={keyword ? "syntax-keyword" : punctuation ? "syntax-punctuation" : undefined}
          key={`${token}-${index}`}
        >
          {token}
        </span>
      );
    });
}

function ModelEditor({
  diagnostics,
  graph,
  modelText,
  onChange,
  onSelectRelation,
  selectedLine,
}: {
  diagnostics: ModelDiagnostic[];
  graph: ModelGraph;
  modelText: string;
  onChange: (model: string) => void;
  onSelectRelation: (relation: GraphRelation) => void;
  selectedLine?: number;
}) {
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const lines = modelText.split("\n");
  const diagnosticLines = new Set(diagnostics.map((diagnostic) => diagnostic.line));
  const isChanged = modelText !== defaultModel;

  const selectCurrentLine = (textarea: HTMLTextAreaElement) => {
    const line = modelText.slice(0, textarea.selectionStart).split("\n").length;
    const relation = findRelationByLine(graph, line);
    if (relation) onSelectRelation(relation);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    onChange(`${modelText.slice(0, start)}  ${modelText.slice(end)}`);
    window.requestAnimationFrame(() => textarea.setSelectionRange(start + 2, start + 2));
  };

  return (
    <div className="live-editor">
      <div className="code-toolbar">
        <div className="editor-file">
          <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
          <span>authorization-model.fga</span>
        </div>
        <div className="editor-actions">
          <span className={`live-state ${diagnostics.length ? "invalid" : ""}`}>
            <i /> {diagnostics.length ? `${diagnostics.length} ${diagnostics.length === 1 ? "issue" : "issues"}` : "Valid"}
          </span>
          {isChanged && (
            <button onClick={() => onChange(defaultModel)} title="Restore the example model">
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="editor-surface">
        <pre
          className="editor-highlight"
          aria-hidden="true"
          style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}
        >
          {lines.map((line, index) => {
            const lineNumber = index + 1;
            return (
              <span
                className={`editor-row ${selectedLine === lineNumber ? "highlighted" : ""} ${diagnosticLines.has(lineNumber) ? "diagnostic" : ""}`}
                key={`${lineNumber}-${line}`}
              >
                <span className="editor-line-number">{lineNumber}</span>
                <code>{highlightModelLine(line || " ")}</code>
              </span>
            );
          })}
        </pre>
        <textarea
          aria-label="OpenFGA authorization model"
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => selectCurrentLine(event.currentTarget)}
          onKeyDown={handleKeyDown}
          onKeyUp={(event) => selectCurrentLine(event.currentTarget)}
          onScroll={(event) =>
            setScroll({ left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop })
          }
          spellCheck={false}
          value={modelText}
          wrap="off"
        />
      </div>

      <div className="editor-footer">
        <span>{graph.schemaVersion} · {graph.types.length} types · {graph.relationCount} relations</span>
        <span>{diagnostics[0] ? `L${diagnostics[0].line}:${diagnostics[0].column} ${diagnostics[0].message}` : "OpenFGA language parser"}</span>
      </div>
    </div>
  );
}

function RelationInspector({ relation, onClose }: { relation: GraphRelation; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyExpression = async () => {
    await navigator.clipboard.writeText(`define ${relation.name}: ${relation.expression}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <aside className="relation-inspector">
      <header>
        <div>
          <span>Selected relation</span>
          <strong>{relation.type}.{relation.name}</strong>
        </div>
        <button onClick={onClose} aria-label="Close relation details"><X size={15} /></button>
      </header>

      <div className="relation-inspector-body">
        <div className={`relation-kind ${relation.kind}`}>
          {relation.kind === "permission" ? <Braces size={13} /> : <Link2 size={13} />}
          {relation.kind}
        </div>

        <div className="inspector-expression">
          <div>
            <span>MODEL · LINE {relation.line}</span>
            <button onClick={copyExpression}>{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied" : "Copy"}</button>
          </div>
          <code><em>define {relation.name}:</em> {relation.expression}</code>
        </div>

        {relation.directSubjects.length > 0 && (
          <section className="inspector-section">
            <span>Accepts directly</span>
            <div className="subject-chips">
              {relation.directSubjects.map((subject) => (
                <code key={`${subject.type}-${subject.relation}-${subject.wildcard}`}>
                  {formatSubject(subject)}{subject.condition ? ` with ${subject.condition}` : ""}
                </code>
              ))}
            </div>
          </section>
        )}

        <section className="inspector-section">
          <span>Derived from</span>
          {relation.dependencies.length > 0 ? (
            <div className="dependency-list">
              {relation.dependencies.map((dependency) => (
                <div className={`dependency-row ${dependency.kind}`} key={dependency.id}>
                  <i />
                  <code>{dependency.sourceType}{dependency.sourceRelation ? `.${dependency.sourceRelation}` : ""}</code>
                  <span>{dependency.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p>No computed dependencies. This relation is populated only through tuples.</p>
          )}
        </section>
      </div>
    </aside>
  );
}

export function FgaLens() {
  const [modelText, setModelText] = useState(defaultModel);
  const [parsed, setParsed] = useState(initialParseResult);
  const [lastValidGraph, setLastValidGraph] = useState(initialParseResult.graph!);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [graphSession, setGraphSession] = useState(0);
  const [draftStorageReady, setDraftStorageReady] = useState(false);

  const graph = parsed.graph ?? lastValidGraph;
  const selectedRelation = graph.types
    .flatMap((type) => type.relations)
    .find((relation) => relation.id === selectedRelationId) ?? null;
  const selectRelation = useCallback((relation: GraphRelation) => setSelectedRelationId(relation.id), []);
  const updateModel = useCallback((nextModel: string) => {
    const nextResult = parseAuthorizationModel(nextModel);
    setModelText(nextModel);
    setParsed(nextResult);
    if (nextResult.graph) setLastValidGraph(nextResult.graph);
  }, []);
  const loadSample = useCallback((sample: SampleModel) => {
    setSelectedRelationId(null);
    setGraphSession((current) => current + 1);
    updateModel(sample.model);
  }, [updateModel]);

  useEffect(() => {
    let savedModel: string | null = null;
    try {
      savedModel = window.localStorage.getItem(modelDraftStorageKey);
    } catch {
      // The editor still works when storage is blocked or unavailable.
    }

    let active = true;
    window.queueMicrotask(() => {
      if (!active) return;
      if (savedModel !== null) updateModel(savedModel);
      setDraftStorageReady(true);
    });
    return () => { active = false; };
  }, [updateModel]);

  useEffect(() => {
    if (!draftStorageReady) return;
    try {
      window.localStorage.setItem(modelDraftStorageKey, modelText);
    } catch {
      // Ignore quota and privacy-mode failures rather than interrupting editing.
    }
  }, [draftStorageReady, modelText]);

  useEffect(() => {
    const closeExpandedGraph = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setGraphExpanded(false);
    };
    window.addEventListener("keydown", closeExpandedGraph);
    return () => window.removeEventListener("keydown", closeExpandedGraph);
  }, []);

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div className="brand-lockup"><LogoMark /><strong>FGA Lens</strong></div>
        <div className="document-path" aria-label="Current model">
          <span>model</span><b>/</b><strong>authorization-model.fga</strong>
        </div>
        <div className="header-actions">
          <span className={`parser-status ${parsed.diagnostics.length ? "invalid" : ""}`}>
            {parsed.diagnostics.length ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
            {parsed.diagnostics.length ? "Model has issues" : "Model valid"}
          </span>
          <a href="https://openfga.dev/docs/configuration-language" target="_blank" rel="noreferrer">
            <FileCode2 size={13} /> DSL reference
          </a>
        </div>
      </header>

      <div className={`studio-workspace ${graphExpanded ? "graph-expanded" : ""}`}>
        <aside className="model-pane">
          <div className="pane-heading">
            <div><span>Source</span><h1>Authorization model</h1></div>
            <div className="pane-heading-actions">
              <ExampleModelPicker modelText={modelText} onSelect={loadSample} />
              <span className="live-label"><i /> live</span>
            </div>
          </div>
          <ModelEditor
            diagnostics={parsed.diagnostics}
            graph={graph}
            modelText={modelText}
            onChange={updateModel}
            onSelectRelation={selectRelation}
            selectedLine={selectedRelation?.line ?? parsed.diagnostics[0]?.line}
          />
        </aside>

        <main className="graph-pane">
          <div className="graph-toolbar">
            <div>
              <span className="graph-title-icon"><GitFork size={15} /></span>
              <div><span>Live topology</span><h2>Model graph</h2></div>
            </div>
            <div className="graph-stats">
              <span><strong>{graph.types.length}</strong> types</span>
              <span><strong>{graph.relationCount}</strong> relations</span>
              <span><strong>{graph.dependencies.length}</strong> edges</span>
            </div>
            <div className="graph-toolbar-actions">
              <div className="graph-legend" aria-label="Graph edge legend">
                <span><i className="direct" /> direct</span>
                <span><i className="computed" /> computed</span>
                <span><i className="inherited" /> inherited</span>
              </div>
              <button
                aria-label={graphExpanded ? "Exit expanded graph" : "Expand graph"}
                aria-pressed={graphExpanded}
                className="expand-graph-button"
                onClick={() => setGraphExpanded((current) => !current)}
                title={graphExpanded ? "Exit expanded view (Esc)" : "Give the graph the full workspace"}
              >
                {graphExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span>{graphExpanded ? "Exit" : "Expand"}</span>
              </button>
            </div>
          </div>

          <div className={`graph-canvas ${selectedRelation ? "has-inspector" : ""}`}>
            <ModelGraphCanvas
              graph={graph}
              key={graphSession}
              onClearSelection={() => setSelectedRelationId(null)}
              onSelect={selectRelation}
              selectedRelationId={selectedRelationId}
              viewKey={`${graphExpanded ? "expanded" : "split"}:${selectedRelationId ?? "all"}`}
            />
            {parsed.diagnostics.length > 0 && (
              <div className="model-error-toast">
                <AlertTriangle size={15} />
                <div><strong>Showing the last valid graph</strong><span>L{parsed.diagnostics[0].line}:{parsed.diagnostics[0].column} · {parsed.diagnostics[0].message}</span></div>
              </div>
            )}
            {selectedRelation && <RelationInspector relation={selectedRelation} onClose={() => setSelectedRelationId(null)} />}
          </div>
        </main>
      </div>
    </div>
  );
}
