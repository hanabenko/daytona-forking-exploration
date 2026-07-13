# Daytona Forking Exploration

Workspace wrapper for the demo in `daytona-forking-coupon-demo/`.

## Run

Use `npm run`, not `npm` directly:

```bash
npm install --prefix daytona-forking-coupon-demo
npm run seed --prefix daytona-forking-coupon-demo
npm run dev --prefix daytona-forking-coupon-demo
```

Open `http://localhost:4173`, apply `SUMMER-2026`, then click checkout. If you
have a Daytona key, the live start button in the page can run the optional fork
flow.

## Commands

These are the trimmed commands that still work:

```bash
npm run demo:reset
npm run demo:codex
npm run demo:codex:live
npm run daytona:check
npm run daytona:plan
npm run daytona:live
```

The exact interactive flow is:

```bash
npm run demo:reset
npm run demo:codex:live
```

`npm run demo:codex:live` skips the optional OpenAI cache probe by default so
the Daytona fork run can complete even when prompt-cache quota is unavailable.
Use `npm run daytona:live` if you specifically want the cache probe and have
quota for it.

The live runner pauses at each `[continue]` prompt when it is attached to a
terminal. Press Enter to advance each step.

## Daytona Setup

The live runner reads `DAYTONA_API_KEY` from:

```text
daytona-forking-coupon-demo/.env.daytona.local
.env.daytona.local at the workspace root
daytona-forking-coupon-demo/.env
.env at the workspace root
```

It also reads `DAYTONA_TARGET`, `DAYTONA_BASE_SNAPSHOT`, `DAYTONA_KEEP_SANDBOXES`,
and `DAYTONA_DEMO_AUTOSTOP_MINUTES` from those env files or your shell.
