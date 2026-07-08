import { Daytona } from "@daytona/sdk";

const daytona = new Daytona();

const parent = await daytona.create({
  snapshot: "coupon-prepared-baseline",
  autoStopInterval: 0
});

await parent.process.executeCommand(
  "cd daytona-forking-coupon-demo && npm run inspect-state"
);

const frontendFork = await parent._experimental_fork({ name: "frontend-hypothesis" });
const backendFork = await parent._experimental_fork({ name: "backend-hypothesis" });

await frontendFork.process.executeCommand(
  "cd daytona-forking-coupon-demo && echo frontend > fork-note.txt"
);
await backendFork.process.executeCommand(
  "cd daytona-forking-coupon-demo && echo backend > fork-note.txt"
);

const parentCheck = await parent.process.executeCommand(
  "cd daytona-forking-coupon-demo && test ! -f fork-note.txt && echo parent-independent"
);

console.log(parentCheck.result ?? parentCheck);
