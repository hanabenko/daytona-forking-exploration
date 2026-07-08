import { Daytona } from "@daytona/sdk";

const daytona = new Daytona();

const parent = await daytona.create({
  snapshot: "coupon-prepared-baseline",
  autoStopInterval: 0
});

const contractHypothesis = await daytona._experimental_fork(parent, {
  name: "contract-hypothesis"
});

await contractHypothesis.process.executeCommand(
  "cd daytona-forking-coupon-demo && echo shared-contract-fix > fork-note.txt"
);

const minimal = await contractHypothesis._experimental_fork({ name: "contract-minimal" });
const regression = await contractHypothesis._experimental_fork({
  name: "contract-with-regression-test"
});

await minimal.process.executeCommand(
  "cd daytona-forking-coupon-demo && echo minimal-fix > refinement.txt"
);
await regression.process.executeCommand(
  "cd daytona-forking-coupon-demo && echo regression-test-fix > refinement.txt"
);

console.log("Forked contract-hypothesis into contract-minimal and contract-with-regression-test.");
