import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { projectPath } from "./state-utils.js";

const screenshotsDir = projectPath("docs", "screenshots");
const pagesDir = join(screenshotsDir, "pages");
mkdirSync(pagesDir, { recursive: true });

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --ink: #ffffff;
        --muted: #a2a2a2;
        --line: #414141;
        --page: #0a0a0a;
        --panel: #161616;
        --blue: #2ecc71;
        --green: #2ecc71;
        --amber: #f1c40f;
        --red: #e74c3c;
        --terminal: #0a0a0a;
        --surface-soft: #252525;
        --green-bright: #00e49a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--page);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main { width: 1000px; margin: 0 auto; padding: 34px; }
      h1 { margin: 0; font-size: 34px; line-height: 1.05; letter-spacing: 0; }
      h2, h3, p { margin: 0; }
      .eyebrow {
        margin: 0 0 8px;
        color: var(--blue);
        font-size: 13px;
        font-weight: 900;
        letter-spacing: 0;
        text-transform: uppercase;
      }
      .sub { margin: 10px 0 22px; color: var(--muted); font-size: 15px; line-height: 1.45; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
      .metric, .card {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        padding: 16px;
      }
      .metric span {
        display: block;
        margin-bottom: 6px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 900;
        text-transform: uppercase;
      }
      .metric strong { font-size: 24px; }
      .terminal {
        margin-top: 16px;
        padding: 18px;
        border-radius: 8px;
        background: var(--terminal);
        color: #fafafa;
        font: 12px/1.38 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        white-space: pre-wrap;
      }
      .terminal .dim { color: var(--muted); }
      .terminal .ok { color: var(--green-bright); }
      .terminal .warn { color: #fcd34d; }
      table {
        width: 100%;
        border-collapse: collapse;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }
      th, td { padding: 11px 13px; border-bottom: 1px solid var(--line); text-align: left; font-size: 13px; }
      th { color: var(--ink); background: var(--surface-soft); font-size: 12px; text-transform: uppercase; }
      .bar-wrap { width: 100%; height: 10px; border-radius: 999px; background: var(--surface-soft); }
      .bar { height: 10px; border-radius: 999px; background: var(--blue); }
      .fork-tree {
        position: relative;
        height: 650px;
        margin-top: 20px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }
      .node {
        position: absolute;
        width: 190px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        box-shadow: 0 12px 28px rgb(30 36 48 / 8%);
      }
      .node strong { display: block; margin-bottom: 6px; font-size: 15px; }
      .node p { color: var(--muted); font-size: 12px; line-height: 1.35; }
      .node.parent { left: 385px; top: 26px; border-color: var(--green); background: color-mix(in srgb, var(--green) 13%, var(--panel)); }
      .node.frontend { left: 60px; top: 220px; }
      .node.backend { left: 385px; top: 220px; }
      .node.contract { left: 710px; top: 220px; border-color: var(--green); background: color-mix(in srgb, var(--green) 13%, var(--panel)); }
      .node.minimal { left: 560px; top: 470px; }
      .node.regression { left: 760px; top: 470px; border-color: var(--green); background: color-mix(in srgb, var(--green) 13%, var(--panel)); }
      .line {
        position: absolute;
        height: 2px;
        background: var(--line);
        transform-origin: left center;
      }
      .l1 { left: 480px; top: 148px; width: 340px; transform: rotate(27deg); }
      .l2 { left: 480px; top: 148px; width: 170px; transform: rotate(90deg); }
      .l3 { left: 480px; top: 148px; width: 340px; transform: rotate(153deg); }
      .l4 { left: 805px; top: 348px; width: 170px; transform: rotate(128deg); }
      .l5 { left: 805px; top: 348px; width: 150px; transform: rotate(55deg); }
      .caption { margin-top: 14px; color: var(--muted); font-size: 13px; line-height: 1.45; }
      .semantic-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 18px; }
      .semantic-grid img { width: 100%; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

function currentUiPage(title, body, extraStyle = "") {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="../../../src/client/styles.css" />
    <link rel="stylesheet" href="../../../src/client/forking-demo.css" />
    <style>
      body { background: #0a0a0a; }
      .guide-shot {
        width: 1040px !important;
        max-width: 1040px !important;
        margin: 0 auto !important;
        padding: 24px !important;
      }
      .guide-shot .topbar { display: flex; margin-bottom: 18px; }
      .guide-shot .topbar nav { display: none; }
      .guide-shot .topbar h1 { max-width: 900px; font-size: 38px; }
      .guide-shot .repro-workbench { margin-top: 0; }
      .guide-shot .operator-console-panel.simple-hypothesis-panel { margin-top: 16px; }
      .guide-shot h1,
      .guide-shot h2,
      .guide-shot h3,
      .guide-shot p,
      .guide-shot strong,
      .guide-shot span {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .guide-shot .terminal-tags { padding: 0; }
      .guide-shot .terminal-tags span {
        color: #00e49a;
        background: #111111;
        border-color: #414141;
      }
      .guide-shot .pill {
        display: inline-flex;
        width: fit-content;
        padding: 4px 8px;
        border: 1px solid #414141;
        border-radius: 999px;
        color: #00e49a;
        background: #111111;
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
      }
      .guide-card {
        min-width: 0;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        padding: 18px;
      }
      .guide-terminal {
        min-width: 0;
        overflow: hidden;
        border: 1px solid #334155;
        border-radius: 8px;
        background: #111827;
      }
      .guide-terminal header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        color: #cbd5e1;
        background: #172033;
        font-size: 12px;
        font-weight: 900;
      }
      .guide-terminal pre {
        margin: 0;
        padding: 16px;
        color: #fafafa;
        font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .guide-state-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: 16px;
      }
      .guide-checklist {
        display: grid;
        gap: 10px;
      }
      .guide-check {
        min-width: 0;
        display: grid;
        grid-template-columns: 12px minmax(0, 1fr) 26px;
        gap: 10px;
        align-items: center;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }
      .guide-check .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--green);
      }
      .guide-check strong { font-size: 13px; }
      .guide-check span:last-child { color: var(--green); font-size: 12px; font-weight: 900; }
      .guide-fork-tree {
        position: relative;
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        grid-template-rows: repeat(3, minmax(128px, auto));
        gap: 24px 14px;
        min-height: 520px;
        padding: 18px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #111111;
      }
      .guide-fork-tree .node { min-height: 126px; box-shadow: none; }
      .guide-fork-tree .node.parent { grid-column: 3 / span 2; grid-row: 1; }
      .guide-fork-tree .node.frontend-hypothesis { grid-column: 1 / span 2; grid-row: 2; }
      .guide-fork-tree .node.backend-hypothesis { grid-column: 3 / span 2; grid-row: 2; }
      .guide-fork-tree .node.contract-hypothesis { grid-column: 5 / span 2; grid-row: 2; }
      .guide-fork-tree .node.contract-minimal { grid-column: 4 / span 2; grid-row: 3; }
      .guide-fork-tree .node.contract-with-regression-test { grid-column: 6 / span 1; grid-row: 3; }
      .guide-level-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .guide-level {
        min-width: 0;
        display: grid;
        grid-template-columns: 220px minmax(0, 1fr);
        gap: 12px;
        align-items: start;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }
      .guide-level header {
        display: grid;
        grid-template-columns: 36px 1fr;
        gap: 8px;
        align-items: start;
        margin-bottom: 0;
      }
      .guide-level-number {
        display: grid;
        width: 36px;
        height: 36px;
        place-items: center;
        border-radius: 999px;
        color: #06140d;
        background: var(--blue);
        font-size: 12px;
        font-weight: 900;
      }
      .guide-level header h2 {
        margin: 0 0 5px;
        font-size: 16px;
      }
      .guide-level header p {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.35;
      }
      .guide-level-nodes {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 10px;
      }
      .guide-level-node {
        display: grid;
        gap: 8px;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #111111;
      }
      .guide-level-node.prepared,
      .guide-level-node.changed {
        border-color: var(--green);
        background: color-mix(in srgb, var(--green) 13%, var(--panel));
      }
      .guide-level-node strong {
        font-size: 14px;
      }
      .guide-level-node p {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.35;
      }
      .guide-level-arrow {
        grid-column: 2;
        margin: 0;
        color: var(--muted);
        font: 18px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        text-align: left;
      }
      .guide-semantic-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .guide-semantic-grid img {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }
      ${extraStyle}
    </style>
  </head>
  <body>
    <main class="console unified-console guide-shot">${body}</main>
  </body>
</html>`;
}

function topbar(eyebrow, title) {
  return `<header class="topbar">
    <div>
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(title)}</h1>
    </div>
  </header>`;
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function readLiveLog() {
  const raw = existsSync(projectPath("logs", "daytona-live-run.txt"))
    ? readFileSync(projectPath("logs", "daytona-live-run.txt"), "utf8")
    : "";
  return raw
    .split(/\r?\n/)
    .filter((line) => !line.includes("[continue]"))
    .filter((line) => !line.includes("Effective snapshot candidates"))
    .join("\n")
    .trim();
}

function formatSeconds(value) {
  const seconds = Number(value ?? 0);
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${seconds.toFixed(2)}s`;
}

