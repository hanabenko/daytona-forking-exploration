import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { projectPath, readJson, writeJson } from "./state-utils.js";

const command = process.argv[2] ?? "help";
const sessionPath = projectPath("data", "demo-session-state.json");
const runPath = projectPath("logs", "simple-demo-run.json");
const reportPath = projectPath("logs", "simple-demo-latency-report.md");
const fixCandidatePath = projectPath("fix-candidate.md");

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

const timingNote =
  "Timing note: the non-live fork timings in this script are deterministic local demo timings from scripts/simple-demo.js. They are for stable video pacing, not measured Daytona API latency. Live measured latency is recorded by demo:agent or the Daytona live probes.";

const cleanSessionState = {
  bugReproduced: false,
  invalidCoupon: "SUMMER-2026",
  uiAcceptedInvalidCoupon: false,
  checkoutFailedGenerically: false,
  fixApplied: false,
  fixedAt: null,
  winningHypothesis: null,
  fixedCouponMessage: null,
  fixedCheckoutMessage: null,
  reproducedAt: null,
  events: []
};

function now() {
  return new Date().toISOString();
}

function loadRun() {
  const run = readJson(runPath, {
    generatedAt: now(),
    mode: "command-driven",
    metrics: [],
    events: []
  });

  return {
    ...run,
    metrics: dedupeMetrics(run.metrics ?? [])
  };
}

function saveRun(run) {
  writeJson(runPath, {
    ...run,
    metrics: dedupeMetrics(run.metrics ?? []),
    updatedAt: now()
  });
}

function metricKey(item) {
  return `${item.operation}:${item.branch}`;
}

function dedupeMetrics(metrics) {
  const byKey = new Map();
  for (const item of metrics) {
    byKey.set(metricKey(item), item);
  }
  return [...byKey.values()];
}

function readSession() {
  return {
    ...cleanSessionState,
    ...readJson(sessionPath, cleanSessionState)
  };
}

function requireReproduced() {
  const session = readSession();
  if (!session.bugReproduced) {
    console.log("Bug is not reproduced yet.");
    console.log("");
    printBrowserSteps();
    console.log("");
    console.log("After the browser writes the marker, run this again.");
    process.exitCode = 1;
    return null;
  }

  return session;
}

function addMetric(run, operation, branch, latencyMs, detail) {
  const next = {
    operation,
    branch,
    latencyMs,
    detail,
    at: now()
  };
  const index = run.metrics.findIndex((item) => metricKey(item) === metricKey(next));
  if (index >= 0) {
    run.metrics[index] = next;
  } else {
    run.metrics.push(next);
  }
}

function addEvent(run, label, detail) {
  run.events.push({
    at: now(),
    label,
    detail
  });
}

function printHeader(title) {
  console.log("");
  console.log("=".repeat(76));
  console.log(title);
  console.log("=".repeat(76));
}

function printCommandBlock(title, lines) {
  console.log(title);
  for (const line of lines) {
    console.log(`  ${line}`);
  }
}

function printTimingNote() {
  console.log(timingNote);
}

function printBrowserSteps() {
  console.log("Browser bug location:");
  console.log("  1. Run: npm run dev");
  console.log("  2. Open the printed localhost URL, usually http://localhost:4173");
  console.log("  3. In the Coupon Bug Baseline panel, SUMMER-2026 is already typed.");
  console.log('  4. Click "Apply". The visible bug is: Coupon accepted: SUMMER-2026');
  console.log('  5. Click "Checkout". The second visible bug is the generic checkout error.');
}

function reset() {
  writeJson(sessionPath, cleanSessionState);
  writeJson(runPath, {
    generatedAt: now(),
    mode: "command-driven",
    metrics: [],
    events: [
      {
        at: now(),
        label: "reset",
        detail: "Reset browser reproduction marker and command-driven demo run."
      }
    ]
  });

  printHeader("Coupon fork demo reset");
  printBrowserSteps();
  console.log("");
  console.log("Then run:");
  console.log("  npm run demo:codex:live");
}

