# Daytona Forking Exploration

Workspace for the Daytona sandbox-forking coupon demo.

The demo shows why a coding agent should fork after useful setup exists: repo ready,
dependencies installed, app built, data seeded, bug reproduced, logs saved, and
hypotheses written down.

## Run The Demo

```bash
npm install --prefix daytona-forking-coupon-demo
npm run seed
npm run build
npm run dev
```

Open `http://localhost:4173`, apply `SUMMER-2026`, then click checkout. The UI
accepts the invalid coupon before checkout fails with a generic error.

## Recording Flow

Use a second terminal after reproducing the browser bug:

```bash
npm run demo:reset
npm run demo:codex
```

For measured Daytona fork timings:

```bash
npm run demo:codex:live
```

`demo:codex:live` reads `DAYTONA_API_KEY` locally, creates the prepared parent,
forks the hypothesis branches, forks the contract branch again, prints live SDK
latencies, and cleans up created sandboxes by default. Created sandboxes also
auto-stop after 15 minutes.

If `OPENAI_API_KEY` is configured, the live command also prints OpenAI
prompt-cache usage from API metadata. These rows are model-side prompt cache
observations, not Daytona copying OpenAI KV cache between sandboxes.

## Useful Commands

```bash
npm run inspect-state
npm run lifecycle-demo
npm run fork-tree-demo
npm run demo:cache
npm run daytona:check
```

## Generated Artifacts

Generated logs and screenshots are hidden under:

```text
daytona-forking-coupon-demo/.artifacts/logs/
daytona-forking-coupon-demo/.artifacts/screenshots/
```

Source docs, graphs, guide Markdown inserts, and the running work log remain in:

```text
daytona-forking-coupon-demo/docs/
daytona-forking-coupon-demo/SUMMARY.md
```
