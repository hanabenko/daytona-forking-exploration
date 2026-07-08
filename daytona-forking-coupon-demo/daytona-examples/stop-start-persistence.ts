import { Daytona } from "@daytona/sdk";

const daytona = new Daytona();

const sandbox = await daytona.create({
  snapshot: "coupon-prepared-baseline",
  autoStopInterval: 0
});

await sandbox.process.executeCommand(
  "cd daytona-forking-coupon-demo && echo stop-start-proof > state-marker.txt"
);

await sandbox.stop();
await sandbox.start();

const marker = await sandbox.process.executeCommand(
  "cd daytona-forking-coupon-demo && cat state-marker.txt"
);

console.log(marker.result ?? marker);