function state() {
  const session = requireReproduced();
  if (!session) return;

  const run = loadRun();
  addEvent(run, "parent-state-inspected", "Browser reproduction marker is present.");
  addMetric(run, "inspect prepared parent state", "coupon-parent-prepared", 180, "state manifest and artifacts present");
  saveRun(run);

  printHeader("Bug reproduced. Parent state is ready to fork.");
  console.log(`Invalid coupon: ${session.invalidCoupon}`);
  console.log(`Reproduced at: ${session.reproducedAt}`);
  console.log("");
  console.log("Prepared parent contains:");
  for (const item of preparedState) {
    console.log(`  - ${item}`);
  }
  console.log("");
  printCommandBlock("Daytona SDK shape to reveal parent contents:", [
    'await parent.process.executeCommand("cd daytona-forking-coupon-demo && npm run inspect-state");',
    'await parent.process.executeCommand("cd daytona-forking-coupon-demo && ls .artifacts/logs debug-brief.md state-marker.txt dist");'
  ]);
  console.log("");
  console.log("This is the first important state boundary: the parent is not empty.");
  console.log("Next:");
  console.log("  npm run demo:forks");
}

function forks() {
  const session = requireReproduced();
  if (!session) return;

  const run = loadRun();
  addEvent(run, "fork-point-1", "Prepared parent branches into three independent hypotheses.");
  addMetric(run, "fork prepared parent", "frontend-hypothesis", 420, "client validation branch");
  addMetric(run, "fork prepared parent", "backend-hypothesis", 470, "checkout API branch");
  addMetric(run, "fork prepared parent", "contract-hypothesis", 510, "shared contract branch");
  saveRun(run);

  printHeader("Fork point 1: branch from the prepared parent");
  printTimingNote();
  console.log("");
  console.log("coupon-parent-prepared");
  console.log("|-- frontend-hypothesis        demo 420ms   client-side validation theory");
  console.log("|-- backend-hypothesis         demo 470ms   checkout/API validation theory");
  console.log("`-- contract-hypothesis        demo 510ms   shared schema/contract theory");
  console.log("");
  console.log("Each fork starts with the same prepared disk state:");
  console.log(`  ${preparedState.join(", ")}`);
  console.log("");
  printCommandBlock("Daytona SDK shape for this fork point:", [
    'const frontendFork = await parent._experimental_fork({ name: "frontend-hypothesis" });',
    'const backendFork = await parent._experimental_fork({ name: "backend-hypothesis" });',
    'const contractFork = await parent._experimental_fork({ name: "contract-hypothesis" });'
  ]);
  console.log("");
  console.log("Why this is not just cloning:");
  console.log("  These branches inherit the reproduced bug, logs, debug brief, build, and seeded data.");
  console.log("  They do not spend the first minutes rediscovering or rebuilding the same context.");
  console.log("");
  console.log("Next:");
  console.log("  npm run demo:hypotheses");
}

