import test from "node:test";
import assert from "node:assert/strict";
import { checkoutApi, validateCouponApi } from "../src/server/app.js";

test("validation API accepts the seeded coupon", () => {
  const result = validateCouponApi("SAVE10");
  assert.equal(result.ok, true);
});

test("validation API should reject unknown coupon codes", () => {
  const result = validateCouponApi("SUMMER-2026");
  assert.equal(result.ok, false);
  assert.equal(result.message, "Invalid coupon code");
});

test("checkout API currently exposes the layered failure", () => {
  const result = checkoutApi({ couponCode: "SUMMER-2026", subtotalCents: 4200 });
  assert.equal(result.status, 402);
  assert.equal(result.body.error, "Checkout failed. Please try another payment method.");
});
