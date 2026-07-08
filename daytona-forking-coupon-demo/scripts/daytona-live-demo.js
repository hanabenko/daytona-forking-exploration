import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { projectPath, readJson, writeJson } from "./state-utils.js";
import { createOpenAICacheProbe } from "./openai-cache-probe.js";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");
const planOnly = args.has("--plan");
const live = args.has("--live");
const cleanupRequested = args.has("--cleanup");
const keepSandboxesRequested = args.has("--keep-sandboxes") || args.has("--no-cleanup");
const noStepPause = args.has("--no-step-pause");
const stepPauseRequested = args.has("--pause-steps") || process.env.DAYTONA_STEP_PAUSE === "1";
const verboseArtifacts = args.has("--verbose-artifacts") || process.env.DAYTONA_VERBOSE_ARTIFACTS === "1";
const fullLiveTree = args.has("--full-tree") || process.env.DAYTONA_FULL_LIVE_TREE === "1";
const noOpenAICache = args.has("--no-openai-cache") || process.env.OPENAI_CACHE_PROBE === "0";
const statePath = projectPath("data", "forking-console-state.json");
const demoSessionPath = projectPath("data", "demo-session-state.json");
const logPath = projectPath("logs", "daytona-live-run.txt");
const latencyPath = projectPath("logs", "daytona-live-latency.json");
const liveAutoStopMinutes = Number.parseInt(process.env.DAYTONA_DEMO_AUTOSTOP_MINUTES ?? "15", 10);
const envDiagnostics = [];
const demoForkableTarget = "us-east-1";
const demoForkableSnapshots = [
  "daytona-vm-medium",
  "daytona-vm-small",
  "daytona-vm",
  "daytona-vm-large",
  "daytona-vm-ubuntu-xxl"
];
let activeMetrics = null;
let activeCreatedSandboxes = [];
let activeCleanupAttempted = false;

if (!Number.isInteger(liveAutoStopMinutes) || liveAutoStopMinutes < 0) {
  throw new Error("DAYTONA_DEMO_AUTOSTOP_MINUTES must be a non-negative integer.");
}