function hypotheses() {
  const session = requireReproduced();
  if (!session) return;

  const run = loadRun();
  addEvent(run, "hypothesis-results", "Compared frontend, backend, and contract fork outcomes.");
  addMetric(run, "evaluate hypothesis", "frontend-hypothesis", 240, "UI-only fix leaves API inconsistency");
  addMetric(run, "evaluate hypothesis", "backend-hypothesis", 260, "API-only fix leaves confusing UI path");
  addMetric(run, "evaluate hypothesis", "contract-hypothesis", 310, "shared validation fixes UI and API together");
  saveRun(run);

  printHeader("What happened inside each hypothesis fork");
  console.log("");
  console.log("frontend-hypothesis");
  console.log("  Agent reasoning:");
  console.log("    The bug appears first in the form, so client validation is a plausible failure point.");
  console.log("    If this is the real fix, rejecting SUMMER-2026 in the UI should be enough.");
  console.log("  Experiment:");
  console.log("    Add an inline invalid-coupon check near the coupon input.");
  console.log("  Observation:");
  console.log("    The form can show a better error, but the API still has a different coupon rule.");
  console.log("  Verdict:");
  console.log("    Partial fix. It improves the symptom, not the shared source of truth.");
  console.log("");
  console.log("backend-hypothesis");
  console.log("  Agent reasoning:");
  console.log("    The generic checkout failure comes from the API, so backend handling is plausible.");
  console.log("    If this is the real fix, checkout should return a specific invalid-coupon response.");
  console.log("  Experiment:");
  console.log("    Make checkout reject unknown coupons with an explicit validation error.");
  console.log("  Observation:");
  console.log("    Checkout behavior improves, but the UI still accepts SUMMER-2026 before checkout.");
  console.log("  Verdict:");
  console.log("    Partial fix. It catches the bug late instead of preventing bad state from entering.");
  console.log("");
  console.log("contract-hypothesis");
  console.log("  Agent reasoning:");
  console.log("    The UI and API disagree about what a valid coupon means.");
  console.log("    That points to a shared contract/schema problem, not one isolated layer.");
  console.log("  Experiment:");
  console.log("    Move unknown-coupon rejection into the shared coupon rule used by both paths.");
  console.log("  Observation:");
  console.log("    SUMMER-2026 is rejected before checkout, and UI/API behavior becomes consistent.");
  console.log("  Verdict:");
  console.log("    Winner. This fixes the invariant both layers should share.");
  console.log("");
  console.log("Why the contract branch wins:");
  console.log("  The agent is not looking for the first place an error appears.");
  console.log("  It is looking for the state boundary where the UI and API diverge.");
  console.log("  The contract fork is the best parent for the next fork because it changes that boundary.");
  console.log("");
  console.log("Decision:");
  console.log("  Continue from contract-hypothesis because it fixes the shared contract instead of one symptom.");
  console.log("");
  printCommandBlock("Optional commands to prove it:", [
    "frontend fork: npm run test:ui",
    "backend fork:  npm run test:api",
    "contract fork: npm run test"
  ]);
  console.log("");
  console.log("Next:");
  console.log("  npm run demo:contract");
}

function contract() {
  const session = requireReproduced();
  if (!session) return;

  const fixCandidate = `# Contract Candidate Fix

Generated by \`npm run demo:contract\`.

Winning hypothesis: \`contract-hypothesis\`

Candidate change:

- Move unknown-coupon rejection into the shared coupon contract.
- Make UI validation and checkout/API validation agree.
- Invalid coupon \`SUMMER-2026\` should show \`Invalid coupon code\` before checkout.

Why this matters for forking:

This file is a disk-state change written before the next fork point. The refinements and
validators should inherit this changed state, not start from the original baseline.
`;

  writeFileSync(fixCandidatePath, fixCandidate);

  const run = loadRun();
  addEvent(run, "contract-candidate-written", "contract-hypothesis wrote fix-candidate.md before deeper forks.");
  addMetric(run, "write contract candidate fix", "contract-hypothesis", 620, "fix-candidate.md created");
  addMetric(run, "fork contract candidate", "contract-minimal", 330, "smallest shared-contract fix");
  addMetric(run, "fork contract candidate", "contract-with-regression-test", 390, "fix plus regression tests");
  saveRun(run);

  printHeader("Contract branch wins, then writes state before forking again");
  printTimingNote();
  console.log("");
  console.log("What happened inside contract-hypothesis:");
  console.log("  1. The fork inherited the reproduced bug, seeded coupons, failing logs, and debug brief.");
  console.log("  2. The agent changed the proposed source of truth: unknown coupons should fail shared validation.");
  console.log("  3. That decision is written to disk as fix-candidate.md before any deeper forks start.");
  console.log("");
  console.log("Why the next branch point works:");
  console.log("  The next children are not branched from the original broken parent.");
  console.log("  They are branched from the contract fork after it has a candidate fix on disk.");
  console.log("  That means each child starts with the same proposed fix, then explores a different future.");
  console.log("");
  console.log("contract-hypothesis");
  console.log("`-- contract-candidate-fix");
  console.log("    |-- contract-minimal                 demo 330ms");
  console.log("    `-- contract-with-regression-test    demo 390ms");
  console.log("");
  console.log("Disk change before this fork:");
  console.log("  fix-candidate.md");
  console.log("");
  console.log("What happens in the fork-a-fork children:");
  console.log("  contract-minimal:");
  console.log("    Keep only the smallest shared validator change needed to reject SUMMER-2026.");
  console.log("    This branch answers: can the invariant be fixed without extra surface area?");
  console.log("");
  console.log("  contract-with-regression-test:");
  console.log("    Start from the same candidate fix, then add explicit tests for the invalid coupon path.");
  console.log("    This branch answers: can we make the fix harder to regress before merging?");
  console.log("");
  printCommandBlock("Daytona SDK shape for the second fork point:", [
    'await contractFork.process.executeCommand("cd daytona-forking-coupon-demo && cat fix-candidate.md");',
    'const minimal = await contractFork._experimental_fork({ name: "contract-minimal" });',
    'const withTests = await contractFork._experimental_fork({ name: "contract-with-regression-test" });'
  ]);
  console.log("");
  console.log("This is the multi-level fork argument:");
  console.log("  The second fork point is not the original baseline.");
  console.log("  It is the contract branch after it wrote a candidate fix to disk.");
  console.log("  Cloning the original baseline three times would miss this useful changed parent state.");
  console.log("");
  console.log("Next:");
  console.log("  npm run demo:validators");
}

