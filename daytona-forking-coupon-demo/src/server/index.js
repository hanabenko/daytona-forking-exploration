import { createServer } from "./app.js";

const requestedPort = Number(process.env.PORT ?? 4173);
const explicitPort = process.env.PORT !== undefined;
const host = process.env.HOST ?? "127.0.0.1";
let activeServer;

function listen(port, remainingRetries = 10) {
  const server = createServer();

  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && !explicitPort && remainingRetries > 0) {
      console.log(`Port ${port} is already in use; trying ${port + 1}.`);
      listen(port + 1, remainingRetries - 1);
      return;
    }

    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Set PORT to another value or stop the existing server.`);
    } else if (error.code === "EPERM") {
      console.error(`Cannot bind ${host}:${port}. Set HOST/PORT to an allowed local address or stop the existing server.`);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  });

  server.listen(port, host, () => {
    activeServer = server;
    console.log(`Coupon checkout demo running at http://localhost:${port}`);
    console.log("Try coupon SAVE10, then SUMMER-2026.");
  });
}

listen(requestedPort);

process.on("SIGTERM", () => activeServer?.close());
process.on("SIGINT", () => activeServer?.close());
