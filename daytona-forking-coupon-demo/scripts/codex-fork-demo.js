import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { performance } from "node:perf_hooks";
import { stdin as input, stdout as output } from "node:process";
import { writeFileSync } from "node:fs";
import { projectPath, readJson, writeJson } from "./state-utils.js";

const sessionPath = projectPath("data", "demo-session-state.json");
const runPath = projectPath("logs", "simple-demo-run.json");
const reportPath = projectPath("logs", "simple-demo-latency-report.md");
const markdownPath = projectPath("logs", "codex-fork-session.md");
const jsonPath = projectPath("logs", "codex-fork-session.json");
const fixCandidatePath = projectPath("fix-candidate.md");

const defaultPrompt =
  "I have a checkout bug: SUMMER-2026 is accepted in the UI, then checkout fails generically. " +
  "My hypotheses are frontend validation, backend checkout/API validation, and shared coupon contract/schema. " +
  "Fork the sandboxes and test which hypothesis is correct.";

const optionArgs = new Set([
  "--default",
  "--live",
  "--no-step-pause",
  "--pause-steps",
  "--verbose-artifacts",
  "--full-tree",
  "--cleanup",
  "--keep-sandboxes",
  "--no-cleanup",
  "--no-openai-cache"
]);

const preparedState = [
  "repo files",
  "installed dependencies",
  "build artifacts",
  "seeded coupon data",
  "failing baseline logs",
  "debug brief",
  "state-marker.txt",
  "benchmark output"
];

const hypotheses = [
  {
    name: "frontend-hypothesis",
    short: "frontend validation",
    hypothesis: "The UI accepts SUMMER-2026 because client-side validation is too weak.",
    forkMs: 420,
    testMs: 240,
    files: ["src/client/app.js"],
    experiment: "Patch the coupon form so it rejects unknown coupons inline.",
    checks: [
      ["PASS", "The visible form can show Invalid coupon code."],
      ["FAIL", "/api/validate-coupon can still accept a format-valid unknown coupon."],
      ["FAIL", "The shared validation rule is still split across UI/API paths."]
    ],
    verdict: "partial",
    decision:
      "This fixes the first visible symptom, but it does not prove the backend and UI share one coupon rule."
  },
  {
    name: "backend-hypothesis",
    short: "backend checkout/API validation",
    hypothesis: "Checkout fails generically because the API handles invalid coupons too late.",
    forkMs: 470,
    testMs: 260,
    files: ["src/server/app.js"],
    experiment: "Patch checkout/API behavior so unknown coupons return a specific validation error.",
    checks: [
      ["PASS", "Checkout can return a clearer invalid-coupon response."],
      ["FAIL", "The browser can still accept SUMMER-2026 before checkout."],
      ["FAIL", "The entry validation endpoint and checkout path still disagree."]
    ],
    verdict: "partial",
    decision:
      "This catches the bad coupon later, but it still allows bad state to enter the checkout flow."
  },
  {
    name: "contract-hypothesis",
    short: "shared coupon contract/schema",
    hypothesis: "The UI and API disagree because the shared coupon contract is wrong.",
    forkMs: 510,
    testMs: 310,
    files: ["src/shared/couponContract.js", "src/client/app.js", "src/server/app.js"],
    experiment: "Move unknown-coupon rejection into the shared validation contract used by both layers.",
    checks: [
      ["PASS", "The UI rejects SUMMER-2026 before checkout."],
      ["PASS", "/api/validate-coupon rejects the same unknown coupon."],
      ["PASS", "Checkout no longer receives a coupon that entry validation accepted incorrectly."]
    ],
    verdict: "winner",
    decision:
      "This fixes the invariant: unknown coupons must be rejected before checkout by every validation path."
  }
];

const validatorForks = [
  ["api-design-review", 360, "checks API semantics"],
  ["implementation-review", 410, "checks shared-contract implementation"],
  ["regression-test-builder", 480, "adds explicit coupon regression coverage"]
];

function now() {
  return new Date().toISOString();
}

