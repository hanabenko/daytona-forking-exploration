import { writeFileSync } from "node:fs";
import { projectPath } from "./state-utils.js";

const baseline = {
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

writeFileSync(projectPath("data", "demo-session-state.json"), `${JSON.stringify(baseline, null, 2)}\n`);
console.log("Reset demo session state: data/demo-session-state.json");
