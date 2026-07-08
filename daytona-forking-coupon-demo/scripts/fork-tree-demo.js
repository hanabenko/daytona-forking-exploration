console.log(`coupon-parent-prepared
├── frontend-hypothesis
├── backend-hypothesis
└── contract-hypothesis
    ├── contract-candidate-fix
    │   ├── api-design-review
    │   ├── implementation-review
    │   ├── regression-test-builder
    │   └── memory-state-check
    ├── contract-minimal
    └── contract-with-regression-test

Why multi-level forking matters:
- The first fork point is the prepared parent state.
- The contract branch writes a candidate fix before more forks happen.
- Validator forks inherit the actual changed branch, not just the original baseline.
- If a validator rejects the fix, the demo keeps iterating from the exact contract-fix parent.`);
