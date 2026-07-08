const form = document.querySelector("#coupon-form");
const couponInput = document.querySelector("#coupon");
const couponMessage = document.querySelector("#coupon-message");
const checkoutButton = document.querySelector("#checkout");
const checkoutMessage = document.querySelector("#checkout-message");
const bugLocation = document.querySelector(".bug-location");
const discount = document.querySelector("#discount");
const total = document.querySelector("#total");
let acceptedInvalidCoupon = false;
let demoFixApplied = false;

function setMessage(node, kind, text) {
  node.className = `message ${kind}`;
  node.textContent = text;
}

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload };
}

async function recordBugReproduction(couponCode, checkoutError) {
  const normalized = couponCode.trim().toUpperCase();
  const checkoutFailedGenerically =
    checkoutError === "Checkout failed. Please try another payment method.";

  if (!acceptedInvalidCoupon || normalized !== "SUMMER-2026" || !checkoutFailedGenerically) {
    return;
  }

  await postJson("/api/reproduction-event", {
    invalidCoupon: normalized,
    uiAcceptedInvalidCoupon: true,
    checkoutFailedGenerically: true,
    checkoutError
  });

  showBugLocation();
  window.dispatchEvent(new CustomEvent("demo-session-updated"));
}

function showBugLocation() {
  bugLocation?.removeAttribute("hidden");
}

function resetTotals() {
  discount.textContent = "$0.00";
  total.textContent = "$42.00";
}

function isFixedInvalidCoupon(couponCode) {
  return demoFixApplied && couponCode.trim().toUpperCase() === "SUMMER-2026";
}

function showFixedCouponState(session = {}) {
  demoFixApplied = true;
  acceptedInvalidCoupon = false;
  showBugLocation();
  setMessage(couponMessage, "error", session.fixedCouponMessage ?? "Invalid coupon code");
  setMessage(
    checkoutMessage,
    "neutral",
    session.fixedCheckoutMessage ?? "Blocked before checkout by the shared coupon contract."
  );
  resetTotals();

  if (bugLocation) {
    bugLocation.classList.add("fixed");
    bugLocation.innerHTML = `<strong>Fixed behavior</strong>
      <span>After Apply: <code>Invalid coupon code</code></span>
      <span>Checkout is not reached with <code>SUMMER-2026</code>.</span>`;
  }
}

async function pollDemoFixState() {
  try {
    const response = await fetch("/api/demo-session");
    const session = await response.json();
    if (session.fixApplied) {
      showFixedCouponState(session);
    } else if (session.bugReproduced) {
      showBugLocation();
    } else if (demoFixApplied) {
      window.location.reload();
    }
  } catch {
    // The checkout still works if the demo-state poll is temporarily unavailable.
  }

  setTimeout(pollDemoFixState, 2000);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const couponCode = couponInput.value;

  if (isFixedInvalidCoupon(couponCode)) {
    showFixedCouponState();
    return;
  }

  const { response, payload } = await postJson("/api/validate-coupon", { couponCode });

  if (response.ok && payload.ok) {
    setMessage(couponMessage, "ok", payload.message);
    acceptedInvalidCoupon = couponCode.trim().toUpperCase() === "SUMMER-2026";
    discount.textContent = couponCode.trim().toUpperCase() === "SAVE10" ? "-$4.20" : "$0.00";
    total.textContent = couponCode.trim().toUpperCase() === "SAVE10" ? "$37.80" : "$42.00";
    return;
  }

  acceptedInvalidCoupon = false;
  setMessage(couponMessage, "error", payload.message ?? "Invalid coupon code");
  resetTotals();
});

checkoutButton.addEventListener("click", async () => {
  setMessage(checkoutMessage, "neutral", "Checking out...");
  const couponCode = couponInput.value;

  if (isFixedInvalidCoupon(couponCode)) {
    setMessage(checkoutMessage, "error", "Checkout blocked until a valid coupon is applied.");
    return;
  }

  const { response, payload } = await postJson("/api/checkout", { couponCode, subtotalCents: 4200 });

  if (response.ok && payload.ok) {
    setMessage(checkoutMessage, "ok", `Checkout ready. Total ${money(payload.totalCents)}.`);
    return;
  }

  const errorText = payload.error ?? "Checkout failed.";
  setMessage(checkoutMessage, "error", errorText);

  await recordBugReproduction(couponCode, errorText);
});

pollDemoFixState();
