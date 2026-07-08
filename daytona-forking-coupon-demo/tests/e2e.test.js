import test from "node:test";
import assert from "node:assert/strict";
import { checkoutApi, validateCouponApi } from "../src/server/app.js";

test("invalid coupon is rejected during validation instead of checkout", () => {
  const validation = validateCouponApi("SUMMER-2026");

  assert.equal(validation.ok, false);
  assert.equal(validation.message, "Invalid coupon code");

  const checkout = checkoutApi({ couponCode: "SUMMER-2026", subtotalCents: 4200 });
  assert.equal(checkout.status, 422);
  assert.equal(checkout.body.error, "Invalid coupon code");
});
