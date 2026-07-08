# Forking Semantics

Sandbox lifecycle operations are easy to collapse into one vague idea of "saving state." The guide should avoid that. Each operation answers a different question.

## Stop/Start

Stop/start returns to the same sandbox identity. Filesystem state persists, so `state-marker.txt`, logs, seeded data, and build artifacts should still be present after the sandbox starts again.

Do not treat running processes as preserved by ordinary stop/start. Restart the app and background workers explicitly.

## Pause

Pause keeps the same sandbox identity and is about runtime continuity. Where the runner supports pause semantics, process memory can be frozen and resumed. This is distinct from a filesystem-only baseline.

In this demo, pause is explained semantically and shown as an SDK example. The local repo does not attempt to prove live memory persistence.

## Fork

Fork creates a new sandbox identity from the current prepared sandbox state. The child starts with the same disk/filesystem contents at the fork point and then diverges independently.

This is the lifecycle operation used for the coupon hypotheses:

- `frontend-hypothesis`
- `backend-hypothesis`
- `contract-hypothesis`

After the contract hypothesis looks best, fork it again into:

- `contract-minimal`
- `contract-with-regression-test`

## Fork After A Candidate Fix

A common agent framing is: one agent explores the bug, then several agents specialize from what it learned. That is useful, but the strongest sandbox-forking case is when the first agent has changed durable state before the fork.

In this demo, the stronger fork point is `contract-candidate-fix`:

- the failing baseline log is on disk
- the debug brief is on disk
- seeded coupon data is on disk
- build output is on disk
- the candidate shared-contract fix is on disk

Three validators then fork from that changed state:

- `api-design-review`: tries to green-light API behavior
- `implementation-review`: checks whether the fix is coherent and minimal
- `regression-test-builder`: develops coverage for the invalid coupon

If any validator does not green-light the candidate fix, the demo keeps iterating from the original contract-fix branch. This is different from asking several agents to rediscover the same failing files from a clean checkout.

## Memory-State Probe

The live runner includes a separate `memory-state-check` probe. It warms a small process in the contract candidate branch, then forks a child that tries to query that process.

Use conservative language for this result:

- if the child observes the warmed state, say this runner preserved that live process state for this run
- if the child cannot query the process, say the demonstrated fork should be described as filesystem-state reuse
- do not generalize the result to all workloads or platforms

With the provided key on 2026-07-02, the current Daytona organization did not have a fork-capable or pause-capable sandbox path available. The default container sandbox reported `Forking is not supported for this sandbox` and `Pausing is not supported for this sandbox`. Treat the memory-state probe as a planned live proof for a fork-capable runner, not as proven by this account.

## Snapshot

Snapshot saves a reusable baseline/checkpoint. It is useful when you want to recreate the prepared state later, not necessarily branch immediately from a live parent.

For this guide, the reusable baseline is named `coupon-prepared-baseline`.

## Restore/Create From Snapshot

Restoring from a snapshot creates a new sandbox from a saved baseline. That makes it different from stop/start, which returns to the same sandbox identity. It is also different from fork, which is an immediate branch from the current sandbox lineage.

The live container probe showed why snapshot should stay separate from fork in the guide: the stopped-container filesystem snapshot eventually completed, but exceeded a 180-second client timeout and required polling before cleanup. That is a reusable-baseline path, not the immediate branching path that the fork tree needs.

## Observed Daytona Capability Probe

The current key can prove stop/start filesystem persistence:

- create default `daytonaio/sandbox:0.8.0` container in `us`
- write `state-marker.txt`
- stop the same sandbox
- start the same sandbox
- verify the marker still exists

The same key cannot currently prove the live fork tree:

- default container fork is unsupported
- default container pause is unsupported
- prebuilt `daytona-vm-small` is not available in `us` or `eu` for the organization
- creating a temporary `linux-vm` snapshot in `us` is blocked because no `linux-vm` runners are configured
- `eu` is not available to the organization

Plan for the post: use this account's live evidence for stop/start and capability boundaries, and use a fork-capable Daytona target before capturing real fork IDs, fork-a-fork, validator fan-out, or memory-state preservation.

## Technical Sidebar: Memory snapshots and checkpoint/restore

Some platforms use memory snapshots or checkpoint/restore to avoid rerunning expensive initialization.

Depending on implementation and platform support, these systems may capture process memory, file descriptors, registers, environment variables, process IDs, and filesystem mutations.

Daytona fork, snapshot, pause, and restore should not be collapsed into one concept. In this demo:

- stop/start proves same-sandbox filesystem persistence
- fork proves independent branching from a prepared filesystem state
- snapshot proves reusable baseline creation
- pause represents runtime/process-state preservation

Do not claim GPU state can be snapshotted or forked naively. GPU state, drivers, device memory, kernel handles, and accelerator scheduling make stronger claims unsafe unless the platform explicitly documents that support for the exact workload.

## References To Verify Against Current Daytona Docs

- Sandbox start/stop/pause/fork/snapshot semantics: <https://www.daytona.io/docs/en/sandboxes/>
- Snapshot creation and snapshot-based sandbox creation: <https://www.daytona.io/docs/en/snapshots/>
