# Daytona Sandbox Forking Demo

This demo shows why an AI agent should prepare meaningful runtime state once, then branch it. The parent sandbox is not empty: it has the repo, dependencies, build output, seeded coupon data, failing logs, a debug brief, a state marker, and benchmark output.

Main sentence:

> Stopping lets you return to the same sandbox. Pausing freezes live runtime state. Snapshotting saves a reusable baseline. Forking creates a new independent future from the current state.

## Parent Baseline Preparation

```bash
npm install
npm run seed
npm run build
npm run dev
```

Then reproduce the bug:

1. Open `http://localhost:4173`.
2. Apply `SUMMER-2026`.
3. Observe the UI accepts it.
4. Click checkout.
5. Observe the generic checkout failure.

## Video Recording Handoff

For the video, keep the coupon bug in the browser and move the forking explanation to static terminal commands.

Terminal A:

```bash
npm run dev
```

Terminal B:

```bash
npm run demo:reset
```

Then reproduce the browser bug:

1. In `Checkout Debug Baseline`, leave `SUMMER-2026` in the coupon field.
2. Click `Apply`.
3. Show `Coupon accepted: SUMMER-2026`.
4. Click `Checkout`.
5. Show `Checkout failed. Please try another payment method.`

Then run the Codex-style fork session:

```bash
npm run demo:codex
```

At the prompt, the parent state has already captured the bug. Press Enter for the demo hypotheses, or paste a line like:

```text
I have a checkout coupon bug. Hypotheses: frontend validation, backend API validation, shared coupon contract. Fork the sandboxes and test which is correct.
```

This is the recommended recording flow because it feels like asking Codex to investigate the bug, but it still prints once and exits. The terminal does not clear or continuously update.

Show the fork mechanics in the terminal first. `demo:codex` includes SDK-shaped calls such as `parent._experimental_fork({ name: "frontend-hypothesis" })` and parent inspection commands such as `parent.process.executeCommand("... npm run inspect-state")`. Keep the Daytona console open only as supporting evidence for sandbox identity and fork names when the account/runner supports live forks.

For real live timing rows while Daytona sandboxes run, use:

```bash
npm run demo:codex:live
```

`demo:codex` uses deterministic demo timings. `demo:codex:live` streams measured `[live:start]`, `[live:ok]`, and `[live:failed]` rows around Daytona SDK calls and writes `.artifacts/logs/daytona-live-latency.json`. It defaults to the fork-capable target `us-east-1` and tries known `linux-vm` snapshots, starting with `daytona-vm-medium`. The default live path creates the parent, three hypothesis forks, and two contract refinements, then stops before validator fan-out so it stays under the Daytona CPU limit. Interactive live runs pause after each major explanation block, including a short agent-reasoning summary for why the next fork point matters. If `OPENAI_API_KEY` is configured, the same run prints live `[cache:start]` and `[cache:ok]` rows for model-side prompt-cache usage at the first and second fork layers. At completion, the browser flips to the fixed inline-validation state. Use `npm run demo:codex:live -- --no-step-pause` to stream without pauses, `npm run demo:codex:live -- --no-openai-cache` to suppress OpenAI cache requests, or `npm run demo:codex:live -- --full-tree` for validator/memory/snapshot expansion when you have enough capacity.

Credential lookup for the live path checks the shell first, then `.env.daytona.local` in this folder, then `.env.daytona.local` or `.env` at the workspace root. Missing credentials produce a short setup message and a blocked latency artifact.
The live Daytona path configures every created parent and fork sandbox to auto-stop after 15 minutes of inactivity. Cleanup still runs at command exit by default; auto-stop is a backup guard for interrupted or explicitly kept recording runs. Override with `DAYTONA_DEMO_AUTOSTOP_MINUTES` only when needed.
OpenAI cache lookup checks the shell first and then `.env` files. The cache metrics are live usage metadata from OpenAI prompt caching. They show repeated serialized context being cached for model requests; they are not a claim that Daytona forks OpenAI KV cache.

Use the granular commands only when you want a slower walkthrough:

```bash
npm run demo:state
npm run demo:forks
npm run demo:hypotheses
npm run demo:contract
npm run demo:validators
npm run demo:report
```

Artifacts:

