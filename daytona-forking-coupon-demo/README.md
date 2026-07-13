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
npm run dev
```

Open `http://localhost:4173`, apply `SUMMER-2026`, then click checkout. If you
have a Daytona key, the live start button in the page can run the optional fork
flow.

## Commands

The trimmed repo still supports:

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

The live runner reads `DAYTONA_API_KEY` from `.env.daytona.local`, `.env`, or
their workspace-root equivalents. `OPENAI_API_KEY` is optional and only affects
the cache-probe reporting.
