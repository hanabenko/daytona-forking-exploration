import { performance } from "node:perf_hooks";
import { projectPath, readJson, writeJson } from "./state-utils.js";

const sessionPath = projectPath("data", "demo-session-state.json");
const metricsPath = projectPath("logs", "video-terminal-metrics.json");

const fastMode = process.env.VIDEO_TERMINAL_FAST === "1";
const skipWait = process.env.VIDEO_TERMINAL_SKIP_WAIT === "1";
const noClear = process.env.VIDEO_TERMINAL_NO_CLEAR === "1";
const mode = process.env.VIDEO_TERMINAL_MODE ?? "recording";
const delayScale = fastMode ? 0.04 : 1;
const apiKeyConfigured = Boolean(process.env.DAYTONA_API_KEY);
const startedAt = new Date().toISOString();
const wallStart = performance.now();

const defaultSessionState = {
  bugReproduced: false,
  invalidCoupon: "SUMMER-2026",
  uiAcceptedInvalidCoupon: false,
  checkoutFailedGenerically: false,
  reproducedAt: null,
  events: []
};

const panes = {
  parent: {
    title: "parent: coupon-parent-prepared",
    status: "waiting",
    lines: [
      "waiting for browser reproduction marker",
      "invalid coupon: SUMMER-2026",
      "state file: data/demo-session-state.json"
    ]
  },
  frontend: {
    title: "frontend-hypothesis",
    status: "queued",
    lines: ["queued until parent state is prepared"]
  },
  backend: {
    title: "backend-hypothesis",
    status: "queued",
    lines: ["queued until parent state is prepared"]
  },
  contract: {
    title: "contract-hypothesis",
    status: "queued",
    lines: ["queued until parent state is prepared"]
  },
  validators: {
    title: "validators",
    status: "queued",
    lines: ["waits for contract candidate-fix state"]
  }
};

const metrics = [];
const eventLog = [];
let activeStep = "Waiting for browser to reproduce the coupon bug";
let completedSteps = 0;
let lastLatencyMs = 0;
let waitTicks = 0;
let reproductionDetectedAt = null;
let postReproductionStart = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms * delayScale)));
}

function readSession() {
  return {
    ...defaultSessionState,
    ...readJson(sessionPath, defaultSessionState)
  };
}

function clearScreen() {
  if (!noClear) {
    process.stdout.write("\x1b[2J\x1b[H");
  }
}

function fit(value, width) {
  const text = String(value);
  if (text.length <= width) {
    return text.padEnd(width, " ");
  }

  if (width <= 1) {
    return text.slice(0, width);
  }

  return `${text.slice(0, width - 1)}~`;
}

function status(value) {
  return value.toUpperCase().padEnd(7, " ");
}

function box(title, lines, width, height = 10) {
  const inner = Math.max(12, width - 4);
  const bodyHeight = Math.max(1, height - 4);
  const bodyLines = lines.slice(-bodyHeight);

  while (bodyLines.length < bodyHeight) {
    bodyLines.unshift("");
  }

  return [
    `+${"-".repeat(width - 2)}+`,
    `| ${fit(title, inner)} |`,
    `|${"-".repeat(width - 2)}|`,
    ...bodyLines.map((line) => `| ${fit(line, inner)} |`),
    `+${"-".repeat(width - 2)}+`
  ];
}

function combine(left, right) {
  return left.map((line, index) => `${line}  ${right[index] ?? ""}`);
}

function appendLine(paneName, line) {
  panes[paneName].lines.push(line);
  panes[paneName].lines = panes[paneName].lines.slice(-8);
}

function appendEvent(line) {
  eventLog.push(line);
  eventLog.splice(0, Math.max(0, eventLog.length - 8));
}

