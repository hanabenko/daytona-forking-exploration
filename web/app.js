const nodes = new Map();
const states = new Map();
const timeline = [];
let startedAt = null;
let clockTimer = null;

const positions = {
  parent: [70, 126],
  "strategy-1": [340, 48],
  "strategy-2": [340, 154],
  "strategy-3": [340, 260],
  "strategy-1-refine": [620, 48],
};

const parents = {
  "strategy-1": "parent",
  "strategy-2": "parent",
  "strategy-3": "parent",
  "strategy-1-refine": "strategy-1",
};

const els = {
  sdkStatus: document.querySelector("#sdkStatus"),
  authStatus: document.querySelector("#authStatus"),
  phaseStatus: document.querySelector("#phaseStatus"),
  reportPath: document.querySelector("#reportPath"),
  runClock: document.querySelector("#runClock"),
  branchCount: document.querySelector("#branchCount"),
  eventCount: document.querySelector("#eventCount"),
  graph: document.querySelector("#forkGraph"),
  branchList: document.querySelector("#branchList"),
  timeline: document.querySelector("#timeline"),
  stateTable: document.querySelector("#stateTable"),
  liveRun: document.querySelector("#liveRun"),
  demoRun: document.querySelector("#demoRun"),
  keepSandboxes: document.querySelector("#keepSandboxes"),
};

function setPhase(value) {
  els.phaseStatus.textContent = value;
}

function upsertNode(id, patch = {}) {
  const current = nodes.get(id) || {
    id,
    parent: parents[id] || null,
    status: "pending",
    sandboxId: "",
    counter: "",
  };
  nodes.set(id, { ...current, ...patch, id, parent: patch.parent || current.parent });
  render();
}

function addTimeline(line) {
  timeline.push(line);
  if (timeline.length > 120) timeline.shift();
  els.eventCount.textContent = String(timeline.length);
  renderTimeline();
}

function renderTimeline() {
  els.timeline.replaceChildren(
    ...timeline.map((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      return li;
    }),
  );
  els.timeline.scrollTop = els.timeline.scrollHeight;
}

function edgeBetween(fromId, toId) {
  const from = positions[fromId];
  const to = positions[toId];
  if (!from || !to) return null;
  const startX = from[0] + 178;
  const startY = from[1] + 39;
  const endX = to[0];
  const endY = to[1] + 39;
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const edge = document.createElement("div");
  edge.className = "edge";
  edge.style.left = `${startX}px`;
  edge.style.top = `${startY}px`;
  edge.style.width = `${length}px`;
  edge.style.transform = `rotate(${angle}deg)`;
  return edge;
}

function render() {
  const activeNodes = [...nodes.values()];
  els.branchCount.textContent = String(activeNodes.length);

  const graphChildren = [];
  for (const node of activeNodes) {
    if (node.parent && nodes.has(node.parent)) {
      const edge = edgeBetween(node.parent, node.id);
      if (edge) graphChildren.push(edge);
    }
  }

  for (const node of activeNodes) {
    const [left, top] = positions[node.id] || [70, 126 + graphChildren.length * 94];
    const item = document.createElement("article");
    item.className = `node ${node.status || "pending"}`;
    item.style.left = `${left}px`;
    item.style.top = `${top}px`;
    item.innerHTML = `
      <strong>${escapeHtml(node.id)}</strong>
      <span>${escapeHtml(node.status || "pending")}</span>
      <code>${escapeHtml(node.sandboxId || "awaiting id")}</code>
      <span>${node.counter ? `counter ${escapeHtml(String(node.counter))}` : ""}</span>
    `;
    graphChildren.push(item);
  }
  els.graph.replaceChildren(...graphChildren);

  els.branchList.replaceChildren(
    ...activeNodes.map((node) => {
      const item = document.createElement("article");
      item.className = `branch ${node.status || "pending"}`;
      item.innerHTML = `
        <strong>${escapeHtml(node.id)}</strong>
        <span>${escapeHtml(node.parent ? `parent ${node.parent}` : "root")}</span>
        <code>${escapeHtml(node.sandboxId || "awaiting id")}</code>
        <span>${escapeHtml(node.status || "pending")}</span>
      `;
      return item;
    }),
  );
}

