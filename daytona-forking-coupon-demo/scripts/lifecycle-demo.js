const rows = [
  [
    "Stop/start",
    "same sandbox identity; files persist; running processes should be restarted, not assumed preserved"
  ],
  [
    "Pause",
    "same sandbox identity; live processes and memory can be frozen where the runner supports pause semantics"
  ],
  [
    "Fork",
    "new sandbox identity; same disk state at the fork point; future writes diverge independently"
  ],
  ["Snapshot", "saved reusable baseline; useful when the prepared filesystem state should be recreated later"],
  [
    "Restore from snapshot",
    "new sandbox identity created from the saved baseline; not the same as returning to a stopped sandbox"
  ]
];

console.log("Daytona lifecycle semantics for the coupon demo\n");
console.log("Stop/start means same sandbox, files persist.");
console.log("Pause means same sandbox, live processes/memory are frozen.");
console.log("Fork means new sandbox, same disk state at fork point, independent divergence.");
console.log("Snapshot means reusable baseline.");
console.log("Restore from snapshot means create/recreate a sandbox from the saved baseline.\n");

const operationWidth = Math.max(...rows.map(([operation]) => operation.length));
for (const [operation, meaning] of rows) {
  console.log(`${operation.padEnd(operationWidth)}  ${meaning}`);
}