- simple run log: `.artifacts/logs/simple-demo-run.json`
- simple latency report: `.artifacts/logs/simple-demo-latency-report.md`
- Codex-style fork session: `.artifacts/logs/codex-fork-session.md`
- optional live agent reasoning: `.artifacts/logs/agent-reasoning.md`
- live OpenAI cache probe: `.artifacts/logs/openai-cache-probe.json`
- live OpenAI cache report: `.artifacts/logs/openai-cache-probe.md`
- optional animated terminal metrics: `.artifacts/logs/video-terminal-metrics.json`

Credential split:

- `npm run demo:codex` does not need an API key.
- `npm run demo:codex:live` uses `DAYTONA_API_KEY` and the fork-capable `us-east-1` / `linux-vm` Daytona path by default.
- `npm run demo:agent` and the live cache probe use `OPENAI_API_KEY` from the local environment or `.env`.
- `npm run demo:cache` rehearses only the OpenAI cached-token rows.
- The advanced localhost Daytona probe expects a Daytona `dtn_...` key.
- A browser probe error such as `Invalid credentials` does not block the local recording flow.

Collect parent-state artifacts:

```bash
npm test > .artifacts/logs/failing-baseline.txt 2>&1
npm run benchmark-state-reuse
npm run render-graphs
npm run inspect-state
```

## Lifecycle Comparison

| Operation             | Same sandbox? |  New sandbox? |     Reusable later? |         Preserves files? |                            Preserves running memory/processes? | Best use                           |
| --------------------- | ------------: | ------------: | ------------------: | -----------------------: | -------------------------------------------------------------: | ---------------------------------- |
| Stop/start            |           Yes |            No |   Same sandbox only |                      Yes |                                             No / not the point | Pause work and resume later        |
| Pause                 |           Yes |            No |   Same sandbox only |                      Yes |                                                            Yes | Freeze live runtime state          |
| Fork                  |            No |           Yes |    Immediate branch |     Yes, from fork point |                                               Do not overclaim | Explore independent hypotheses now |
| Snapshot              |            No | Not by itself |                 Yes |                      Yes | Usually filesystem-focused; memory support depends on platform | Save reusable baseline             |
| Restore from snapshot |            No |           Yes | Uses saved snapshot | Yes, from snapshot point |                               Depends on snapshot type/support | Recreate a known baseline later    |
| Git branch            |            No |            No | Source history only |                Code only |                                                             No | Track source-code versions         |
| Docker image/template |            No |           Yes |                 Yes |    Base filesystem image |                                                             No | Start from predefined stack        |

## What kind of state are we reusing?

Layer 1: Filesystem state

- repo files
- installed dependencies
- build artifacts
- seeded database files
- debug-brief.md
- failing test logs
- state-marker.txt

Layer 2: Sandbox configuration state

- environment variables
- exposed ports
- working directory
- service configuration

Layer 3: Runtime/process state

- running dev server
- in-memory caches
- process memory
- file descriptors
- open processes

Layer 4: Agent/debugging state externalized to disk

- reproduction notes
- relevant files
- hypotheses
- test results
- fork plan

## Hypothesis Forks

`frontend-hypothesis`

- Assumes the bug is in client-side validation.
- Expected result: inline UI behavior improves, but backend/API inconsistency remains.

`backend-hypothesis`

- Assumes the bug is in the checkout API.
- Expected result: API behavior improves, but UI may still show confusing behavior.

`contract-hypothesis`

- Assumes the bug is in the shared coupon validation schema/contract.
- Expected result: UI and API behavior become consistent.

Then fork the winning hypothesis:

`contract-candidate-fix`

- Candidate shared contract/schema fix written on the winning branch before validators are forked.

`contract-minimal`

- Smallest correct shared contract/schema fix.

`contract-with-regression-test`

- Shared contract/schema fix plus explicit regression coverage.

## Post-Fix Validator Fan-Out

The original agent workflow was:

> An agent has already identified the files responsible for a failing test. Rather than assigning three agents to independently rediscover the same information, a single agent performs the exploration once before forking into specialized workers.

The feedback was that forking becomes more interesting when the parent includes disk or memory changes before the fork, not just knowledge held inside an agent process.

This demo incorporates that feedback with a second fork point:

