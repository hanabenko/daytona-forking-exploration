import { Daytona } from "@daytona/sdk";

const daytona = new Daytona();

const sandbox = await daytona.create({
  snapshot: "coupon-prepared-baseline",
  autoStopInterval: 0,
  autoArchiveInterval: 60
});

const state = await sandbox.process.executeCommand(
  "cd daytona-forking-coupon-demo && npm run inspect-state"
);

console.log(state.result ?? state);
