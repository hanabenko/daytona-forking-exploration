import { projectPath, writeJson } from "./state-utils.js";

const sessionPath = projectPath("data", "demo-session-state.json");

const cleanSessionState = {
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

writeJson(sessionPath, cleanSessionState);

console.log("Reset coupon reproduction state for video recording.");
console.log("Recommended simple flow: run `npm run dev`, reproduce SUMMER-2026 in the browser, then run `npm run demo:state`.");
console.log("The older animated terminal is still available as `npm run video:terminal`.");
