import { Daytona } from "@daytona/sdk";

const daytona = new Daytona();

const preparedParent = await daytona.create({
  snapshot: "YOUR_BASE_SNAPSHOT",
  autoStopInterval: 0
});

await preparedParent.process.executeCommand(`set -e
git clone YOUR_REPO_URL daytona-forking-coupon-demo
cd daytona-forking-coupon-demo
npm install
npm run seed
npm run build
mkdir -p .artifacts/logs
npm test > .artifacts/logs/failing-baseline.txt 2>&1 || true
npm run benchmark-state-reuse
`);

const immediateFork = await preparedParent._experimental_fork({
  name: "contract-hypothesis"
});

await preparedParent._experimental_createSnapshot("coupon-prepared-baseline");

const laterSandbox = await daytona.create({
  snapshot: "coupon-prepared-baseline",
  autoStopInterval: 0
});

console.log({
  immediateFork: immediateFork.id,
  reusableSnapshotRestore: laterSandbox.id
});
