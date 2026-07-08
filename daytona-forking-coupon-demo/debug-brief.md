# Debug Brief: Coupon Validation Baseline

## Reproduction

1. Start the app with `npm run dev`.
2. Open the checkout page.
3. Leave the coupon field set to `SUMMER-2026`.
4. Click **Apply**.
5. The UI accepts the coupon.
6. Click **Checkout**.
7. Checkout fails with a generic payment-style error.

## Expected Behavior

The invalid coupon `SUMMER-2026` should be rejected inline before checkout proceeds with:

```text
Invalid coupon code
```

## Current Observations

- Valid coupon `SAVE10` exists in seeded coupon data.
- Invalid coupon `SUMMER-2026` matches the shared format regex.
- The UI and `/api/validate-coupon` treat format validity as coupon validity.
- `/api/checkout` checks seeded coupon data and rejects unknown coupons.
- Checkout returns a generic error, which hides the real validation issue.

## Hypotheses

| Fork | Hypothesis | Expected learning |
| --- | --- | --- |
| `frontend-hypothesis` | Client validation is incomplete. | Inline behavior can improve, but API inconsistency remains. |
| `backend-hypothesis` | Checkout API error handling is incomplete. | API behavior can improve, but UI may still accept the bad coupon first. |
| `contract-hypothesis` | Shared coupon validation contract is wrong. | UI and API behavior become consistent. |

## Suggested Winning Path

Start from `contract-hypothesis`, then fork it into:

- `contract-minimal`: smallest shared contract fix.
- `contract-with-regression-test`: shared contract fix plus explicit regression coverage.