function renderStates() {
  const rows = [...states.entries()].map(([id, state]) => {
    const row = document.createElement("div");
    row.className = "state-row";
    row.innerHTML = `
      <strong>${escapeHtml(id)}</strong>
      <strong>${escapeHtml(String(state.counter ?? ""))}</strong>
      <span>${escapeHtml((state.events || []).join(", "))}</span>
    `;
    return row;
  });
  els.stateTable.replaceChildren(...rows);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadPreflight() {
  const res = await fetch("/api/preflight");
  const data = await res.json();
  els.sdkStatus.textContent = data.daytonaSdk ? "ready" : "missing";
  els.authStatus.textContent = data.auth ? "ready" : "missing";
  els.liveRun.disabled = !data.canRunLive || data.running;
  return data;
}

function connectEvents() {
  const source = new EventSource("/events");
  source.onmessage = (event) => handleEvent(JSON.parse(event.data));
  const types = ["connected", "reset", "phase", "preflight", "node", "state", "log", "report", "done", "error"];
  for (const type of types) {
    source.addEventListener(type, (event) => handleEvent(JSON.parse(event.data)));
  }
}

function handleEvent(event) {
  const payload = event.payload || {};
  if (event.type === "reset") {
    nodes.clear();
    states.clear();
    timeline.length = 0;
    startedAt = performance.now();
    startClock();
    els.reportPath.textContent = "none";
    setPhase("starting");
    render();
    renderStates();
    renderTimeline();
  } else if (event.type === "phase") {
    setPhase(payload.name || "running");
  } else if (event.type === "preflight") {
    els.sdkStatus.textContent = payload.daytonaSdk ? "ready" : "missing";
    els.authStatus.textContent = payload.auth ? "ready" : "missing";
  } else if (event.type === "node") {
    upsertNode(payload.id, payload);
  } else if (event.type === "state") {
    states.set(payload.id, payload);
    upsertNode(payload.id, { counter: payload.counter, status: "complete" });
    renderStates();
  } else if (event.type === "log") {
    addTimeline(payload.line || "");
  } else if (event.type === "report") {
    els.reportPath.textContent = payload.path || "written";
    addTimeline(`report: ${payload.path || "written"}`);
  } else if (event.type === "done") {
    setPhase("done");
    stopClock();
    els.liveRun.disabled = false;
    els.demoRun.disabled = false;
    loadPreflight();
  } else if (event.type === "error") {
    setPhase("error");
    stopClock();
    addTimeline(`error: ${payload.message || `exit ${payload.exitCode}`}`);
    els.liveRun.disabled = false;
    els.demoRun.disabled = false;
    loadPreflight();
  }
}

function startClock() {
  stopClock();
  clockTimer = window.setInterval(() => {
    if (!startedAt) return;
    const elapsed = (performance.now() - startedAt) / 1000;
    els.runClock.textContent = `${elapsed.toFixed(1)}s`;
  }, 100);
}

function stopClock() {
  if (clockTimer) window.clearInterval(clockTimer);
  clockTimer = null;
}

async function startRun(mode) {
  els.liveRun.disabled = true;
  els.demoRun.disabled = true;
  const res = await fetch("/api/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode, keep: els.keepSandboxes.checked }),
  });
  if (!res.ok) {
    const data = await res.json();
    handleEvent({ type: "error", payload: { message: data.error || "start failed" } });
  }
}

els.liveRun.addEventListener("click", () => startRun("live"));
els.demoRun.addEventListener("click", () => startRun("demo"));

upsertNode("parent", { status: "pending" });
loadPreflight();
connectEvents();