function branch() {
  const session = requireReproduced();
  if (!session) return;

  const fixCandidate = `# Contract Candidate Fix

Generated by \`npm run demo:branch\`.

Winning hypothesis: \`contract-hypothesis\`

Candidate change:

- Move unknown-coupon rejection into the shared coupon contract.
- Make UI validation and checkout/API validation agree.
- Invalid coupon \`SUMMER-2026\` should show \`Invalid coupon code\` before checkout.

Why this matters for forking:

This file is a disk-state change written before the next fork point. The refinements and
validators should inherit this changed state, not start from the original baseline.
`;

  writeFileSync(fixCandidatePath, fixCandidate);

  const run = loadRun();
  addEvent(run, "branch-story", "Printed simplified parent, hypothesis, and contract fork story.");
  addMetric(run, "inspect prepared parent state", "coupon-parent-prepared", 180, "state manifest and artifacts present");
  addMetric(run, "fork prepared parent", "frontend-hypothesis", 420, "client validation branch");
  addMetric(run, "fork prepared parent", "backend-hypothesis", 470, "checkout API branch");
  addMetric(run, "fork prepared parent", "contract-hypothesis", 510, "shared contract branch");
  addMetric(run, "evaluate hypothesis", "frontend-hypothesis", 240, "UI-only fix leaves API inconsistency");
  addMetric(run, "evaluate hypothesis", "backend-hypothesis", 260, "API-only fix leaves confusing UI path");
  addMetric(run, "evaluate hypothesis", "contract-hypothesis", 310, "shared validation fixes UI and API together");
  addMetric(run, "write contract candidate fix", "contract-hypothesis", 620, "fix-candidate.md created");
  addMetric(run, "fork contract candidate", "contract-minimal", 330, "smallest shared-contract fix");
  addMetric(run, "fork contract candidate", "contract-with-regression-test", 390, "fix plus regression tests");
  saveRun(run);

  printHeader("Simplified branch story: prepared parent -> winning contract fork");
  console.log(`Invalid coupon reproduced: ${session.invalidCoupon}`);
  console.log(`Reproduced at: ${session.reproducedAt}`);
  console.log("");
  printTimingNote();
  console.log("");
  console.log("1. Parent state before forking");
  console.log("   coupon-parent-prepared already contains:");
  for (const item of preparedState) {
    console.log(`   - ${item}`);
  }
  console.log("");
  printCommandBlock("   Reveal it in Daytona with:", [
    'await parent.process.executeCommand("cd daytona-forking-coupon-demo && npm run inspect-state");',
    'await parent.process.executeCommand("cd daytona-forking-coupon-demo && ls .artifacts/logs debug-brief.md state-marker.txt dist");'
  ]);
  console.log("");
  console.log("2. Fork point 1: three independent futures from the same prepared disk state");
  console.log("   coupon-parent-prepared");
  console.log("   |-- frontend-hypothesis        demo 420ms   change only UI validation");
  console.log("   |-- backend-hypothesis         demo 470ms   change only checkout/API behavior");
  console.log("   `-- contract-hypothesis        demo 510ms   change the shared validation contract");
  console.log("");
  printCommandBlock("   SDK shape:", [
    'const frontendFork = await parent._experimental_fork({ name: "frontend-hypothesis" });',
    'const backendFork = await parent._experimental_fork({ name: "backend-hypothesis" });',
    'const contractFork = await parent._experimental_fork({ name: "contract-hypothesis" });'
  ]);
  console.log("");
  console.log("3. What happens inside each fork");
  console.log("   frontend-hypothesis:");
  console.log("     The agent treats the visible form acceptance as the main bug.");
  console.log("     It adds an inline UI rejection. The UI improves, but the API contract is still inconsistent.");
  console.log("");
  console.log("   backend-hypothesis:");
  console.log("     The agent treats the generic checkout failure as the main bug.");
  console.log("     It improves checkout rejection. The API improves, but the UI still accepts bad state first.");
  console.log("");
  console.log("   contract-hypothesis:");
  console.log("     The agent treats UI/API disagreement as the bug.");
  console.log("     It moves unknown-coupon rejection into the shared contract so both paths agree.");
  console.log("");
  console.log("4. Why contract becomes the next parent");
  console.log("   Contract is the only branch that changes the invariant both layers depend on:");
  console.log("   unknown coupons must be rejected before checkout.");
  console.log("   The branch writes fix-candidate.md, creating durable disk state for the next fork.");
  console.log("");
  console.log("5. Fork point 2: fork the changed contract branch, not the original baseline");
  console.log("   contract-hypothesis");
  console.log("   `-- contract-candidate-fix");
  console.log("       |-- contract-minimal                 demo 330ms");
  console.log("       `-- contract-with-regression-test    demo 390ms");
  console.log("");
  console.log("   contract-minimal asks: what is the smallest correct shared-contract fix?");
  console.log("   contract-with-regression-test asks: what fix plus explicit coverage should we keep?");
  console.log("");
  console.log("Why this is forking, not cloning:");
  console.log("  A clone from the original baseline would not inherit the contract candidate fix.");
  console.log("  These children inherit the changed branch state and diverge from there.");
  console.log("");
  console.log("Next commands for the shorter recording flow:");
  console.log("  npm run demo:validators");
  console.log("  npm run demo:report");
  console.log("");
  console.log("Optional live model reasoning:");
  console.log("  npm run demo:agent");
}

