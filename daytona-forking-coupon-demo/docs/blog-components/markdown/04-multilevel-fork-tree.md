### Forking a fork: the fork point moves forward

The second fork point starts from the changed `contract-hypothesis` sandbox, not
from the original failing baseline. This is the key reason to use forking rather
than launching fresh clones for every attempt.

```text
coupon-parent-prepared
├── frontend-hypothesis
├── backend-hypothesis
└── contract-hypothesis
    ├── contract-minimal
    └── contract-with-regression-test
```

| Level | Sandbox | What exists at this point | Why it matters |
| --- | --- | --- | --- |
| L0 | `coupon-parent-prepared` | The bug is reproduced, dependencies are installed, data is seeded, failing logs are saved, and `debug-brief.md` exists. | The expensive setup and investigation happened once. |
| L1 | `frontend-hypothesis` | A child sandbox inherits the prepared parent and tests the client-side validation explanation. | The UI theory can be tested without disturbing the parent. |
| L1 | `backend-hypothesis` | A child sandbox inherits the same prepared parent and tests the checkout/API validation explanation. | The API theory starts from the same evidence as the UI theory. |
| L1 | `contract-hypothesis` | A child sandbox tests whether UI and API validation should share one coupon contract. It writes `fix-candidate.md`. | This branch now contains changed state that the original parent does not have. |
| L2 | `contract-minimal` | A fork of `contract-hypothesis` after the candidate contract fix exists. | Tests the smallest correct patch from the changed branch. |
| L2 | `contract-with-regression-test` | A fork of `contract-hypothesis` after the candidate contract fix exists. | Tests the same fix with explicit `SUMMER-2026` regression coverage. |

The first fork compares where the bug might be. The second fork compares how to
package the fix after the likely layer has been found.

In other words, the useful parent changes over time:

```text
original reproduced state
    └── contract-hypothesis writes candidate fix
            └── refinements fork from the changed contract state
```

That is the part a fresh clone does not capture. A fresh clone can recreate the
repository. A fork can branch the environment after the investigation has already
created useful state.
