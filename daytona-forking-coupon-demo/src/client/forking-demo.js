const stateUrl = "/api/forking-state";
const sessionUrl = "/api/demo-session";
const tree = document.querySelector("#fork-tree");
const parentState = document.querySelector("#parent-state");
const steps = document.querySelector("#steps");
const terminals = document.querySelector("#terminals");
const validators = document.querySelector("#validators");
const candidateState = document.querySelector("#candidate-state");
const forkEvents = document.querySelector("#fork-events");
const memoryProbe = document.querySelector("#memory-probe");
const liveLog = document.querySelector("#live-log");
const daytonaForm = document.querySelector("#daytona-form");
const daytonaKey = document.querySelector("#daytona-key");
const daytonaFormStatus = document.querySelector("#daytona-form-status");
const daytonaStart = document.querySelector("#daytona-start");
const replicationStatus = document.querySelector("#replication-status");
const resetSession = document.querySelector("#reset-session");
const serverStateLabel = document.querySelector("#server-state-label");
const serverStateDetail = document.querySelector("#server-state-detail");
const demoStepChecklist = document.querySelector("#demo-step-checklist");
const multiLevelTree = document.querySelector("#multi-level-tree");
const cloneFanout = document.querySelector("#clone-fanout");
const forkedStateTree = document.querySelector("#forked-state-tree");
const rootTerminal = document.querySelector("#root-terminal");
const splitTerminals = document.querySelector("#split-terminals");
const consoleStream = document.querySelector("#console-stream");
let demoSession = {
  bugReproduced: false
};
let currentRunStatus = "idle";
let lastState = null;

function text(value) {
  return String(value ?? "");
}

function slug(value) {
  return (
    text(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "item"
  );
}

function pillClass(verdict, status) {
  const value = `${verdict} ${status}`.toLowerCase();
  if (value.includes("partial")) return "partial";
  if (value.includes("best")) return "best";
  if (value.includes("green-light")) return "best";
  if (value.includes("prepared")) return "ready";
  if (value.includes("recommended")) return "recommended";
  if (value.includes("ready")) return "ready";
  if (value.includes("failed")) return "error";
  if (value.includes("live")) return "ready";
  return "";
}

function renderNode(node) {
  const nodeClass = node.kind === "parent" ? "parent" : slug(node.name);
  const changedFiles = (node.changedFiles ?? []).join(", ");
  return `<article class="node ${nodeClass}">
    <span class="pill ${pillClass(node.verdict, node.status)}">${text(node.status)}</span>
    <h3>${text(node.name)}</h3>
    <p>${text(node.summary)}</p>
    <div class="meta">
      <span>id: ${text(node.sandboxId ?? "not created")}</span>
      <span>files: ${text(changedFiles || "none")}</span>
      <span>tests: ${text(node.testStatus)}</span>
      <strong>${text(node.verdict)}</strong>
    </div>
  </article>`;
}

function renderLines() {
  return `
    <span class="branch-line" style="left:32%;top:31%;width:20%;transform:rotate(23deg)"></span>
    <span class="branch-line" style="left:43%;top:31%;width:14%;"></span>
    <span class="branch-line" style="left:51%;top:31%;width:20%;transform:rotate(-23deg)"></span>
    <span class="branch-line" style="left:72%;top:61%;width:16%;transform:rotate(24deg)"></span>
    <span class="branch-line" style="left:78%;top:61%;width:15%;transform:rotate(-23deg)"></span>
  `;
}

function renderTags(items) {
  return (items ?? []).map((item) => `<span>${text(item)}</span>`).join("");
}

function findNode(state, name) {
  return (state.nodes ?? []).find((node) => node.name === name) ?? {};
}

function lastMatchingEvent(state, name) {
  return [...(state.forkEvents ?? [])].reverse().find((event) => event.fork === name) ?? null;
}

function stateTableLines(rows) {
  return (rows ?? []).map(([label, value]) => `${label.padEnd(24, " ")} ${value}`).join("\n");
}

function compactId(value) {
  const id = text(value);
  if (!id || id === "not created" || id.startsWith("simulated")) {
    return id || "not created";
  }

  return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-6)}` : id;
}

function renderTerminalPane({ title, status, command, lines, tags }) {
  return `<section class="split-terminal ${slug(status)}">
    <header>
      <span>${text(title)}</span>
      <span>${text(status)}</span>
    </header>
    <pre><span class="prompt">$</span> ${text(command)}
