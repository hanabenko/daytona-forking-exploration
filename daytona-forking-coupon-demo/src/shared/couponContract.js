export const VALID_COUPON_CODES = ["SAVE10"];
export const COUPON_PATTERN = /^[A-Z0-9-]{4,20}$/;

export function normalizeCouponCode(input) {
  return String(input ?? "").trim().toUpperCase();
}

export function loadCouponCodes(couponRows) {
  return new Set(couponRows.map((row) => normalizeCouponCode(row.code)));
}

export function validateCouponForEntry(input) {
  const code = normalizeCouponCode(input);

  if (code.length === 0) {
    return { ok: true, code: "", message: "No coupon applied." };
  }

  if (!COUPON_PATTERN.test(code)) {
    return { ok: false, code, message: "Invalid coupon code" };
  }

  // Baseline bug: this is only a format check. The UI and validation API accept
  // plausible-looking coupons that are not in the seeded coupon data.
  return { ok: true, code, message: `Coupon accepted: ${code}` };
}

export function validateCouponForCheckout(input, couponRows) {
  const code = normalizeCouponCode(input);
  const knownCoupons = loadCouponCodes(couponRows);

  if (code.length === 0) {
    return { ok: true, code: "", discountPercent: 0, message: "No coupon applied." };
  }

  if (!COUPON_PATTERN.test(code) || !knownCoupons.has(code)) {
    return { ok: false, code, message: "Invalid coupon code" };
  }

  const coupon = couponRows.find((row) => normalizeCouponCode(row.code) === code);
  return {
    ok: true,
    code,
    discountPercent: coupon.discountPercent,
    message: `${coupon.discountPercent}% discount applied.`
  };
}

export function calculateTotalCents(subtotalCents, discountPercent) {
  const discount = Math.round(subtotalCents * (discountPercent / 100));
  return subtotalCents - discount;
}
