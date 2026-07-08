import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { projectPath, updateStateManifest } from "./state-utils.js";

const distDir = projectPath("dist");
const clientDist = join(distDir, "client");

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}

mkdirSync(clientDist, { recursive: true });
cpSync(projectPath("src", "client"), clientDist, { recursive: true });

writeFileSync(
  join(distDir, "build-info.json"),
  `${JSON.stringify(
    {
      name: "daytona-forking-coupon-demo",
      artifact: "static checkout UI + Node server",
      builtAt: new Date().toISOString()
    },
    null,
    2
  )}\n`
);

updateStateManifest({ buildArtifacts: true });

console.log("Built static app artifacts: dist/client");
console.log("Wrote build metadata: dist/build-info.json");