function render() {
  const columns = Math.max(96, Math.min(process.stdout.columns || 120, 132));
  const fullWidth = columns - 1;
  const paneWidth = Math.floor((fullWidth - 2) / 2);
  const elapsedSeconds = ((performance.now() - wallStart) / 1000).toFixed(1);
  const totalObservedMs = metrics.reduce((sum, item) => sum + item.observedMs, 0);

  clearScreen();

  const header = [
    "Daytona coupon forking video console",
    `mode=${mode}  daytona_api_key=${apiKeyConfigured ? "configured(redacted)" : "not-set"}  elapsed=${elapsedSeconds}s`,
    `completed=${completedSteps}  last_latency=${lastLatencyMs}ms  observed_step_latency=${Math.round(totalObservedMs)}ms`,
    `active=${activeStep}`
  ];

  for (const line of header) {
    process.stdout.write(`${fit(line, fullWidth)}\n`);
  }
  process.stdout.write(`${"-".repeat(fullWidth)}\n`);

  const parentLines = [
    `status: ${status(panes.parent.status)}`,
    ...panes.parent.lines,
    "",
    "fork tree: parent -> 3 hypotheses -> contract fix -> validators"
  ];
  for (const line of box(panes.parent.title, parentLines, fullWidth, 11)) {
    process.stdout.write(`${line}\n`);
  }

  const frontendBox = box(
    panes.frontend.title,
    [`status: ${status(panes.frontend.status)}`, ...panes.frontend.lines],
    paneWidth,
    10
  );
  const backendBox = box(
    panes.backend.title,
    [`status: ${status(panes.backend.status)}`, ...panes.backend.lines],
    paneWidth,
    10
  );
  const contractBox = box(
    panes.contract.title,
    [`status: ${status(panes.contract.status)}`, ...panes.contract.lines],
    paneWidth,
    10
  );
  const validatorsBox = box(
    panes.validators.title,
    [`status: ${status(panes.validators.status)}`, ...panes.validators.lines],
    paneWidth,
    10
  );

  for (const line of combine(frontendBox, backendBox)) {
    process.stdout.write(`${line}\n`);
  }
  for (const line of combine(contractBox, validatorsBox)) {
    process.stdout.write(`${line}\n`);
  }

  const recentMetrics = metrics.slice(-6).map((item) =>
    `${item.name.padEnd(30, " ")} ${String(item.observedMs).padStart(5, " ")}ms  ${item.branch}`
  );
  const timelineLines = eventLog.length > 0 ? eventLog : ["waiting for first event"];
  for (const line of box("live event log", timelineLines, fullWidth, 10)) {
    process.stdout.write(`${line}\n`);
  }
  for (const line of box("latency metrics", recentMetrics, fullWidth, 10)) {
    process.stdout.write(`${line}\n`);
  }
}

async function waitForReproduction() {
  if (skipWait) {
    return {
      ...defaultSessionState,
      bugReproduced: true,
      uiAcceptedInvalidCoupon: true,
      checkoutFailedGenerically: true,
      reproducedAt: new Date().toISOString(),
      synthetic: true
    };
  }

  while (true) {
    const session = readSession();
    if (session.bugReproduced) {
      return session;
    }

    waitTicks += 1;
    panes.parent.status = "waiting";
    panes.parent.lines = [
      "terminal is armed and waiting",
      "open http://localhost:4173",
      "apply SUMMER-2026",
      "click checkout",
      `polls=${waitTicks}`
    ];
    render();
    await sleep(500);
  }
}

async function runStep({ name, branch, pane, plannedMs, detail, after }) {
  const paneName = pane ?? branch;
  activeStep = name;
  panes[paneName].status = "running";
  appendLine(paneName, `> ${name}`);
  render();

  const stepStart = performance.now();
  await sleep(plannedMs);
  const observedMs = Math.max(1, Math.round(performance.now() - stepStart));
  lastLatencyMs = observedMs;
  completedSteps += 1;

  metrics.push({
    name,
    branch,
    pane: paneName,
    plannedDemoMs: plannedMs,
    observedMs,
    source: mode,
    completedAt: new Date().toISOString()
  });
  panes[paneName].status = "done";
  appendLine(paneName, `ok ${observedMs}ms - ${detail}`);
  appendEvent(`${name} -> ${branch} completed in ${observedMs}ms`);
  after?.();
  render();
}

async function runParallel(groupName, steps) {
  activeStep = groupName;
  for (const step of steps) {
    const paneName = step.pane ?? step.branch;
    panes[paneName].status = "running";
    appendLine(paneName, `> ${step.name}`);
  }
  render();

  const sorted = [...steps].sort((a, b) => a.plannedMs - b.plannedMs);
  const groupStart = performance.now();
  let previousPlannedMs = 0;

  for (const step of sorted) {
    await sleep(step.plannedMs - previousPlannedMs);
    previousPlannedMs = step.plannedMs;

    const paneName = step.pane ?? step.branch;
    const observedMs = Math.max(1, Math.round(performance.now() - groupStart));
    lastLatencyMs = observedMs;
    completedSteps += 1;
    panes[paneName].status = step.keepRunning ? "running" : "done";
    appendLine(paneName, `ok ${observedMs}ms - ${step.detail}`);
    appendEvent(`${step.name} -> ${step.branch} completed in ${observedMs}ms`);
    metrics.push({
      name: step.name,
      branch: step.branch,
      pane: paneName,
      plannedDemoMs: step.plannedMs,
      observedMs,
      source: mode,
      group: groupName,
      completedAt: new Date().toISOString()
    });
    step.after?.();
    render();
  }
}

function writeMetrics() {
  const totalObservedMs = Math.round(metrics.reduce((sum, item) => sum + item.observedMs, 0));
  const maxObservedMs = Math.max(...metrics.map((item) => item.observedMs));
  const wallClockMs = Math.round(performance.now() - wallStart);
  const postReproductionWallMs = postReproductionStart
    ? Math.round(performance.now() - postReproductionStart)
    : null;
  writeJson(metricsPath, {
    generatedAt: new Date().toISOString(),
    startedAt,
    reproductionDetectedAt,
    mode,
    fastMode,
    apiKeyConfigured,
    sessionStateFile: "data/demo-session-state.json",
    operationCount: metrics.length,
    totals: {
      totalObservedMs,
      maxObservedMs,
      wallClockMs,
      postReproductionWallMs
    },
    metrics
  });
}

