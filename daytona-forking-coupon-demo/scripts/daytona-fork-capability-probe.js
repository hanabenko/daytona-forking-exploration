import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Daytona } from "@daytona/sdk";
import apiClient from "@daytona/api-client";
import { projectPath, writeJson } from "./state-utils.js";

const {
  AdminApi,
  Configuration,
  RegionsApi,
  RunnersApi,
  SandboxClass
} = apiClient;

const startedAt = new Date().toISOString();
const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith("--")) ?? "inventory";
const reportPath = projectPath("logs", "daytona-fork-capability-probe.json");
const autoStopMinutes = Number.parseInt(process.env.DAYTONA_DEMO_AUTOSTOP_MINUTES ?? "15", 10);

if (!Number.isInteger(autoStopMinutes) || autoStopMinutes < 0) {
  throw new Error("DAYTONA_DEMO_AUTOSTOP_MINUTES must be a non-negative integer.");
}

function parseFlag(name) {
  const prefix = `--${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : "";
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function splitCsv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && value && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadEnv() {
  loadEnvFile(projectPath(".env.daytona.local"));
  loadEnvFile(projectPath(".env"));
  loadEnvFile(projectPath("..", ".env.daytona.local"));
  loadEnvFile(projectPath("..", ".env"));
}

function ensureKey() {
  if (!process.env.DAYTONA_API_KEY) {
    throw new Error("DAYTONA_API_KEY is not configured.");
  }
}

function createApiConfig() {
  return new Configuration({
    basePath: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
    baseOptions: {
      headers: {
        Authorization: `Bearer ${process.env.DAYTONA_API_KEY}`,
        "X-Daytona-Source": "coupon-fork-capability-probe"
      }
    }
  });
}

function createDaytona(target) {
  return new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL || undefined,
    target: target || process.env.DAYTONA_TARGET || undefined
  });
}

function elapsedMs(start) {
  return Math.round(performance.now() - start);
}

function errorSummary(error) {
  return {
    message: error?.message ?? String(error),
    status: error?.response?.status,
    response:
      typeof error?.response?.data === "string"
        ? error.response.data.slice(0, 500)
        : error?.response?.data?.message ?? error?.response?.data?.error ?? undefined
  };
}

async function measured(label, fn) {
  const start = performance.now();
  try {
    const value = await fn();
    return { ok: true, label, ms: elapsedMs(start), value };
  } catch (error) {
    return { ok: false, label, ms: elapsedMs(start), error: errorSummary(error) };
  }
}

function sanitizeRunner(runner) {
  return {
    id: runner.id,
    name: runner.name,
    region: runner.region,
    regionType: runner.regionType,
    state: runner.state,
    sandboxClass: runner.sandboxClass,
    cpu: runner.cpu,
    memory: runner.memory,
    disk: runner.disk,
    gpu: runner.gpu,
    gpuType: runner.gpuType,
    unschedulable: runner.unschedulable,
    availabilityScore: runner.availabilityScore,
    currentStartedSandboxes: runner.currentStartedSandboxes,
    tags: runner.tags
  };
}

function sanitizeSnapshot(snapshot) {
  return {
    id: snapshot.id,
    name: snapshot.name,
    general: snapshot.general,
    state: snapshot.state,
    imageName: snapshot.imageName,
    sandboxClass: snapshot.sandboxClass,
    regionIds: snapshot.regionIds,
    ref: snapshot.ref,
    cpu: snapshot.cpu,
    mem: snapshot.mem,
    disk: snapshot.disk,
    gpu: snapshot.gpu,
    errorReason: snapshot.errorReason
  };
}

function sanitizeSandbox(sandbox) {
  return {
    id: sandbox.id,
    name: sandbox.name,
    state: sandbox.state,
    target: sandbox.target,
    snapshot: sandbox.snapshot,
    sandboxClass: sandbox.sandboxClass,
    cpu: sandbox.cpu,
    memory: sandbox.memory,
    disk: sandbox.disk,
    autoStopInterval: sandbox.autoStopInterval
  };
}

function snapshotLooksReady(snapshot) {
  return String(snapshot.state).toLowerCase().includes("active") ||
    String(snapshot.state).toLowerCase().includes("ready") ||
    String(snapshot.state).toLowerCase().includes("created");
}

async function buildInventory() {
  const apiConfig = createApiConfig();
  const regionsApi = new RegionsApi(apiConfig);
  const runnersApi = new RunnersApi(apiConfig);
  const adminApi = new AdminApi(apiConfig);
  const daytona = createDaytona();

  const regions = await measured("list shared regions", () => regionsApi.listSharedRegions());
  const snapshots = await measured("list snapshots", () => daytona.snapshot.list(1, 100));
  const runners = await measured("list runners", () => runnersApi.listRunners());
  const adminRunners = await measured("admin list runners", () => adminApi.adminListRunners());

  const regionRunnerResults = [];
  if (regions.ok) {
    for (const region of regions.value.data ?? []) {
      regionRunnerResults.push(
        await measured(`list runners in ${region.id}`, () => runnersApi.listRunners(region.id))
      );
    }
  }

  const sandboxes = [];
  try {
    for await (const sandbox of daytona.list({ limit: 50 })) {
      sandboxes.push(sanitizeSandbox(sandbox));
    }
  } catch (error) {
    sandboxes.push({ error: errorSummary(error) });
  }

  return {
    generatedAt: new Date().toISOString(),
    command: "inventory",
    environment: {
      target: process.env.DAYTONA_TARGET || null,
      apiUrlConfigured: Boolean(process.env.DAYTONA_API_URL),
      apiKeyConfigured: Boolean(process.env.DAYTONA_API_KEY)
    },
    sandboxClasses: SandboxClass,
    regions: regions.ok
      ? { ok: true, ms: regions.ms, items: regions.value.data }
      : { ok: false, ms: regions.ms, error: regions.error },
    snapshots: snapshots.ok
      ? { ok: true, ms: snapshots.ms, total: snapshots.value.total, items: snapshots.value.items.map(sanitizeSnapshot) }
      : { ok: false, ms: snapshots.ms, error: snapshots.error },
    runners: runners.ok
      ? { ok: true, ms: runners.ms, items: runners.value.data.map(sanitizeRunner) }
      : { ok: false, ms: runners.ms, error: runners.error },
    adminRunners: adminRunners.ok
      ? { ok: true, ms: adminRunners.ms, items: adminRunners.value.data.map(sanitizeRunner) }
      : { ok: false, ms: adminRunners.ms, error: adminRunners.error },
    regionRunners: regionRunnerResults.map((result) =>
      result.ok
        ? { label: result.label, ok: true, ms: result.ms, items: result.value.data.map(sanitizeRunner) }
        : { label: result.label, ok: false, ms: result.ms, error: result.error }
    ),
    sandboxes
  };
}

function printInventory(inventory) {
  console.log("Daytona fork capability inventory");
  console.log(`target: ${inventory.environment.target ?? "default"}`);
  console.log(`regions: ${inventory.regions.ok ? inventory.regions.items.length : `error: ${inventory.regions.error.message}`}`);
  console.log(`snapshots: ${inventory.snapshots.ok ? inventory.snapshots.items.length : `error: ${inventory.snapshots.error.message}`}`);
  console.log(`runners: ${inventory.runners.ok ? inventory.runners.items.length : `error: ${inventory.runners.error.message}`}`);
  console.log(
    `admin runners: ${
      inventory.adminRunners.ok ? inventory.adminRunners.items.length : `error: ${inventory.adminRunners.error.message}`
    }`
  );

  const runnerRows = [
    ...(inventory.runners.ok ? inventory.runners.items : []),
    ...(inventory.adminRunners.ok ? inventory.adminRunners.items : [])
  ];
  const byClass = new Map();
  for (const runner of runnerRows) {
    const key = runner.sandboxClass ?? "unknown";
    byClass.set(key, (byClass.get(key) ?? 0) + 1);
  }
  console.log("runner classes:");
  for (const [klass, count] of byClass.entries()) {
    console.log(`  ${klass}: ${count}`);
  }

  if (inventory.snapshots.ok) {
    console.log("snapshot classes:");
    const snapshotsByClass = new Map();
    for (const snapshot of inventory.snapshots.items) {
      const key = snapshot.sandboxClass ?? "unknown";
      snapshotsByClass.set(key, (snapshotsByClass.get(key) ?? 0) + 1);
    }
    for (const [klass, count] of snapshotsByClass.entries()) {
      console.log(`  ${klass}: ${count}`);
    }
  }
}

function candidateTargets(inventory) {
  const explicit = splitCsv(parseFlag("targets") || process.env.DAYTONA_PROBE_TARGETS || "");
  if (explicit.length > 0) return explicit;

  const targets = new Set();
  if (process.env.DAYTONA_TARGET) targets.add(process.env.DAYTONA_TARGET);
  if (inventory.regions.ok) {
    for (const region of inventory.regions.items) {
      targets.add(region.id);
    }
  }

  return [undefined, ...targets].slice(0, Number(parseFlag("max-targets") || 6));
}

function candidateSnapshots(inventory) {
  const explicit = splitCsv(parseFlag("snapshots") || process.env.DAYTONA_PROBE_SNAPSHOTS || "");
  if (explicit.length > 0) {
    return [{ name: null, label: "default" }, ...explicit.map((name) => ({ name, label: name }))];
  }

  const snapshots = inventory.snapshots.ok ? inventory.snapshots.items : [];
  const linuxVm = snapshots
    .filter((snapshot) => snapshot.sandboxClass === SandboxClass.LINUX_VM && snapshotLooksReady(snapshot))
    .map((snapshot) => ({ name: snapshot.name, label: snapshot.name }));
  const containers = snapshots
    .filter((snapshot) => snapshot.sandboxClass === SandboxClass.CONTAINER && snapshotLooksReady(snapshot))
    .slice(0, 3)
    .map((snapshot) => ({ name: snapshot.name, label: snapshot.name }));

  return [{ name: null, label: "default" }, ...linuxVm, ...containers].slice(
    0,
    Number(parseFlag("max-snapshots") || 10)
  );
}

async function cleanupSandbox(daytona, sandbox, label) {
  if (!sandbox) return { label, skipped: true };
  const result = await measured(`delete ${label}`, () => daytona.delete(sandbox, 60));
  return result.ok ? { label, ok: true, ms: result.ms } : { label, ok: false, ms: result.ms, error: result.error };
}

async function setAutoStop(sandbox) {
  if (!sandbox || typeof sandbox.setAutostopInterval !== "function") {
    return { ok: false, skipped: true };
  }

  return measured("set fork auto-stop", () => sandbox.setAutostopInterval(autoStopMinutes));
}

async function probeForks(inventory) {
  const keep = hasFlag("keep");
  const attempts = [];
  const targets = candidateTargets(inventory);
  const snapshots = candidateSnapshots(inventory);
  const maxAttempts = Number(parseFlag("max-attempts") || 20);

  for (const target of targets) {
    for (const snapshot of snapshots) {
      if (attempts.length >= maxAttempts) return attempts;

      const daytona = createDaytona(target);
      const suffix = `${Date.now()}-${attempts.length}`;
      const name = `coupon-fork-probe-${suffix}`;
      const params = {
        name,
        autoStopInterval: autoStopMinutes,
        labels: {
          demo: "coupon-fork-probe",
          createdBy: "codex"
        }
      };
      if (snapshot.name) {
        params.snapshot = snapshot.name;
      }

      const attempt = {
        target: target ?? "default",
        snapshot: snapshot.label,
        params: {
          snapshot: params.snapshot ?? null
        },
        createdAt: new Date().toISOString(),
        steps: []
      };

      console.log("");
      console.log(`Attempt ${attempts.length + 1}: target=${attempt.target} snapshot=${attempt.snapshot}`);

      let parent;
      let fork;
      const createResult = await measured("create parent", () => daytona.create(params, { timeout: 90 }));
      attempt.steps.push(createResult.ok
        ? { operation: "create parent", ok: true, ms: createResult.ms, sandbox: sanitizeSandbox(createResult.value) }
        : { operation: "create parent", ok: false, ms: createResult.ms, error: createResult.error });
      console.log(createResult.ok ? `  create parent: ok ${createResult.ms}ms` : `  create parent: failed ${createResult.error.message}`);
      if (!createResult.ok) {
        attempts.push(attempt);
        continue;
      }

      parent = createResult.value;
      const prepareResult = await measured("write marker", () =>
        parent.process.executeCommand("printf fork-probe-parent > /tmp/coupon-fork-probe.txt")
      );
      attempt.steps.push(
        prepareResult.ok
          ? { operation: "write marker", ok: true, ms: prepareResult.ms }
          : { operation: "write marker", ok: false, ms: prepareResult.ms, error: prepareResult.error }
      );
      console.log(prepareResult.ok ? `  write marker: ok ${prepareResult.ms}ms` : `  write marker: failed ${prepareResult.error.message}`);

      const forkResult = await measured("fork parent", () =>
        daytona._experimental_fork(parent, { name: `${name}-fork` }, 90)
      );
      attempt.steps.push(
        forkResult.ok
          ? { operation: "fork parent", ok: true, ms: forkResult.ms, sandbox: sanitizeSandbox(forkResult.value) }
          : { operation: "fork parent", ok: false, ms: forkResult.ms, error: forkResult.error }
      );
      console.log(forkResult.ok ? `  fork parent: ok ${forkResult.ms}ms` : `  fork parent: failed ${forkResult.error.message}`);

      if (forkResult.ok) {
        fork = forkResult.value;
        const autoStopResult = await setAutoStop(fork);
        attempt.steps.push(
          autoStopResult.ok
            ? { operation: "set fork auto-stop", ok: true, ms: autoStopResult.ms, minutes: autoStopMinutes }
            : {
                operation: "set fork auto-stop",
                ok: false,
                ms: autoStopResult.ms ?? 0,
                skipped: autoStopResult.skipped ?? false,
                error: autoStopResult.error
              }
        );
        console.log(
          autoStopResult.ok
            ? `  set fork auto-stop: ok ${autoStopResult.ms}ms (${autoStopMinutes}m)`
            : "  set fork auto-stop: skipped or failed"
        );
        const verifyResult = await measured("verify fork inherited marker", () =>
          fork.process.executeCommand("cat /tmp/coupon-fork-probe.txt")
        );
        attempt.steps.push(
          verifyResult.ok
            ? {
                operation: "verify fork inherited marker",
                ok: true,
                ms: verifyResult.ms,
                output: verifyResult.value?.result ?? verifyResult.value?.output ?? verifyResult.value?.stdout ?? ""
              }
            : { operation: "verify fork inherited marker", ok: false, ms: verifyResult.ms, error: verifyResult.error }
        );
        console.log(
          verifyResult.ok
            ? `  verify fork inherited marker: ok ${verifyResult.ms}ms`
            : `  verify fork inherited marker: failed ${verifyResult.error.message}`
        );
        attempt.success = true;
      } else {
        attempt.success = false;
      }

      if (!keep) {
        attempt.cleanup = [];
        attempt.cleanup.push(await cleanupSandbox(daytona, fork, "fork"));
        attempt.cleanup.push(await cleanupSandbox(daytona, parent, "parent"));
      } else {
        attempt.kept = {
          parent: parent?.id,
          fork: fork?.id
        };
      }

      attempts.push(attempt);
      if (attempt.success) return attempts;
    }
  }

  return attempts;
}

function writeReport(report) {
  mkdirSync(projectPath("logs"), { recursive: true });
  writeJson(reportPath, report);
}

loadEnv();
ensureKey();

const inventory = await buildInventory();
if (command === "inventory") {
  const report = {
    generatedAt: new Date().toISOString(),
    startedAt,
    inventory
  };
  writeReport(report);
  printInventory(inventory);
  console.log(`Wrote ${reportPath}`);
} else if (command === "probe") {
  printInventory(inventory);
  const attempts = await probeForks(inventory);
  const winner = attempts.find((attempt) => attempt.success);
  const report = {
    generatedAt: new Date().toISOString(),
    startedAt,
    command: "probe",
    inventory,
    attempts,
    winner: winner
      ? {
          target: winner.target,
          snapshot: winner.snapshot,
          parent: winner.steps.find((step) => step.operation === "create parent")?.sandbox,
          fork: winner.steps.find((step) => step.operation === "fork parent")?.sandbox
        }
      : null
  };
  writeReport(report);
  console.log("");
  if (winner) {
    console.log("Fork-capable combination found:");
    console.log(`  target: ${winner.target}`);
    console.log(`  snapshot: ${winner.snapshot}`);
  } else {
    console.log("No fork-capable combination found in attempted candidates.");
  }
  console.log(`Wrote ${reportPath}`);
} else {
  console.error("Usage:");
  console.error("  npm run daytona:inventory");
  console.error("  npm run daytona:probe-fork -- --max-attempts=20");
  process.exitCode = 1;
}
