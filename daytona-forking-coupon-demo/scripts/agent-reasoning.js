import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { projectPath, readJson, writeJson } from "./state-utils.js";

const DEFAULT_MODEL = "gpt-4.1-mini";
const sessionPath = projectPath("data", "demo-session-state.json");
const runPath = projectPath("logs", "simple-demo-run.json");
const reasoningJsonPath = projectPath("logs", "agent-reasoning.json");
const reasoningMdPath = projectPath("logs", "agent-reasoning.md");
const workspaceRoot = resolve(projectPath(".."));

const cleanSessionState = {
  bugReproduced: false,
  invalidCoupon: "SUMMER-2026",
  uiAcceptedInvalidCoupon: false,
  checkoutFailedGenerically: false,
  reproducedAt: null,
  events: []
};

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

const reasoningSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "setup",
    "forks",
    "winningBranch",
    "nextForkPoint",
    "validatorDecision",
    "terminalScript",
    "caveats"
  ],
  properties: {
    headline: { type: "string" },
    setup: {
      type: "object",
      additionalProperties: false,
      required: ["preparedParent", "stateBoundary"],
      properties: {
        preparedParent: { type: "string" },
        stateBoundary: { type: "string" }
      }
    },
    forks: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "hypothesis", "evidence", "experiment", "observation", "verdict"],
        properties: {
          name: { type: "string" },
          hypothesis: { type: "string" },
          evidence: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "string" }
          },
          experiment: { type: "string" },
          observation: { type: "string" },
          verdict: { type: "string" }
        }
      }
    },
    winningBranch: {
      type: "object",
      additionalProperties: false,
      required: ["name", "why", "invariant"],
      properties: {
        name: { type: "string" },
        why: { type: "string" },
        invariant: { type: "string" }
      }
    },
    nextForkPoint: {
      type: "object",
      additionalProperties: false,
      required: ["parent", "diskStateWrittenBeforeFork", "children", "whyForkingHelps"],
      properties: {
        parent: { type: "string" },
        diskStateWrittenBeforeFork: { type: "string" },
        children: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          items: { type: "string" }
        },
        whyForkingHelps: { type: "string" }
      }
    },
    validatorDecision: {
      type: "object",
      additionalProperties: false,
      required: ["rule", "greenLightCriteria", "fallbackRoute"],
      properties: {
        rule: { type: "string" },
        greenLightCriteria: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          items: { type: "string" }
        },
        fallbackRoute: { type: "string" }
      }
    },
    terminalScript: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: { type: "string" }
    },
    caveats: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" }
    }
  }
};