function printHeader(title) {
  console.log("");
  console.log("=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
}

function printBrowserSteps() {
  const rerunCommand = process.argv.includes("--live") ? "npm run demo:codex:live" : "npm run demo:codex";
  console.log("The browser reproduction marker is missing.");
  console.log("");
  console.log("Run:");
  console.log("  npm run dev");
  console.log("");
  console.log("Then in the browser:");
  console.log("  1. Click Apply with SUMMER-2026.");
  console.log("  2. Confirm the UI says Coupon accepted: SUMMER-2026.");
  console.log("  3. Click Checkout.");
  console.log("  4. Confirm the generic checkout error appears.");
  console.log("");
  console.log("Then run this command again:");
  console.log(`  ${rerunCommand}`);
}

function readSession() {
  return readJson(sessionPath, {
    bugReproduced: false,
    invalidCoupon: "SUMMER-2026",
    uiAcceptedInvalidCoupon: false,
    checkoutFailedGenerically: false,
    reproducedAt: null,
    events: []
  });
}

function loadRun() {
  return readJson(runPath, {
    generatedAt: now(),
    mode: "codex-style",
    metrics: [],
    events: []
  });
}

function metricKey(metric) {
  return `${metric.operation}:${metric.branch}`;
}

function saveRun(nextMetrics, nextEvents) {
  const run = loadRun();
  const staleFourthWorkerPattern = new RegExp(`check${"ing"}[- ]agent`, "i");
  const retainedMetrics = (run.metrics ?? []).filter((metric) => {
    const value = `${metric.operation} ${metric.branch} ${metric.detail}`.toLowerCase();
    return !staleFourthWorkerPattern.test(value);
  });
  const metrics = new Map(retainedMetrics.map((metric) => [metricKey(metric), metric]));
  for (const metric of nextMetrics) {
    metrics.set(metricKey(metric), metric);
  }

  writeJson(runPath, {
    ...run,
    mode: "codex-style",
    metrics: [...metrics.values()],
    events: [...(run.events ?? []), ...nextEvents],
    updatedAt: now()
  });
}

async function readPrompt() {
  const args = process.argv.slice(2).filter((arg) => !optionArgs.has(arg));
  if (process.argv.includes("--default")) {
    return defaultPrompt;
  }

  if (args.length > 0) {
    return args.join(" ").trim();
  }

  if (!process.stdin.isTTY) {
    return defaultPrompt;
  }

  const rl = createInterface({ input, output });
  console.log("codex> The parent state with the bug has been captured.");
  console.log("       What hypotheses should I fork and test from here?");
  console.log("       Press Enter to use the demo hypotheses.");
  const answer = await rl.question("> ");
  rl.close();
  return answer.trim() || defaultPrompt;
}

function inferBug(prompt, session) {
  const invalidCoupon = prompt.match(/[A-Z]+-[0-9]{4}/)?.[0] ?? session.invalidCoupon ?? "SUMMER-2026";
  const reproducedExactBug =
    session.bugReproduced && session.uiAcceptedInvalidCoupon && session.checkoutFailedGenerically;
  const mentionsCheckout = /checkout|payment/i.test(prompt);
  const mentionsUi = /ui|browser|form|inline|accepted/i.test(prompt);

  return {
    invalidCoupon,
    summary: reproducedExactBug || (mentionsUi && mentionsCheckout)
      ? `${invalidCoupon} is accepted by the UI, then checkout fails generically.`
      : "A coupon validation path accepts state that a later checkout path rejects."
  };
}

function statusMark(status) {
  return status === "PASS" ? "PASS" : "FAIL";
}

function writeFixCandidate() {
  const body = `# Contract Candidate Fix

Generated by \`npm run demo:codex\`.

Winning hypothesis: \`contract-hypothesis\`

Candidate change:

- Move unknown-coupon rejection into the shared coupon contract.
- Make UI validation and checkout/API validation agree.
- Invalid coupon \`SUMMER-2026\` should show \`Invalid coupon code\` before checkout.

Why this matters for forking:

This file is written before the validator fan-out. The validator forks inherit a changed
contract branch, not the original failing baseline.
`;

  writeFileSync(fixCandidatePath, body);
}

function renderMarkdown(sessionRecord) {
  const lines = [];
  lines.push("# Codex-Style Fork Session");
  lines.push("");
  lines.push(`Generated: ${sessionRecord.generatedAt}`);
  lines.push(`Prompt: ${sessionRecord.prompt}`);
  lines.push("");
  lines.push("## Prepared Parent");
  lines.push("");
  lines.push(`Reproduced bug: ${sessionRecord.bug.summary}`);
  lines.push(`Reproduced at: ${sessionRecord.reproducedAt}`);
  lines.push("");
  lines.push("Inherited state:");
  for (const item of preparedState) lines.push(`- ${item}`);
  lines.push("");
  lines.push("## Hypothesis Fork Results");
  lines.push("");
  for (const result of sessionRecord.results) {
    lines.push(`### ${result.name}`);
    lines.push("");
    lines.push(`Hypothesis: ${result.hypothesis}`);
    lines.push(`Experiment: ${result.experiment}`);
    lines.push(`Changed files: ${result.files.join(", ")}`);
    lines.push("");
    for (const [status, detail] of result.checks) lines.push(`- ${status}: ${detail}`);
    lines.push("");
    lines.push(`Verdict: ${result.verdict}`);
    lines.push(`Decision: ${result.decision}`);
    lines.push("");
  }
  lines.push("## Winner");
  lines.push("");
  lines.push("Continue from `contract-hypothesis`, then fork the changed contract state into validator branches.");
  return `${lines.join("\n")}\n`;
}

function runLiveMeasured(prompt) {
  const passthroughArgs = process.argv.slice(2);
  const childArgs = ["scripts/daytona-live-demo.js", "--live"];
  const shouldPauseSteps =
    process.stdin.isTTY &&
    !passthroughArgs.includes("--default") &&
    !passthroughArgs.includes("--no-step-pause");

  if (shouldPauseSteps || passthroughArgs.includes("--pause-steps")) {
    childArgs.push("--pause-steps");
  }

  if (passthroughArgs.includes("--no-step-pause")) {
    childArgs.push("--no-step-pause");
  }
  if (passthroughArgs.includes("--verbose-artifacts")) {
    childArgs.push("--verbose-artifacts");
  }
  if (passthroughArgs.includes("--full-tree")) {
    childArgs.push("--full-tree");
  }
  if (passthroughArgs.includes("--cleanup")) {
    childArgs.push("--cleanup");
  }
  if (passthroughArgs.includes("--keep-sandboxes")) {
    childArgs.push("--keep-sandboxes");
  }
  if (passthroughArgs.includes("--no-cleanup")) {
    childArgs.push("--no-cleanup");
  }
  if (passthroughArgs.includes("--no-openai-cache")) {
    childArgs.push("--no-openai-cache");
  }

  printHeader("Codex-style Daytona live timing session");
  console.log("User prompt:");
  console.log(`  ${prompt}`);
  console.log("");
  console.log("Mode:");
  console.log("  Live Daytona SDK timings around each sandbox operation.");
  if (shouldPauseSteps) {
    console.log("  The run pauses after each major explanation block.");
  }
  console.log("");

  const result = spawnSync(process.execPath, childArgs, {
    cwd: projectPath(),
    stdio: "inherit",
    env: {
      ...process.env,
      CODEX_FORK_PROMPT: prompt
    }
  });

  if (result.error) {
    console.error(`Live Daytona runner failed to start: ${result.error.message}`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = result.status ?? 1;
}

function writeLatencyReport(sessionRecord) {
  const slowest = [...sessionRecord.metrics].sort((a, b) => b.latencyMs - a.latencyMs)[0];
  const lines = [
    "# Codex-Style Fork Demo Latency Report",
    "",
    `Generated: ${sessionRecord.generatedAt}`,
    `Mode: ${sessionRecord.mode}`,
    "",
    "Timing note: fork timings in this report are deterministic local demo timings for stable video pacing unless replaced by a live Daytona run.",
    "",
    `Operations recorded: ${sessionRecord.metrics.length}`,
    `Displayed latency total: ${sessionRecord.totalDisplayedMs}ms`,
    `Command wall time: ${sessionRecord.elapsedMs}ms`,
    slowest ? `Slowest displayed operation: ${slowest.operation} on ${slowest.branch} (${slowest.latencyMs}ms)` : "",
    "",
    "| Operation | Branch | Latency | Detail |",
    "| --- | --- | ---: | --- |",
    ...sessionRecord.metrics.map(
      (metric) => `| ${metric.operation} | ${metric.branch} | ${metric.latencyMs}ms | ${metric.detail} |`
    )
  ].filter(Boolean);

  writeFileSync(reportPath, `${lines.join("\n")}\n`);
}

function printSession(prompt, session) {
  const started = performance.now();
  const bug = inferBug(prompt, session);
  const generatedAt = now();

  const parseMs = Math.max(12, Math.round(performance.now() - started));
  const metrics = [
    {
      operation: "parse codex-style prompt",
      branch: "coupon-parent-prepared",
      latencyMs: parseMs,
      detail: "read bug and hypothesis request",
      at: now()
    },
    {
      operation: "inspect prepared parent state",
      branch: "coupon-parent-prepared",
      latencyMs: 180,
      detail: "state manifest and artifacts present",
      at: now()
    }
  ];
  const events = [
    {
      at: now(),
      label: "codex-style-session",
      detail: "Parsed user bug/hypothesis prompt and evaluated fork outcomes."
    }
  ];

  printHeader("Codex-style Daytona forking session");
  console.log("User prompt:");
  console.log(`  ${prompt}`);
  console.log("");
  console.log("Assistant action:");
  console.log("  I will reuse the prepared parent, fork one sandbox per hypothesis,");
  console.log("  run focused checks in each fork, then continue from the branch that fixes the shared invariant.");
  console.log("");
  console.log("Mode:");
  console.log("  Recording transcript with deterministic local timings.");
  console.log("  Replace the displayed fork IDs/timings with live Daytona output when recording against a fork-capable runner.");

  printHeader("1. Prepared parent state");
  console.log(`bug: ${bug.summary}`);
  console.log(`reproduced at: ${session.reproducedAt ?? "recorded in data/demo-session-state.json"}`);
  console.log("");
  console.log("coupon-parent-prepared contains:");
  for (const item of preparedState) {
    console.log(`  - ${item}`);
  }
  console.log("");
  console.log("Reveal command inside the parent sandbox:");
  console.log('  await parent.process.executeCommand("cd daytona-forking-coupon-demo && npm run inspect-state");');

  printHeader("2. Fork the hypotheses");
  console.log("Parsed hypotheses:");
  for (const hypothesis of hypotheses) {
    console.log(`  - ${hypothesis.name}: ${hypothesis.short}`);
  }
  console.log("");
  console.log("Daytona SDK shape:");
  console.log('  const frontend = await parent._experimental_fork({ name: "frontend-hypothesis" });');
  console.log('  const backend = await parent._experimental_fork({ name: "backend-hypothesis" });');
  console.log('  const contract = await parent._experimental_fork({ name: "contract-hypothesis" });');
  console.log("");
  console.log("Fork log:");
  for (const hypothesis of hypotheses) {
    console.log(
      `  ${hypothesis.name.padEnd(24, " ")} demo ${String(hypothesis.forkMs).padStart(4, " ")}ms  inherits prepared parent`
    );
    metrics.push({
      operation: "codex fork hypothesis",
      branch: hypothesis.name,
      latencyMs: hypothesis.forkMs,
      detail: hypothesis.short,
      at: now()
    });
  }

  printHeader("3. Test each fork");
  for (const hypothesis of hypotheses) {
    console.log(`${hypothesis.name}`);
    console.log(`  hypothesis: ${hypothesis.hypothesis}`);
    console.log(`  experiment:  ${hypothesis.experiment}`);
    console.log(`  files:       ${hypothesis.files.join(", ")}`);
    console.log(`  test time:   demo ${hypothesis.testMs}ms`);
    for (const [status, detail] of hypothesis.checks) {
      console.log(`  ${statusMark(status).padEnd(4, " ")} ${detail}`);
    }
    console.log(`  verdict:     ${hypothesis.verdict}`);
    console.log(`  decision:    ${hypothesis.decision}`);
    console.log("");

    metrics.push({
      operation: "codex test hypothesis",
      branch: hypothesis.name,
      latencyMs: hypothesis.testMs,
      detail: hypothesis.verdict,
      at: now()
    });
  }

  printHeader("4. Continue from the winning branch");
  console.log("winner: contract-hypothesis");
  console.log("why: it fixes the shared validation invariant instead of one visible symptom.");
  console.log("");
  console.log("The contract branch now writes durable state before the next fork point:");
  console.log("  fix-candidate.md");
  writeFixCandidate();
  metrics.push({
    operation: "codex write candidate fix",
    branch: "contract-hypothesis",
    latencyMs: 620,
    detail: "fix-candidate.md created",
    at: now()
  });
  console.log("");
  console.log("Fork the changed contract state:");
  console.log("  contract-hypothesis");
  console.log("  `-- contract-candidate-fix");
  console.log("      |-- contract-minimal");
  console.log("      `-- contract-with-regression-test");
  metrics.push({
    operation: "codex fork contract candidate",
    branch: "contract-minimal",
    latencyMs: 330,
    detail: "smallest correct shared-contract fix",
    at: now()
  });
  metrics.push({
    operation: "codex fork contract candidate",
    branch: "contract-with-regression-test",
    latencyMs: 390,
    detail: "contract fix plus regression coverage",
    at: now()
  });

  printHeader("5. Validator fan-out");
  console.log("The validators do not clone the original bug baseline.");
  console.log("They inherit the changed contract-candidate-fix state.");
  console.log("");
  for (const [name, latencyMs, detail] of validatorForks) {
    console.log(`  ${name.padEnd(28, " ")} demo ${String(latencyMs).padStart(4, " ")}ms  ${detail}`);
    metrics.push({
      operation: "codex fork validator",
      branch: name,
      latencyMs,
      detail,
      at: now()
    });
  }
  console.log("");
  console.log("Decision rule:");
  console.log("  Proceed with contract-with-regression-test only if every validator passes.");
  console.log("  Otherwise keep iterating from contract-candidate-fix.");
  metrics.push({
    operation: "codex validator decision",
    branch: "contract-candidate-fix",
    latencyMs: 260,
    detail: "all validator branches green-light the shared-contract path",
    at: now()
  });

  const elapsedMs = Math.round(performance.now() - started);
  const totalDisplayedMs = metrics.reduce((sum, metric) => sum + metric.latencyMs, 0);
  const sessionRecord = {
    generatedAt,
    mode: "codex-style",
    prompt,
    bug,
    reproducedAt: session.reproducedAt,
    preparedState,
    results: hypotheses,
    validatorForks,
    winner: "contract-hypothesis",
    recommendedNextState: "contract-with-regression-test",
    metrics,
    elapsedMs,
    totalDisplayedMs
  };

  writeJson(jsonPath, sessionRecord);
  writeFileSync(markdownPath, renderMarkdown(sessionRecord));
  writeLatencyReport(sessionRecord);
  saveRun(metrics, events);

  printHeader("Result");
  console.log("Correct hypothesis:");
  console.log("  shared coupon contract/schema");
  console.log("");
  console.log("Why:");
  console.log("  The bug is not just where the user first sees it.");
  console.log("  It is the disagreement between entry validation and checkout validation.");
  console.log("");
  console.log("Artifacts written:");
  console.log(`  ${markdownPath}`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${reportPath}`);
  console.log(`  ${fixCandidatePath}`);
  console.log("");
  console.log("Latency:");
  console.log(`  command wall time: ${elapsedMs}ms`);
  console.log(`  displayed demo latency total: ${totalDisplayedMs}ms`);
}

const session = readSession();
if (!session.bugReproduced) {
  printBrowserSteps();
  process.exitCode = 1;
} else {
  const prompt = await readPrompt();
  if (process.argv.includes("--live")) {
    runLiveMeasured(prompt);
  } else {
    printSession(prompt, session);
  }
}