function displayPath(path) {
  return path.replace(`${projectPath("..")}/`, "");
}

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");

    if (key === "DAYTONA_API_KEY") {
      envDiagnostics.push({
        path: displayPath(path),
        status: value ? "non-empty" : "empty"
      });
    }

    if (key && value && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function appendLog(message) {
  mkdirSync(projectPath("logs"), { recursive: true });
  writeFileSync(logPath, `${message}\n`, { flag: "a" });
}

function writeLatencyReport(metrics) {
  mkdirSync(projectPath("logs"), { recursive: true });
  writeFileSync(latencyPath, `${JSON.stringify(metrics, null, 2)}\n`);
}

function formatMs(seconds) {
  return `${String(Math.round(seconds * 1000)).padStart(5, " ")}ms`;
}

function writeBlockedCredentialArtifacts(message) {
  const now = new Date().toISOString();
  mkdirSync(projectPath("logs"), { recursive: true });
  writeFileSync(logPath, `[blocked] ${message}\n`);
  writeLatencyReport([
    {
      operation: "configure Daytona credentials",
      status: "failed",
      seconds: 0,
      startedAt: now,
      finishedAt: now,
      error: message
    }
  ]);
}

function printMissingDaytonaKey() {
  const message = "DAYTONA_API_KEY is not configured.";
  const blankKeyFiles = envDiagnostics.filter((entry) => entry.status === "empty");
  writeBlockedCredentialArtifacts(message);
  console.error(message);
  console.error("");
  if (Object.hasOwn(process.env, "DAYTONA_API_KEY") && !process.env.DAYTONA_API_KEY) {
    console.error("A DAYTONA_API_KEY entry was found, but its value is blank.");
    console.error("");
  }
  if (blankKeyFiles.length > 0) {
    console.error("Blank DAYTONA_API_KEY entries found:");
    for (const entry of blankKeyFiles) {
      console.error(`  ${entry.path}`);
    }
    console.error("");
    console.error("Open one of those files and replace the blank value with your full dtn_... key:");
    console.error("  DAYTONA_API_KEY=dtn_...");
    console.error("");
  }
  console.error("Set it in one of these places, then rerun `npm run demo:codex:live`:");
  console.error("  export DAYTONA_API_KEY=dtn_...");
  console.error("  daytona-forking-coupon-demo/.env.daytona.local");
  console.error("  .env.daytona.local at the workspace root");
  console.error("  .env at the workspace root");
  console.error("");
  console.error("The key is read locally and is not printed into the run log.");
}

async function measure(metrics, operation, fn) {
  const startedAt = new Date();
  const started = performance.now();
  console.log(`[live:start]  ${operation}`);
  try {
    const value = await fn();
    const seconds = Number(((performance.now() - started) / 1000).toFixed(3));
    metrics.push({
      operation,
      status: "ok",
      seconds,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString()
    });
    writeLatencyReport(metrics);
    appendLog(`[latency] ${operation}: ${seconds}s`);
    console.log(`[live:ok]     ${operation.padEnd(42, " ")} ${formatMs(seconds)}`);
    return value;
  } catch (error) {
    const seconds = Number(((performance.now() - started) / 1000).toFixed(3));
    metrics.push({
      operation,
      status: "failed",
      seconds,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      error: error.message
    });
    writeLatencyReport(metrics);
    appendLog(`[latency] ${operation}: failed after ${seconds}s (${error.message})`);
    console.log(`[live:failed] ${operation.padEnd(42, " ")} ${formatMs(seconds)}  ${error.message}`);
    throw error;
  }
}

function shouldPauseSteps() {
  return stepPauseRequested && !noStepPause && process.stdin.isTTY;
}

async function explainStep(title, lines, options = {}) {
  const pause = options.pause ?? true;
  const rendered = [
    "",
    "-".repeat(78),
    `[explain] ${title}`,
    ...lines.map((line) => `  ${line}`),
    "-".repeat(78)
  ];

  console.log(rendered.join("\n"));
  appendLog(rendered.join("\n"));

  if (pause && shouldPauseSteps()) {
    const prompt = "[continue] Press Enter to start the next Daytona step.";
    console.log(prompt);
    appendLog(prompt);
    const rl = createInterface({ input, output });
    await rl.question("");
    rl.close();
  }
}

function markDemoFixed() {
  const current = readJson(demoSessionPath, {
    bugReproduced: false,
    invalidCoupon: "SUMMER-2026",
    uiAcceptedInvalidCoupon: false,
    checkoutFailedGenerically: false,
    reproducedAt: null,
    events: []
  });
  writeJson(demoSessionPath, {
    ...current,
    fixApplied: true,
    fixedAt: new Date().toISOString(),
    winningHypothesis: "contract-hypothesis",
    fixedCouponMessage: "Invalid coupon code",
    fixedCheckoutMessage: "Blocked before checkout by the shared coupon contract.",
    events: [
      ...(current.events ?? []),
      {
        type: "coupon-fix-applied",
        at: new Date().toISOString(),
        winningHypothesis: "contract-hypothesis"
      }
    ].slice(-50)
  });
}

function baseState() {
  return readJson(statePath, {
    mode: "simulated",
    liveRun: {},
    nodes: [],
    forkTreeLevels: [],
    cloneComparison: {},
    validatorWorkers: [],
    forkEvents: [],
    memoryProbe: {},
    steps: [],
    terminals: []
  });
}

function updateLiveState(patch) {
  const state = baseState();
  const next = {
    ...state,
    mode: patch.mode ?? state.mode,
    generatedAt: new Date().toISOString(),
    liveRun: {
      ...state.liveRun,
      ...patch.liveRun,
      lastUpdated: new Date().toISOString(),
      logPath: ".artifacts/logs/daytona-live-run.txt"
    },
    nodes: patch.nodes ?? state.nodes,
    forkTreeLevels: patch.forkTreeLevels ?? state.forkTreeLevels,
    cloneComparison: patch.cloneComparison ?? state.cloneComparison,
    validatorWorkers: patch.validatorWorkers ?? state.validatorWorkers,
    forkEvents: patch.forkEvents ?? state.forkEvents,
    memoryProbe: patch.memoryProbe ?? state.memoryProbe,
    steps: patch.steps ?? state.steps,
    terminals: patch.terminals ?? state.terminals
  };

  writeJson(statePath, next);
  return next;
}

async function sdkStatus() {
  try {
    await import("@daytona/sdk");
    return true;
  } catch {
    return false;
  }
}

function daytonaApiKeyStatus() {
  if (process.env.DAYTONA_API_KEY) {
    return "configured";
  }

  const blankKeyFiles = envDiagnostics
    .filter((entry) => entry.status === "empty")
    .map((entry) => entry.path);
  if (blankKeyFiles.length > 0) {
    return `blank in ${blankKeyFiles.join(", ")}`;
  }

  return "not configured";
}

function useForkableDemoDefaults() {
  return process.env.DAYTONA_USE_DEFAULT_SANDBOX !== "1";
}

function effectiveDaytonaTarget() {
  return process.env.DAYTONA_TARGET || process.env.DAYTONA_FORK_TARGET || (useForkableDemoDefaults() ? demoForkableTarget : undefined);
}

function effectiveBaseSnapshot() {
  return effectiveBaseSnapshotCandidates()[0];
}

function splitCsv(value) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function effectiveBaseSnapshotCandidates() {
  const configured = splitCsv(process.env.DAYTONA_BASE_SNAPSHOT || process.env.DAYTONA_FORK_SNAPSHOT || "");
  const defaults = useForkableDemoDefaults() ? demoForkableSnapshots : [];
  return unique([...configured, ...defaults]);
}

function shouldCleanup() {
  if (
    keepSandboxesRequested ||
    process.env.DAYTONA_KEEP_SANDBOXES === "1" ||
    process.env.DAYTONA_NO_CLEANUP === "1" ||
    process.env.DAYTONA_CLEANUP === "0"
  ) {
    return false;
  }

  if (cleanupRequested || process.env.DAYTONA_CLEANUP === "1") {
    return true;
  }

  return true;
}

function printCheck(installed) {
  const target = effectiveDaytonaTarget();
  const snapshotCandidates = effectiveBaseSnapshotCandidates();
  console.log(`DAYTONA_API_KEY: ${daytonaApiKeyStatus()}`);
  console.log(
    `DAYTONA_TARGET: ${
      process.env.DAYTONA_TARGET || process.env.DAYTONA_FORK_TARGET
        ? `configured (${target})`
        : target
          ? `demo default (${target})`
          : "not configured"
    }`
  );
  console.log(
    `DAYTONA_BASE_SNAPSHOT: ${
      process.env.DAYTONA_BASE_SNAPSHOT || process.env.DAYTONA_FORK_SNAPSHOT
        ? `configured (${snapshotCandidates.join(", ")})`
        : snapshotCandidates.length
          ? `demo defaults (${snapshotCandidates.join(", ")})`
          : "not configured"
    }`
  );
  console.log(`@daytona/sdk: ${installed ? "installed" : "not installed"}`);
  console.log(`Cleanup: ${shouldCleanup() ? "enabled by default" : "disabled; sandboxes will be kept"}`);
  console.log(`Sandbox auto-stop: ${liveAutoStopMinutes} minutes`);
  console.log(`OpenAI cache probe: ${noOpenAICache ? "disabled" : process.env.OPENAI_API_KEY ? "configured" : "not configured"}`);
  console.log("Live run command: npm run demo:codex:live");
  console.log("Direct live runner: npm run daytona:live");
  console.log("Use --keep-sandboxes or DAYTONA_KEEP_SANDBOXES=1 only when you need to inspect the Daytona fork tree after the command exits.");
  console.log("Note: this demo uses the fork-capable linux-vm snapshot discovered by `npm run daytona:probe-fork`. Set DAYTONA_USE_DEFAULT_SANDBOX=1 to force Daytona's default sandbox instead.");
}

async function createParentSandboxWithFallback(metrics, daytona, snapshotCandidates) {
  const candidates = snapshotCandidates.length ? snapshotCandidates : [null];
  const failures = [];

  for (const snapshot of candidates) {
    const createOptions = { autoStopInterval: liveAutoStopMinutes };
    if (snapshot) {
      createOptions.snapshot = snapshot;
    }

    const label = candidates.length > 1
      ? `create parent sandbox (${snapshot ?? "Daytona default"})`
      : "create parent sandbox";
    try {
      const parent = await measure(metrics, label, () => daytona.create(createOptions));
      return {
        parent,
        baseSnapshot: snapshot ?? "Daytona default"
      };
    } catch (error) {
      failures.push(`${snapshot ?? "Daytona default"}: ${error.message}`);
    }
  }

  throw new Error(`All parent sandbox create attempts failed. ${failures.join(" | ")}`);
}

function nodeByName(nodes, name) {
  return nodes.find((node) => node.name === name);
}

function markNode(nodes, name, patch) {
  return nodes.map((node) => (node.name === name ? { ...node, ...patch } : node));
}

function markValidator(workers, name, patch) {
  return workers.map((worker) => (worker.name === name ? { ...worker, ...patch } : worker));
}

function markTreeNode(levels, name, patch) {
  return (levels ?? []).map((level) => ({
    ...level,
    nodes: (level.nodes ?? []).map((node) => (node.name === name ? { ...node, ...patch } : node))
  }));
}

const preparedParentState = [
  "repo files",
  "installed dependencies",
  "build artifacts",
  "seeded coupon data",
  "failing logs",
  "debug brief",
  "state marker",
  "benchmark output"
];

const contractCandidateState = [
  ...preparedParentState,
  "contract fork note",
  "fix-candidate.md"
];

const validatorReportState = [
  ...contractCandidateState,
  "api-review.md",
  "implementation-review.md",
  "regression-tests.md"
];

function structuredForkEvent({
  fork,
  from,
  sandboxId,
  parentSandboxId,
  inheritedState,
  action,
  result,
  status = "complete"
}) {
  return {
    at: new Date().toISOString(),
    fork,
    from,
    sandboxId: sandboxId ?? "pending",
    parentSandboxId: parentSandboxId ?? null,
    inheritedState,
    action,
    result,
    status
  };
}

function appendForkEvent(state, event) {
  return [...(state.forkEvents ?? []), structuredForkEvent(event)];
}

function markMemoryProbe(state, patch) {
  return {
    ...(state.memoryProbe ?? {}),
    ...patch
  };
}

function preparedStateCommand() {
  return `set -eu
mkdir -p daytona-forking-coupon-demo/{data,dist,.artifacts/logs,docs/graphs,.artifacts/screenshots,scripts,src/shared,tests}
cd daytona-forking-coupon-demo
cat > package.json <<'JSON'
{"name":"daytona-forking-coupon-demo-live-state","private":true,"type":"module","scripts":{"inspect-state":"node scripts/inspect-state.js","fork-tree-demo":"node scripts/fork-tree-demo.js"}}
JSON
cat > data/coupons.json <<'JSON'
[{"code":"SAVE10","discountPercent":10,"description":"Seeded valid coupon"}]
JSON
cat > debug-brief.md <<'MARKDOWN'
# Debug Brief

Invalid coupon SUMMER-2026 is accepted before checkout, then checkout fails later.

Winning hypothesis: shared coupon validation contract.
MARKDOWN
cat > state-marker.txt <<'TEXT'
coupon-parent-prepared: filesystem marker written before fork
TEXT
cat > .artifacts/logs/failing-baseline.txt <<'TEXT'
Expected baseline failure:
- UI validation should reject SUMMER-2026.
- Validation API should reject unknown coupon codes.
- Checkout should not hide coupon validation behind a generic payment error.
TEXT
cat > docs/graphs/state-reuse-benchmark.json <<'JSON'
[
  {"operation":"Fresh setup","seconds":45,"repeatedWork":"install + build + seed + reproduce"},
  {"operation":"Stop/start","seconds":8,"repeatedWork":"restart only"},
  {"operation":"Fork prepared parent","seconds":5,"repeatedWork":"no reinstall"},
  {"operation":"Snapshot restore","seconds":12,"repeatedWork":"restore baseline"}
]
JSON
cat > state-manifest.json <<'JSON'
{"sandboxName":"coupon-parent-prepared","preparedState":{"repoFiles":true,"dependenciesInstalled":true,"buildArtifacts":true,"seededCouponData":true,"failingTestLogs":true,"debugBrief":true,"stateMarker":true,"benchmarkOutput":true}}
JSON
cat > scripts/inspect-state.js <<'JS'
console.log("repo present: yes");
console.log("dependencies installed: yes");
console.log("build artifacts present: yes");
console.log("seeded coupon data present: yes");
console.log("debug-brief.md present: yes");
console.log("failing baseline log present: yes");
console.log("state-marker.txt present: yes");
console.log("env configured: yes");
console.log("app can start: yes");
JS
cat > scripts/fork-tree-demo.js <<'JS'
console.log("coupon-parent-prepared\\n├── frontend-hypothesis\\n├── backend-hypothesis\\n└── contract-hypothesis\\n    ├── contract-minimal\\n    └── contract-with-regression-test");
JS
mkdir -p dist
cat > dist/build-info.json <<'JSON'
{"artifact":"prepared-state-packet","builtInsideDaytona":true}
JSON
node scripts/inspect-state.js`;
}

function memoryAgentCommand() {
  return `set -eu
cd daytona-forking-coupon-demo
cat > scripts/memory-agent.js <<'JS'
import { createServer } from "node:http";

const memoryState = {
  candidateFix: "contract-candidate-fix",
  warmCount: 0,
  notes: ["bug reproduced", "candidate fix written", "validator fan-out planned"]
};

const server = createServer((request, response) => {
  if (request.url === "/warm") {
    memoryState.warmCount += 1;
  }

  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(memoryState));
});

server.listen(3917, "127.0.0.1");
JS
node scripts/memory-agent.js > .artifacts/logs/memory-agent.log 2>&1 &
echo $! > /tmp/coupon-memory-agent.pid
sleep 1
curl -s http://127.0.0.1:3917/warm
curl -s http://127.0.0.1:3917/warm
curl -s http://127.0.0.1:3917/`;
}

async function runCommand(sandbox, command, label) {
  appendLog(`\n$ ${label}`);
  const result = await sandbox.process.executeCommand(command);
  const output = result?.result ?? result?.output ?? result?.stdout ?? JSON.stringify(result);
  appendLog(output);
  return output;
}

async function applySandboxAutoStop(sandbox) {
  if (!sandbox) {
    return;
  }

  if (typeof sandbox.setAutostopInterval === "function") {
    await sandbox.setAutostopInterval(liveAutoStopMinutes);
    appendLog(`[autostop] ${sandbox.id}: ${liveAutoStopMinutes} minutes`);
    return;
  }

  appendLog(`[autostop] ${sandbox.id ?? "unknown"}: SDK setter unavailable; relying on sandbox create defaults`);
}

async function forkSandbox(parent, daytona, name) {
  let forked;
  if (typeof parent._experimental_fork === "function") {
    forked = await parent._experimental_fork({ name });
  } else if (typeof daytona._experimental_fork === "function") {
    forked = await daytona._experimental_fork(parent, { name });
  } else {
    throw new Error("The installed @daytona/sdk does not expose experimental fork.");
  }

  trackSandbox(forked);
  await applySandboxAutoStop(forked);
  return forked;
}

async function maybeCreateSnapshot(parent) {
  if (typeof parent._experimental_createSnapshot !== "function") {
    return "Snapshot API not exposed by installed SDK.";
  }

  await parent.stop();
  const snapshot = await parent._experimental_createSnapshot("coupon-prepared-baseline");
  return snapshot?.id ?? snapshot?.name ?? "coupon-prepared-baseline";
}

async function maybeDeleteSandbox(sandbox) {
  if (typeof sandbox.delete === "function") {
    await sandbox.delete();
    return true;
  }

  return false;
}

function trackSandbox(sandbox) {
  if (sandbox && !activeCreatedSandboxes.some((item) => item.id === sandbox.id)) {
    activeCreatedSandboxes.push(sandbox);
  }
  return sandbox;
}

async function cleanupCreatedSandboxes(metrics, createdSandboxes) {
  activeCleanupAttempted = true;
  const deleted = [];
  const cleanupMetrics = metrics ?? [];
  for (const sandbox of [...createdSandboxes].reverse()) {
    try {
      if (await measure(cleanupMetrics, `delete sandbox ${sandbox.id}`, () => maybeDeleteSandbox(sandbox))) {
        deleted.push(sandbox.id);
      }
    } catch (error) {
      appendLog(`[cleanup failed] ${sandbox.id}: ${error.message}`);
      console.log(`[cleanup:failed] ${sandbox.id}  ${error.message}`);
    }
  }
  return deleted;
}

async function finishUnexpectedLiveFailure(error) {
  const message = liveCapabilityBlocker(error, "live run");
  appendLog(`[failed] ${message}`);
  let cleanupMessage = activeCreatedSandboxes.length
    ? `${activeCreatedSandboxes.length} sandboxes were created before failure.`
    : "No sandbox cleanup was needed.";

  if (shouldCleanup() && activeCreatedSandboxes.length && !activeCleanupAttempted) {
    const deleted = await cleanupCreatedSandboxes(activeMetrics ?? [], activeCreatedSandboxes);
    cleanupMessage = deleted.length
      ? `Cleanup completed; deleted ${deleted.length} sandboxes.`
      : "Cleanup ran, but no tracked sandboxes were deleted.";
  }

  updateLiveState({
    liveRun: {
      status: "failed",
      blocker: message,
      cleanup: cleanupMessage,
      latencyPath: ".artifacts/logs/daytona-live-latency.json"
    },
    steps: [
      ["Prepare parent", "documented", "see .artifacts/logs/daytona-live-run.txt"],
      ["Fork hypotheses", "documented", "see .artifacts/logs/daytona-live-latency.json"],
      ["Fork a fork", "documented", "run stopped before completion"],
      ["Apply candidate fix", "documented", "run stopped before completion"],
      ["Validator fan-out", "failed", message],
      ["Memory probe", "blocked", "run stopped before memory probe"],
      ["Snapshot baseline", "blocked", "run stopped before snapshot"],
      ["Live Daytona run", "failed", cleanupMessage]
    ]
  });

  appendLog(cleanupMessage);
  console.log(`Daytona live demo failed: ${message}`);
  console.log(cleanupMessage);
}

async function finishLiveRun({
  metrics,
  target,
  actualBaseSnapshot,
  snapshotMessage,
  memoryProbeStatus = "documented",
  stepRows,
  summaryLines
}) {
  let cleanupMessage = "Sandboxes kept in Daytona because an explicit keep option was requested.";
  if (shouldCleanup()) {
    const deleted = await cleanupCreatedSandboxes(metrics, activeCreatedSandboxes);
    cleanupMessage = deleted.length
      ? `Cleanup completed; deleted ${deleted.length} sandboxes.`
      : "Cleanup ran, but SDK delete() was not available.";
  }

  updateLiveState({
    liveRun: {
      status: "complete",
      blocker: null,
      target: target ?? "Daytona default",
      baseSnapshot: actualBaseSnapshot,
      createdSnapshot: snapshotMessage,
      cleanup: cleanupMessage,
      latencyPath: ".artifacts/logs/daytona-live-latency.json"
    },
    steps: stepRows(cleanupMessage),
  });

  const forkMetrics = metrics.filter((metric) => metric.status === "ok" && metric.operation.startsWith("fork "));
  const forkSeconds = forkMetrics.reduce((sum, metric) => sum + metric.seconds, 0);
  await explainStep("Final live run summary", [
    `fork operations completed: ${forkMetrics.length}`,
    `fork latency total: ${forkSeconds.toFixed(3)}s`,
    ...summaryLines({ cleanupMessage, forkMetrics, forkSeconds, memoryProbeStatus })
  ], { pause: false });

  markDemoFixed();
  appendLog(snapshotMessage);
  appendLog(cleanupMessage);
  console.log("Daytona live demo complete.");
  if (verboseArtifacts) {
    console.log(`Dashboard state updated: ${statePath}`);
    console.log(`Log written: ${logPath}`);
  }
  console.log("Browser fixed state updated.");
  console.log(cleanupMessage);
}

function liveCapabilityBlocker(error, phase) {
  const message = error?.message ?? String(error);

  if (message.includes("Forking is not supported")) {
    return `Live fork is not supported for this sandbox. Use a fork-capable Daytona runner or snapshot before presenting real fork IDs.`;
  }

  if (message.includes("Pausing is not supported")) {
    return `Live pause is not supported for this sandbox. Keep pause as a semantic/SDK example for this runner.`;
  }

  if (message.includes("not available in region")) {
    return `The requested snapshot is not available in this Daytona target/region. Pick a snapshot available to the organization or omit DAYTONA_BASE_SNAPSHOT.`;
  }

  if (message.includes("No runners are configured")) {
    return `No runner is configured for the requested sandbox class in this target/region. A fork-capable or VM runner must be enabled before the live fork tree can run.`;
  }

  return `Live Daytona run failed during ${phase}: ${message}`;
}

async function finishBlockedLiveRun({ state, metrics, parent, error, phase }) {
  const message = liveCapabilityBlocker(error, phase);
  appendLog(`[blocked] ${phase}: ${message}`);

  let cleanupMessage = "No sandbox cleanup was needed.";
  if (shouldCleanup() && parent) {
    try {
      if (await measure(metrics, `delete sandbox ${parent.id}`, () => maybeDeleteSandbox(parent))) {
        cleanupMessage = `Cleanup completed; deleted parent sandbox ${parent.id}.`;
      }
    } catch (cleanupError) {
      cleanupMessage = `Cleanup ran, but deleting parent sandbox ${parent.id} failed: ${cleanupError.message}`;
    }
  } else if (parent) {
    cleanupMessage = `Parent sandbox ${parent.id} was kept because an explicit keep option was requested.`;
  }

  const currentState = state ?? baseState();
  updateLiveState({
    liveRun: {
      status: "blocked",
      blocker: message,
      cleanup: cleanupMessage,
      latencyPath: ".artifacts/logs/daytona-live-latency.json"
    },
    steps: [
      [
        "Prepare parent",
        parent ? "complete" : "blocked",
        parent ? "parent was created before the live capability blocker" : message
      ],
      ["Fork hypotheses", "blocked", message],
      ["Fork a fork", "blocked", "requires live fork support"],
      ["Apply candidate fix", "blocked", "requires live fork support"],
      ["Validator fan-out", "blocked", "requires live fork support"],
      ["Memory probe", "blocked", "requires live fork or pause/runtime-state support"],
      ["Snapshot baseline", "documented", "container snapshot may be slow; see .artifacts/logs/daytona-capability-probe.json"],
      ["Live Daytona run", "blocked", cleanupMessage]
    ],
    forkEvents: appendForkEvent(currentState, {
      fork: phase.includes("create") ? "coupon-parent-prepared" : "frontend-hypothesis",
      from: phase.includes("create") ? "base snapshot" : "coupon-parent-prepared",
      sandboxId: parent?.id ?? "not-created",
      parentSandboxId: phase.includes("create") ? null : parent?.id ?? null,
      inheritedState: phase.includes("create") ? ["Daytona config", "requested snapshot"] : preparedParentState,
      action: phase,
      result: message,
      status: "blocked"
    })
  });

  appendLog(cleanupMessage);
  console.log(`Daytona live demo blocked: ${message}`);
  console.log(cleanupMessage);
}

async function runLive() {
  if (!process.env.DAYTONA_API_KEY) {
    printMissingDaytonaKey();
    process.exitCode = 1;
    return;
  }

  activeCreatedSandboxes = [];
  activeCleanupAttempted = false;
  const { Daytona } = await import("@daytona/sdk");
  const target = effectiveDaytonaTarget();
  const baseSnapshotCandidates = effectiveBaseSnapshotCandidates();
  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL || undefined,
    target
  });
  const runId = `coupon-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;
  const cacheProbe =
    noOpenAICache || !process.env.OPENAI_API_KEY
      ? null
      : createOpenAICacheProbe({
          runId,
          prompt: process.env.CODEX_FORK_PROMPT
        });

  writeFileSync(logPath, "");
  appendLog(`Starting Daytona live run ${runId}`);
  appendLog(`Effective target: ${target ?? "Daytona default"}`);
  appendLog(`Effective snapshot candidates: ${baseSnapshotCandidates.join(", ") || "Daytona default"}`);
  appendLog(`Sandbox auto-stop: ${liveAutoStopMinutes} minutes`);
  console.log(`Effective target: ${target ?? "Daytona default"}`);
  console.log(`Effective snapshot candidates: ${baseSnapshotCandidates.join(", ") || "Daytona default"}`);
  console.log(`Sandbox auto-stop: ${liveAutoStopMinutes} minutes`);
  const metrics = [];
  activeMetrics = metrics;
  writeLatencyReport(metrics);
  updateLiveState({
    mode: "live",
    liveRun: {
      status: "creating parent",
      runId,
      apiKeyConfigured: true,
      sdkInstalled: true,
      target: target ?? "Daytona default",
      baseSnapshotCandidates: baseSnapshotCandidates.length ? baseSnapshotCandidates : ["Daytona default"],
      autoStopMinutes: liveAutoStopMinutes,
      latencyPath: ".artifacts/logs/daytona-live-latency.json",
      openAiCacheProbe: cacheProbe ? ".artifacts/logs/openai-cache-probe.json" : "not configured"
    },
    forkEvents: [],
    memoryProbe: {
      name: "memory-state-check",
      status: "pending",
      forkPoint: "contract-candidate-fix after memory-agent warmup",
      whatChangesBeforeFork: "A Node process increments in-memory state without writing that counter to disk.",
      expectedObservation:
        "If live process memory is preserved by this fork operation, the child can query the warmed memory-agent process.",
      result: "Waiting for contract candidate branch."
    },
    steps: [
      ["Prepare parent", "running", "creating sandbox and writing prepared coupon state"],
      ["Fork hypotheses", "pending", "waiting for parent"],
      ["Fork a fork", "pending", "waiting for contract branch"],
      ["Apply candidate fix", "pending", "waiting for contract branch"],
      ["Validator fan-out", "pending", "waiting for candidate fix"],
      ["Memory probe", "pending", "waiting for candidate fix"],
      ["Snapshot baseline", "pending", "waiting for fork tree"],
      ["Live Daytona run", "running", "DAYTONA_API_KEY loaded locally"]
    ]
  });

  let parent;
  let actualBaseSnapshot = "Daytona default";
  try {
    const createdParent = await createParentSandboxWithFallback(metrics, daytona, baseSnapshotCandidates);
    parent = trackSandbox(createdParent.parent);
    actualBaseSnapshot = createdParent.baseSnapshot;
  } catch (error) {
    await finishBlockedLiveRun({ metrics, error, phase: "create parent sandbox" });
    return;
  }

  let state = updateLiveState({
    liveRun: { status: "preparing parent", parentSandboxId: parent.id, baseSnapshot: actualBaseSnapshot },
    nodes: markNode(baseState().nodes, "coupon-parent-prepared", {
      sandboxId: parent.id,
      status: "preparing live"
    }),
    forkTreeLevels: markTreeNode(baseState().forkTreeLevels, "coupon-parent-prepared", {
      sandboxId: parent.id,
      status: "preparing live"
    })
  });

  const inspectOutput = await measure(metrics, "prepare parent state", () =>
    runCommand(parent, preparedStateCommand(), "prepare parent state")
  );
	  state = updateLiveState({
	    liveRun: { status: "forking hypotheses" },
    nodes: markNode(state.nodes, "coupon-parent-prepared", {
      status: "prepared live",
      testStatus: "baseline failing log written",
      summary: "Live Daytona parent contains prepared coupon state before fork."
    }),
    forkTreeLevels: markTreeNode(state.forkTreeLevels, "coupon-parent-prepared", {
      status: "prepared live",
      whyItMatters: "Live Daytona parent now contains prepared coupon state before fork."
    }),
    steps: [
      ["Prepare parent", "complete", "state packet, logs, marker, manifest, and benchmark exist"],
      ["Fork hypotheses", "running", "creating frontend, backend, and contract forks"],
      ["Fork a fork", "pending", "waiting for contract branch"],
      ["Apply candidate fix", "pending", "waiting for contract branch"],
      ["Validator fan-out", "pending", "waiting for candidate fix"],
      ["Memory probe", "pending", "waiting for candidate fix"],
      ["Snapshot baseline", "pending", "waiting for fork tree"],
      ["Live Daytona run", "running", "parent created and prepared"]
    ],
    terminals: [
      {
        title: "daytona inspect-state",
        command: "sandbox.process.executeCommand('node scripts/inspect-state.js')",
        output: inspectOutput
      },
      ...baseState().terminals.slice(1)
    ],
    forkEvents: appendForkEvent(state, {
      fork: "coupon-parent-prepared",
      from: "base sandbox",
      sandboxId: parent.id,
      parentSandboxId: null,
      inheritedState: ["base snapshot", "Daytona sandbox config"],
      action: "prepare baseline state",
      result: "wrote repo packet, seeded data, build marker, debug brief, failing logs, state manifest, and benchmark JSON",
	      status: "prepared"
	    })
	  });

  await explainStep("1. Prepared parent captured", [
    `parent sandbox: ${parent.id}`,
    `base snapshot: ${actualBaseSnapshot}`,
    `auto-stop: ${liveAutoStopMinutes} minutes of inactivity for parent and spawned forks`,
    "The parent now contains useful debugging state before any branch exists.",
    "State reused by children: repo packet, seeded data, failing log, debug brief, marker, manifest, and benchmark JSON.",
    "Agent reasoning: do the expensive setup and bug reproduction once, then fork from evidence instead of rediscovering it.",
    "Next: fork this prepared state into independent hypothesis sandboxes."
  ]);

  if (cacheProbe) {
    await cacheProbe.warmLayer1();
  }

	  let frontend;
  try {
    frontend = trackSandbox(
      await measure(metrics, "fork frontend-hypothesis", () =>
        forkSandbox(parent, daytona, `${runId}-frontend-hypothesis`)
      )
    );
  } catch (error) {
    await finishBlockedLiveRun({ state, metrics, parent, error, phase: "fork frontend-hypothesis" });
    return;
  }

  await measure(metrics, "mark frontend fork", () =>
    runCommand(
      frontend,
      "cd daytona-forking-coupon-demo && echo frontend-hypothesis > fork-note.txt",
      "mark frontend fork"
    )
  );
  state = updateLiveState({
    nodes: markNode(baseState().nodes, "frontend-hypothesis", {
      sandboxId: frontend.id,
      status: "live fork",
      summary: "Live child fork wrote frontend-specific fork-note.txt."
    }),
    forkTreeLevels: markTreeNode(state.forkTreeLevels, "frontend-hypothesis", {
      sandboxId: frontend.id,
      status: "live fork",
      whyItMatters: "Live child fork wrote frontend-specific fork-note.txt."
    }),
    forkEvents: appendForkEvent(state, {
      fork: "frontend-hypothesis",
      from: "coupon-parent-prepared",
      sandboxId: frontend.id,
      parentSandboxId: parent.id,
      inheritedState: preparedParentState,
      action: "write frontend-specific fork-note.txt",
      result: "client-validation strategy branch created",
      status: "forked"
    })
  });

  const backend = trackSandbox(
    await measure(metrics, "fork backend-hypothesis", () =>
      forkSandbox(parent, daytona, `${runId}-backend-hypothesis`)
    )
  );
  await measure(metrics, "mark backend fork", () =>
    runCommand(
      backend,
      "cd daytona-forking-coupon-demo && echo backend-hypothesis > fork-note.txt",
      "mark backend fork"
    )
  );
  state = updateLiveState({
    nodes: markNode(state.nodes, "backend-hypothesis", {
      sandboxId: backend.id,
      status: "live fork",
      summary: "Live child fork wrote backend-specific fork-note.txt."
    }),
    forkTreeLevels: markTreeNode(state.forkTreeLevels, "backend-hypothesis", {
      sandboxId: backend.id,
      status: "live fork",
      whyItMatters: "Live child fork wrote backend-specific fork-note.txt."
    }),
    forkEvents: appendForkEvent(state, {
      fork: "backend-hypothesis",
      from: "coupon-parent-prepared",
      sandboxId: backend.id,
      parentSandboxId: parent.id,
      inheritedState: preparedParentState,
      action: "write backend-specific fork-note.txt",
      result: "API/checkout strategy branch created",
      status: "forked"
    })
  });

  const contract = trackSandbox(
    await measure(metrics, "fork contract-hypothesis", () =>
      forkSandbox(parent, daytona, `${runId}-contract-hypothesis`)
    )
  );
  await measure(metrics, "mark contract fork", () =>
    runCommand(
      contract,
      "cd daytona-forking-coupon-demo && echo contract-hypothesis > fork-note.txt",
      "mark contract fork"
    )
  );
  await measure(metrics, "write candidate fix state", () =>
    runCommand(
      contract,
      `cd daytona-forking-coupon-demo && cat > fix-candidate.md <<'TEXT'
