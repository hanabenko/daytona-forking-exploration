# Daytona Forking Coupon Demo

Small checkout app for a Daytona guide about forking prepared sandboxes for AI
agents.

The intentional bug:

- `SAVE10` is valid.
- `SUMMER-2026` is invalid.
- The UI accepts `SUMMER-2026`.
- Checkout later fails with a generic error.

Correct behavior is an inline `Invalid coupon code` error before checkout.

## Run

```bash
npm install
npm run seed
npm run dev
```

Open `http://localhost:4173`, apply `SUMMER-2026`, then click checkout. If you
have a Daytona key, the live start button in the page can run the optional fork
flow.
