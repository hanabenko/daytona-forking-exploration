import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const rootDir = new URL("../", import.meta.url).pathname;

export function projectPath(...parts) {
  if (parts[0] === "logs") {
    return join(rootDir, ".artifacts", "logs", ...parts.slice(1));
  }

  if (parts[0] === "docs" && parts[1] === "screenshots") {
    return join(rootDir, ".artifacts", "screenshots", ...parts.slice(2));
  }

  return join(rootDir, ...parts);
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

export function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson(path, fallback) {
  if (!existsSync(path)) {
    return fallback;
  }

  return JSON.parse(readFileSync(path, "utf8"));
}

export function updateStateManifest(preparedStatePatch) {
  const manifestPath = projectPath("state-manifest.json");
  const manifest = readJson(manifestPath, {
    sandboxName: "coupon-parent-prepared",
    preparedState: {}
  });

  manifest.preparedState = {
    ...manifest.preparedState,
    ...preparedStatePatch
  };

  writeJson(manifestPath, manifest);
}

export function yesNo(value) {
  return value ? "yes" : "no";
}