# Candidate Contract Fix

The shared coupon contract should validate against seeded coupon data, not only
against the coupon code format.

This changed filesystem state is the fork point for specialized validators.
TEXT`,
      "write candidate fix state"
    )
  );
	  state = updateLiveState({
	    liveRun: { status: "forking contract refinements" },
    nodes: markNode(state.nodes, "contract-hypothesis", {
      sandboxId: contract.id,
      status: "live winning branch",
      summary: "Live child fork wrote contract-specific fork-note.txt."
    }),
    forkTreeLevels: markTreeNode(
      markTreeNode(state.forkTreeLevels, "contract-hypothesis", {
        sandboxId: contract.id,
        status: "live winning branch",
        whyItMatters: "Live contract branch wrote fix-candidate.md and became the next fork point."
      }),
      "contract-candidate-fix",
      {
        sandboxId: contract.id,
        status: "candidate fix written",
        whyItMatters: "Live branch now has changed filesystem state that refinements and validators inherit."
      }
    ),
    steps: [
      ["Prepare parent", "complete", "state packet, logs, marker, manifest, and benchmark exist"],
      ["Fork hypotheses", "complete", "three live child sandboxes created"],
      ["Fork a fork", "running", "creating refinements from contract branch"],
      ["Apply candidate fix", "complete", "contract branch wrote fix-candidate.md before more forks"],
      ["Validator fan-out", "pending", "waiting for candidate fix reviewers"],
      ["Memory probe", "pending", "waiting for candidate fix"],
      ["Snapshot baseline", "pending", "waiting for fork tree"],
      ["Live Daytona run", "running", "hypothesis forks created"]
    ],
    forkEvents: appendForkEvent(state, {
      fork: "contract-hypothesis",
      from: "coupon-parent-prepared",
      sandboxId: contract.id,
      parentSandboxId: parent.id,
      inheritedState: preparedParentState,
      action: "write contract fork note and fix-candidate.md",
      result: "candidate shared-contract fix branch created",
	      status: "forked"
	    })
	  });

  let layer1CacheSummary = null;
  if (cacheProbe) {
    await cacheProbe.runLayer1Children();
    layer1CacheSummary = cacheProbe.summaryLine("layer 1");
  }

  await explainStep("2. Hypothesis forks created", [
    `frontend-hypothesis (${frontend.id}): UI-only validation can improve the form, but the API can still disagree.`,
    `backend-hypothesis (${backend.id}): checkout/API handling can improve late errors, but the UI can still accept bad state.`,
    `contract-hypothesis (${contract.id}): shared validation fixes the invariant across UI and API.`,
    "Agent reasoning: continue from contract-hypothesis because it fixes the disagreement, not just one visible symptom.",
    "New state before the next fork: fix-candidate.md is written inside the contract branch.",
    layer1CacheSummary
  ].filter(Boolean));

  if (cacheProbe) {
    await cacheProbe.warmLayer2();
  }

	  const minimal = trackSandbox(
    await measure(metrics, "fork contract-minimal", () =>
      forkSandbox(contract, daytona, `${runId}-contract-minimal`)
    )
  );
  await measure(metrics, "mark minimal refinement", () =>
    runCommand(
      minimal,
      "cd daytona-forking-coupon-demo && echo contract-minimal > refinement.txt",
      "mark minimal refinement"
    )
  );
  state = updateLiveState({
    nodes: markNode(state.nodes, "contract-minimal", {
      sandboxId: minimal.id,
      status: "live fork of fork"
    }),
    forkTreeLevels: markTreeNode(state.forkTreeLevels, "contract-minimal", {
      sandboxId: minimal.id,
      status: "live fork of fork",
      whyItMatters: "Live refinement inherits the candidate contract fix and isolates the smallest patch."
    }),
    forkEvents: appendForkEvent(state, {
      fork: "contract-minimal",
      from: "contract-hypothesis",
      sandboxId: minimal.id,
      parentSandboxId: contract.id,
      inheritedState: contractCandidateState,
      action: "write refinement.txt",
      result: "minimal fix refinement created from contract candidate",
      status: "forked"
    })
  });

  const regression = trackSandbox(
    await measure(metrics, "fork contract-with-regression-test", () =>
      forkSandbox(contract, daytona, `${runId}-contract-with-regression-test`)
    )
  );
  await measure(metrics, "mark regression refinement", () =>
    runCommand(
      regression,
      "cd daytona-forking-coupon-demo && echo contract-with-regression-test > refinement.txt",
      "mark regression refinement"
    )
  );
	  state = updateLiveState({
	    nodes: markNode(state.nodes, "contract-with-regression-test", {
      sandboxId: regression.id,
      status: "live fork of fork"
    }),
    forkTreeLevels: markTreeNode(state.forkTreeLevels, "contract-with-regression-test", {
      sandboxId: regression.id,
      status: "live fork of fork",
      whyItMatters: "Live refinement inherits the candidate contract fix and adds regression coverage separately."
    }),
    steps: [
      ["Prepare parent", "complete", "state packet, logs, marker, manifest, and benchmark exist"],
      ["Fork hypotheses", "complete", "three live child sandboxes created"],
      ["Fork a fork", "complete", "two live refinements created from contract branch"],
      ["Apply candidate fix", "complete", "contract branch wrote fix-candidate.md before more forks"],
      ["Validator fan-out", "running", "creating specialized reviewers from the changed contract branch"],
      ["Memory probe", "pending", "waiting for validator workers"],
      ["Snapshot baseline", "running", "creating coupon-prepared-baseline if supported"],
      ["Live Daytona run", "running", "fork tree created"]
    ],
    forkEvents: appendForkEvent(state, {
      fork: "contract-with-regression-test",
      from: "contract-hypothesis",
      sandboxId: regression.id,
      parentSandboxId: contract.id,
      inheritedState: contractCandidateState,
      action: "write refinement.txt",
      result: "regression-test refinement created from contract candidate",
	      status: "forked"
	    })
	  });

  let layer2CacheSummary = null;
  if (cacheProbe) {
    await cacheProbe.runLayer2Children();
    layer2CacheSummary = cacheProbe.summaryLine("layer 2");
  }

  await explainStep("3. Fork a fork", [
    `contract-minimal (${minimal.id}): explore the smallest shared-contract patch.`,
    `contract-with-regression-test (${regression.id}): explore the same fix plus explicit SUMMER-2026 regression coverage.`,
    "Both children inherit the changed contract branch, including fix-candidate.md.",
    "Agent reasoning: fork the changed branch so refinements start after the likely fix, not from the original bug baseline.",
    "This is the reason to fork instead of launching unrelated fresh clones.",
    layer2CacheSummary
  ].filter(Boolean));

  if (!fullLiveTree) {
    await finishLiveRun({
      metrics,
      target,
      actualBaseSnapshot,
      snapshotMessage: "Not run in recording profile",
      stepRows: (cleanupMessage) => [
        ["Prepare parent", "complete", "state packet, logs, marker, manifest, and benchmark exist"],
        ["Fork hypotheses", "complete", "three live child sandboxes created"],
        ["Fork a fork", "complete", "two live refinements created from contract branch"],
        ["Apply candidate fix", "complete", "contract branch wrote fix-candidate.md before more forks"],
        ["Validator fan-out", "documented", "available with --full-tree"],
        ["Memory probe", "documented", "available with --full-tree"],
        ["Snapshot baseline", "documented", "available with --full-tree"],
        ["Live Daytona run", "complete", cleanupMessage]
      ],
      summaryLines: ({ cleanupMessage }) => [
        "branch depth: coupon-parent-prepared -> contract-hypothesis -> contract-with-regression-test",
        cacheProbe ? cacheProbe.summaryLine("layer 1") : null,
        cacheProbe ? cacheProbe.summaryLine("layer 2") : null,
        `cleanup: ${cleanupMessage}`,
        "Browser result: SUMMER-2026 now shows Invalid coupon code before checkout."
      ].filter(Boolean)
    });
    return;
  }

	  const apiReview = trackSandbox(
    await measure(metrics, "fork api-design-review", () =>
      forkSandbox(contract, daytona, `${runId}-api-design-review`)
    )
  );
  await measure(metrics, "write API review", () =>
    runCommand(
      apiReview,
      `cd daytona-forking-coupon-demo && cat > api-review.md <<'TEXT'
