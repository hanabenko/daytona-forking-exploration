import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { projectPath } from "./state-utils.js";

const screenshotsDir = projectPath("docs", "screenshots");
const pagesDir = join(screenshotsDir, "pages");
mkdirSync(pagesDir, { recursive: true });

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function run(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: projectPath(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
}

function terminalPage(title, command, content) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin: 0; background: #f6f7f9; color: #1e2430; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: 1120px; margin: 0 auto; padding: 36px; }
      h1 { margin: 0 0 10px; font-size: 32px; letter-spacing: 0; }
      .command { margin: 0 0 18px; color: #667085; font-size: 15px; }
      pre { min-height: 520px; margin: 0; padding: 24px; overflow: hidden; border: 1px solid #d9dee8; border-radius: 8px; background: #111827; color: #e5e7eb; font: 14px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p class="command">${escapeHtml(command)}</p>
      <pre>${escapeHtml(content).slice(0, 9000)}</pre>
    </main>
  </body>
</html>
`;
}

function brokenCouponPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Broken Coupon UI</title>
    <style>
      :root { --ink:#1e2430; --muted:#667085; --line:#d9dee8; --page:#f6f7f9; --blue:#2267d8; --green:#177245; --red:#b42318; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--page); color: var(--ink); font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: 1060px; margin: 0 auto; padding: 40px 24px; }
      .grid { display: grid; grid-template-columns: 1fr 420px; gap: 28px; align-items: start; }
      .eyebrow { margin: 16px 0 12px; color: var(--blue); font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0; }
      h1 { margin: 0; font-size: 58px; line-height: 0.98; letter-spacing: 0; }
      .lead { margin: 22px 0 0; max-width: 620px; color: #3d4758; font-size: 20px; line-height: 1.5; }
      .panel { padding: 24px; border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: 0 18px 55px rgb(30 36 48 / 9%); }
      .product { display: grid; grid-template-columns: 62px 1fr auto; gap: 16px; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--line); }
      .art { display: grid; width: 62px; height: 62px; place-items: center; border: 1px solid #adc4eb; border-radius: 8px; color: var(--blue); background: #eef4ff; font-size: 24px; font-weight: 900; }
      h2 { margin: 0 0 4px; font-size: 18px; }
      p { margin: 0; }
      .muted { color: var(--muted); }
      label { display: block; margin: 22px 0 8px; color: #3d4758; font-size: 14px; font-weight: 700; }
      .row { display: grid; grid-template-columns: 1fr 94px; gap: 10px; }
      input { height: 46px; padding: 0 13px; border: 1px solid #b9c1cf; border-radius: 6px; color: var(--ink); background: #fff; font: inherit; }
      button { min-height: 46px; border: 0; border-radius: 6px; color: #fff; background: var(--blue); font: inherit; font-weight: 800; }
      .message { min-height: 24px; margin: 10px 0 0; font-size: 14px; font-weight: 800; line-height: 1.35; }
      .ok { color: var(--green); }
      .error { color: var(--red); }
      .totals { display: grid; gap: 10px; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--line); }
      .totals div { display: flex; justify-content: space-between; }
      .total { padding-top: 10px; border-top: 1px solid var(--line); font-size: 22px; }
      .checkout { width: 100%; margin-top: 20px; }
      .callout { margin-top: 26px; padding: 16px; border: 1px solid #f0a6a0; border-radius: 8px; background: #fff1f0; color: #7a271a; font-weight: 800; }
    </style>
  </head>
  <body>
    <main>
      <div class="grid">
        <section>
          <p class="eyebrow">Prepared parent sandbox</p>
          <h1>Checkout Debug Baseline</h1>
          <p class="lead">The invalid coupon is accepted during validation, then checkout fails later with a generic error.</p>
          <div class="callout">Bug: SUMMER-2026 should show “Invalid coupon code” inline before checkout.</div>
        </section>
        <section class="panel">
          <div class="product">
            <div class="art">10</div>
            <div><h2>Agent Runtime Pack</h2><p class="muted">Seeded checkout fixture</p></div>
            <strong>$42.00</strong>
          </div>
          <label>Coupon code</label>
          <div class="row"><input value="SUMMER-2026" /><button>Apply</button></div>
          <p class="message ok">Coupon accepted: SUMMER-2026</p>
          <div class="totals">
            <div><span>Subtotal</span><strong>$42.00</strong></div>
            <div><span>Discount</span><strong>$0.00</strong></div>
            <div class="total"><span>Total</span><strong>$42.00</strong></div>
          </div>
          <button class="checkout">Checkout</button>
          <p class="message error">Checkout failed. Please try another payment method.</p>
        </section>
      </div>
    </main>
  </body>
</html>
`;
}

function readVideoMetrics() {
  const metricsPath = projectPath("logs", "video-terminal-metrics.json");
  if (!existsSync(metricsPath)) {
    return {
      mode: "recording",
      fastMode: false,
      apiKeyConfigured: false,
      operationCount: 0,
      totals: {},
      metrics: []
    };
  }

  return JSON.parse(readFileSync(metricsPath, "utf8"));
}

function readSimpleRun() {
  const runPath = projectPath("logs", "simple-demo-run.json");
  if (!existsSync(runPath)) {
    return {
      mode: "command-driven",
      metrics: []
    };
  }

  return JSON.parse(readFileSync(runPath, "utf8"));
}

function formatMs(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "n/a";
  }

  const ms = Number(value);
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function videoShellPage(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { --ink:#1e2430; --muted:#667085; --line:#d9dee8; --page:#f6f7f9; --terminal:#111827; --blue:#2267d8; --green:#177245; --amber:#a15c07; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--page); color: var(--ink); font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: 1080px; margin: 0 auto; padding: 30px; }
      h1 { margin: 0 0 8px; font-size: 32px; letter-spacing: 0; }
      .sub { margin: 0 0 18px; color: var(--muted); font-size: 15px; }
      .terminal { padding: 18px; border-radius: 8px; background: var(--terminal); color: #e5e7eb; font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .terminal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .pane { min-height: 156px; padding: 14px; border: 1px solid #374151; border-radius: 6px; background: #0b1220; }
      .pane h2 { margin: 0 0 10px; color: #f8fafc; font-size: 14px; letter-spacing: 0; }
      .pane p { margin: 3px 0; color: #cbd5e1; overflow-wrap: anywhere; }
      .ok { color: #86efac; }
      .warn { color: #fcd34d; }
      .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
      .metric { padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
      .metric span { display: block; color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; }
      .metric strong { display: block; margin-top: 6px; font-size: 24px; }
      table { width: 100%; border-collapse: collapse; overflow: hidden; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
      th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; font-size: 13px; }
      th { color: #3d4758; background: #eef2f7; font-size: 12px; text-transform: uppercase; }
      .bar-wrap { width: 100%; height: 10px; border-radius: 999px; background: #e5e7eb; }
      .bar { height: 10px; border-radius: 999px; background: var(--blue); }
      .caption { margin-top: 14px; color: var(--muted); font-size: 13px; line-height: 1.4; }
    </style>
  </head>
  <body>
    <main>
      ${body}
    </main>
  </body>
</html>
`;
}

function videoTerminalWaitingPage() {
  return videoShellPage(
    "Static Demo Reset And Browser Bug Location",
    `<h1>Static Demo Reset And Browser Bug Location</h1>
      <p class="sub">Command: npm run demo:reset</p>
      <section class="terminal">
        <p>Coupon fork demo reset</p>
        <p>Browser bug location:</p>
        <br />
        <p>1. Run: npm run dev</p>
        <p>2. Open the printed localhost URL.</p>
        <p>3. In Checkout Debug Baseline, SUMMER-2026 is already typed.</p>
        <p>4. Click Apply. Visible bug: Coupon accepted: SUMMER-2026</p>
        <p>5. Click Checkout. Visible bug: Checkout failed. Please try another payment method.</p>
        <br />
        <p>Then run: npm run demo:branch</p>
      </section>
      <p class="caption">This screenshot shows exactly where the browser bug appears before the fork commands start.</p>`
  );
}

function videoTerminalCompletePage() {
  const run = readSimpleRun();
  const latest = run.metrics ?? [];
  const total = latest.reduce((sum, item) => sum + (item.latencyMs ?? 0), 0);
  const slowest = [...latest].sort((a, b) => (b.latencyMs ?? 0) - (a.latencyMs ?? 0))[0];

  return videoShellPage(
    "Static Command Multi-Branch Fork Run",
    `<h1>Static Command Multi-Branch Fork Run</h1>
      <p class="sub">Command-driven fork stages: each command prints once and exits.</p>
      <div class="metrics">
        <div class="metric"><span>operations</span><strong>${latest.length}</strong></div>
        <div class="metric"><span>displayed latency sum</span><strong>${formatMs(total)}</strong></div>
        <div class="metric"><span>slowest step</span><strong>${formatMs(slowest?.latencyMs)}</strong></div>
        <div class="metric"><span>mode</span><strong>static</strong></div>
      </div>
      <section class="terminal">
        <div class="terminal-grid">
          <div class="pane">
            <h2>parent: coupon-parent-prepared</h2>
            <p class="ok">npm run demo:branch</p>
            <p>repo, deps, build, seed data, logs, debug brief, marker</p>
          </div>
          <div class="pane">
            <h2>fork point 1</h2>
            <p class="ok">inside demo:branch</p>
            <p>frontend/backend/contract fork from parent</p>
          </div>
          <div class="pane">
            <h2>fork point 2</h2>
            <p class="ok">inside demo:branch</p>
            <p>contract branch writes fix-candidate.md, then forks two refinements</p>
          </div>
          <div class="pane">
            <h2>fork point 3</h2>
            <p class="ok">npm run demo:validators</p>
            <p>validators inherit fix-candidate.md</p>
          </div>
        </div>
      </section>
      <p class="caption">Timing source: non-live fork timings are deterministic local demo values in scripts/simple-demo.js.<br />Measured latency comes from demo:agent and Daytona live probes.</p>`
  );
}

function latencyReportPage() {
  const run = readSimpleRun();
  const rows = run.metrics ?? [];
  const total = rows.reduce((sum, row) => sum + (row.latencyMs ?? 0), 0);
  const max = Math.max(1, ...rows.map((row) => row.latencyMs ?? 0));
  return videoShellPage(
    "Static Command Latency Report",
    `<h1>Static Command Latency Report</h1>
      <p class="sub">Displayed latencies from the command-driven fork demo.</p>
      <div class="metrics">
        <div class="metric"><span>operations</span><strong>${rows.length}</strong></div>
        <div class="metric"><span>displayed latency sum</span><strong>${formatMs(total)}</strong></div>
        <div class="metric"><span>slowest operation</span><strong>${formatMs(max)}</strong></div>
        <div class="metric"><span>mode</span><strong>static</strong></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Operation</th><th>Branch/Fork</th><th>Latency</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (row, index) => `<tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(row.operation)}</td>
                <td>${escapeHtml(row.branch)}</td>
                <td>${formatMs(row.latencyMs)}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <p class="caption">Timing source: non-live fork timings are deterministic local demo values in scripts/simple-demo.js.<br />Measured latency comes from demo:agent and Daytona live probes.</p>`
  );
}

function readAgentReasoning() {
  const path = projectPath("logs", "agent-reasoning.json");
  if (!existsSync(path)) {
    return {
      model: "not generated",
      latencyMs: null,
      reasoning: {
        headline: "Run npm run demo:agent after reproducing the browser bug.",
        forks: [],
        winningBranch: { name: "contract-hypothesis", why: "waiting for live reasoning" },
        nextForkPoint: {
          parent: "contract-candidate-fix",
          diskStateWrittenBeforeFork: "fix-candidate.md",
          children: ["contract-minimal", "contract-with-regression-test"],
          whyForkingHelps: "waiting for live reasoning"
        },
        caveats: ["No live reasoning report has been generated yet."]
      }
    };
  }

  return JSON.parse(readFileSync(path, "utf8"));
}

function agentReasoningPage() {
  const report = readAgentReasoning();
  const reasoning = report.reasoning ?? {};
  const forks = reasoning.forks ?? [];
  const winner = reasoning.winningBranch ?? {};
  const nextForkPoint = reasoning.nextForkPoint ?? {};
  const caveats = reasoning.caveats ?? [];

  return videoShellPage(
    "Live Agent Reasoning",
    `<style>
        main { width: 1000px; }
        .terminal { font-size: 12px; }
      </style>
      <h1>Live Agent Reasoning</h1>
      <p class="sub">Command: npm run demo:agent. The API key is read locally and never printed.</p>
      <div class="metrics" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
        <div class="metric"><span>model</span><strong>${escapeHtml(report.model ?? "n/a")}</strong></div>
        <div class="metric"><span>latency</span><strong>${formatMs(report.latencyMs)}</strong></div>
        <div class="metric"><span>winner</span><strong>${escapeHtml(winner.name ?? "n/a")}</strong></div>
      </div>
      <section class="terminal">
        <p class="ok">${escapeHtml(reasoning.headline ?? "Live agent reasoning report")}</p>
        <br />
        <div class="terminal-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
          ${forks
            .map(
              (fork) => `<div class="pane">
                <h2>${escapeHtml(fork.name)}</h2>
                <p><strong>hypothesis</strong></p>
                <p>${escapeHtml(fork.hypothesis)}</p>
                <p><strong>evidence</strong></p>
                ${(fork.evidence ?? []).slice(0, 2).map((item) => `<p>- ${escapeHtml(item)}</p>`).join("")}
                <p><strong>verdict</strong></p>
                <p class="${fork.name === winner.name ? "ok" : "warn"}">${escapeHtml(fork.verdict)}</p>
              </div>`
            )
            .join("")}
        </div>
        <br />
        <div class="terminal-grid">
          <div class="pane">
            <h2>decision</h2>
            <p class="ok">continue from ${escapeHtml(winner.name ?? "contract-hypothesis")}</p>
            <p>${escapeHtml(winner.why ?? "")}</p>
          </div>
          <div class="pane">
            <h2>next fork point</h2>
            <p>parent: ${escapeHtml(nextForkPoint.parent ?? "contract-candidate-fix")}</p>
            <p>disk state: ${escapeHtml(nextForkPoint.diskStateWrittenBeforeFork ?? "fix-candidate.md")}</p>
            <p>children: ${escapeHtml((nextForkPoint.children ?? []).join(", "))}</p>
          </div>
        </div>
        <br />
        <div class="pane">
          <h2>precision caveats</h2>
          ${caveats.slice(0, 4).map((item) => `<p>- ${escapeHtml(item)}</p>`).join("")}
        </div>
      </section>`
  );
}

function writePage(filename, html) {
  const path = join(pagesDir, filename);
  writeFileSync(path, html);
  return path;
}

run("npm", ["run", "render-graphs"]);

const failingLogPath = projectPath("logs", "failing-baseline.txt");
const failingTests = existsSync(failingLogPath)
  ? readFileSync(failingLogPath, "utf8")
  : "Run `npm test > .artifacts/logs/failing-baseline.txt 2>&1` to populate this baseline log.";

const pageMap = {
  "01-broken-coupon-ui.html": brokenCouponPage(),
  "02-failing-tests.html": terminalPage("Failing Baseline Tests", "npm test", failingTests),
  "03-debug-brief.html": terminalPage(
    "Debug Brief",
    "debug-brief.md",
    readFileSync(projectPath("debug-brief.md"), "utf8")
  ),
  "04-inspect-state.html": terminalPage(
    "Prepared Parent State Inspection",
    "npm run inspect-state",
    run("npm", ["run", "inspect-state"])
  ),
  "05-lifecycle-demo.html": terminalPage(
    "Lifecycle Demo Output",
    "npm run lifecycle-demo",
    run("npm", ["run", "lifecycle-demo"])
  ),
  "06-fork-tree.html": terminalPage(
    "Fork Tree Output",
    "npm run fork-tree-demo",
    run("npm", ["run", "fork-tree-demo"])
  ),
  "07-state-reuse-benchmark.html": `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>State Reuse Benchmark</title><style>body{margin:0;background:#f6f7f9}img{width:1200px;height:720px;display:block}</style></head><body><img src="../../../docs/graphs/state-reuse-benchmark.svg" alt="State reuse benchmark graph" /></body></html>`,
  "08-branch-outcomes.html": `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Branch Outcomes</title><style>body{margin:0;background:#f6f7f9}img{width:1200px;height:720px;display:block}</style></head><body><img src="../../../docs/graphs/branch-outcomes.svg" alt="Branch outcomes graph" /></body></html>`
  ,
  "10-video-terminal-waiting.html": videoTerminalWaitingPage(),
  "11-video-terminal-complete.html": videoTerminalCompletePage(),
  "12-video-latency-report.html": latencyReportPage(),
  "13-agent-reasoning.html": agentReasoningPage()
};

const writtenPages = Object.entries(pageMap).map(([filename, html]) => [filename, writePage(filename, html)]);

const manifestEntries = [
  [
    "01-broken-coupon-ui.png",
    "Checkout UI showing SUMMER-2026 accepted by validation and rejected later by generic checkout error.",
    ".artifacts/screenshots/pages/01-broken-coupon-ui.html; browser equivalent is npm run dev at http://localhost:4173.",
    "This is the user-visible bug the forks investigate."
  ],
  [
    "02-failing-tests.png",
    "Baseline tests defining the desired inline invalid coupon behavior.",
    ".artifacts/screenshots/pages/02-failing-tests.html from .artifacts/logs/failing-baseline.txt.",
    "Shows useful failing state collected before forking."
  ],
  [
    "03-debug-brief.png",
    "The debug brief written into the prepared parent sandbox.",
    ".artifacts/screenshots/pages/03-debug-brief.html from debug-brief.md.",
    "Shows agent/debugging state externalized to disk."
  ],
  [
    "04-inspect-state.png",
    "Prepared parent state checklist.",
    ".artifacts/screenshots/pages/04-inspect-state.html from npm run inspect-state.",
    "Proves the parent has reusable work before fork."
  ],
  [
    "05-lifecycle-demo.png",
    "Lifecycle semantics terminal output.",
    ".artifacts/screenshots/pages/05-lifecycle-demo.html from npm run lifecycle-demo.",
    "Supports the guide's distinction between stop, pause, fork, snapshot, and restore."
  ],
  [
    "06-fork-tree.png",
    "Multi-level fork tree output with hypothesis branches, candidate fix state, validators, memory probe, and fork-a-fork refinements.",
    ".artifacts/screenshots/pages/06-fork-tree.html from npm run fork-tree-demo.",
    "Explains why the useful fork point is the changed contract branch, not only the original baseline."
  ],
  [
    "07-state-reuse-benchmark.png",
    "Benchmark-style bar chart comparing fresh setup, stop/start, fork, and snapshot restore.",
    ".artifacts/screenshots/pages/07-state-reuse-benchmark.html using docs/graphs/state-reuse-benchmark.svg.",
    "Visualizes repeated work avoided by prepared state reuse."
  ],
  [
    "08-branch-outcomes.png",
    "Matrix-style visual comparing frontend, backend, and contract hypotheses.",
    ".artifacts/screenshots/pages/08-branch-outcomes.html using docs/graphs/branch-outcomes.svg.",
    "Shows why the contract hypothesis is the best branch."
  ],
  [
    "10-video-terminal-waiting.png",
    "The static reset output showing exactly where the browser coupon bug appears.",
    ".artifacts/screenshots/pages/10-video-terminal-waiting.html, representing npm run demo:reset.",
    "Shows the browser-to-terminal handoff without relying on a moving terminal."
  ],
  [
    "11-video-terminal-complete.png",
    "The command-driven multi-branch fork run: prepared parent, first fork point, contract fork-a-fork, and validators.",
    ".artifacts/screenshots/pages/11-video-terminal-complete.html from .artifacts/logs/simple-demo-run.json.",
    "Shows the simpler static terminal story as the main video artifact."
  ],
  [
    "12-video-latency-report.png",
    "A static command latency report for the fork stages.",
    ".artifacts/screenshots/pages/12-video-latency-report.html from .artifacts/logs/simple-demo-run.json.",
    "Gives the guide a concrete latency artifact without requiring an animated terminal."
  ],
  [
    "13-agent-reasoning.png",
    "Live OpenAI-generated externalized debugging rationale for frontend, backend, and contract hypothesis forks.",
    ".artifacts/screenshots/pages/13-agent-reasoning.html from .artifacts/logs/agent-reasoning.md, generated by npm run demo:agent.",
    "Shows the actual agent reasoning used to explain why the contract fork is the best next parent."
  ]
];

writeFileSync(
  projectPath("docs", "screenshots", "manifest.md"),
  `# Screenshot Manifest

PNG files in this folder were rendered from the listed pages with:

\`\`\`bash
qlmanage -t -s 1280 -o .artifacts/screenshots <page>
\`\`\`

${manifestEntries
  .map(
    ([filename, shows, command, why]) => `## ${filename}

- What it shows: ${shows}
- Command/page used to generate it: ${command}
- Why it belongs in the post: ${why}
`
  )
  .join("\n")}
`
);

async function tryPlaywrightCapture() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return false;
  }

  const port = 4174;
  const server = spawn(process.execPath, ["src/server/index.js"], {
    cwd: projectPath(),
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore"
  });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    await page.locator("#coupon").fill("SUMMER-2026");
    await page.locator("button", { hasText: "Apply" }).click();
    await page.locator("#checkout").click();
    await page.screenshot({ path: join(screenshotsDir, "01-broken-coupon-ui.png"), fullPage: true });

    for (const [htmlFilename, path] of writtenPages) {
      const pngFilename = htmlFilename.replace(".html", ".png");
      await page.goto(pathToFileURL(path).href);
      await page.screenshot({ path: join(screenshotsDir, pngFilename), fullPage: true });
    }
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }

  return true;
}

const captured = await tryPlaywrightCapture();
console.log("Wrote .artifacts/screenshots/manifest.md");
for (const [filename] of writtenPages) {
  console.log(`Wrote .artifacts/screenshots/pages/${filename}`);
}

if (captured) {
  console.log("Captured PNG screenshots with Playwright.");
} else {
  console.log("Playwright is not installed; generated screenshot HTML pages and manifest only.");
  console.log("Use the in-app browser or install Playwright to create the PNG files.");
}