function now() {
  return new Date().toISOString();
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;

    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
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

function hydrateEnv() {
  for (const path of [
    projectPath(".env.local"),
    projectPath(".env"),
    resolve(workspaceRoot, ".env.local"),
    resolve(workspaceRoot, ".env")
  ]) {
    loadEnvFile(path);
  }
}

function readText(path, fallback = "", limit = 7000) {
  if (!existsSync(path)) return fallback;
  const text = readFileSync(path, "utf8");
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[truncated to ${limit} characters]`;
}

function requireReproduced() {
  const session = {
    ...cleanSessionState,
    ...readJson(sessionPath, cleanSessionState)
  };

  if (!session.bugReproduced) {
    console.log("Bug is not reproduced yet.");
    console.log("");
    console.log("Browser bug location:");
    console.log("  1. Run: npm run dev");
    console.log("  2. Open the printed localhost URL, usually http://localhost:4173");
    console.log("  3. Click Apply for SUMMER-2026, then click Checkout.");
    console.log("  4. Re-run: npm run demo:agent");
    process.exit(1);
  }

  return session;
}

function buildContext(session) {
  return {
    demo: {
      validCoupon: "SAVE10",
      invalidCoupon: session.invalidCoupon,
      expectedUserMessage: "Invalid coupon code",
      observedBug: "The UI accepts SUMMER-2026, then checkout fails with a generic error."
    },
    bindingFacts: [
      "Baseline /api/validate-coupon incorrectly accepts SUMMER-2026 because it checks coupon format only.",
      "Baseline /api/checkout rejects SUMMER-2026 late because it checks seeded coupon data, but it returns a generic checkout error.",
      "The UI uses the same too-weak validation path as /api/validate-coupon, so it accepts SUMMER-2026 before checkout.",
      "A frontend-only fix can improve inline behavior but does not establish a shared source of truth.",
      "A backend-only fix can improve checkout/API error handling but still allows the UI to accept bad state first.",
      "The contract hypothesis wins because shared validation should reject unknown coupons before checkout in both UI and API paths."
    ],
    reproducedSession: session,
    preparedParentState: preparedState,
    forkPlan: {
      firstForkPoint: "coupon-parent-prepared",
      hypotheses: ["frontend-hypothesis", "backend-hypothesis", "contract-hypothesis"],
      winningBranch: "contract-hypothesis",
      secondForkPoint: "contract-candidate-fix",
      refinements: ["contract-minimal", "contract-with-regression-test"],
      validators: [
        "api-design-review",
        "implementation-review",
        "regression-test-builder"
      ]
    },
    artifacts: {
      debugBrief: readText(projectPath("debug-brief.md")),
      failingBaseline: readText(projectPath("logs", "failing-baseline.txt")),
      stateManifest: readText(projectPath("state-manifest.json")),
      simpleDemoRun: readText(runPath, "No command-run metrics have been recorded yet.", 5000),
      candidateFix: readText(projectPath("fix-candidate.md"), "No fix-candidate.md yet.")
    }
  };
}

function extractOutputText(responseJson) {
  if (typeof responseJson.output_text === "string") {
    return responseJson.output_text;
  }

  const parts = [];
  for (const item of responseJson.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}

function redactLikelySecrets(text) {
  return text
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[redacted-openai-key]")
    .replace(/dtn_[A-Za-z0-9]{20,}/g, "[redacted-daytona-key]");
}

function metricKey(item) {
  return `${item.operation}:${item.branch}`;
}

function updateRun(latencyMs, model) {
  const run = readJson(runPath, {
    generatedAt: now(),
    mode: "command-driven",
    metrics: [],
    events: []
  });
  const metric = {
    operation: "generate agent reasoning",
    branch: "contract-candidate-fix",
    latencyMs,
    detail: `OpenAI Responses API via ${model}`,
    at: now()
  };
  const metrics = run.metrics ?? [];
  const index = metrics.findIndex((item) => metricKey(item) === metricKey(metric));
  if (index >= 0) {
    metrics[index] = metric;
  } else {
    metrics.push(metric);
  }

  writeJson(runPath, {
    ...run,
    metrics,
    events: [
      ...(run.events ?? []),
      {
        at: now(),
        label: "agent-reasoning-generated",
        detail: "Live OpenAI reasoning report generated for the hypothesis fork segment."
      }
    ],
    updatedAt: now()
  });
}

function renderMarkdown(reasoning, metadata) {
  const lines = [
    "# Agent Reasoning Report",
    "",
    `Generated: ${metadata.generatedAt}`,
    `Model: ${metadata.model}`,
    `Latency: ${metadata.latencyMs}ms`,
    "",
    `## ${reasoning.headline}`,
    "",
    "## Prepared Parent",
    "",
    `- ${reasoning.setup.preparedParent}`,
    `- ${reasoning.setup.stateBoundary}`,
    "",
    "## Hypothesis Forks",
    ""
  ];

  for (const fork of reasoning.forks) {
    lines.push(`### ${fork.name}`);
    lines.push("");
    lines.push(`Hypothesis: ${fork.hypothesis}`);
    lines.push("");
    lines.push("Evidence:");
    for (const item of fork.evidence) {
      lines.push(`- ${item}`);
    }
    lines.push("");
    lines.push(`Experiment: ${fork.experiment}`);
    lines.push(`Observation: ${fork.observation}`);
    lines.push(`Verdict: ${fork.verdict}`);
    lines.push("");
  }

  lines.push("## Decision");
  lines.push("");
  lines.push(`Winner: ${reasoning.winningBranch.name}`);
  lines.push("");
  lines.push(reasoning.winningBranch.why);
  lines.push("");
  lines.push(`Invariant: ${reasoning.winningBranch.invariant}`);
  lines.push("");
  lines.push("## Next Fork Point");
  lines.push("");
  lines.push(`Parent: ${reasoning.nextForkPoint.parent}`);
  lines.push(`Disk state written before fork: ${reasoning.nextForkPoint.diskStateWrittenBeforeFork}`);
  lines.push("");
  lines.push("Children:");
  for (const child of reasoning.nextForkPoint.children) {
    lines.push(`- ${child}`);
  }
  lines.push("");
  lines.push(reasoning.nextForkPoint.whyForkingHelps);
  lines.push("");
  lines.push("## Validator Decision Rule");
  lines.push("");
  lines.push(reasoning.validatorDecision.rule);
  lines.push("");
  lines.push("Green-light criteria:");
  for (const item of reasoning.validatorDecision.greenLightCriteria) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push(`Fallback route: ${reasoning.validatorDecision.fallbackRoute}`);
  lines.push("");
  lines.push("## Terminal Script");
  lines.push("");
  for (const line of reasoning.terminalScript) {
    lines.push(`- ${line}`);
  }
  lines.push("");
  lines.push("## Caveats");
  lines.push("");
  for (const caveat of reasoning.caveats) {
    lines.push(`- ${caveat}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function printReasoning(reasoning, metadata) {
  console.log("");
  console.log("=".repeat(76));
  console.log("Live agent reasoning for the hypothesis forks");
  console.log("=".repeat(76));
  console.log(`model: ${metadata.model}`);
  console.log(`latency: ${metadata.latencyMs}ms`);
  console.log("");
  console.log(reasoning.headline);
  console.log("");
  console.log("Prepared parent:");
  console.log(`  ${reasoning.setup.preparedParent}`);
  console.log(`  ${reasoning.setup.stateBoundary}`);
  console.log("");

  for (const fork of reasoning.forks) {
    console.log(fork.name);
    console.log(`  hypothesis: ${fork.hypothesis}`);
    console.log("  evidence:");
    for (const item of fork.evidence) {
      console.log(`    - ${item}`);
    }
    console.log(`  experiment: ${fork.experiment}`);
    console.log(`  observation: ${fork.observation}`);
    console.log(`  verdict: ${fork.verdict}`);
    console.log("");
  }

  console.log(`Decision: continue from ${reasoning.winningBranch.name}`);
  console.log(`  ${reasoning.winningBranch.why}`);
  console.log(`  invariant: ${reasoning.winningBranch.invariant}`);
  console.log("");
  console.log("Next fork point:");
  console.log(`  parent: ${reasoning.nextForkPoint.parent}`);
  console.log(`  disk state: ${reasoning.nextForkPoint.diskStateWrittenBeforeFork}`);
  console.log(`  children: ${reasoning.nextForkPoint.children.join(", ")}`);
  console.log(`  why: ${reasoning.nextForkPoint.whyForkingHelps}`);
  console.log("");
  console.log("Validator decision rule:");
  console.log(`  rule: ${reasoning.validatorDecision.rule}`);
  console.log(`  fallback: ${reasoning.validatorDecision.fallbackRoute}`);
  console.log("");
  console.log("Terminal script:");
  for (const line of reasoning.terminalScript) {
    console.log(`  - ${line}`);
  }
  console.log("");
  console.log("Caveats:");
  for (const caveat of reasoning.caveats) {
    console.log(`  - ${caveat}`);
  }
  console.log("");
  console.log(`Wrote ${reasoningMdPath}`);
  console.log(`Wrote ${reasoningJsonPath}`);
}

async function requestReasoning(apiKey, model, context) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You are the lead debugging agent in a Daytona sandbox forking demo.",
                "Return externalized engineering rationale suitable for a terminal demo, not private chain-of-thought.",
                "Use only the provided context. Do not invent real Daytona sandbox IDs or secret values.",
                "Keep claims precise: filesystem state is inherited by forks; do not overclaim process memory preservation.",
                "Do not claim process memory must be preserved or must reinitialize; say it needs runner-specific proof.",
                "Treat the binding facts in the user context as authoritative and do not contradict them.",
                "Prefer concise evidence, experiment, observation, and verdict language."
              ].join(" ")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Generate the live agent reasoning for this coupon forking demo:\n\n${JSON.stringify(
                context,
                null,
                2
              )}`
            }
          ]
        }
      ],
      max_output_tokens: 2200,
      text: {
        format: {
          type: "json_schema",
          name: "coupon_fork_agent_reasoning",
          strict: true,
          schema: reasoningSchema
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = redactLikelySecrets(await response.text());
    throw new Error(`OpenAI request failed with HTTP ${response.status}: ${errorText.slice(0, 800)}`);
  }

  return response.json();
}

async function main() {
  hydrateEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY. Create one through the secure OpenAI Platform setup flow before running this command.");
    process.exit(1);
  }

  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const session = requireReproduced();
  const context = buildContext(session);
  const startedAt = performance.now();
  const responseJson = await requestReasoning(apiKey, model, context);
  const latencyMs = Math.round(performance.now() - startedAt);
  const outputText = extractOutputText(responseJson);

  let reasoning;
  try {
    reasoning = JSON.parse(outputText);
  } catch (error) {
    writeFileSync(
      reasoningMdPath,
      `# Agent Reasoning Report\n\nThe model returned non-JSON output.\n\n${redactLikelySecrets(outputText)}\n`
    );
    throw new Error(`Could not parse structured model output: ${error.message}`);
  }

  const metadata = {
    generatedAt: now(),
    model,
    latencyMs,
    responseId: responseJson.id ?? null
  };

  writeJson(reasoningJsonPath, {
    ...metadata,
    reasoning
  });
  writeFileSync(reasoningMdPath, renderMarkdown(reasoning, metadata));
  updateRun(latencyMs, model);
  printReasoning(reasoning, metadata);
}

main().catch((error) => {
  console.error(redactLikelySecrets(error.message));
  process.exit(1);
});
