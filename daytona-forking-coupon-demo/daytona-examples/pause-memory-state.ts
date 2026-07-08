import { Daytona } from "@daytona/sdk";

const daytona = new Daytona();

const sandbox = await daytona.create({
  snapshot: "coupon-prepared-baseline",
  autoStopInterval: 0
});

await sandbox.process.executeCommand(`cd daytona-forking-coupon-demo
node -e "let n = 0; setInterval(() => { n += 1; }, 1000)" >/tmp/counter.log 2>&1 &
echo $! >/tmp/counter.pid
`);

// Pause is runtime-state semantics, not filesystem-only semantics.
// If your Daytona account/runner exposes a pause/resume API, use it here.
// Keep this check explicit so the guide does not imply ordinary stop/start
// is the same operation as pausing a live process.
const pauseCapableSandbox = sandbox as typeof sandbox & {
  pause?: () => Promise<void>;
  resume?: () => Promise<void>;
};

if (!pauseCapableSandbox.pause || !pauseCapableSandbox.resume) {
  throw new Error("Pause/resume is runner/API dependent; verify current Daytona SDK support.");
}

await pauseCapableSandbox.pause();
await pauseCapableSandbox.resume();

const pid = await sandbox.process.executeCommand("cat /tmp/counter.pid && ps -p $(cat /tmp/counter.pid)");
console.log(pid.result ?? pid);
