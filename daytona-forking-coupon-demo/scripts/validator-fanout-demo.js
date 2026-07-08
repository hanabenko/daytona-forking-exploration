console.log(`contract-candidate-fix
├── api-design-review        green-light: API rejects SUMMER-2026 before checkout
├── implementation-review    green-light: shared contract fix is minimal and coherent
└── regression-test-builder  green-light: tests cover invalid unknown coupon`);

console.log(`
If any validator does not green-light the candidate fix, the result goes back to the
original contract-fix agent instead of asking every worker to rediscover the bug.`);
