"use client";

import {
  ArrowRight,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Copy,
  GitBranch,
  FolderGit2,
  Info,
  Layers3,
  Link2,
  Play,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import {
  defaultModel,
  displayName,
  evaluate,
  parseModel,
  relations,
  tuples,
  users,
  type Evidence,
  type ModelSummary,
  type Query,
  type Relation,
} from "@/lib/fga-demo";

const initialQuery: Query = {
  user: "user:erik",
  relation: "admin",
  object: "repo:openfga/openfga",
};

type SourceMode = "model" | "tuples";

function highlightModelLine(line: string) {
  return line
    .split(/(\b(?:model|schema|type|relations|define|or|from)\b|[\[\],:#])/g)
    .map((token, index) => {
      const keyword = /^(model|schema|type|relations|define|or|from)$/.test(token);
      const punctuation = /^[\[\],:#]$/.test(token);
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

function LiveModelEditor({
  modelText,
  setModelText,
  summary,
  selected,
  selectEvidence,
}: {
  modelText: string;
  setModelText: (model: string) => void;
  summary: ModelSummary;
  selected: Evidence | null;
  selectEvidence: (evidence: Evidence) => void;
}) {
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const lines = modelText.split("\n");
  const isChanged = modelText !== defaultModel;
  const diagnosticLines = new Set(summary.diagnostics.map((diagnostic) => diagnostic.line));

  const selectCurrentLine = (textarea: HTMLTextAreaElement) => {
    const line = modelText.slice(0, textarea.selectionStart).split("\n").length;
    const expression = lines[line - 1]?.trim();
    if (!expression) return;
    selectEvidence({
      id: `source-line-${line}`,
      kind: "rule",
      title: "Authorization model rule",
      explanation: "This line defines how a relationship can be derived.",
      line,
      expression,
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextModel = `${modelText.slice(0, start)}  ${modelText.slice(end)}`;
    setModelText(nextModel);
    window.requestAnimationFrame(() => textarea.setSelectionRange(start + 2, start + 2));
  };

  return (
    <div className="live-editor">
      <div className="code-toolbar">
        <div className="editor-file">
          <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
          <span>model.fga</span>
        </div>
        <div className="editor-actions">
          <span className={`live-state ${summary.diagnostics.length ? "invalid" : ""}`}>
            <i /> {summary.diagnostics.length ? `${summary.diagnostics.length} issue` : "Live"}
          </span>
          {isChanged && (
            <button onClick={() => setModelText(defaultModel)} title="Reset model">
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
            const highlighted = selected?.kind === "rule" && selected.line === lineNumber;
            return (
              <span
                className={`editor-row ${highlighted ? "highlighted" : ""} ${diagnosticLines.has(lineNumber) ? "diagnostic" : ""}`}
                key={`${lineNumber}-${line}`}
              >
                <span className="editor-line-number">{lineNumber}</span>
                <code>{highlightModelLine(line || " ")}</code>
              </span>
            );
          })}
        </pre>
        <textarea
          aria-label="Live OpenFGA authorization model"
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(event) => setModelText(event.target.value)}
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
        <span>{summary.typeCount} types · {summary.relationCount} relations</span>
        <span>{summary.diagnostics[0]?.message ?? "Re-evaluates as you type"}</span>
      </div>
    </div>
  );
}

function shorten(value: string) {
  return value.replace("organization:", "org:").replace("repo:openfga/", "repo:");
}

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

function SourcePanel({
  mode,
  setMode,
  disabled,
  toggleTuple,
  resetTuples,
  selected,
  selectEvidence,
  modelText,
  setModelText,
  modelSummary,
}: {
  mode: SourceMode;
  setMode: (mode: SourceMode) => void;
  disabled: Set<string>;
  toggleTuple: (id: string) => void;
  resetTuples: () => void;
  selected: Evidence | null;
  selectEvidence: (evidence: Evidence) => void;
  modelText: string;
  setModelText: (model: string) => void;
  modelSummary: ModelSummary;
}) {
  const activeCount = tuples.length - disabled.size;

  return (
    <aside className="source-panel panel">
      <div className="panel-heading source-heading">
        <div>
          <span className="eyebrow">Source</span>
          <h2>GitHub sample</h2>
        </div>
        <div className="source-status" title="Loaded locally">
          <span /> local
        </div>
      </div>

      <div className="segmented source-tabs" role="tablist" aria-label="Authorization source">
        <button
          className={mode === "model" ? "active" : ""}
          onClick={() => setMode("model")}
          role="tab"
          aria-selected={mode === "model"}
        >
          <Braces size={14} /> Model
        </button>
        <button
          className={mode === "tuples" ? "active" : ""}
          onClick={() => setMode("tuples")}
          role="tab"
          aria-selected={mode === "tuples"}
        >
          <Layers3 size={14} /> Tuples <span className="tab-count">{activeCount}</span>
        </button>
      </div>

      {mode === "model" ? (
        <div className="model-view" role="tabpanel">
          <LiveModelEditor
            modelText={modelText}
            setModelText={setModelText}
            summary={modelSummary}
            selected={selected}
            selectEvidence={selectEvidence}
          />
        </div>
      ) : (
        <div className="tuple-view" role="tabpanel">
          <div className="tuple-toolbar">
            <div>
              <SlidersHorizontal size={14} />
              <span>Live simulation</span>
            </div>
            {disabled.size > 0 && (
              <button className="text-button" onClick={resetTuples}>
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
          <p className="tuple-hint">Disable a fact to see whether the proof still holds.</p>
          <div className="tuple-list">
            {tuples.map((tuple) => {
              const isDisabled = disabled.has(tuple.id);
              const isSelected = selected?.sourceId === tuple.id;
              return (
                <button
                  className={`tuple-card ${isDisabled ? "disabled" : ""} ${isSelected ? "selected" : ""}`}
                  key={tuple.id}
                  onClick={() =>
                    selectEvidence({
                      id: `source-${tuple.id}`,
                      kind: "tuple",
                      title: "Relationship tuple",
                      explanation: "This relationship is stored directly in the authorization store.",
                      sourceId: tuple.id,
                      expression: `${tuple.user}  ${tuple.relation}  ${tuple.object}`,
                    })
                  }
                >
                  <span className="tuple-card-content">
                    <span className="tuple-subject">{shorten(tuple.user)}</span>
                    <span className="tuple-relation">{tuple.relation}</span>
                    <span className="tuple-object">{shorten(tuple.object)}</span>
                  </span>
                  <span
                    className={`tuple-switch ${isDisabled ? "off" : ""}`}
                    role="switch"
                    aria-checked={!isDisabled}
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleTuple(tuple.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleTuple(tuple.id);
                      }
                    }}
                  >
                    <span />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

function QueryBuilder({
  draft,
  setDraft,
  run,
}: {
  draft: Query;
  setDraft: (query: Query) => void;
  run: () => void;
}) {
  return (
    <div className="query-builder" aria-label="Authorization query builder">
      <div className="query-field user-field">
        <span className="field-label">Subject</span>
        <label>
          <span className="entity-avatar">{displayName(draft.user).slice(0, 1).toUpperCase()}</span>
          <select
            aria-label="Subject"
            value={draft.user}
            onChange={(event) => setDraft({ ...draft, user: event.target.value })}
          >
            {users.map((user) => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
      </div>
      <span className="query-grammar">can</span>
      <div className="query-field relation-field">
        <span className="field-label">Relation</span>
        <label>
          <GitBranch size={15} />
          <select
            aria-label="Relation"
            value={draft.relation}
            onChange={(event) => setDraft({ ...draft, relation: event.target.value as Relation })}
          >
            {relations.map((relation) => (
              <option key={relation} value={relation}>
                {relation}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
      </div>
      <span className="query-grammar">on</span>
      <div className="query-field object-field">
        <span className="field-label">Object</span>
        <label>
          <FolderGit2 size={15} />
          <select aria-label="Object" value={draft.object} disabled>
            <option value="repo:openfga/openfga">repo:openfga/openfga</option>
          </select>
          <ChevronDown size={14} />
        </label>
      </div>
      <button className="run-button" onClick={run}>
        <Play size={14} fill="currentColor" /> Run check
      </button>
    </div>
  );
}

function ProofStep({
  evidence,
  index,
  selected,
  onSelect,
}: {
  evidence: Evidence;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <>
      <div className="proof-connector">
        <span />
        <ArrowRight size={13} />
      </div>
      <button className={`proof-step ${selected ? "selected" : ""}`} onClick={onSelect}>
        <span className={`step-icon ${evidence.kind}`}>
          {evidence.kind === "tuple" ? <Link2 size={16} /> : <Braces size={16} />}
        </span>
        <span className="step-copy">
          <span className="step-meta">
            Step {index + 1} · {evidence.kind === "tuple" ? "Tuple fact" : "Model rule"}
          </span>
          <strong>{evidence.title}</strong>
          <code>{evidence.expression}</code>
        </span>
        <span className="evidence-link">
          {evidence.kind === "tuple" ? evidence.sourceId?.toUpperCase() : `L${evidence.line}`}
        </span>
      </button>
    </>
  );
}

function DecisionCanvas({
  query,
  disabled,
  modelText,
  selected,
  selectEvidence,
}: {
  query: Query;
  disabled: Set<string>;
  modelText: string;
  selected: Evidence | null;
  selectEvidence: (evidence: Evidence) => void;
}) {
  const decision = useMemo(() => evaluate(query, disabled, modelText), [query, disabled, modelText]);
  const modelLines = modelText.split("\n");
  const tupleCount = decision.path.filter((item) => item.kind === "tuple").length;
  const ruleCount = decision.path.length - tupleCount;

  return (
    <main className="decision-panel panel">
      <div className={`decision-summary ${decision.allowed ? "allowed" : "denied"}`}>
        <div className="decision-result-icon">
          {decision.allowed ? <CheckCircle2 size={26} /> : <XCircle size={26} />}
        </div>
        <div className="decision-copy">
          <span className="eyebrow">Decision</span>
          <h1>{decision.allowed ? "Access granted" : "Access denied"}</h1>
          <p>
            <strong>{displayName(query.user)}</strong> {decision.allowed ? "can" : "cannot"}{" "}
            <strong>{query.relation}</strong> <strong>{displayName(query.object)}</strong>
            {decision.allowed ? " through the proof below." : " with the active relationships."}
          </p>
        </div>
        <div className={`verdict-pill ${decision.allowed ? "allowed" : "denied"}`}>
          {decision.allowed ? <Check size={14} /> : <X size={14} />}
          {decision.allowed ? "TRUE" : "FALSE"}
        </div>
      </div>

      <div className="decision-stats">
        <span>
          <CircleDot size={13} /> {decision.visited} relations evaluated
        </span>
        <span>
          {decision.allowed
            ? `${tupleCount} ${tupleCount === 1 ? "tuple" : "tuples"} · ${ruleCount} ${ruleCount === 1 ? "rule" : "rules"}`
            : `${decision.attempts.length} ${decision.attempts.length === 1 ? "path" : "paths"} exhausted`}
        </span>
        <span className="semantic-label">
          <ShieldCheck size={13} /> semantic proof
        </span>
      </div>

      <div className="proof-scroll">
        {decision.allowed ? (
          <section className="proof-content" aria-label="Successful authorization proof">
            <div className="proof-section-heading">
              <div>
                <span className="eyebrow">Minimal proof</span>
                <h2>Why this check passed</h2>
              </div>
              <span className="proof-path-count">1 successful path</span>
            </div>

            <div className="proof-chain">
              <div className="entity-node subject-node">
                <span className="entity-avatar large">{displayName(query.user).slice(0, 1).toUpperCase()}</span>
                <span>
                  <small>Subject</small>
                  <strong>{query.user}</strong>
                </span>
              </div>

              {decision.path.map((evidence, index) => (
                <ProofStep
                  evidence={evidence}
                  index={index}
                  key={evidence.id}
                  selected={selected?.id === evidence.id}
                  onSelect={() => selectEvidence(evidence)}
                />
              ))}

              <div className="proof-connector final">
                <span />
                <ArrowRight size={13} />
              </div>
              <div className="entity-node resource-node">
                <span className="resource-icon">
                  <FolderGit2 size={18} />
                </span>
                <span>
                  <small>Result</small>
                  <strong>{query.relation}</strong>
                  <code>{query.object}</code>
                </span>
                <CheckCircle2 size={18} className="resource-check" />
              </div>
            </div>
          </section>
        ) : (
          <section className="proof-content denied-content" aria-label="Failed authorization paths">
            <div className="proof-section-heading">
              <div>
                <span className="eyebrow">Resolution report</span>
                <h2>Why this check failed</h2>
              </div>
              <span className="proof-path-count failed">{decision.attempts.length} failed paths</span>
            </div>

            <div className="failed-paths">
              {decision.attempts.map((attempt, index) => (
                <button
                  className="failed-path"
                  key={attempt.id}
                  onClick={() => {
                    if (!attempt.line) return;
                    selectEvidence({
                      id: attempt.id,
                      kind: "rule",
                      title: attempt.title,
                      explanation: attempt.detail,
                      line: attempt.line,
                      expression: modelLines[attempt.line - 1]?.trim() ?? "",
                    });
                  }}
                >
                  <span className="failed-number">{index + 1}</span>
                  <span>
                    <strong>{attempt.title}</strong>
                    <small>{attempt.detail}</small>
                  </span>
                  <X size={14} />
                </button>
              ))}
            </div>

            <div className="suggestion-card">
              <div className="suggestion-icon">
                <Info size={17} />
              </div>
              <div>
                <span className="eyebrow">Closest fix</span>
                <strong>Connect the subject through an accepted relation</strong>
                <p>
                  Add a direct <code>{query.relation}</code> tuple, or make {displayName(query.user)} a
                  member of a team or organization that already grants it.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function EvidenceInspector({
  selected,
  query,
  disabled,
  modelText,
  onClose,
}: {
  selected: Evidence | null;
  query: Query;
  disabled: Set<string>;
  modelText: string;
  onClose: () => void;
}) {
  const decision = useMemo(() => evaluate(query, disabled, modelText), [query, disabled, modelText]);
  const [copied, setCopied] = useState(false);

  const copyExpression = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.expression);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <aside className="inspector-panel panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Inspector</span>
          <h2>Evidence details</h2>
        </div>
        <button className="inspector-close" onClick={onClose} aria-label="Close inspector">
          <X size={15} />
        </button>
      </div>

      {selected ? (
        <div className="inspector-content">
          <div className={`evidence-kind ${selected.kind}`}>
            {selected.kind === "tuple" ? <Link2 size={14} /> : <Braces size={14} />}
            {selected.kind === "tuple" ? "Stored tuple" : "Model rule"}
          </div>
          <h3>{selected.title}</h3>
          <p className="evidence-description">{selected.explanation}</p>

          <div className="expression-card">
            <div className="expression-heading">
              <span>{selected.kind === "tuple" ? "RELATIONSHIP" : `MODEL · LINE ${selected.line}`}</span>
              <button onClick={copyExpression} aria-label="Copy evidence">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <code>{selected.expression}</code>
          </div>

          <div className="why-card">
            <span className="eyebrow">Why it matters</span>
            <p>
              {selected.kind === "tuple"
                ? "Tuples are facts. Remove this relationship and every proof depending on it is reevaluated."
                : "Rules are derivations. They connect stored facts without creating another permission record."}
            </p>
          </div>

          <div className="decision-use">
            <span>Used in current decision</span>
            {(() => {
              const used = decision.path.some(
                (item) =>
                  item.id === selected.id ||
                  (selected.sourceId && item.sourceId === selected.sourceId) ||
                  (selected.line && item.line === selected.line),
              );
              return (
                <strong className={used ? "used" : "unused"}>
                  {used ? (
                    <>
                      <Check size={13} /> Yes
                    </>
                  ) : (
                    "No"
                  )}
                </strong>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="inspector-empty">
          <div className="inspector-illustration" aria-hidden="true">
            <span className="mini-node tuple" />
            <span className="mini-link first" />
            <span className="mini-node rule" />
            <span className="mini-link second" />
            <span className="mini-node result" />
          </div>
          <h3>Select a proof step</h3>
          <p>Inspect the exact tuple or model rule that contributed to this decision.</p>
        </div>
      )}

      <div className="legend-card">
        <span className="eyebrow">Proof language</span>
        <div><span className="legend-swatch tuple" /> Tuple fact</div>
        <div><span className="legend-swatch rule" /> Model derivation</div>
        <div><span className="legend-swatch result" /> Final decision</div>
      </div>
    </aside>
  );
}

export function FgaLens() {
  const [draft, setDraft] = useState<Query>(initialQuery);
  const [query, setQuery] = useState<Query>(initialQuery);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [sourceMode, setSourceMode] = useState<SourceMode>("model");
  const [selected, setSelected] = useState<Evidence | null>(null);
  const [modelText, setModelText] = useState(defaultModel);
  const modelSummary = useMemo(() => parseModel(modelText), [modelText]);

  const selectEvidence = (evidence: Evidence) => {
    setSelected(evidence);
    setSourceMode(evidence.kind === "tuple" ? "tuples" : "model");
  };

  const toggleTuple = (id: string) => {
    setDisabled((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const run = () => {
    setQuery(draft);
    setSelected(null);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <LogoMark />
          <strong>FGA Lens</strong>
        </div>
        <div className="document-path" aria-label="Current model">
          <span>openfga</span><b>/</b><span>github</span><b>/</b><strong>model.fga</strong>
        </div>
        <div className="header-actions">
          <span className="header-runtime"><i /> Local engine</span>
          <a
            className="github-link"
            href="https://github.com/openfga/sample-stores/tree/main/stores/github"
            target="_blank"
            rel="noreferrer"
          >
            <FolderGit2 size={14} /> Sample repo
          </a>
        </div>
      </header>

      <section className="query-bar">
        <QueryBuilder draft={draft} setDraft={setDraft} run={run} />
      </section>

      <div className="workspace">
        <SourcePanel
          mode={sourceMode}
          setMode={setSourceMode}
          disabled={disabled}
          toggleTuple={toggleTuple}
          resetTuples={() => setDisabled(new Set())}
          selected={selected}
          selectEvidence={selectEvidence}
          modelText={modelText}
          setModelText={setModelText}
          modelSummary={modelSummary}
        />
        <DecisionCanvas
          query={query}
          disabled={disabled}
          modelText={modelText}
          selected={selected}
          selectEvidence={selectEvidence}
        />
        {selected && (
          <EvidenceInspector
            selected={selected}
            query={query}
            disabled={disabled}
            modelText={modelText}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}