${text((lines ?? []).join("\n"))}</pre>
    <div class="terminal-tags">${renderTags(tags)}</div>
  </section>`;
}

function renderHypothesisCard({ title, status, focus, reasoning, outcome, files }) {
  return `<article class="hypothesis-card ${slug(status)}">
    <span class="pill ${pillClass(outcome, status)}">${text(status)}</span>
    <h3>${text(title)}</h3>
    <p class="hypothesis-focus">${text(focus)}</p>
    <p>${text(reasoning)}</p>
    <strong>${text(outcome)}</strong>
    <div class="terminal-tags">${renderTags(files)}</div>
  </article>`;
}

function renderOperatorConsole(state, runLogs = null) {
  if (!rootTerminal || !splitTerminals || !consoleStream) {
    return;
  }

  const parent = findNode(state, "coupon-parent-prepared");
  const frontend = findNode(state, "frontend-hypothesis");
  const backend = findNode(state, "backend-hypothesis");
  const contract = findNode(state, "contract-hypothesis");
  const liveRun = state.liveRun ?? {};
  const forkBlocked = liveRun.status === "blocked";
  const blocker = liveRun.blocker ?? lastMatchingEvent(state, "frontend-hypothesis")?.result ?? "";
  const parentEvent = lastMatchingEvent(state, "coupon-parent-prepared");
  const blockedBeforeParent =
    forkBlocked &&
    (parentEvent?.sandboxId === "not-created" ||
      text(parentEvent?.action).includes("create parent"));
  const displayedParentId = blockedBeforeParent
    ? "not-created"
    : (parentEvent?.sandboxId ?? parent.sandboxId ?? liveRun.parentSandboxId ?? "not created");
  const parentCreated = displayedParentId && displayedParentId !== "not-created";
  const parentStatus = forkBlocked ? "blocked" : parent.status ?? "prepared";
  const reproduction = bugWasReplicated() ? "recorded" : "waiting";
  const cleanup = liveRun.cleanup ? `cleanup: ${liveRun.cleanup}` : "";
  const rootView = Boolean(document.querySelector(".unified-console"));

  if (rootView) {
    rootTerminal.hidden = true;
    consoleStream.closest(".live-stream-terminal")?.setAttribute("hidden", "");
    splitTerminals.innerHTML = [
      renderHypothesisCard({
        title: "Frontend validation",
        status: "hypothesis",
        focus: "Could the form be accepting SUMMER-2026 too early?",
        reasoning: "Test whether the first bad state enters through the browser validation path.",
        outcome: "Hypothesis to test",
        files: frontend.changedFiles ?? ["src/client/app.js"]
      }),
      renderHypothesisCard({
        title: "Backend/API validation",
        status: "hypothesis",
        focus: "Could checkout be rejecting the coupon too late?",
        reasoning: "Test whether the API response shape or checkout validation timing is the real failure point.",
        outcome: "Hypothesis to test",
        files: backend.changedFiles ?? ["src/server/app.js"]
      }),
      renderHypothesisCard({
        title: "Shared coupon contract",
        status: "hypothesis",
        focus: "Could the UI and API be using the wrong shared rule?",
        reasoning: "Test whether one shared coupon rule should decide what both UI and API accept.",
        outcome: "Hypothesis to test",
        files: ["src/shared/couponContract.js"]
      })
    ].join("");
    return;
  }

  rootTerminal.innerHTML = `<header>
    <span>parent: coupon-parent-prepared</span>
    <span>${text(parentStatus)}</span>
  </header>
  <pre><span class="prompt">$</span> coupon reproduce SUMMER-2026
