# Daytona Forking Coupon Demo

Small checkout app for a Daytona guide about forking prepared sandboxes for AI
agents.

The intentional bug:

- `SAVE10` is valid.
- `SUMMER-2026` is invalid.
- The UI accepts `SUMMER-2026`.
- Checkout later fails with a generic error.

Correct behavior is an inline `Invalid coupon code` error before checkout.

## Run

```bash
npm install
npm run seed
npm run build
npm run dev
```

Open `http://localhost:4173`, apply `SUMMER-2026`, then click checkout.

## Demo Commands

After reproducing the browser bug:

```bash
npm run demo:reset
npm run demo:codex
```

For the live Daytona version:

```bash
npm run demo:codex:live
```

The live run creates `coupon-parent-prepared`, forks
`frontend-hypothesis`, `backend-hypothesis`, and `contract-hypothesis`, then
forks `contract-hypothesis` into `contract-minimal` and
`contract-with-regression-test`.

By default, live sandboxes are deleted at the end and auto-stop after 15 minutes.
Use `-- --keep-sandboxes` only when you need the Daytona console to keep the fork
tree visible after the command exits.

## State And Metrics

Generated files are hidden under:

```text
.artifacts/logs/
.artifacts/screenshots/
```

Important artifacts:

- `.artifacts/logs/daytona-live-latency.json`
- `.artifacts/logs/openai-cache-probe.json`
- `.artifacts/logs/codex-fork-session.md`
- `.artifacts/screenshots/guide-inserts/`

OpenAI cache rows come from API usage metadata
`input_tokens_details.cached_tokens`. They show model-side prompt prefix caching,
not Daytona copying OpenAI KV cache between sandboxes.

## Guide Assets

- `docs/graphs/`: source SVG diagrams and benchmark JSON.
- `docs/blog-components/markdown/`: Markdown replacements for the dense fork-tree
  and lifecycle screenshots.
- `docs/guide-image-inserts.md`: paste-ready image or Markdown insert map.
- `SUMMARY.md`: running work log.

## Checks

```bash
npm run test
npm run inspect-state
npm run lifecycle-demo
npm run fork-tree-demo
npm run render-graphs
```

The baseline tests intentionally fail until the shared coupon contract is fixed.
