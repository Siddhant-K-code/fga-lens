# FGA Lens

A live visualizer for OpenFGA authorization models. Paste or write schema 1.1 DSL and FGA Lens turns types, relations, usersets, wildcards, computed permissions, and `X from Y` inheritance into an interactive graph.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What it includes

- OpenFGA's official ANTLR-backed DSL parser and semantic validator
- A syntax-highlighted model editor that rebuilds the graph as you type
- Type cards with relation and permission connection points
- Distinct edges for direct subjects, computed relations, and inherited relations
- Support for usersets such as `group#member`, wildcards such as `user:*`, conditions, unions, intersections, differences, and tuple-to-userset rules
- Pan, zoom, fit-to-view, relation inspection, source-line linking, and useful malformed-model states

Parsing and validation run locally in the browser. The graph represents the authorization model, not relationship tuples or the result of a runtime authorization check.

## Verification

```bash
npm run lint
npm run build
```
