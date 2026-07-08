# Guide Screenshot Set

Use this smaller set for the forking guide. It matches the latest live demo, where the default recording path stops after the parent, three hypothesis forks, and two contract refinements. The refreshed images use a Daytona docs-style dark theme with green highlights.

Guide-ready current-UI renders live in `.artifacts/screenshots/guide-inserts/`. Use `docs/guide-image-inserts.md` for paste-ready markdown, alt text, and captions.

## Recommended 5 Screenshots

### 1. `.artifacts/screenshots/guide-inserts/01-demo-bug.png`

Use for: opening problem statement.

What it shows: `SUMMER-2026` is accepted by the UI, then checkout fails later with a generic error.

Guide point: the parent sandbox should contain a reproduced bug before forking starts.

### 2. `.artifacts/screenshots/guide-inserts/02-prepared-parent-state.png`

Use for: prepared parent section.

What it shows: repo files, dependencies, build artifacts, seeded coupon data, failing logs, debug brief, state marker, env, and app start checks.

Guide point: forking is valuable because this useful state already exists.

### 3. `.artifacts/screenshots/guide-inserts/03-live-fork-run.png`

Use for: live Daytona execution section.

What it shows: measured live setup, prepared parent state, hypothesis forks, and explanation blocks from `npm run demo:codex:live`.

Guide point: the demo is not just conceptual; the terminal records live sandbox operations and fork latencies.

### 4. `.artifacts/screenshots/guide-inserts/04-multilevel-fork-tree.png`

Preferred blog version: paste `docs/blog-components/markdown/04-multilevel-fork-tree.md` so the tree renders as native Markdown article text instead of a fixed screenshot.

Use for: multi-level forking section.

What it shows: parent -> frontend/backend/contract hypotheses -> contract-minimal and contract-with-regression-test.

Guide point: this is the main "why fork instead of clone" visual. The second fork point happens after the contract branch writes changed state.

### 5. `.artifacts/screenshots/guide-inserts/05-state-semantics.png`

Preferred blog version: paste `docs/blog-components/markdown/05-state-semantics.md` so the state layers and lifecycle semantics stay readable as native Markdown article text.

Use for: lifecycle semantics section.

What it shows: state layers plus lifecycle comparison for stop/start, pause, fork, snapshot, and restore.

Guide point: the guide should keep these operations distinct and avoid overclaiming.

## Optional Swap: DO THIS

Use `.artifacts/screenshots/15-guide-live-latency.png` instead of `17-guide-state-semantics.png` if the guide needs a more concrete benchmark-style visual.

What it shows: measured SDK timings from the latest live demo: parent create, prepared state, five fork operations, and candidate-fix writes.

## Screenshots To Avoid For This Shorter Guide

- `11-video-terminal-complete.png`: from the older static flow with validator fan-out.
- `13-agent-reasoning.png`: useful for a longer AI-agent article, but too detailed for the core forking guide.
- `08-branch-outcomes.png`: more conclusion-oriented than the current neutral hypothesis UI.
