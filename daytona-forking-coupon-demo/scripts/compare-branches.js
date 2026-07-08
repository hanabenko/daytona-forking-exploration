const rows = [
  {
    fork: "frontend-hypothesis",
    hypothesis: "Client-side validation bug",
    changedFiles: "src/client/app.js",
    ui: "Inline invalid coupon appears",
    api: "Validation API still accepts format-only coupon",
    tests: "UI-focused tests pass; API contract tests fail",
    verdict: "Partial"
  },
  {
    fork: "backend-hypothesis",
    hypothesis: "Checkout/API validation bug",
    changedFiles: "src/server/app.js",
    ui: "Apply still accepts SUMMER-2026",
    api: "Checkout can return Invalid coupon code",
    tests: "API checkout tests pass; UI flow remains confusing",
    verdict: "Partial"
  },
  {
    fork: "contract-hypothesis",
    hypothesis: "Shared coupon contract bug",
    changedFiles: "src/shared/couponContract.js, src/server/app.js",
    ui: "Apply rejects SUMMER-2026 inline",
    api: "Validation and checkout use same known-coupon rule",
    tests: "UI, API, and e2e tests pass",
    verdict: "Best"
  },
  {
    fork: "contract-minimal",
    hypothesis: "Smallest shared contract fix",
    changedFiles: "src/shared/couponContract.js",
    ui: "Apply rejects SUMMER-2026 inline",
    api: "Validation and checkout agree",
    tests: "Existing regression suite passes",
    verdict: "Good for hotfix"
  },
  {
    fork: "contract-with-regression-test",
    hypothesis: "Shared fix plus explicit regression coverage",
    changedFiles: "src/shared/couponContract.js, tests/*.test.js",
    ui: "Apply rejects SUMMER-2026 inline",
    api: "Validation and checkout agree",
    tests: "Regression covers invalid unknown coupon",
    verdict: "Recommended"
  }
];

const columns = [
  ["branch/fork name", "fork"],
  ["hypothesis", "hypothesis"],
  ["changed files", "changedFiles"],
  ["UI behavior", "ui"],
  ["API behavior", "api"],
  ["tests", "tests"],
  ["verdict", "verdict"]
];

const widths = columns.map(([heading, key]) =>
  Math.max(heading.length, ...rows.map((row) => String(row[key]).length))
);

function line(left, middle, right, fill) {
  return `${left}${widths.map((width) => fill.repeat(width + 2)).join(middle)}${right}`;
}

console.log(line("┌", "┬", "┐", "─"));
console.log(
  `│${columns
    .map(([heading], index) => ` ${heading.padEnd(widths[index])} `)
    .join("│")}│`
);
console.log(line("├", "┼", "┤", "─"));

for (const row of rows) {
  console.log(
    `│${columns
      .map(([, key], index) => ` ${String(row[key]).padEnd(widths[index])} `)
      .join("│")}│`
  );
}

console.log(line("└", "┴", "┘", "─"));
