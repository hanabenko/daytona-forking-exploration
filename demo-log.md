# Daytona Forking Demo Log

Date: 2026-06-26

## Goal

Run a short Daytona forking demo and write down the actions/results in markdown
files.

## Documentation Checked

I used Daytona's current docs generated on 2026-06-23.

Relevant fork semantics from the docs:

- A sandbox must be in `started` state before forking.
- Forking duplicates the sandbox filesystem and memory into a new independent
  sandbox.
- Daytona tracks parent-child relationships in a fork tree.
- Forks can themselves be forked.
- A parent sandbox cannot be deleted while it has active fork children.

Relevant Python SDK call:

```python
forked = sandbox._experimental_fork(name="my-forked-sandbox")
```

Relevant REST endpoint:

```bash
curl 'https://app.daytona.io/api/sandbox/{sandboxIdOrName}/fork' \
  --request POST \
  --header 'X-Daytona-Organization-ID: YOUR_ORGANIZATION_ID' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{"name": "my-forked-sandbox"}'
```

## Local Environment Findings

Workspace:

```text
/Users/hana/Documents/Code/daytona-forking-exploration
```

Initial repo state:

```text
empty directory, not a git repository
```

Daytona CLI on `PATH`:

```text
not found
```

Daytona config locations checked:

```text
/Users/hana/.daytona: not found
/Users/hana/.config/daytona: not found
```

Credential environment variables:

```text
DAYTONA_API_KEY was not present
DAYTONA_JWT_TOKEN was not present
DAYTONA_ORGANIZATION_ID was not present
```

Python SDK:

```text
ModuleNotFoundError: No module named 'daytona'
```

## CLI Preflight

Downloaded the current Apple Silicon CLI binary:

```bash
curl -fL https://github.com/daytonaio/daytona/releases/latest/download/daytona-darwin-arm64 -o /tmp/daytona
chmod +x /tmp/daytona
```

Verified version:

```text
Daytona CLI version v0.190.0
```

Verified command surface:

```text
create, exec, info, list, pause, preview-url, snapshot, ssh, start, stop, volume
```

The first `list` attempt failed because the sandbox blocked writes to the normal
macOS config directory:

```text
mkdir /Users/hana/Library/Application Support/daytona: operation not permitted
```

Then I used a workspace-local `HOME`:

```bash
mkdir -p .daytona-home
env HOME=/Users/hana/Documents/Code/daytona-forking-exploration/.daytona-home /tmp/daytona list --format json
```

Result:

```text
no profiles found. Run `daytona login` to authenticate
```

## Live Demo Status

The live Daytona create/fork run is blocked in this session by missing Daytona
authentication. The demo script in this repo is ready to run once
`DAYTONA_API_KEY` or a Daytona CLI profile is available.

## Demo Chosen

I used the smallest demo that still makes forking obvious:

- Parent sandbox starts a Python HTTP server with in-memory state.
- Parent warms the state.
- Daytona forks the started parent into three children.
- Each child mutates the copied in-memory server state differently.
- One child is forked again.
- The markdown report shows that every branch started from the same live state
  and then diverged independently.

This specifically demonstrates:

- Running state preservation.
- Copy-on-write branching.
- Parent/child fork tree.
- Forking a fork.
- Why recreating containers is weaker: recreating a container would restart the
  process and lose the already-warmed in-memory state.

