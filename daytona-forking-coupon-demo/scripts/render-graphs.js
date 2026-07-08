import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { projectPath } from "./state-utils.js";

const graphDir = projectPath("docs", "graphs");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function writeGraph(filename, svg) {
  writeFileSync(projectPath("docs", "graphs", filename), svg);
  console.log(`Wrote docs/graphs/${filename}`);
}

function frame(title, subtitle, body, width = 1200, height = 720) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(title)}</title>
  <desc id="desc">${escapeHtml(subtitle)}</desc>
  <style>
    .bg { fill: #0a0a0a; }
    .panel { fill: #161616; stroke: #414141; stroke-width: 1.5; rx: 8; }
    .ink { fill: #ffffff; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .muted { fill: #a2a2a2; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .title { font-size: 34px; font-weight: 800; letter-spacing: 0; }
    .subtitle { font-size: 16px; letter-spacing: 0; }
    .label { font-size: 16px; font-weight: 800; letter-spacing: 0; }
    .small { font-size: 13px; letter-spacing: 0; }
    .tiny { font-size: 11px; letter-spacing: 0; }
    .line { stroke: #414141; stroke-width: 2; fill: none; }
    .blue { fill: #2ecc71; }
    .green { fill: #00e49a; }
    .amber { fill: #f1c40f; }
    .red { fill: #e74c3c; }
    .soft-blue { fill: #102017; stroke: #2ecc71; }
    .soft-green { fill: #102017; stroke: #2ecc71; }
    .soft-amber { fill: #211d0f; stroke: #f1c40f; }
    .soft-red { fill: #211013; stroke: #e74c3c; }
    .soft-gray { fill: #111111; stroke: #414141; }
  </style>
  <rect class="bg" width="${width}" height="${height}"/>
  <text class="ink title" x="56" y="58">${escapeHtml(title)}</text>
  <text class="muted subtitle" x="56" y="88">${escapeHtml(subtitle)}</text>
  ${body}
</svg>
`;
}

function stateLayers() {
  const layers = [
    {
      name: "Layer 1: Filesystem state",
      fill: "soft-blue",
      y: 132,
      items: "repo files, node_modules/package lock, dist/, seeded data, logs, state-marker.txt"
    },
    {
      name: "Layer 2: Sandbox configuration state",
      fill: "soft-green",
      y: 246,
      items: "environment variables, exposed ports, working directory, service configuration"
    },
    {
      name: "Layer 3: Runtime/process state",
      fill: "soft-amber",
      y: 360,
      items: "running dev server, in-memory caches, process memory, file descriptors"
    },
    {
      name: "Layer 4: Agent/debugging state externalized to disk",
      fill: "soft-red",
      y: 474,
      items: "debug-brief.md, hypotheses, failing logs, reproduction notes, fork plan"
    }
  ];

  const body = `${layers
    .map(
      (layer, index) => `<rect class="panel ${layer.fill}" x="74" y="${layer.y}" width="720" height="82" rx="8"/>
  <text class="ink label" x="104" y="${layer.y + 31}">${escapeHtml(layer.name)}</text>
  <text class="muted small" x="104" y="${layer.y + 58}">${escapeHtml(layer.items)}</text>
  <circle cx="868" cy="${layer.y + 41}" r="24" fill="#161616" stroke="#414141"/>
  <text class="ink label" text-anchor="middle" x="868" y="${layer.y + 47}">${index + 1}</text>`
    )
    .join("\n")}
  <path class="line" d="M868 214v32 M868 328v32 M868 442v32"/>
  <rect class="panel" x="840" y="590" width="286" height="70" rx="8"/>
  <text class="ink label" x="866" y="620">Prepared parent sandbox</text>
  <text class="muted small" x="866" y="645">Forks branch after useful state exists.</text>`;

  return frame(
    "State Layers Reused By Forking",
    "Different lifecycle operations preserve different layers; the guide keeps those semantics separate.",
    body
  );
}

function lifecycleComparison() {
  const cards = [
    ["Stop/start", "Same sandbox", "Files persist; restart processes", "soft-blue", 80],
    ["Pause", "Same sandbox", "Freeze runtime state where supported", "soft-amber", 300],
    ["Fork", "New sandbox", "Independent future from current disk", "soft-green", 520],
    ["Snapshot", "Saved baseline", "Reusable filesystem checkpoint", "soft-gray", 740],
    ["Restore", "New sandbox", "Created later from snapshot", "soft-red", 960]
  ];

  const body = `${cards
    .map(
      ([name, identity, detail, fill, x]) => `<rect class="panel ${fill}" x="${x}" y="150" width="170" height="180" rx="8"/>
  <text class="ink label" text-anchor="middle" x="${x + 85}" y="190">${escapeHtml(name)}</text>
  <text class="ink small" text-anchor="middle" x="${x + 85}" y="226">${escapeHtml(identity)}</text>
  <foreignObject x="${x + 24}" y="246" width="122" height="58">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #a2a2a2; font-size: 12px; line-height: 1.35; text-align: center;">${escapeHtml(
      detail
    )}</div>
  </foreignObject>`
    )
    .join("\n")}
  <path class="line" d="M165 396h880"/>
  <circle class="blue" cx="165" cy="396" r="7"/>
  <circle class="amber" cx="385" cy="396" r="7"/>
  <circle class="green" cx="605" cy="396" r="7"/>
  <circle fill="#a2a2a2" cx="825" cy="396" r="7"/>
  <circle class="red" cx="1045" cy="396" r="7"/>
  <text class="ink label" x="92" y="468">Key distinction</text>
  <text class="muted small" x="92" y="498">Stop/start returns to the same sandbox. Fork and restore create new sandbox identities.</text>
  <text class="muted small" x="92" y="522">Pause is about live runtime state. Snapshot is a reusable baseline concept.</text>`;

  return frame(
    "Lifecycle Operations Are Not Interchangeable",
    "Stop/start, pause, fork, snapshot, and restore each answer a different state reuse question.",
    body
  );
}

function forkTree() {
  function node(label, x, y, fill, width = 180, height = 52) {
    return `<rect class="panel ${fill}" x="${x}" y="${y}" width="${width}" height="${height}" rx="8"/>
  <foreignObject x="${x + 10}" y="${y + 10}" width="${width - 20}" height="${height - 18}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #ffffff; font-size: 12px; font-weight: 800; line-height: 1.2; text-align: center; overflow-wrap: anywhere;">${escapeHtml(
      label
    )}</div>
  </foreignObject>`;
  }

  const body = `<path class="line" d="M600 176 C600 222 170 222 170 255"/>
  <path class="line" d="M600 176 C600 222 430 222 430 255"/>
  <path class="line" d="M600 176 C600 222 690 222 690 255"/>
  <path class="line" d="M780 307 C780 334 780 334 780 354"/>
  <path class="line" d="M780 307 C780 390 580 390 580 438"/>
  <path class="line" d="M780 307 C780 390 820 390 820 438"/>
  <path class="line" d="M780 406 C780 486 165 486 165 538"/>
  <path class="line" d="M780 406 C780 486 375 486 375 538"/>
  <path class="line" d="M780 406 C780 486 585 486 585 538"/>
  <path class="line" d="M780 406 C780 486 795 486 795 538"/>
  ${node("coupon-parent-prepared", 500, 124, "soft-blue", 200, 52)}
  ${node("frontend-hypothesis", 80, 255, "soft-amber")}
  ${node("backend-hypothesis", 340, 255, "soft-amber")}
  ${node("contract-hypothesis", 600, 255, "soft-green")}
  ${node("contract-candidate-fix", 680, 354, "soft-green", 200, 52)}
  ${node("contract-minimal", 490, 438, "soft-green")}
  ${node("contract-with-regression-test", 730, 438, "soft-green", 220, 52)}
  ${node("api-design-review", 75, 538, "soft-gray")}
  ${node("implementation-review", 285, 538, "soft-gray")}
  ${node("regression-test-builder", 495, 538, "soft-gray")}
  ${node("memory-state-check", 705, 538, "soft-gray")}
  <text class="ink label" x="80" y="645">Multi-level point</text>
  <text class="muted small" x="80" y="674">The contract branch writes a candidate fix, then becomes the parent for validators and refinements.</text>`;

  return frame(
    "Coupon Debugging Multi-Level Fork Tree",
    "A prepared parent branches into hypotheses; the winning contract branch writes state before deeper forks.",
    body
  );
}

function benchmarkGraph() {
  const path = projectPath("docs", "graphs", "state-reuse-benchmark.json");
  const data = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8"))
    : [
        { operation: "Fresh setup", seconds: 45, repeatedWork: "install + build + seed + reproduce" },
        { operation: "Stop/start", seconds: 8, repeatedWork: "restart only" },
        { operation: "Fork prepared parent", seconds: 5, repeatedWork: "no reinstall" },
        { operation: "Snapshot restore", seconds: 12, repeatedWork: "restore baseline" }
      ];

  const max = Math.max(...data.map((row) => row.seconds));
  const body = `${data
    .map((row, index) => {
      const x = 130 + index * 245;
      const barHeight = Math.round((row.seconds / max) * 330);
      const y = 520 - barHeight;
      return `<rect class="panel soft-gray" x="${x}" y="160" width="160" height="360" rx="8"/>
  <rect class="${index === 0 ? "red" : index === 1 ? "amber" : index === 2 ? "green" : "blue"}" x="${
        x + 34
      }" y="${y}" width="92" height="${barHeight}" rx="6"/>
  <text class="ink label" text-anchor="middle" x="${x + 80}" y="${y - 16}">${row.seconds}s</text>
  <foreignObject x="${x + 14}" y="545" width="132" height="56">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #ffffff; font-size: 13px; font-weight: 800; line-height: 1.25; text-align: center;">${escapeHtml(
      row.operation
    )}</div>
  </foreignObject>
  <foreignObject x="${x + 4}" y="608" width="152" height="52">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #a2a2a2; font-size: 11px; line-height: 1.25; text-align: center;">${escapeHtml(
      row.repeatedWork
    )}</div>
  </foreignObject>`;
    })
    .join("\n")}
  <text class="muted small" x="78" y="126">Local simulated benchmark values for post visuals; JSON includes warm local check timings.</text>`;

  return frame(
    "Prepared State Reuse Benchmark",
    "Reusing a prepared sandbox avoids repeating install, build, seed, reproduction, and logging work.",
    body
  );
}

function branchOutcomes() {
  const rows = [
    ["Frontend", "Inline UI improves", "API remains inconsistent", "Partial", "soft-amber"],
    ["Backend", "UI still confusing", "Checkout error improves", "Partial", "soft-amber"],
    ["Contract", "UI rejects invalid coupon", "API and UI agree", "Best", "soft-green"]
  ];
  const headers = ["Hypothesis", "UI behavior", "API behavior", "Verdict"];
  const x = [80, 300, 565, 865];

  const body = `<rect class="panel" x="64" y="142" width="1060" height="390" rx="8"/>
  ${headers
    .map(
      (header, index) =>
        `<text class="ink label" x="${x[index]}" y="190">${escapeHtml(header)}</text>`
    )
    .join("\n")}
  <path class="line" d="M80 216h1010"/>
  ${rows
    .map((row, rowIndex) => {
      const y = 270 + rowIndex * 96;
      return `<rect class="${row[4]}" x="80" y="${y - 38}" width="1010" height="68" rx="8"/>
  <text class="ink label" x="${x[0]}" y="${y}">${escapeHtml(row[0])}</text>
  <text class="ink small" x="${x[1]}" y="${y}">${escapeHtml(row[1])}</text>
  <text class="ink small" x="${x[2]}" y="${y}">${escapeHtml(row[2])}</text>
  <text class="ink label" x="${x[3]}" y="${y}">${escapeHtml(row[3])}</text>`;
    })
    .join("\n")}
  <text class="muted small" x="80" y="604">The contract hypothesis wins because it removes the split-brain validation semantics.</text>`;

  return frame(
    "Branch Outcomes",
    "The useful fork is the one that makes UI and API behavior consistent, not just less confusing.",
    body
  );
}

writeGraph("state-layers.svg", stateLayers());
writeGraph("lifecycle-comparison.svg", lifecycleComparison());
writeGraph("fork-tree.svg", forkTree());
writeGraph("state-reuse-benchmark.svg", benchmarkGraph());
writeGraph("branch-outcomes.svg", branchOutcomes());

writeFileSync(
  projectPath("docs", "graphs", "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Daytona Forking Demo Graphs</title>
    <style>
      body { margin: 0; padding: 24px; background: #0a0a0a; color: #ffffff; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { display: grid; gap: 24px; max-width: 1220px; margin: 0 auto; }
      h1 { margin: 0; font-size: 28px; letter-spacing: 0; }
      section { background: #161616; border: 1px solid #414141; border-radius: 8px; padding: 12px; }
      img { display: block; width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <main>
      <h1>Daytona Forking Coupon Demo Graphs</h1>
      ${[
        "state-layers.svg",
        "lifecycle-comparison.svg",
        "fork-tree.svg",
        "state-reuse-benchmark.svg",
        "branch-outcomes.svg"
      ]
        .map((filename) => `<section><img src="./${filename}" alt="${filename}" /></section>`)
        .join("\n      ")}
    </main>
  </body>
</html>
`
);

console.log("Wrote docs/graphs/index.html");