function liveTerminalPage() {
  const liveLog = readLiveLog();
  const excerpt = liveLog
    .replaceAll("Not run in recording profile\n", "")
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("Sandboxes kept in Daytona."))
    .slice(0, 82)
    .join("\n");
  return page(
    "Live Daytona Forking Run",
    `<p class="eyebrow">Live recording path</p>
      <h1>Prepared Parent, Hypothesis Forks, Fork-A-Fork</h1>
      <p class="sub">Current demo command: <code>npm run demo:codex:live</code>. The default path stops after the multi-level fork tree to stay under the Daytona CPU limit.</p>
      <section class="terminal">${escapeHtml(excerpt)}</section>`
  );
}

function liveLatencyPage() {
  const metrics = readJson(projectPath("logs", "daytona-live-latency.json"), []);
  const forkRows = metrics.filter((item) => item.operation.startsWith("fork "));
  const totalForkSeconds = forkRows.reduce((sum, item) => sum + Number(item.seconds ?? 0), 0);
  const maxSeconds = Math.max(1, ...metrics.map((item) => Number(item.seconds ?? 0)));
  const rows = metrics.filter((item) => !item.operation.startsWith("delete sandbox"));
  return page(
    "Measured Live Fork Latencies",
    `<p class="eyebrow">Measured SDK timings</p>
      <h1>Latency Of Reusing Prepared State</h1>
      <p class="sub">Rows are measured around Daytona SDK operations from the latest successful shortened live run.</p>
      <div class="metrics">
        <div class="metric"><span>fork operations</span><strong>${forkRows.length}</strong></div>
        <div class="metric"><span>fork latency sum</span><strong>${formatSeconds(totalForkSeconds)}</strong></div>
        <div class="metric"><span>parent create</span><strong>${formatSeconds(metrics.find((item) => item.operation.startsWith("create parent"))?.seconds)}</strong></div>
        <div class="metric"><span>profile</span><strong>recording</strong></div>
      </div>
      <table>
        <thead><tr><th>Operation</th><th>Status</th><th>Latency</th><th></th></tr></thead>
        <tbody>
          ${rows
            .map((row) => {
              const seconds = Number(row.seconds ?? 0);
              const width = Math.max(4, Math.round((seconds / maxSeconds) * 100));
              return `<tr>
                <td>${escapeHtml(row.operation)}</td>
                <td>${escapeHtml(row.status)}</td>
                <td>${formatSeconds(seconds)}</td>
                <td><div class="bar-wrap"><div class="bar" style="width:${width}%"></div></div></td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>`
  );
}

function currentForkTreePage() {
  return page(
    "Current Recording Fork Tree",
    `<p class="eyebrow">Current demo tree</p>
      <h1>Fork After Useful State Exists</h1>
      <p class="sub">The parent contains cloned repo state, installed dependencies, build artifacts, seeded coupon data, failing logs, a debug brief, and a state marker before any branch is created.</p>
      <section class="fork-tree">
        <span class="line l1"></span><span class="line l2"></span><span class="line l3"></span><span class="line l4"></span><span class="line l5"></span>
        <article class="node parent"><strong>coupon-parent-prepared</strong><p>Bug reproduced, tests/logs collected, debug brief written.</p></article>
        <article class="node frontend"><strong>frontend-hypothesis</strong><p>Test UI validation theory in an isolated future.</p></article>
        <article class="node backend"><strong>backend-hypothesis</strong><p>Test checkout/API validation theory in an isolated future.</p></article>
        <article class="node contract"><strong>contract-hypothesis</strong><p>Writes fix-candidate.md before becoming the next fork point.</p></article>
        <article class="node minimal"><strong>contract-minimal</strong><p>Fork of the changed contract branch.</p></article>
        <article class="node regression"><strong>contract-with-regression-test</strong><p>Fork of the changed contract branch with explicit SUMMER-2026 coverage.</p></article>
      </section>`
  );
}

function stateSemanticsPage() {
  return page(
    "Sandbox Lifecycle Semantics",
    `<p class="eyebrow">Lifecycle semantics</p>
      <h1>Do Not Collapse Stop, Pause, Fork, Snapshot</h1>
      <p class="sub">The guide should make conservative, concrete claims about which state each operation reuses.</p>
      <section class="semantic-grid">
        <img src="../../../docs/graphs/state-layers.svg" alt="State layers" />
        <img src="../../../docs/graphs/lifecycle-comparison.svg" alt="Lifecycle comparison" />
      </section>`
  );
}

function currentBugPage() {
  return currentUiPage(
    "Guide Insert: Broken Coupon UI",
    `${topbar("Coding agents + sandbox forking", "Prepare once. Fork the investigation.")}
      <section class="repro-workbench" aria-label="Bug reproduction">
        <section class="checkout" aria-labelledby="checkout-title">
          <div class="copy">
            <p class="eyebrow">Captured bug state</p>
            <h2 id="checkout-title" class="repro-title">Coupon Bug Baseline</h2>
            <p class="lead">
              A coding agent has reproduced a real checkout failure and written the useful
              evidence to disk. From this prepared state, forked agents can test competing fixes
              without repeating setup.
            </p>
          </div>

          <div class="panel">
            <div class="product">
              <div class="product-art" aria-hidden="true">10</div>
              <div>
                <h2>Agent Runtime Pack</h2>
                <p>Seeded checkout fixture</p>
              </div>
              <strong>$42.00</strong>
            </div>

            <form class="coupon-form">
              <label for="coupon">Coupon code</label>
              <div class="coupon-row">
                <input id="coupon" name="coupon" value="SUMMER-2026" autocomplete="off" />
                <button type="button">Apply</button>
              </div>
              <p class="message ok">Coupon accepted: SUMMER-2026</p>
            </form>

            <div class="totals" aria-live="polite">
              <div><span>Subtotal</span><strong>$42.00</strong></div>
              <div><span>Discount</span><strong>$0.00</strong></div>
              <div class="total"><span>Total</span><strong>$42.00</strong></div>
            </div>

            <button class="checkout-button">Checkout</button>
            <p class="message error">Checkout failed. Please try another payment method.</p>

            <div class="bug-location">
              <strong>Bug appears here</strong>
              <span>After Apply: <code>Coupon accepted: SUMMER-2026</code></span>
              <span>After Checkout: <code>generic checkout error shown above</code></span>
            </div>
          </div>
        </section>
      </section>

      <section class="operator-console-panel simple-hypothesis-panel" aria-label="Forked agent paths">
        <div class="operator-console-head">
          <div>
            <p class="eyebrow">Forked agent paths</p>
            <h2>Same parent state, different debugging strategies</h2>
          </div>
        </div>
        <div class="terminal-split-grid">
          <article class="hypothesis-card">
            <span class="pill">hypothesis</span>
            <h3>Frontend validation</h3>
            <p class="hypothesis-focus">Could the form be accepting SUMMER-2026 too early?</p>
            <p>Test whether the first bad state enters through the browser validation path.</p>
            <strong>Hypothesis to test</strong>
            <div class="terminal-tags"><span>src/client/app.js</span></div>
          </article>
          <article class="hypothesis-card">
            <span class="pill">hypothesis</span>
            <h3>Backend/API validation</h3>
            <p class="hypothesis-focus">Could checkout be rejecting the coupon too late?</p>
            <p>Test whether the API response shape or checkout validation timing is the real failure point.</p>
            <strong>Hypothesis to test</strong>
            <div class="terminal-tags"><span>src/server/app.js</span></div>
          </article>
          <article class="hypothesis-card">
            <span class="pill">hypothesis</span>
            <h3>Shared coupon contract</h3>
            <p class="hypothesis-focus">Could the UI and API be using the wrong shared rule?</p>
            <p>Test whether one shared coupon rule should decide what both UI and API accept.</p>
            <strong>Hypothesis to test</strong>
            <div class="terminal-tags"><span>src/shared/couponContract.js</span></div>
          </article>
        </div>
      </section>`
  );
}

function currentPreparedParentPage() {
  const stateRows = [
    ["Repo files", "yes"],
    ["Dependencies installed", "yes"],
    ["Build artifacts", "yes"],
    ["Seeded coupon data", "yes"],
    ["Failing baseline logs", "yes"],
    ["Debug brief", "yes"],
    ["State marker", "yes"],
    ["Benchmark output", "yes"]
  ];
  return currentUiPage(
    "Guide Insert: Prepared Parent State",
    `${topbar("Preparing the parent sandbox", "Useful State Exists Before Forking")}
      <section class="guide-state-grid">
        <section class="guide-terminal">
          <header><span>npm run inspect-state</span><span>prepared parent</span></header>
          <pre>&gt; daytona-forking-coupon-demo@0.1.0 inspect-state
&gt; node scripts/inspect-state.js

repo present: yes
dependencies installed: yes
build artifacts present: yes
seeded coupon data present: yes
debug-brief.md present: yes
failing baseline log present: yes
state-marker.txt present: yes
env configured: yes
app can start: yes</pre>
        </section>
        <aside class="guide-card">
          <p class="eyebrow">Parent state before fork</p>
          <h2>coupon-parent-prepared</h2>
          <p style="margin:10px 0 16px;color:var(--muted);font-size:14px;line-height:1.45">
            Children inherit setup and debugging artifacts written to disk.
          </p>
          <div class="guide-checklist">
            ${stateRows
              .map(
                ([label, value]) => `<div class="guide-check"><span class="dot"></span><strong>${label}</strong><span>${value}</span></div>`
              )
              .join("")}
          </div>
        </aside>
      </section>`
  );
}

function currentLiveTerminalPage() {
  const liveLog = readLiveLog();
  const excerpt = liveLog
    .replaceAll("Not run in recording profile\n", "")
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("Sandboxes kept in Daytona."))
    .slice(0, 78)
    .join("\n");
  return currentUiPage(
    "Guide Insert: Live Daytona Forking Run",
    `${topbar("Live walkthrough", "Prepared Parent, Hypothesis Forks, Fork-A-Fork")}
      <section class="guide-terminal">
        <header><span>npm run demo:codex:live</span><span>SDK timings</span></header>
        <pre>${escapeHtml(excerpt)}</pre>
      </section>`,
    `.guide-terminal pre { min-height: 1040px; }`
  );
}

function currentGuideForkTreePage() {
  return currentUiPage(
    "Guide Insert: Current Fork Tree",
    `${topbar("Forking a fork", "The Fork Point Moves Forward With The Investigation")}
      <section class="guide-level-grid">
        <article class="guide-level">
          <header>
            <span class="guide-level-number">L0</span>
            <div>
              <h2>Prepared parent</h2>
              <p>Useful state exists before any branch starts.</p>
            </div>
          </header>
          <div class="guide-level-nodes">
            <section class="guide-level-node prepared">
              <span class="pill">prepared live</span>
              <strong>coupon-parent-prepared</strong>
              <p>Bug reproduced, tests/logs collected, debug brief written, state marker saved.</p>
            </section>
          </div>
          <div class="guide-level-arrow">fork()</div>
        </article>

        <article class="guide-level">
          <header>
            <span class="guide-level-number">L1</span>
            <div>
              <h2>Hypothesis forks</h2>
              <p>Independent futures test different explanations from the same parent.</p>
            </div>
          </header>
          <div class="guide-level-nodes">
            <section class="guide-level-node">
              <span class="pill">hypothesis</span>
              <strong>frontend-hypothesis</strong>
              <p>Does the browser accept bad state too early?</p>
            </section>
            <section class="guide-level-node">
              <span class="pill">hypothesis</span>
              <strong>backend-hypothesis</strong>
              <p>Does checkout/API reject the coupon too late?</p>
            </section>
            <section class="guide-level-node changed">
              <span class="pill">changed branch</span>
              <strong>contract-hypothesis</strong>
              <p>Writes <code>fix-candidate.md</code> and becomes the next fork point.</p>
            </section>
          </div>
          <div class="guide-level-arrow">fork(contract-hypothesis)</div>
        </article>

        <article class="guide-level">
          <header>
            <span class="guide-level-number">L2</span>
            <div>
              <h2>Refinement forks</h2>
              <p>The second fork starts from the changed contract branch.</p>
            </div>
          </header>
          <div class="guide-level-nodes">
            <section class="guide-level-node">
              <span class="pill">fork of fork</span>
              <strong>contract-minimal</strong>
              <p>Package the smallest correct shared-contract patch.</p>
            </section>
            <section class="guide-level-node">
              <span class="pill">fork of fork</span>
              <strong>contract-with-regression-test</strong>
              <p>Add explicit <code>SUMMER-2026</code> regression coverage.</p>
            </section>
          </div>
        </article>
      </section>`
  );
}

function currentGuideStateSemanticsPage() {
  return currentUiPage(
    "Guide Insert: State Semantics",
    `${topbar("Lifecycle semantics", "Different Operations Preserve Different State")}
      <section class="guide-semantic-grid">
        <img src="../../../docs/graphs/state-layers.svg" alt="State layers" />
        <img src="../../../docs/graphs/lifecycle-comparison.svg" alt="Lifecycle comparison" />
      </section>
      <section class="operator-console-panel simple-hypothesis-panel" style="margin-top:16px">
        <div class="terminal-split-grid">
          <article class="hypothesis-card">
            <span class="pill">stop/start</span>
            <h3>Same sandbox</h3>
            <p class="hypothesis-focus">Filesystem state persists.</p>
            <p>Running processes should not be treated as preserved.</p>
          </article>
          <article class="hypothesis-card">
            <span class="pill">fork</span>
            <h3>New sandbox</h3>
            <p class="hypothesis-focus">Independent future from the fork point.</p>
            <p>Children start with the prepared parent state, then diverge.</p>
          </article>
          <article class="hypothesis-card">
            <span class="pill">snapshot</span>
            <h3>Reusable baseline</h3>
            <p class="hypothesis-focus">Saved checkpoint for later creation.</p>
            <p>Not the same as an immediate active child sandbox.</p>
          </article>
        </div>
      </section>`
  );
}

function writePage(name, html) {
  const path = join(pagesDir, name);
  writeFileSync(path, html);
  return path;
}

const pages = [
  ["guide-01-demo-bug.html", currentBugPage()],
  ["guide-02-prepared-parent-state.html", currentPreparedParentPage()],
  ["guide-03-live-fork-run.html", currentLiveTerminalPage()],
  ["guide-04-multilevel-fork-tree.html", currentGuideForkTreePage()],
  ["guide-05-state-semantics.html", currentGuideStateSemanticsPage()],
  ["14-guide-live-fork-run.html", liveTerminalPage()],
  ["15-guide-live-latency.html", liveLatencyPage()],
  ["16-guide-current-fork-tree.html", currentForkTreePage()],
  ["17-guide-state-semantics.html", stateSemanticsPage()]
];

for (const [name, html] of pages) {
  writePage(name, html);
  console.log(`Wrote .artifacts/screenshots/pages/${name}`);
}
