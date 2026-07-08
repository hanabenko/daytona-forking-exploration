# Codex-Style Fork Session

Generated: 2026-07-07T00:43:29.697Z
Prompt: I have a checkout bug: SUMMER-2026 is accepted in the UI, then checkout fails generically. My hypotheses are frontend validation, backend checkout/API validation, and shared coupon contract/schema. Fork the sandboxes and test which hypothesis is correct.

## Prepared Parent

Reproduced bug: SUMMER-2026 is accepted by the UI, then checkout fails generically.
Reproduced at: 2026-07-06T23:32:02.894Z

Inherited state:
- repo files
- installed dependencies
- build artifacts
- seeded coupon data
- failing baseline logs
- debug brief
- state-marker.txt
- benchmark output

## Hypothesis Fork Results

### frontend-hypothesis

Hypothesis: The UI accepts SUMMER-2026 because client-side validation is too weak.
Experiment: Patch the coupon form so it rejects unknown coupons inline.
Changed files: src/client/app.js

- PASS: The visible form can show Invalid coupon code.
- FAIL: /api/validate-coupon can still accept a format-valid unknown coupon.
- FAIL: The shared validation rule is still split across UI/API paths.

Verdict: partial
Decision: This fixes the first visible symptom, but it does not prove the backend and UI share one coupon rule.

### backend-hypothesis

Hypothesis: Checkout fails generically because the API handles invalid coupons too late.
Experiment: Patch checkout/API behavior so unknown coupons return a specific validation error.
Changed files: src/server/app.js

- PASS: Checkout can return a clearer invalid-coupon response.
- FAIL: The browser can still accept SUMMER-2026 before checkout.
- FAIL: The entry validation endpoint and checkout path still disagree.

Verdict: partial
Decision: This catches the bad coupon later, but it still allows bad state to enter the checkout flow.

### contract-hypothesis

Hypothesis: The UI and API disagree because the shared coupon contract is wrong.
Experiment: Move unknown-coupon rejection into the shared validation contract used by both layers.
Changed files: src/shared/couponContract.js, src/client/app.js, src/server/app.js

- PASS: The UI rejects SUMMER-2026 before checkout.
- PASS: /api/validate-coupon rejects the same unknown coupon.
- PASS: Checkout no longer receives a coupon that entry validation accepted incorrectly.

Verdict: winner
Decision: This fixes the invariant: unknown coupons must be rejected before checkout by every validation path.

## Winner

Continue from `contract-hypothesis`, then fork the changed contract state into validator branches.