1. The contract branch applies a candidate shared-contract fix.
2. That changed filesystem state becomes `contract-candidate-fix`.
3. Daytona forks three validator workers from that state:
   - `api-design-review`
   - `implementation-review`
   - `regression-test-builder`
4. Each validator inherits the fix, failing logs, debug brief, seeded data, and tests.
5. If any validator does not green-light the fix, its report goes back to the original contract-fix branch.

This shows forking after durable work exists, not just after conversational exploration. It is deliberately different from spinning up three clones from the original baseline because the validator workers inherit the changed contract branch.

## Browser-Started Daytona Run

The demo can ask for the Daytona API key directly in the always-on console at `/`, but this is now an advanced capability check. Use it only after the broken coupon flow has been reproduced in the browser and only when you want to test a Daytona `dtn_...` key.

The key is posted to `localhost` and passed to the live runner as `DAYTONA_API_KEY`. It is not written to `data/`, `.artifacts/logs/`, or `SUMMARY.md`.

Use the full Daytona API key in `dtn_...` format. The local server verifies the key with Daytona before it starts the live runner. If the preflight fails, no sandbox is created and the Live Daytona Run Log shows the credential error.

The bug reproduction itself is tracked on the server, not only in browser state. The server writes `data/demo-session-state.json` after it receives the reproduction event. `POST /api/daytona-run` refuses to start until that state says `bugReproduced: true`.

Live browser flow:

1. Open `/`.
2. Apply `SUMMER-2026`.
3. Click checkout and observe the generic failure.
4. Enter the Daytona API key once in the console on the same page.
5. Watch the parent terminal run the prepared-state and fork commands.
6. After the fork step, use the three split panes for frontend, backend, and contract work.
7. Use `/forking-demo` only as a visual reference view when you want the full tree and matrices.

### Observed live capability with the current key

| Probe | Observed result |
| --- | --- |
| Default container in `us` | Creates and runs commands, but fork fails |
| Inventory | Found `5` active `linux-vm` snapshots |
| Fork probe | `us-east-1` + `daytona-vm-medium` can fork; `daytona-vm-small` had a transient start failure |
| Full live tree | Parent, hypothesis forks, fork-a-fork refinements, validators, memory probe, and snapshot all completed |
| Cleanup rehearsal | Deleted `10` created sandboxes |

The live run deletes created Daytona sandboxes by default when it exits. If you need the Daytona console to keep the fork tree visible after the command exits, run:

```bash
npm run demo:codex:live -- --keep-sandboxes
```

For unattended rehearsal output, run:

```bash
npm run demo:codex:live -- --default
```

If a rehearsal hits Daytona CPU limits, the runner cleans up tracked sandboxes before exiting. Delete any older manually kept demo sandboxes before running again. The default live path avoids the validator fan-out that caused the previous CPU-limit failure.

## Memory-State Probe

The live runner also tries a conservative memory-state probe:

1. The contract candidate branch starts a small Node process.
2. The process warms in-memory state without writing the counter to disk.
3. The demo forks a `memory-state-check` child.
4. The child tries to query the warmed process.

If the child observes the warmed state, the log says so. If it does not, the log says this run should be described as filesystem-state forking only. The guide should report the observed result rather than overclaiming runtime memory preservation.

## Local Proofs and Post Visuals

```bash
npm run lifecycle-demo
npm run fork-tree-demo
npm run validator-fanout-demo
npm run compare-branches
npm run benchmark-state-reuse
npm run render-graphs
npm run capture-screenshots
```

The benchmark values are local simulated guide values, not Daytona production timings. They are useful for explaining repeated work avoided by prepared state reuse.

## Demo Step Checklist

1. Always-on console at `/`.
2. Server-side reproduction tracking.
3. Visible reproduced-state controls and reset button.
4. Structured fork spawn log with timestamp, parent, sandbox ID, inherited state, action, result, and status.
5. Multi-level fork tree with candidate-fix branch point.
6. Memory-state probe represented conservatively; live proof requires fork/pause-capable support.
7. Live Daytona capability probe found `us-east-1` + `linux-vm` snapshots as the fork-capable path.
8. Screenshot decision: capture `npm run demo:codex:live -- --keep-sandboxes` only when real fork IDs should remain visible in Daytona after the command exits.
