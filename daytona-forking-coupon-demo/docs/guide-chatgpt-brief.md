# ChatGPT Brief For The Forking Guide

Copy this into ChatGPT when drafting or revising the guide.

## Prompt

I am writing a technical Daytona developer guide about sandbox forking for AI agent workflows. Please rewrite my draft into a polished, technically precise guide.

Use this core message:

> An AI agent can prepare meaningful runtime state once: repo cloned, dependencies installed, app built, database seeded, bug reproduced, tests/logs collected, debug brief written, and then Daytona can reuse or branch that state in different ways.

Use this main sentence:

> Stopping lets you return to the same sandbox. Pausing freezes live runtime state. Snapshotting saves a reusable baseline. Forking creates a new independent future from the current state.

The demo is a checkout/coupon bug:

- Valid coupon: `SAVE10`
- Invalid coupon: `SUMMER-2026`
- User-visible bug: the UI accepts `SUMMER-2026`, then checkout fails later with a generic error.
- Correct behavior: show `Invalid coupon code` inline before checkout proceeds.

The prepared parent sandbox contains:

- repo files
- installed dependencies
- build artifacts
- seeded coupon data
- failing test logs
- `debug-brief.md`
- `state-marker.txt`
- benchmark output

The current live demo command is:

```bash
npm run demo:codex:live
```

The default live path creates:

1. `coupon-parent-prepared`
2. `frontend-hypothesis`
3. `backend-hypothesis`
4. `contract-hypothesis`
5. `contract-minimal`
6. `contract-with-regression-test`

The default path stops before validator fan-out so it stays under the Daytona CPU limit. The older expanded path is available with:

```bash
npm run demo:codex:live -- --full-tree
```

Use these guide screenshots:

- `.artifacts/screenshots/01-broken-coupon-ui.png`: browser bug reproduction.
- `.artifacts/screenshots/04-inspect-state.png`: prepared parent state checklist.
- `.artifacts/screenshots/14-guide-live-fork-run.png`: live Daytona terminal run.
- `.artifacts/screenshots/16-guide-current-fork-tree.png`: current fork tree.
- `.artifacts/screenshots/17-guide-state-semantics.png`: state layers and lifecycle semantics.

Optional alternative:

- `.artifacts/screenshots/15-guide-live-latency.png`: measured SDK timing table.

Please structure the guide roughly as:

1. Why sandbox forking exists.
2. What state is worth preparing before a fork.
3. The coupon bug demo and prepared parent.
4. Forking the parent into hypotheses.
5. Forking the winning/changed branch again.
6. Lifecycle semantics: stop/start vs pause vs fork vs snapshot vs restore.
7. Why this is different from Git branches, clones, or Docker images.
8. AI-agent workflow patterns and best practices.

Technical precision constraints:

- Do not say fork, pause, snapshot, and restore are the same operation.
- Do not claim GPU state can be snapshotted or forked naively.
- Say "observed for this runner" when discussing runtime/process memory behavior.
- Explain that stop/start keeps the same sandbox identity and filesystem state, but running processes should not be treated as preserved.
- Explain that fork creates a new sandbox identity with independent future state.
- Explain that snapshot is a reusable baseline, while fork is an immediate branch from a current sandbox.
- Explain that Git branches track source history; sandbox forks branch runtime state.

Tone:

- Technical and visual.
- More like an infrastructure post than a marketing page.
- Use diagrams, tables, state layers, and concrete lifecycle semantics.
- Keep claims conservative and defensible.

## Latest Measured Live Demo Notes

The latest successful live run used:

- target: `us-east-1`
- base snapshot: `daytona-vm-medium`
- parent create: about `1.40s`
- prepared parent state: about `0.62s`
- fork operations completed: `5`
- fork latency total: about `2.96s`
- branch depth: `coupon-parent-prepared -> contract-hypothesis -> contract-with-regression-test`

The guide can use these numbers as measured demo observations, not general Daytona performance claims.

## Suggested Title Options

- Forking Runtime State For AI Agents
- Branching Sandboxes After The Work Is Done
- Prepared State, Independent Futures
- Why Fork A Sandbox Instead Of Creating Another One?
