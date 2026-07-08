import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { projectPath } from "./state-utils.js";

const metricsPath = projectPath("logs", "video-terminal-metrics.json");
const reportPath = projectPath("logs", "video-terminal-latency-report.md");

function formatMs(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "n/a";
  }

  const ms = Number(value);
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

if (!existsSync(metricsPath)) {
  console.error("Missing .artifacts/logs/video-terminal-metrics.json. Run npm run video:terminal first.");
  process.exit(1);
}

const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));
const rows = metrics.metrics ?? [];
const grouped = rows.reduce((acc, row) => {
  const key = row.group ?? "sequential";
  acc[key] ??= [];
  acc[key].push(row);
  return acc;
}, {});

const slowest = [...rows].sort((a, b) => b.observedMs - a.observedMs).slice(0, 5);
const report = `# Video Terminal Latency Report

Generated: ${new Date().toISOString()}

Source: \`.artifacts/logs/video-terminal-metrics.json\`

## Run Summary

| Metric | Value |
| --- | ---: |
| Mode | ${escapePipes(metrics.mode)} |
| Fast mode | ${metrics.fastMode ? "yes" : "no"} |
| Daytona API key configured | ${metrics.apiKeyConfigured ? "yes, redacted" : "no"} |
| Operations completed | ${metrics.operationCount ?? rows.length} |
| Wall-clock time from terminal start | ${formatMs(metrics.totals?.wallClockMs)} |
| Wall-clock time after coupon bug reproduction | ${formatMs(metrics.totals?.postReproductionWallMs)} |
| Sum of observed operation latencies | ${formatMs(metrics.totals?.totalObservedMs)} |
| Slowest single observed operation | ${formatMs(metrics.totals?.maxObservedMs)} |

The post-reproduction wall-clock number is the one to use in the video narration: it starts after the terminal detects the reproduced coupon bug and ends after the validator/runtime-state steps complete.

## Operation Timeline

| # | Operation | Branch/Fork | Group | Observed latency |
| ---: | --- | --- | --- | ---: |
${rows
  .map(
    (row, index) =>
      `| ${index + 1} | ${escapePipes(row.name)} | ${escapePipes(row.branch)} | ${escapePipes(
        row.group ?? "sequential"
      )} | ${formatMs(row.observedMs)} |`
  )
  .join("\n")}

## Parallel Groups

${Object.entries(grouped)
  .map(([group, items]) => {
    const max = Math.max(...items.map((item) => item.observedMs));
    const branches = items.map((item) => item.branch).join(", ");
    return `- ${group}: ${formatMs(max)} critical-path latency across ${items.length} operation(s): ${branches}`;
  })
  .join("\n")}

## Slowest Operations

${slowest
  .map((row, index) => `${index + 1}. ${row.name} on \`${row.branch}\`: ${formatMs(row.observedMs)}`)
  .join("\n")}
`;

writeFileSync(reportPath, report);
console.log(`Wrote ${reportPath}`);