function validators() {
  const session = requireReproduced();
  if (!session) return;

  if (!existsSync(fixCandidatePath)) {
    console.log("Missing fix-candidate.md.");
    console.log("Run this first:");
    console.log("  npm run demo:contract");
    process.exitCode = 1;
    return;
  }

  const run = loadRun();
  addEvent(run, "fork-point-3", "Validators branch from changed contract state.");
  addMetric(run, "fork validator", "api-design-review", 360, "reviews public API behavior");
  addMetric(run, "fork validator", "implementation-review", 410, "reviews shared contract implementation");
  addMetric(run, "fork validator", "regression-test-builder", 480, "adds coverage");
  addMetric(run, "validator decision", "contract-candidate-fix", 260, "green-light or keep iterating");
  saveRun(run);

  printHeader("Fork point 3: validators inherit the changed contract state");
  printTimingNote();
  console.log("");
  console.log("contract-candidate-fix");
  console.log("|-- api-design-review          demo 360ms   checks API semantics");
  console.log("|-- implementation-review      demo 410ms   checks shared contract implementation");
  console.log("`-- regression-test-builder    demo 480ms   adds explicit coverage");
  console.log("");
  printCommandBlock("Daytona SDK shape for validator fan-out:", [
    'const apiReview = await candidateFix._experimental_fork({ name: "api-design-review" });',
    'const implementationReview = await candidateFix._experimental_fork({ name: "implementation-review" });',
    'const regressionBuilder = await candidateFix._experimental_fork({ name: "regression-test-builder" });'
  ]);
  console.log("");
  console.log("Decision rule:");
  console.log("  Proceed only if every validator green-lights the candidate fix.");
  console.log("  Otherwise keep iterating from contract-candidate-fix.");
  console.log("");
  console.log("Next:");
  console.log("  npm run demo:report");
}

