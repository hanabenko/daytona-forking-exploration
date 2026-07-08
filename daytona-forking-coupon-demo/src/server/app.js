import { spawn } from "node:child_process";
import { createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { extname, join, normalize } from "node:path";
import {
  calculateTotalCents,
  validateCouponForCheckout,
  validateCouponForEntry
} from "../shared/couponContract.js";

const rootDir = new URL("../../", import.meta.url).pathname;
const clientDir = join(rootDir, "src", "client");
const dataPath = join(rootDir, "data", "coupons.json");
const forkingStatePath = join(rootDir, "data", "forking-console-state.json");
const demoSessionPath = join(rootDir, "data", "demo-session-state.json");
const daytonaRun = {
  status: "idle",
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  logs: []
};

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

export function loadCoupons() {
  if (!existsSync(dataPath)) {
    return [];
  }

  return JSON.parse(readFileSync(dataPath, "utf8"));
}

export function validateCouponApi(code) {
  return validateCouponForEntry(code);
}

export function checkoutApi({ couponCode, subtotalCents = 4200 }) {
  const coupons = loadCoupons();
  const couponResult = validateCouponForCheckout(couponCode, coupons);

  if (!couponResult.ok) {
    return {
      status: 402,
      body: {
        ok: false,
        error: "Checkout failed. Please try another payment method."
      }
    };
  }

  const totalCents = calculateTotalCents(subtotalCents, couponResult.discountPercent);
  return {
    status: 200,
    body: {
      ok: true,
      totalCents,
      discountPercent: couponResult.discountPercent,
      message: "Checkout ready."
    }
  };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

function defaultDemoSessionState() {
  return {
    bugReproduced: false,
    invalidCoupon: "SUMMER-2026",
    uiAcceptedInvalidCoupon: false,
    checkoutFailedGenerically: false,
    fixApplied: false,
    fixedAt: null,
    winningHypothesis: null,
    fixedCouponMessage: null,
    fixedCheckoutMessage: null,
    reproducedAt: null,
    events: []
  };
}

function readDemoSessionState() {
  if (!existsSync(demoSessionPath)) {
    return defaultDemoSessionState();
  }

  return {
    ...defaultDemoSessionState(),
    ...JSON.parse(readFileSync(demoSessionPath, "utf8"))
  };
}

function writeDemoSessionState(state) {
  writeFileSync(demoSessionPath, `${JSON.stringify(state, null, 2)}\n`);
}

function recordReproductionEvent(body) {
  const state = readDemoSessionState();
  const event = {
    type: "coupon-bug-reproduced",
    at: new Date().toISOString(),
    invalidCoupon: String(body.invalidCoupon ?? "SUMMER-2026"),
    uiAcceptedInvalidCoupon: Boolean(body.uiAcceptedInvalidCoupon),
    checkoutFailedGenerically: Boolean(body.checkoutFailedGenerically),
    checkoutError: String(body.checkoutError ?? "")
  };

  const bugReproduced =
    event.invalidCoupon === "SUMMER-2026" &&
    event.uiAcceptedInvalidCoupon &&
    event.checkoutFailedGenerically;

  const next = {
    ...state,
    bugReproduced: state.bugReproduced || bugReproduced,
    invalidCoupon: event.invalidCoupon,
    uiAcceptedInvalidCoupon: state.uiAcceptedInvalidCoupon || event.uiAcceptedInvalidCoupon,
    checkoutFailedGenerically: state.checkoutFailedGenerically || event.checkoutFailedGenerically,
    reproducedAt: bugReproduced ? event.at : state.reproducedAt,
    events: [...(state.events ?? []), event].slice(-50)
  };

  writeDemoSessionState(next);
  return next;
}

function appendDaytonaRunLog(message) {
  const sanitized = String(message).replace(/daytona_[A-Za-z0-9._-]+/g, "daytona_***");
  for (const line of sanitized.split(/\r?\n/)) {
    if (line.trim()) {
      daytonaRun.logs.push(`[${new Date().toISOString()}] ${line}`);
    }
  }

  if (daytonaRun.logs.length > 400) {
    daytonaRun.logs.splice(0, daytonaRun.logs.length - 400);
  }
}

function startDaytonaRun(apiKey) {
  daytonaRun.status = "running";
  daytonaRun.startedAt = new Date().toISOString();
  daytonaRun.finishedAt = null;
  daytonaRun.exitCode = null;
  daytonaRun.logs = [];
  appendDaytonaRunLog("Starting Daytona live run from browser request.");

  const child = spawn(process.execPath, ["scripts/daytona-live-demo.js", "--live", "--from-browser"], {
    cwd: rootDir,
    env: {
      ...process.env,
      DAYTONA_API_KEY: apiKey,
      DAYTONA_CLEANUP: process.env.DAYTONA_CLEANUP ?? "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => appendDaytonaRunLog(chunk));
  child.stderr.on("data", (chunk) => appendDaytonaRunLog(chunk));
  child.on("error", (error) => {
    daytonaRun.status = "failed";
    daytonaRun.finishedAt = new Date().toISOString();
    appendDaytonaRunLog(`Failed to start Daytona live run: ${error.message}`);
  });
  child.on("close", (code) => {
    daytonaRun.status = code === 0 ? "complete" : "failed";
    daytonaRun.exitCode = code;
    daytonaRun.finishedAt = new Date().toISOString();
    appendDaytonaRunLog(`Daytona live run exited with code ${code}.`);
  });
}

function failDaytonaRunBeforeSpawn(message) {
  daytonaRun.status = "failed";
  daytonaRun.startedAt = new Date().toISOString();
  daytonaRun.finishedAt = new Date().toISOString();
  daytonaRun.exitCode = null;
  daytonaRun.logs = [];
  appendDaytonaRunLog(message);
}

async function verifyDaytonaCredentials(apiKey) {
  try {
    const { Daytona } = await import("@daytona/sdk");
    const daytona = new Daytona({ apiKey });
    try {
      await daytona.configApi.configControllerGetConfig();
    } finally {
      await daytona[Symbol.asyncDispose]?.();
    }

    return { ok: true };
  } catch (error) {
    const message = String(error?.message ?? error);
    const statusCode = message.toLowerCase().includes("credential") ? 401 : 502;
    return {
      ok: false,
      statusCode,
      error:
        statusCode === 401
          ? "Daytona rejected the API key. Paste the full dtn_... key again and make sure it has not been revoked."
          : `Could not verify the Daytona API key before starting the run: ${message}`
    };
  }
}

function sendStatic(response, requestUrl) {
  const pathname =
    requestUrl === "/"
      ? "/index.html"
      : requestUrl === "/forking-demo" || requestUrl === "/forking-demo/"
        ? "/forking-demo.html"
        : requestUrl;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(clientDir, safePath);

  if (!filePath.startsWith(clientDir) || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "content-type": mimeTypes[extname(filePath)] ?? "text/plain" });
  createReadStream(filePath).pipe(response);
}

export function createServer() {
  return createHttpServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true, service: "coupon-checkout" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/forking-state") {
      const state = existsSync(forkingStatePath)
        ? JSON.parse(readFileSync(forkingStatePath, "utf8"))
        : { mode: "missing", message: "data/forking-console-state.json not found" };
      sendJson(response, 200, state);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/demo-session") {
      sendJson(response, 200, readDemoSessionState());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/demo-session/reset") {
      const next = defaultDemoSessionState();
      writeDemoSessionState(next);
      sendJson(response, 200, next);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/reproduction-event") {
      const body = await readJson(request);
      const next = recordReproductionEvent(body);
      sendJson(response, next.bugReproduced ? 200 : 422, next);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/daytona-run") {
      sendJson(response, 200, {
        status: daytonaRun.status,
        startedAt: daytonaRun.startedAt,
        finishedAt: daytonaRun.finishedAt,
        exitCode: daytonaRun.exitCode,
        logs: daytonaRun.logs
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/daytona-run") {
      const body = await readJson(request);
      const apiKey = String(body.apiKey ?? "").trim();
      const demoSession = readDemoSessionState();

      if (!apiKey) {
        sendJson(response, 400, { ok: false, error: "DAYTONA_API_KEY is required." });
        return;
      }

      if (!demoSession.bugReproduced) {
        sendJson(response, 409, {
          ok: false,
          error: "Reproduce the SUMMER-2026 checkout bug before starting the live fork run."
        });
        return;
      }

      if (daytonaRun.status === "running") {
        sendJson(response, 409, { ok: false, error: "A Daytona live run is already running." });
        return;
      }

      const credentialCheck = await verifyDaytonaCredentials(apiKey);
      if (!credentialCheck.ok) {
        failDaytonaRunBeforeSpawn(credentialCheck.error);
        sendJson(response, credentialCheck.statusCode, { ok: false, error: credentialCheck.error });
        return;
      }

      startDaytonaRun(apiKey);
      sendJson(response, 202, { ok: true, status: daytonaRun.status });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/validate-coupon") {
      const body = await readJson(request);
      const result = validateCouponApi(body.couponCode);
      sendJson(response, result.ok ? 200 : 422, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/checkout") {
      const body = await readJson(request);
      const result = checkoutApi(body);
      sendJson(response, result.status, result.body);
      return;
    }

    if (request.method === "GET") {
      sendStatic(response, url.pathname);
      return;
    }

    sendJson(response, 405, { ok: false, error: "Method not allowed" });
  });
}