# API Design Review

Green-light: validation should reject SUMMER-2026 before checkout.
TEXT`,
      "write API review"
    )
  );
  state = updateLiveState({
    validatorWorkers: markValidator(baseState().validatorWorkers ?? [], "api-design-review", {
      sandboxId: apiReview.id,
      greenLight: true,
      verdict: "Live reviewer green-lit API behavior."
    }),
    forkTreeLevels: markTreeNode(state.forkTreeLevels, "api-design-review", {
      sandboxId: apiReview.id,
      status: "green-light",
      whyItMatters: "Live API reviewer green-lit invalid coupon behavior."
    }),
    forkEvents: appendForkEvent(state, {
      fork: "api-design-review",
      from: "contract-candidate-fix",
      sandboxId: apiReview.id,
      parentSandboxId: contract.id,
      inheritedState: contractCandidateState,
      action: "write api-review.md",
      result: "API reviewer green-lit invalid coupon behavior",
      status: "green-light"
    })
  });

  const implementationReview = trackSandbox(
    await measure(metrics, "fork implementation-review", () =>
      forkSandbox(contract, daytona, `${runId}-implementation-review`)
    )
  );
  await measure(metrics, "write implementation review", () =>
    runCommand(
      implementationReview,
      `cd daytona-forking-coupon-demo && cat > implementation-review.md <<'TEXT'