function report() {
  const run = loadRun();
  const metrics = run.metrics ?? [];
  const total = metrics.reduce((sum, item) => sum + item.latencyMs, 0);
  const slowest = [...metrics].sort((a, b) => b.latencyMs - a.latencyMs)[0];

  const lines = [
    "# Simple Fork Demo Report",
    "",
    `Generated: ${now()}`,
    "",
    timingNote,
    "",
    `Operations recorded: ${metrics.length}`,
    `Sum of displayed latencies: ${total}ms`,
    `Slowest displayed operation: ${slowest ? `${slowest.operation} on ${slowest.branch} (${slowest.latencyMs}ms)` : "n/a"}`,
    "",
    "| Operation | Branch/Fork | Latency | Detail |",
    "| --- | --- | ---: | --- |",
    ...metrics.map(
      (item) => `| ${item.operation} | ${item.branch} | ${item.latencyMs}ms | ${item.detail} |`
    )
  ];

  writeFileSync(reportPath, `${lines.join("\n")}\n`);

  printHeader("Command-driven fork demo report");
  printTimingNote();
  console.log("");
  console.log(`Operations recorded: ${metrics.length}`);
  console.log(`Sum of displayed latencies: ${total}ms`);
  if (slowest) {
    console.log(`Slowest displayed operation: ${slowest.operation} on ${slowest.branch} (${slowest.latencyMs}ms)`);
  }
  console.log("");
  console.log("Timeline:");
  for (const item of metrics) {
    console.log(`  ${String(item.latencyMs).padStart(4, " ")}ms  ${item.operation.padEnd(32, " ")} ${item.branch}`);
  }
  console.log("");
  console.log(`Wrote ${reportPath}`);
}

function help() {
  printHeader("Simple command-driven coupon fork demo");
  console.log("Use this path for recording. Each command prints once and exits.");
  console.log("");
  console.log("Recommended shorter recording flow:");
  console.log("1. npm run demo:reset");
  console.log("2. npm run dev");
  console.log("3. In the browser: click Apply, then Checkout");
  console.log("4. npm run demo:codex");
  console.log("");
  console.log("Optional live model reasoning after demo:codex:");
  console.log("  npm run demo:agent");
  console.log("  npm run demo:cache   # live OpenAI cached-token rows only");
  console.log("");
  console.log("Optional live Daytona timing path:");
  console.log("  npm run demo:codex:live  # measured SDK and OpenAI cache timings");
  console.log("");
  console.log("Granular slow walkthrough:");
  console.log("1. npm run demo:state");
  console.log("2. npm run demo:forks");
  console.log("3. npm run demo:hypotheses");
  console.log("4. npm run demo:agent      # optional live OpenAI-generated reasoning");
  console.log("5. npm run demo:cache      # optional live OpenAI cached-token rows");
  console.log("6. npm run demo:contract");
  console.log("7. npm run demo:validators");
  console.log("8. npm run demo:report");
  console.log("");
  console.log("Use the Daytona console as secondary visual proof:");
  console.log("  - show sandbox IDs and fork names there");
  console.log("  - use these terminal commands to explain the state inside each fork point");
}

const commands = {
  reset,
  state,
  forks,
  hypotheses,
  branch,
  contract,
  validators,
  report,
  help
};

(commands[command] ?? help)();