server reproduction: ${reproduction}

<span class="prompt">$</span> daytona prepare parent
sandbox: ${compactId(displayedParentId)}
status: ${text(parentStatus)}
${stateTableLines(state.parentState ?? [])}

<span class="prompt">$</span> daytona fork frontend backend contract
${forkBlocked ? `blocked: ${blocker}` : "split panes below inherit the prepared parent state"}
${cleanup}</pre>`;

  const blockedLines = parentCreated
    ? ["parent prepared", `fork rejected: ${blocker}`, cleanup].filter(Boolean)
    : [`not spawned: ${blocker || "parent is not ready"}`];

  const panes = [
    {
      title: "frontend-hypothesis",
      status: forkBlocked ? "blocked" : frontend.status,
      command: "agent --focus ui-validation",
      lines: forkBlocked
        ? blockedLines
        : [
            `sandbox: ${compactId(frontend.sandboxId)}`,
            "assumption: client-side validation is incomplete",
            "expected: inline UI improves, API inconsistency remains",
            `verdict: ${frontend.verdict ?? "partial"}`
          ],
      tags: frontend.changedFiles ?? ["src/client/app.js"]
    },
    {
      title: "backend-hypothesis",
      status: forkBlocked ? "blocked" : backend.status,
      command: "agent --focus checkout-api",
      lines: forkBlocked
        ? blockedLines
        : [
            `sandbox: ${compactId(backend.sandboxId)}`,
            "assumption: checkout/API hides coupon failure",
            "expected: API improves, UI remains confusing",
            `verdict: ${backend.verdict ?? "partial"}`
          ],
      tags: backend.changedFiles ?? ["src/server/app.js"]
    },
    {
      title: "contract-hypothesis",
      status: forkBlocked ? "blocked" : contract.status,
      command: "agent --focus shared-contract",
      lines: forkBlocked
        ? blockedLines
        : [
            `sandbox: ${compactId(contract.sandboxId)}`,
            "writes: fix-candidate.md",
            "forks: contract-minimal, contract-with-regression-test",
            `verdict: ${contract.verdict ?? "best"}`
          ],
      tags: ["src/shared/couponContract.js", "fix-candidate.md"]
    }
  ];

  splitTerminals.innerHTML = panes.map(renderTerminalPane).join("");

  const streamLines = runLogs?.length ? runLogs : [];
  consoleStream.textContent = streamLines.length
    ? streamLines.join("\n")
    : "No advanced Daytona probe started.";
}

function renderMultiLevelTree(levels) {
  if (!multiLevelTree) return;

  multiLevelTree.innerHTML = (levels ?? [])
    .map(
      (level) => `<section class="tree-level">
        <header class="tree-level-head">
          <span class="level-number">L${text(level.level)}</span>
          <div>
            <h3>${text(level.title)}</h3>
            <p>${text(level.why)}</p>
          </div>
        </header>
        <div class="tree-level-nodes">
          ${(level.nodes ?? [])
            .map(
              (node) => `<article class="tree-level-node ${slug(node.status)}">
                <div class="tree-level-node-head">
                  <span class="pill ${pillClass(node.status, node.status)}">${text(node.status)}</span>
                  <strong>${text(node.name)}</strong>
                </div>
                <div class="lineage-grid">
                  <span><b>from</b>${text(node.parent)}</span>
                  <span><b>sandbox</b>${text(node.sandboxId ?? "not created")}</span>
                </div>
                <p>${text(node.whyItMatters)}</p>
                <div class="state-chip-row">
                  ${renderTags(node.inherits)}
                </div>
                <div class="writes-row">
                  <b>writes</b>
                  ${renderTags(node.writes)}
                </div>
              </article>`
            )
            .join("")}
        </div>
      </section>`
    )
    .join("");
}

function renderCloneComparison(comparison) {
  if (!cloneFanout || !forkedStateTree) return;

  const renderSide = (item, listKey) => `<div>
    <strong>${text(item?.title)}</strong>
    <p>${text(item?.summary)}</p>
    <pre>${text(item?.tree)}</pre>
    <ul>
      ${(item?.[listKey] ?? []).map((entry) => `<li>${text(entry)}</li>`).join("")}
    </ul>
  </div>`;

  cloneFanout.innerHTML = renderSide(comparison?.cloneFanOut, "limits");
  forkedStateTree.innerHTML = renderSide(comparison?.forkedStateTree, "benefits");
}

function renderState(rows) {
  parentState.innerHTML = rows
    .map(
      ([label, value]) => `<div class="check">
        <span class="dot"></span>
        <strong>${text(label)}</strong>
        <span>${text(value)}</span>
      </div>`
    )
    .join("");
}

function renderSteps(rows) {
  steps.innerHTML = rows
    .map(
      ([label, status, detail]) => `<div class="step ${slug(status)}">
        <span class="dot"></span>
        <strong>${text(label)}</strong>
        <span>${text(status)}</span>
        <p style="grid-column:2 / span 2;color:#667085;font-size:12px;line-height:1.35">${text(
          detail
        )}</p>
      </div>`
    )
    .join("");
}

function renderTerminals(items) {
  terminals.innerHTML = items
    .map(
      (item) => `<section class="terminal">
        <header><span>${text(item.title)}</span><span>${text(item.command)}</span></header>
        <pre>${text(item.output)}</pre>
      </section>`
    )
    .join("");
}

function renderValidators(items) {
  validators.innerHTML = items
    .map(
      (item) => `<article class="validator">
        <span class="pill ${item.greenLight ? "best" : "partial"}">${
          item.greenLight ? "green-light" : "needs work"
        }</span>
        <h3>${text(item.name)}</h3>
        <p>${text(item.strategy)}</p>
        <div class="meta">
          <span>id: ${text(item.sandboxId ?? "not created")}</span>
          <span>inherits: ${text(item.inherits)}</span>
          <span>output: ${text(item.output)}</span>
        </div>
        <p class="green-light">${text(item.verdict)}</p>
      </article>`
    )
    .join("");
}

function renderForkEvents(items) {
  forkEvents.innerHTML = items
    .map((item, index) => {
      const inherited = item.inheritedState ?? (item.stateBeforeFork ? [item.stateBeforeFork] : []);
      return `<article class="fork-event ${slug(item.status ?? "")}">
        <div class="fork-event-index">${index + 1}</div>
        <div class="fork-event-main">
          <div class="fork-event-head">
            <div>
              <strong>${text(item.fork)}</strong>
              <span>${text(item.status ?? "event")}</span>
            </div>
            <time>${text(item.at ?? "simulated")}</time>
          </div>
          <div class="fork-event-grid">
            <span><b>from</b>${text(item.from)}</span>
            <span><b>sandbox</b>${text(item.sandboxId ?? "not created")}</span>
            <span><b>parent id</b>${text(item.parentSandboxId ?? "none")}</span>
          </div>
          <p><b>action:</b> ${text(item.action ?? item.does)}</p>
          <p><b>result:</b> ${text(item.result ?? "")}</p>
          <div class="fork-inherited">
            ${inherited.map((state) => `<span>${text(state)}</span>`).join("")}
          </div>
        </div>
      </article>`;
    })
    .join("");
}

function renderMemoryProbe(item) {
  memoryProbe.innerHTML = `<article class="memory-card">
    <span class="pill ${item?.status === "observed" ? "best" : "partial"}">${text(
      item?.status ?? "not-run"
    )}</span>
    <h3>${text(item?.name ?? "memory-state-check")}</h3>
    <p><strong>Fork point:</strong> ${text(item?.forkPoint)}</p>
    <p><strong>What changes before fork:</strong> ${text(item?.whatChangesBeforeFork)}</p>
    <p><strong>Expected observation:</strong> ${text(item?.expectedObservation)}</p>
    <p><strong>Result:</strong> ${text(item?.result)}</p>
  </article>`;
}

function renderDemoStepChecklist() {
  const bugReady = bugWasReplicated();
  const runStarted = currentRunStatus !== "idle";
  const runComplete = currentRunStatus === "complete";
  const liveFailed = currentRunStatus === "failed";
  const items = [
    {
      label: "Always-on console",
      detail: "Root page includes checkout, fork tree, controls, logs, and comparisons.",
      status: "complete"
    },
    {
      label: "Server reproduction state",
      detail: bugReady
        ? `Recorded in data/demo-session-state.json at ${demoSession.reproducedAt ?? "unknown time"}.`
        : "Apply SUMMER-2026 and checkout to write the server-side reproduction event.",
      status: bugReady ? "complete" : "pending"
    },
    {
      label: "Static fork commands",
      detail: bugReady
        ? "Run npm run demo:codex for the prompt-driven agent flow. Use demo:branch/validators/report only when you want to slow the recording down."
        : "Run the browser bug first so demo:codex can fork and test the hypotheses from the prepared parent.",
      status: bugReady ? "running" : "pending"
    },
    {
      label: "Structured fork log",
      detail: "Fork Spawn Log lists each fork, parent, inherited state, action, and result.",
      status: "complete"
    },
    {
      label: "Multi-level forking",
      detail: "Hypothesis forks lead to contract candidate and validator branches.",
      status: "complete"
    },
    {
      label: "Memory probe",
      detail: "Live run warms a process before forking and logs the observed result.",
      status: "complete"
    },
    {
      label: "Advanced Daytona live probe",
      detail: runComplete
        ? "Live run completed."
        : liveFailed
          ? "Live run failed; check the log panel."
          : runStarted
            ? "Live run is in progress or has produced logs."
            : "Advanced capability check only; the local recording path does not need Daytona credentials.",
      status: runComplete ? "complete" : runStarted ? "running" : "pending"
    },
    {
      label: "Review artifacts",
      detail: "After a live run, capture screenshots and decide whether to keep sandboxes.",
      status: runComplete ? "running" : "pending"
    }
  ];

  demoStepChecklist.innerHTML = items
    .map(
      (item, index) => `<article class="demo-step ${item.status}">
        <span class="step-number">${index + 1}</span>
        <div>
          <strong>${text(item.label)}</strong>
          <p>${text(item.detail)}</p>
        </div>
      </article>`
    )
    .join("");
}

async function loadDemoSession() {
  const response = await fetch(sessionUrl);
  demoSession = await response.json();
  return demoSession;
}

function bugWasReplicated() {
  return Boolean(demoSession.bugReproduced);
}

function updateReplicationGate() {
  const replicated = bugWasReplicated();
  replicationStatus.textContent = replicated ? "yes" : "not yet";
  daytonaKey.disabled = !replicated;
  daytonaStart.disabled = !replicated;
  daytonaStart.textContent = replicated ? "Run advanced Daytona probe" : "Waiting for reproduction";
  serverStateLabel.textContent = replicated ? "bugReproduced: true" : "bugReproduced: false";
  serverStateDetail.textContent = replicated
    ? `Persisted at ${demoSession.reproducedAt ?? "unknown time"} in data/demo-session-state.json.`
    : "Server is waiting for SUMMER-2026 to be accepted and checkout to fail generically.";

  if (!replicated) {
    daytonaFormStatus.textContent =
      "Replicate the bug first: apply SUMMER-2026, then checkout. Then run npm run demo:codex.";
  } else if (sessionStorage.getItem("daytonaRunSubmitted") === "true") {
    daytonaFormStatus.textContent = "Daytona key submitted for this browser session. This is separate from npm run demo:agent.";
  } else {
    daytonaFormStatus.textContent =
      "Bug replicated. Recommended next step: npm run demo:codex. Use this advanced probe only with a valid Daytona dtn_ key.";
  }

  renderDemoStepChecklist();
}

async function startDaytonaRun(event) {
  event.preventDefault();

  if (!bugWasReplicated()) {
    await loadDemoSession();
    updateReplicationGate();
    return;
  }

  const apiKey = daytonaKey.value.trim();
  if (!apiKey) {
    daytonaFormStatus.textContent = "Enter a Daytona API key.";
    return;
  }

  daytonaFormStatus.textContent = "Starting advanced Daytona probe...";
  daytonaStart.disabled = true;

  const response = await fetch("/api/daytona-run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey })
  });
  const payload = await response.json();
  daytonaKey.value = "";

  if (!response.ok) {
    daytonaFormStatus.textContent = payload.error ?? "Could not start Daytona run.";
    daytonaStart.disabled = false;
    pollRun();
    return;
  }

  sessionStorage.setItem("daytonaRunSubmitted", "true");
  daytonaFormStatus.textContent = "Advanced Daytona probe started. Logs will update below.";
  pollRun();
}

async function pollRun() {
  try {
    const response = await fetch("/api/daytona-run");
    const run = await response.json();
    currentRunStatus = run.status ?? "unknown";
    liveLog.textContent = (run.logs ?? []).join("\n") || "Live run started; waiting for output.";
    renderOperatorConsole(lastState ?? {}, run.logs ?? []);
    document.querySelector("#live-status").textContent = currentRunStatus;
    renderDemoStepChecklist();

    if (currentRunStatus === "running") {
      setTimeout(pollRun, 2000);
    } else {
      daytonaStart.disabled = !bugWasReplicated();
      await loadDemoSession();
      await load();
    }
  } catch (error) {
    liveLog.textContent = `Could not read live run status: ${error.message}`;
  }
}

async function resetDemoSession() {
  resetSession.disabled = true;
  try {
    const response = await fetch("/api/demo-session/reset", {
      method: "POST"
    });
    demoSession = await response.json();
    sessionStorage.removeItem("daytonaRunSubmitted");
    daytonaFormStatus.textContent =
      "Reproduction reset. Apply SUMMER-2026, then checkout to unlock forking.";
    updateReplicationGate();
  } finally {
    resetSession.disabled = false;
  }
}

async function load() {
  const [stateResponse] = await Promise.all([fetch(stateUrl), loadDemoSession()]);
  const state = await stateResponse.json();
  lastState = state;

  document.querySelector("#mode").textContent = state.mode ?? "unknown";
  document.querySelector("#live-status").textContent = state.liveRun?.status ?? "unknown";
  document.querySelector("#headline").textContent = state.headline ?? "";

  tree.innerHTML = `${renderLines()}${(state.nodes ?? []).map(renderNode).join("")}`;
  renderState(state.parentState ?? []);
  renderSteps(state.steps ?? []);
  renderTerminals(state.terminals ?? []);
  renderValidators(state.validatorWorkers ?? []);
  renderForkEvents(state.forkEvents ?? []);
  renderMemoryProbe(state.memoryProbe ?? {});
  renderMultiLevelTree(state.forkTreeLevels ?? []);
  renderCloneComparison(state.cloneComparison ?? {});
  renderOperatorConsole(state);

  document.querySelector("#agent-pattern").textContent =
    state.agentPattern?.feedbackIncorporated ?? "";
  candidateState.innerHTML = (state.agentPattern?.candidateFixState ?? [])
    .map((item) => `<li>${text(item)}</li>`)
    .join("");
  updateReplicationGate();
}

daytonaForm.addEventListener("submit", startDaytonaRun);
resetSession.addEventListener("click", resetDemoSession);
window.addEventListener("demo-session-updated", async () => {
  await loadDemoSession();
  updateReplicationGate();
});

load().catch((error) => {
  tree.innerHTML = `<article class="node parent"><span class="pill error">error</span><h3>Could not load state</h3><p>${error.message}</p></article>`;
});
setInterval(() => {
  load().catch(() => {});
}, 3000);
pollRun();