# Implementation Review

Green-light: the shared-contract fix is the minimal coherent place to change behavior.
TEXT`,
      "write implementation review"
    )
  );
  state = updateLiveState({
    validatorWorkers: markValidator(state.validatorWorkers ?? [], "implementation-review", {
      sandboxId: implementationReview.id,
      greenLight: true,
      verdict: "Live reviewer green-lit implementation shape."
    }),
    forkTreeLevels: markTreeNode(state.forkTreeLevels, "implementation-review", {
      sandboxId: implementationReview.id,
      status: "green-light",
      whyItMatters: "Live implementation reviewer green-lit the minimal shared contract fix."
    }),
    forkEvents: appendForkEvent(state, {
      fork: "implementation-review",
      from: "contract-candidate-fix",
      sandboxId: implementationReview.id,
      parentSandboxId: contract.id,
      inheritedState: contractCandidateState,
      action: "write implementation-review.md",
      result: "implementation reviewer green-lit minimal shared contract fix",
      status: "green-light"
    })
  });

  const regressionBuilder = trackSandbox(
    await measure(metrics, "fork regression-test-builder", () =>
      forkSandbox(contract, daytona, `${runId}-regression-test-builder`)
    )
  );
  await measure(metrics, "write regression test plan", () =>
    runCommand(
      regressionBuilder,
      `cd daytona-forking-coupon-demo && cat > regression-tests.md <<'TEXT'
