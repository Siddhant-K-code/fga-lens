# FGA Lens

A query-first visual debugger for relationship-based authorization. FGA Lens explains why an OpenFGA-style check passes or fails, links every proof step back to its tuple or model rule, and lets you disable tuples to simulate policy changes.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What the prototype includes

- The OpenFGA GitHub sample model and relationship tuples
- A semantic proof for successful authorization checks
- Failed-path explanations for denied checks
- Synchronized tuple, model, proof, and evidence views
- Live tuple toggles that immediately reevaluate the decision
- Queries for repository `admin`, `maintainer`, `writer`, `triager`, and `reader`

The resolver is intentionally local and scoped to the included sample model. It demonstrates the interaction and explanation model; it is not an execution trace from a production OpenFGA server.

## Verification

```bash
npm run lint
npm run build
```
