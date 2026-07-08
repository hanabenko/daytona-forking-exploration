# Codex-Style Fork Demo Latency Report
Generated: 2026-07-07T00:43:29.697Z
Mode: codex-style
Timing note: fork timings in this report are deterministic local demo timings for stable video pacing unless replaced by a live Daytona run.
Operations recorded: 15
Displayed latency total: 5252ms
Command wall time: 7ms
Slowest displayed operation: codex write candidate fix on contract-hypothesis (620ms)
| Operation | Branch | Latency | Detail |
| --- | --- | ---: | --- |
| parse codex-style prompt | coupon-parent-prepared | 12ms | read bug and hypothesis request |
| inspect prepared parent state | coupon-parent-prepared | 180ms | state manifest and artifacts present |
| codex fork hypothesis | frontend-hypothesis | 420ms | frontend validation |
| codex fork hypothesis | backend-hypothesis | 470ms | backend checkout/API validation |
| codex fork hypothesis | contract-hypothesis | 510ms | shared coupon contract/schema |
| codex test hypothesis | frontend-hypothesis | 240ms | partial |
| codex test hypothesis | backend-hypothesis | 260ms | partial |
| codex test hypothesis | contract-hypothesis | 310ms | winner |
| codex write candidate fix | contract-hypothesis | 620ms | fix-candidate.md created |
| codex fork contract candidate | contract-minimal | 330ms | smallest correct shared-contract fix |
| codex fork contract candidate | contract-with-regression-test | 390ms | contract fix plus regression coverage |
| codex fork validator | api-design-review | 360ms | checks API semantics |
| codex fork validator | implementation-review | 410ms | checks shared-contract implementation |
| codex fork validator | regression-test-builder | 480ms | adds explicit coupon regression coverage |
| codex validator decision | contract-candidate-fix | 260ms | all validator branches green-light the shared-contract path |
