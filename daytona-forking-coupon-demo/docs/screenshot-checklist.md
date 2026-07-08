# Screenshot Checklist

1. Browser showing broken coupon behavior.
2. Terminal showing failing baseline tests.
3. `debug-brief.md` open in editor.
4. `npm run inspect-state`.
5. `npm run lifecycle-demo`.
6. Daytona UI/CLI showing parent sandbox.
7. Parent stop/start persistence proof.
8. Snapshot baseline example.
9. Multi-level fork tree or `npm run fork-tree-demo`, including `contract-candidate-fix`.
10. Three hypothesis forks side by side.
11. Fork-a-fork refinement.
12. State-reuse benchmark graph.
13. Branch outcome matrix.
14. Final comparison matrix from `npm run compare-branches`.
15. Always-on root console at `/`, including checkout reproduction and post-fix validator fan-out.
16. Root console asking for the Daytona API key after the bug was reproduced.
17. Fork Spawn Log showing timestamp, fork, parent, sandbox ID, inherited state, action, result, and status.
18. Live Daytona Run Log showing live progress without exposing the key.
19. Memory-State Probe panel showing the observed result.
20. `npm run daytona:plan` showing the live run sequence before creating sandboxes.
21. `data/demo-session-state.json` or `/api/demo-session` showing `bugReproduced: true`.
22. Demo Step Checklist panel showing completed and pending steps.
23. Clone-vs-fork comparison showing why validators inherit the changed contract branch.
24. `npm run daytona:probe-fork` showing `us-east-1` + `daytona-vm-medium` as the current fork-capable path.
25. `npm run demo:codex:live` showing real sandbox IDs for parent, hypothesis forks, fork-a-fork refinements, validators, memory probe, and snapshot.
26. Root operator console showing the parent terminal and the three split branch terminals below it.
27. `npm run demo:reset` showing exactly where the browser bug appears.
28. `npm run demo:codex` showing the user bug/hypothesis prompt, prepared parent, hypothesis forks, branch tests, winning contract branch, validator fan-out, and validator decision rule.
29. Optional granular `npm run demo:branch` showing the prepared parent, first fork point, what each fork does, why contract wins, and fork-a-fork setup.
30. Optional granular `npm run demo:state` showing the prepared parent after reproduction.
31. Optional granular `npm run demo:forks` showing the first fork point from `coupon-parent-prepared`.
32. Optional granular `npm run demo:hypotheses` showing what each hypothesis fork tried and why frontend/backend are partial.
33. Optional `npm run demo:agent` showing live OpenAI-generated externalized reasoning and its latency.
34. Optional granular `npm run demo:contract` showing `fix-candidate.md` written before fork-a-fork refinements.
35. Optional `npm run demo:validators` showing validator fan-out.
36. Optional `npm run demo:report` or `.artifacts/logs/simple-demo-latency-report.md`.
37. Optional `npm run demo:codex:live` showing `[live:start]`, `[live:ok]`, and `[live:failed]` measured Daytona timing rows as sandbox operations run.
38. Optional `npm run demo:codex:live` paused on an `[explain]` block that summarizes the agent reasoning and next fork point.
39. Browser after live demo completion showing `SUMMER-2026` rejected inline with `Invalid coupon code`.

## Capture Notes

- App screenshot: use `npm run dev`, apply `SUMMER-2026`, then checkout.
- Static terminal capture: run `npm run demo:reset`, reproduce the browser bug, then capture `npm run demo:codex`.
- Live agent reasoning: optionally run `npm run demo:agent` if the recording should include model-authored reasoning.
- Latency report: `npm run demo:codex` writes deterministic demo metrics; `npm run demo:codex:live` writes measured Daytona SDK metrics to `.artifacts/logs/daytona-live-latency.json` and can pause after major explanation blocks for video narration.
- Terminal screenshots can use generated HTML pages from `npm run capture-screenshots` if direct terminal capture is unavailable.
- Graph screenshots should use the static SVGs under `docs/graphs/`.
- The current key can run live fork with target `us-east-1` and `linux-vm` snapshots. Cleanup is enabled by default. Use `npm run demo:codex:live -- --keep-sandboxes` only for Daytona-console screenshots where sandbox IDs should remain visible after the command exits.
