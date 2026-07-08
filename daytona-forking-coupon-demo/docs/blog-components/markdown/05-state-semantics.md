### Lifecycle semantics: different operations preserve different state

Stop/start, pause, fork, snapshot, and restore are related operations, but they
should not be described as the same thing. The useful question is: which state is
being reused?

#### State layers

| Layer | State | Examples | Why the guide cares |
| --- | --- | --- | --- |
| 1 | Filesystem state | repo files, installed dependencies, build output, seeded data, test logs, `state-marker.txt` | This is the easiest state to inspect and the main state reused by the coupon demo forks. |
| 2 | Sandbox configuration state | environment variables, exposed ports, working directory, service configuration | A prepared sandbox is more useful than a clone because it already knows how to run. |
| 3 | Runtime/process state | running dev server, process memory, in-memory caches, file descriptors | This is separate from files on disk and should not be implied for every operation. |
| 4 | Agent/debugging state externalized to disk | `debug-brief.md`, hypotheses, failing logs, reproduction notes, fork plan | Child sandboxes inherit files, not private agent thoughts, so the agent writes its investigation into the environment before forking. |

#### Operation comparison

| Operation | Sandbox identity | Reusable later? | Preserves files? | Runtime/process state | Best use |
| --- | --- | --- | --- | --- | --- |
| Stop/start | Same sandbox | Same sandbox only | Yes | No / not the point | Resume the same sandbox later. |
| Pause | Same sandbox | Same sandbox only | Yes | Yes, where supported | Freeze live runtime state without treating it as a new branch. |
| Fork | New sandbox | Immediate branch | Yes, from the fork point | Do not overclaim | Explore independent futures from the current prepared state. |
| Snapshot | Saved baseline, not a running child | Yes | Yes | Depends on snapshot type/support | Save a reusable checkpoint for later. |
| Restore from snapshot | New sandbox | Uses saved snapshot | Yes, from the snapshot point | Depends on snapshot type/support | Recreate a known baseline later. |

#### Practical distinction

| If you want to... | Use... | Reason |
| --- | --- | --- |
| Come back to the same sandbox with files still present | Stop/start | The identity stays the same and filesystem state persists. |
| Freeze live runtime state | Pause | Runtime/process state is the point of the operation. |
| Create independent children right now | Fork | Each child starts from the current sandbox state and then diverges. |
| Save a baseline for future creation | Snapshot | The result is reusable later, but it is not itself an active child. |
| Create a new sandbox from a saved baseline | Restore from snapshot | The new sandbox starts from the saved checkpoint, not from the original sandbox identity. |

The conservative wording for the coupon demo is:

> Stopping lets you return to the same sandbox. Pausing freezes live runtime
> state. Snapshotting saves a reusable baseline. Forking creates a new
> independent future from the current state.

This keeps the guide precise: filesystem state is not the same as process
memory, a reusable snapshot is not the same as an active fork, and a sandbox fork
is not the same thing as a Git branch.
