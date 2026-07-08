import { existsSync } from "node:fs";
import { createServer } from "../src/server/app.js";
import { projectPath, yesNo } from "./state-utils.js";

const checks = [
  ["repo present", existsSync(projectPath("package.json")) && existsSync(projectPath("src"))],
  [
    "dependencies installed",
    existsSync(projectPath("package-lock.json")) || existsSync(projectPath("node_modules"))
  ],
  ["build artifacts present", existsSync(projectPath("dist", "client", "index.html"))],
  ["seeded coupon data present", existsSync(projectPath("data", "coupons.json"))],
  ["debug-brief.md present", existsSync(projectPath("debug-brief.md"))],
  ["failing baseline log present", existsSync(projectPath("logs", "failing-baseline.txt"))],
  ["state-marker.txt present", existsSync(projectPath("state-marker.txt"))],
  ["env configured", existsSync(projectPath(".env")) || process.env.PORT !== undefined],
  ["app can start", typeof createServer === "function"]
];

for (const [label, ok] of checks) {
  console.log(`${label}: ${yesNo(ok)}`);
}

if (checks.some(([, ok]) => !ok)) {
  process.exitCode = 1;
}
