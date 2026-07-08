import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { projectPath, readJson, writeJson } from "./state-utils.js";

const DEFAULT_MODEL = "gpt-4.1-mini";
const cacheJsonPath = projectPath("logs", "openai-cache-probe.json");
const cacheMdPath = projectPath("logs", "openai-cache-probe.md");
const workspaceRoot = resolve(projectPath(".."));

const defaultPrompt =
  "I have a checkout bug: SUMMER-2026 is accepted in the UI, then checkout fails generically. " +
  "My hypotheses are frontend validation, backend checkout/API validation, and shared coupon contract/schema. " +
  "Fork the sandboxes and test which hypothesis is correct.";

const preparedState = [
  "repo files",
  "installed dependencies",
  "build artifacts",
  "seeded coupon data",
  "failing baseline logs",
  "debug brief",
  "state-marker.txt",
  "benchmark output"
];

const layer1Tasks = [
  {
    role: "frontend-hypothesis",
    task: "Evaluate whether a UI-only coupon validation change is sufficient. Return concise externalized agent rationale."
  },
  {
    role: "backend-hypothesis",
    task: "Evaluate whether a checkout/API-only validation change is sufficient. Return concise externalized agent rationale."
  },
  {
    role: "contract-hypothesis",
    task: "Evaluate whether the shared coupon contract/schema is the correct fix point. Return concise externalized agent rationale."
  }
];

const layer2Tasks = [
  {
    role: "contract-minimal",
    task: "Evaluate the smallest shared-contract patch after the contract branch wrote fix-candidate.md."
  },
  {
    role: "contract-with-regression-test",
    task: "Evaluate the shared-contract patch plus explicit SUMMER-2026 regression coverage."
  }
];

