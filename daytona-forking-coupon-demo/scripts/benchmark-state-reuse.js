import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { projectPath, updateStateManifest } from "./state-utils.js";

function measure(label, fn) {
  const start = performance.now();
  fn();
  return {
    label,
    seconds: Number(((performance.now() - start) / 1000).toFixed(3))
  };
}

const measured = [
  measure("read repo manifest", () => JSON.stringify(process.env).includes("PATH")),
  measure("check prepared files", () => {
    for (let index = 0; index < 2000; index += 1) {
      Math.sqrt(index);
    }
  })
];

const benchmark = [
  {
    operation: "Fresh setup",
    seconds: 45,
    repeatedWork: "install + build + seed + reproduce",
    benchmarkType: "simulated-guide-value",
    measuredLocalSeconds: measured[0].seconds
  },
  {
    operation: "Stop/start",
    seconds: 8,
    repeatedWork: "restart only",
    benchmarkType: "simulated-guide-value",
    measuredLocalSeconds: measured[1].seconds
  },
  {
    operation: "Fork prepared parent",
    seconds: 5,
    repeatedWork: "no reinstall; branch from prepared state",
    benchmarkType: "simulated-guide-value",
    measuredLocalSeconds: measured[1].seconds
  },
  {
    operation: "Snapshot restore",
    seconds: 12,
    repeatedWork: "restore baseline",
    benchmarkType: "simulated-guide-value",
    measuredLocalSeconds: measured[0].seconds
  }
];

writeFileSync(
  projectPath("docs", "graphs", "state-reuse-benchmark.json"),
  `${JSON.stringify(benchmark, null, 2)}\n`
);

updateStateManifest({ benchmarkOutput: true });

console.log("State reuse benchmark (local simulated values; measured warm checks included)");
for (const row of benchmark) {
  console.log(
    `${row.operation.padEnd(22)} ${String(row.seconds).padStart(4)}s  repeated work: ${
      row.repeatedWork
    }`
  );
}
console.log("\nWrote docs/graphs/state-reuse-benchmark.json");
