import test from "node:test";
import assert from "node:assert/strict";
import { validateCouponForEntry } from "../src/shared/couponContract.js";

test("valid seeded coupon can be entered", () => {
  const result = validateCouponForEntry("SAVE10");
  assert.equal(result.ok, true);
});

test("invalid unknown coupon should be rejected inline before checkout", () => {
  const result = validateCouponForEntry("SUMMER-2026");
  assert.equal(result.ok, false);
  assert.equal(result.message, "Invalid coupon code");
});