function now() {
  return new Date().toISOString();
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;

    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (!key || Object.hasOwn(process.env, key)) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

export function hydrateOpenAIEnv() {
  for (const path of [
    projectPath(".env.local"),
    projectPath(".env"),
    resolve(workspaceRoot, ".env.local"),
    resolve(workspaceRoot, ".env")
  ]) {
    loadEnvFile(path);
  }
}

function readText(path, fallback = "", limit = 9000) {
  if (!existsSync(path)) return fallback;
  const text = readFileSync(path, "utf8");
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[truncated to ${limit} characters]`;
}

function buildRepeatedContext(layer) {
  const facts = [
    "The prepared parent has already reproduced the browser-visible coupon bug.",
    "SUMMER-2026 is invalid and SAVE10 is valid.",
    "The incorrect baseline accepts SUMMER-2026 before checkout.",
    "A useful fork point contains source files, installed dependencies, seeded data, logs, and written debugging context.",
    "Child agents should inherit externalized debugging context from disk rather than rediscovering it.",
    "A frontend-only fix can improve the form but may leave backend/API behavior inconsistent.",
    "A backend-only fix can improve server rejection but may leave the UI accepting invalid state.",
    "A shared contract fix should make UI validation and API validation agree.",
    "Forking a changed contract branch demonstrates that later children inherit candidate-fix state.",
    "OpenAI prompt caching is a separate model-side cache hit from an identical long prompt prefix."
  ];

  const lines = [];
  for (let index = 0; index < 120; index += 1) {
    lines.push(`${layer} cache context ${index + 1}: ${facts[index % facts.length]}`);
  }
  return lines.join("\n");
}

function buildLayer1Prefix(prompt) {
  const session = readJson(projectPath("data", "demo-session-state.json"), {});
  const stateManifest = readText(projectPath("state-manifest.json"), "state-manifest.json is not present.");
  const debugBrief = readText(projectPath("debug-brief.md"), "debug-brief.md is not present.");
  const failingLog = readText(projectPath("logs", "failing-baseline.txt"), "failing baseline log is not present.");

  return [
    "CACHE LAYER 1: coupon-parent-prepared",
    "This shared prompt prefix is intentionally long and identical for the parent warm request and all first-layer child agent requests.",
    "It is derived from state written into the prepared Daytona sandbox before forking.",
    "",
    `User prompt: ${prompt}`,
    "",
    "Prepared parent state:",
    ...preparedState.map((item) => `- ${item}`),
    "",
    "Browser reproduction session:",
    JSON.stringify(session, null, 2),
    "",
    "state-manifest.json:",
    stateManifest,
    "",
    "debug-brief.md:",
    debugBrief,
    "",
    ".artifacts/logs/failing-baseline.txt:",
    failingLog,
    "",
    buildRepeatedContext("layer-1")
  ].join("\n");
}

function buildLayer2Prefix(prompt) {
  const layer1Report = readText(cacheMdPath, "No layer-one cache report has been written yet.", 5000);
  const fixCandidate = readText(projectPath("fix-candidate.md"), "No fix-candidate.md has been written yet.");
  const codexSession = readText(projectPath("logs", "codex-fork-session.md"), "No codex session report has been written yet.", 5000);

  return [
    "CACHE LAYER 2: contract-hypothesis as the new parent",
    "This shared prompt prefix is intentionally long and identical for the contract warm request and all second-layer refinement requests.",
    "It represents the changed child state after the winning branch wrote candidate-fix evidence to disk.",
    "",
    `Original user prompt: ${prompt}`,
    "",
    "Layer-one cache and branch result summary:",
    layer1Report,
    "",
    "fix-candidate.md:",
    fixCandidate,
    "",
    "codex-fork-session.md:",
    codexSession,
    "",
    buildRepeatedContext("layer-2")
  ].join("\n");
}

function normalizeUsage(usage = {}) {
  const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;
  const cachedTokens =
    usage.input_tokens_details?.cached_tokens ??
    usage.prompt_tokens_details?.cached_tokens ??
    0;

  return {
    inputTokens,
    cachedTokens,
    outputTokens,
    totalTokens,
    cacheRate: inputTokens ? Number((cachedTokens / inputTokens).toFixed(3)) : 0
  };
}

function formatInt(value) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function formatCacheRow(record) {
  if (record.status !== "ok") {
    return `[cache:failed] ${record.label.padEnd(34, " ")} ${String(record.latencyMs).padStart(5, " ")}ms  ${record.error}`;
  }

  return [
    `[cache:ok]    ${record.label.padEnd(34, " ")}`,
    `input ${formatInt(record.inputTokens).padStart(5, " ")}`,
    `cached ${formatInt(record.cachedTokens).padStart(5, " ")}`,
    `output ${formatInt(record.outputTokens).padStart(4, " ")}`,
    `${String(record.latencyMs).padStart(5, " ")}ms`
  ].join("  ");
}

function extractOutputText(responseJson) {
  if (typeof responseJson.output_text === "string") return responseJson.output_text;

  const parts = [];
  for (const item of responseJson.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }

  return parts.join("\n").trim();
}

function redactLikelySecrets(text) {
  return String(text)
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[redacted-openai-key]")
    .replace(/dtn_[A-Za-z0-9]{20,}/g, "[redacted-daytona-key]");
}

function renderMarkdown(records, metadata) {
  const lines = [
    "# OpenAI Prompt Cache Probe",
    "",
    `Generated: ${metadata.updatedAt}`,
    `Model: ${metadata.model}`,
    `Run ID: ${metadata.runId}`,
    "",
    "These rows are live OpenAI usage metadata. They show model-side prompt cache hits from reused serialized context, not Daytona copying OpenAI KV cache between sandboxes.",
    "",
    "| Layer | Request | Input tokens | Cached tokens | Output tokens | Cache hit | Latency |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |"
  ];

  for (const record of records) {
    if (record.status !== "ok") {
      lines.push(`| ${record.layer} | ${record.label} | failed | failed | failed | failed | ${record.latencyMs}ms |`);
      continue;
    }
    lines.push(
      `| ${record.layer} | ${record.label} | ${record.inputTokens} | ${record.cachedTokens} | ${record.outputTokens} | ${Math.round(record.cacheRate * 100)}% | ${record.latencyMs}ms |`
    );
  }

  lines.push("");
  return `${lines.join("\n")}`;
}

export function createOpenAICacheProbe({ runId, prompt = defaultPrompt, model, logToConsole = true } = {}) {
  hydrateOpenAIEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  const selectedModel = model ?? process.env.OPENAI_CACHE_MODEL ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const records = [];
  const startedAt = now();

  function persist() {
    const metadata = {
      generatedAt: startedAt,
      updatedAt: now(),
      runId,
      model: selectedModel,
      records
    };
    writeJson(cacheJsonPath, metadata);
    writeFileSync(cacheMdPath, renderMarkdown(records, metadata));
  }

  async function request({ layer, label, role, prefix, task, cacheKey }) {
    if (!apiKey) {
      return null;
    }

    if (logToConsole) {
      console.log(`[cache:start] ${label}`);
    }

    const started = performance.now();
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selectedModel,
          prompt_cache_key: cacheKey,
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: [
                    "You are an externalized debugging agent in a Daytona sandbox forking demo.",
                    "Return concise engineering rationale, not private chain-of-thought.",
                    "Do not print or infer secret values.",
                    "Keep the answer under 60 words."
                  ].join(" ")
                }
              ]
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `${prefix}\n\n--- child-specific task begins here ---\nrole: ${role}\n${task}`
                }
              ]
            }
          ],
          max_output_tokens: 120
        })
      });

      const latencyMs = Math.round(performance.now() - started);

      if (!response.ok) {
        const errorText = redactLikelySecrets(await response.text());
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 500)}`);
      }

      const responseJson = await response.json();
      const usage = normalizeUsage(responseJson.usage);
      const record = {
        at: now(),
        layer,
        label,
        role,
        model: selectedModel,
        status: "ok",
        latencyMs,
        responseId: responseJson.id ?? null,
        outputPreview: redactLikelySecrets(extractOutputText(responseJson)).slice(0, 500),
        ...usage
      };
      records.push(record);
      persist();
      if (logToConsole) {
        console.log(formatCacheRow(record));
      }
      return record;
    } catch (error) {
      const record = {
        at: now(),
        layer,
        label,
        role,
        model: selectedModel,
        status: "failed",
        latencyMs: Math.round(performance.now() - started),
        error: redactLikelySecrets(error.message)
      };
      records.push(record);
      persist();
      if (logToConsole) {
        console.log(formatCacheRow(record));
      }
      return record;
    }
  }

  const layer1Prefix = buildLayer1Prefix(prompt);
  let layer2Prefix = null;
  function getLayer2Prefix() {
    if (!layer2Prefix) {
      layer2Prefix = buildLayer2Prefix(prompt);
    }
    return layer2Prefix;
  }
  const layer1CacheKey = `coupon-fork-demo-${runId}-layer-1`;
  const layer2CacheKey = `coupon-fork-demo-${runId}-layer-2`;

  return {
    enabled: Boolean(apiKey),
    paths: {
      json: cacheJsonPath,
      markdown: cacheMdPath
    },
    records,
    async warmLayer1() {
      return request({
        layer: "layer 1",
        label: "parent context warm",
        role: "coupon-parent-prepared",
        prefix: layer1Prefix,
        task: "Warm the shared prepared-parent debugging context before first-layer hypothesis agents run.",
        cacheKey: layer1CacheKey
      });
    },
    async runLayer1Children() {
      const results = [];
      for (const task of layer1Tasks) {
        results.push(
          await request({
            layer: "layer 1",
            label: task.role,
            role: task.role,
            prefix: layer1Prefix,
            task: task.task,
            cacheKey: layer1CacheKey
          })
        );
      }
      return results;
    },
    async warmLayer2() {
      return request({
        layer: "layer 2",
        label: "contract context warm",
        role: "contract-hypothesis",
        prefix: getLayer2Prefix(),
        task: "Warm the changed contract-branch context before second-layer refinements run.",
        cacheKey: layer2CacheKey
      });
    },
    async runLayer2Children() {
      const results = [];
      for (const task of layer2Tasks) {
        results.push(
          await request({
            layer: "layer 2",
            label: task.role,
            role: task.role,
            prefix: getLayer2Prefix(),
            task: task.task,
            cacheKey: layer2CacheKey
          })
        );
      }
      return results;
    },
    summaryLine(layer) {
      const matching = records.filter((record) => record.status === "ok" && record.layer === layer);
      const childHits = matching.filter((record) => !record.label.includes("warm"));
      if (childHits.length === 0) return "OpenAI cache: no child cache rows recorded.";
      const cached = childHits.reduce((sum, record) => sum + record.cachedTokens, 0);
      const input = childHits.reduce((sum, record) => sum + record.inputTokens, 0);
      const rate = input ? Math.round((cached / input) * 100) : 0;
      return `OpenAI cache: child prompts reused ${formatInt(cached)} of ${formatInt(input)} input tokens (${rate}%).`;
    }
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const prompt = process.env.CODEX_FORK_PROMPT || defaultPrompt;
  const runId = `local-cache-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;
  const probe = createOpenAICacheProbe({ runId, prompt });

  if (!probe.enabled) {
    console.error("OPENAI_API_KEY is not configured. The cache probe cannot make live OpenAI requests.");
    process.exit(1);
  }

  console.log("OpenAI prompt cache probe");
  console.log(`model: ${process.env.OPENAI_CACHE_MODEL ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL}`);
  console.log("");

  await probe.warmLayer1();
  await probe.runLayer1Children();

  if (!args.has("--layer1-only")) {
    await probe.warmLayer2();
    await probe.runLayer2Children();
  }

  console.log("");
  console.log(probe.summaryLine("layer 1"));
  if (!args.has("--layer1-only")) {
    console.log(probe.summaryLine("layer 2"));
  }
  console.log(`Wrote ${cacheJsonPath}`);
  console.log(`Wrote ${cacheMdPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(redactLikelySecrets(error.message));
    process.exit(1);
  });
}