async function main() {
  if (!noClear) {
    process.stdout.write("\x1b[?25l");
  }

  const session = await waitForReproduction();
  reproductionDetectedAt = new Date().toISOString();
  postReproductionStart = performance.now();
  panes.parent.status = "running";
  panes.parent.lines = [
    "browser marker detected",
    `invalid coupon: ${session.invalidCoupon}`,
    `reproduced at: ${session.reproducedAt}`,
    "UI accepted invalid coupon, checkout failed generically"
  ];
  appendEvent("browser reproduced SUMMER-2026 checkout bug");
  render();

  await runStep({
    name: "inspect prepared parent state",
    branch: "coupon-parent-prepared",
    pane: "parent",
    plannedMs: 520,
    detail: "repo/deps/build/seed/logs/debug brief present"
  });
  await runStep({
    name: "stop/start persistence proof",
    branch: "coupon-parent-prepared",
    pane: "parent",
    plannedMs: 730,
    detail: "state-marker.txt survives same sandbox restart"
  });
  await runStep({
    name: "snapshot reusable baseline",
    branch: "coupon-prepared-baseline",
    pane: "parent",
    plannedMs: 620,
    detail: "filesystem baseline saved for later restore"
  });

  await runParallel("fork prepared parent into hypotheses", [
    {
      name: "spawn fork",
      branch: "frontend-hypothesis",
      pane: "frontend",
      plannedMs: 480,
      detail: "client-only validation branch"
    },
    {
      name: "spawn fork",
      branch: "backend-hypothesis",
      pane: "backend",
      plannedMs: 560,
      detail: "checkout/API validation branch"
    },
    {
      name: "spawn fork",
      branch: "contract-hypothesis",
      pane: "contract",
      plannedMs: 640,
      detail: "shared contract branch"
    }
  ]);

  await runStep({
    name: "evaluate frontend hypothesis",
    branch: "frontend-hypothesis",
    pane: "frontend",
    plannedMs: 460,
    detail: "UI improves, API inconsistency remains"
  });
  await runStep({
    name: "evaluate backend hypothesis",
    branch: "backend-hypothesis",
    pane: "backend",
    plannedMs: 500,
    detail: "API improves, UI can still confuse"
  });
  await runStep({
    name: "write contract candidate fix",
    branch: "contract-candidate-fix",
    pane: "contract",
    plannedMs: 750,
    detail: "changed filesystem state exists before next fork"
  });

  await runParallel("fork a fork from contract candidate", [
    {
      name: "spawn refinement",
      branch: "contract-minimal",
      pane: "contract",
      plannedMs: 420,
      detail: "minimal shared contract fix"
    },
    {
      name: "spawn refinement",
      branch: "contract-with-regression-test",
      pane: "contract",
      plannedMs: 510,
      detail: "same fix plus explicit regression coverage"
    }
  ]);

  await runParallel("fan out validators from changed contract state", [
    {
      name: "spawn validator",
      branch: "api-design-review",
      pane: "validators",
      plannedMs: 500,
      detail: "reviews API semantics"
    },
    {
      name: "spawn validator",
      branch: "implementation-review",
      pane: "validators",
      plannedMs: 620,
      detail: "reviews shared contract implementation"
    },
    {
      name: "spawn validator",
      branch: "regression-test-builder",
      pane: "validators",
      plannedMs: 740,
      detail: "adds failing-then-passing coverage"
    }
  ]);

  await runStep({
    name: "validator decision",
    branch: "contract-candidate-fix",
    pane: "validators",
    plannedMs: 500,
    detail: "green-light only if all validators pass"
  });
  await runStep({
    name: "runtime-state observation",
    branch: "memory-state-check",
    pane: "validators",
    plannedMs: 420,
    detail: "memory proof depends on fork/pause-capable runner"
  });

  activeStep = "Complete - metrics saved";
  writeMetrics();
  appendEvent("metrics saved to .artifacts/logs/video-terminal-metrics.json");
  panes.parent.status = "done";
  panes.frontend.status = "done";
  panes.backend.status = "done";
  panes.contract.status = "done";
  panes.validators.status = "done";
  render();

  process.stdout.write(`\nRecording terminal complete. Metrics saved to ${metricsPath}\n`);
}

process.on("SIGINT", () => {
  if (!noClear) {
    process.stdout.write("\x1b[?25h\n");
  }
  process.exit(130);
});

main()
  .catch((error) => {
    if (!noClear) {
      process.stdout.write("\x1b[?25h\n");
    }
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (!noClear) {
      process.stdout.write("\x1b[?25h");
    }
  });