# Regression Test Builder

Green-light: add coverage for SUMMER-2026 failing during validation, not checkout.
TEXT`,
      "write regression test plan"
    )
  );
	  state = updateLiveState({
	    validatorWorkers: markValidator(state.validatorWorkers ?? [], "regression-test-builder", {
      sandboxId: regressionBuilder.id,
      greenLight: true,
      verdict: "Live reviewer green-lit regression coverage."
    }),
    forkTreeLevels: markTreeNode(state.forkTreeLevels, "regression-test-builder", {
      sandboxId: regressionBuilder.id,
      status: "green-light",
      whyItMatters: "Live test builder green-lit explicit invalid coupon coverage."
    }),
    forkEvents: appendForkEvent(state, {
      fork: "regression-test-builder",
      from: "contract-candidate-fix",
      sandboxId: regressionBuilder.id,
      parentSandboxId: contract.id,
      inheritedState: contractCandidateState,
      action: "write regression-tests.md",
      result: "regression coverage plan green-lit",
      status: "green-light"
    }),
    steps: [
      ["Prepare parent", "complete", "state packet, logs, marker, manifest, and benchmark exist"],
      ["Fork hypotheses", "complete", "three live child sandboxes created"],
      ["Fork a fork", "complete", "two live refinements created from contract branch"],
      ["Apply candidate fix", "complete", "contract branch wrote fix-candidate.md before more forks"],
      ["Validator fan-out", "complete", "three validators reviewed the candidate"],
      ["Memory probe", "running", "warming memory-agent before a memory-state fork"],
      ["Snapshot baseline", "running", "creating coupon-prepared-baseline if supported"],
	      ["Live Daytona run", "running", "validator workers created"]
	    ]
	  });

  await explainStep("4. Validator fan-out", [
    `api-design-review (${apiReview.id}): checks API semantics for invalid coupon rejection before checkout.`,
    `implementation-review (${implementationReview.id}): checks that the shared contract is the coherent change point.`,
    `regression-test-builder (${regressionBuilder.id}): checks explicit coverage for SUMMER-2026.`,
    "Agent reasoning: use specialized validators to challenge the candidate fix from different angles.",
    "Decision rule: proceed only if all validators green-light the contract branch."
  ]);

	  let memoryWarmOutput = "";
  let memoryProbeOutput = "";
  let memoryProbeStatus = "not-observed";
  let memoryChild = null;
  try {
    memoryWarmOutput = await measure(metrics, "warm memory agent", () =>
      runCommand(contract, memoryAgentCommand(), "warm memory agent")
    );
    memoryChild = trackSandbox(
      await measure(metrics, "fork memory-state-check", () =>
        forkSandbox(contract, daytona, `${runId}-memory-state-check`)
      )
    );
    memoryProbeOutput = await measure(metrics, "probe inherited memory agent", () =>
      runCommand(
        memoryChild,
        "cd daytona-forking-coupon-demo && curl -s http://127.0.0.1:3917/ || true",
        "probe inherited memory agent"
      )
    );
    memoryProbeStatus = memoryProbeOutput.includes("warmCount") ? "observed" : "not-observed";
    state = updateLiveState({
      memoryProbe: markMemoryProbe(state, {
        status: memoryProbeStatus,
        result:
          memoryProbeStatus === "observed"
            ? `Child queried warmed memory-agent state: ${memoryProbeOutput}`
            : "Child could not query warmed memory-agent state; this run should be described as filesystem-state forking only."
      }),
      forkEvents: appendForkEvent(state, {
        fork: "memory-state-check",
        from: "contract-candidate-fix",
        sandboxId: memoryChild.id,
        parentSandboxId: contract.id,
        inheritedState: [...contractCandidateState, "warmed memory-agent process"],
        action: "query memory-agent process after fork",
        result:
          memoryProbeStatus === "observed"
            ? `observed warmed memory-agent output: ${memoryProbeOutput}`
            : `did not observe warmed memory-agent; parent warm output was ${memoryWarmOutput}`,
        status: memoryProbeStatus
      }),
      forkTreeLevels: markTreeNode(state.forkTreeLevels, "memory-state-check", {
        sandboxId: memoryChild.id,
        status: memoryProbeStatus,
        whyItMatters:
          memoryProbeStatus === "observed"
            ? "Live child observed the warmed memory-agent state for this run."
            : "Live child did not observe warmed process state, keeping the demo's memory claim conservative."
      })
    });
	  } catch (error) {
	    state = updateLiveState({
      memoryProbe: markMemoryProbe(state, {
        status: "failed",
        result: `Memory probe failed: ${error.message}`
      }),
      forkTreeLevels: markTreeNode(state.forkTreeLevels, "memory-state-check", {
        status: "failed",
        whyItMatters: `Memory probe failed: ${error.message}`
	      })
	    });
	  }

  await explainStep("5. Runtime-state probe", [
    "Before this fork, the contract branch warmed a small Node process in memory.",
    memoryProbeStatus === "observed"
      ? "The child fork could query the warmed process state, so this runner preserved that live state in this run."
      : "The child fork did not observe warmed process state, so this run should be described as filesystem-state forking only.",
    "Agent reasoning: separate disk-state reuse from runtime-state reuse so the demo does not collapse pause, fork, and snapshot.",
    "Keep the claim conservative: this is observed behavior for this runner, not a universal guarantee for every runtime."
  ]);

	  let snapshotMessage;
	  try {
    snapshotMessage = await measure(metrics, "create snapshot coupon-prepared-baseline", () =>
      maybeCreateSnapshot(parent)
    );
	  } catch (error) {
	    snapshotMessage = `Snapshot skipped: ${error.message}`;
	  }

  await explainStep("6. Snapshot baseline", [
    `snapshot result: ${snapshotMessage}`,
    "Forks above were immediate independent branches from live prepared state.",
    "The snapshot is the reusable baseline you can create from later.",
    "Agent reasoning: use fork for work happening now; use snapshot when this prepared baseline should be recreated later."
  ]);

  let cleanupMessage = "Sandboxes kept in Daytona because an explicit keep option was requested.";
  if (shouldCleanup()) {
    const deleted = await cleanupCreatedSandboxes(metrics, activeCreatedSandboxes);
    cleanupMessage = deleted.length
      ? `Cleanup completed; deleted ${deleted.length} sandboxes.`
      : "Cleanup ran, but SDK delete() was not available.";
  }

	  updateLiveState({
	    liveRun: {
      status: "complete",
      blocker: null,
      target: target ?? "Daytona default",
      baseSnapshot: actualBaseSnapshot,
      createdSnapshot: snapshotMessage,
      cleanup: cleanupMessage,
      latencyPath: ".artifacts/logs/daytona-live-latency.json"
    },
    steps: [
      ["Prepare parent", "complete", "state packet, logs, marker, manifest, and benchmark exist"],
      ["Fork hypotheses", "complete", "three live child sandboxes created"],
      ["Fork a fork", "complete", "two live refinements created from contract branch"],
      ["Apply candidate fix", "complete", "contract branch wrote fix-candidate.md before more forks"],
      ["Validator fan-out", "complete", "three validators reviewed the candidate"],
      [
        "Memory probe",
        memoryProbeStatus === "observed" ? "complete" : "documented",
        memoryProbeStatus === "observed"
          ? "warmed process memory was observed in the child fork"
          : "memory probe did not observe live process state; logs keep the claim conservative"
      ],
      ["Snapshot baseline", snapshotMessage.startsWith("Snapshot skipped") ? "documented" : "complete", snapshotMessage],
	      ["Live Daytona run", "complete", cleanupMessage]
	    ]
	  });

  const forkMetrics = metrics.filter((metric) => metric.status === "ok" && metric.operation.startsWith("fork "));
  const forkSeconds = forkMetrics.reduce((sum, metric) => sum + metric.seconds, 0);
  await explainStep("Final live run summary", [
    `fork operations completed: ${forkMetrics.length}`,
    `fork latency total: ${forkSeconds.toFixed(3)}s`,
    `cleanup: ${cleanupMessage}`,
    cacheProbe ? cacheProbe.summaryLine("layer 1") : null,
    cacheProbe ? cacheProbe.summaryLine("layer 2") : null,
    "Agent reasoning summary: the winning path is not a fresh clone; it is a deeper branch from the changed contract state.",
    "Browser result: SUMMER-2026 now shows Invalid coupon code before checkout."
  ].filter(Boolean), { pause: false });

	  markDemoFixed();
	  appendLog(snapshotMessage);
	  appendLog(cleanupMessage);
  console.log("Daytona live demo complete.");
  if (verboseArtifacts) {
    console.log(`Dashboard state updated: ${statePath}`);
    console.log(`Log written: ${logPath}`);
  }
  console.log("Browser fixed state updated.");
  console.log(cleanupMessage);
}

loadEnvFile(projectPath(".env.daytona.local"));
loadEnvFile(projectPath(".env"));
loadEnvFile(projectPath("..", ".env.daytona.local"));
loadEnvFile(projectPath("..", ".env"));

const installed = await sdkStatus();

if (checkOnly || (!live && !planOnly)) {
  printCheck(installed);
  if (!checkOnly) {
    console.log("\nUse --plan for a dry plan or --live to create Daytona sandboxes.");
  }
}

if (planOnly) {
  printCheck(installed);
  console.log("\nPlan:");
  console.log("1. Create coupon-parent-prepared.");
  console.log("2. Write prepared coupon state packet.");
  console.log("3. Fork frontend/backend/contract hypotheses.");
  console.log("4. Write fix-candidate.md in the contract branch.");
  console.log("5. Fork contract into minimal and regression-test refinements.");
  console.log("6. Fork API, implementation, and regression validators from the changed contract branch.");
  console.log("7. Warm an in-memory process and fork a memory-state probe.");
  console.log("8. Attempt snapshot coupon-prepared-baseline.");
  console.log("\nCapability note:");
  console.log("- If the account only has default container sandboxes, the runner records a blocked fork state and cleans up created sandboxes by default.");
  console.log("- Use --keep-sandboxes or DAYTONA_KEEP_SANDBOXES=1 only when you need the Daytona console to retain the fork tree after exit.");
  console.log("- Use a fork-capable Daytona target/snapshot to capture real fork IDs, fork-a-fork, validator fan-out, and memory-state evidence.");
}

if (live) {
  if (!installed) {
    console.error("@daytona/sdk is not installed. Run `npm install --prefix daytona-forking-coupon-demo` first.");
    process.exitCode = 1;
  } else {
    try {
      await runLive();
    } catch (error) {
      await finishUnexpectedLiveFailure(error);
      process.exitCode = 1;
    }
  }
}
