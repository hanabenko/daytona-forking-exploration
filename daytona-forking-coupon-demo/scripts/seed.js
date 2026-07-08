import { writeFileSync } from "node:fs";
import { projectPath, updateStateManifest } from "./state-utils.js";

const coupons = [
  {
    code: "SAVE10",
    discountPercent: 10,
    description: "Baseline seeded coupon used by tests and screenshots."
  }
];

writeFileSync(projectPath("data", "coupons.json"), `${JSON.stringify(coupons, null, 2)}\n`);
writeFileSync(
  projectPath("state-marker.txt"),
  "coupon-parent-prepared: filesystem marker written before fork\n"
);

updateStateManifest({
  seededCouponData: true,
  stateMarker: true
});

console.log("Seeded coupon data: data/coupons.json");
console.log("Wrote state marker: state-marker.txt");
