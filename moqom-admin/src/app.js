// MOQOM Cloud operator console. Signs in with Google's OpenID Connect implicit flow (an ID token in
// the redirect fragment, bound to a nonce), keeps the token in sessionStorage for this tab only, and
// sends it as a Bearer header to /v1/operator/*. The control plane verifies the token's signature,
// audience, issuer, expiry, verified email and the operator allow-list; nothing here is trusted.

const root = document.getElementById("app");
const config = {
  api: root.dataset.api,
  clientId: root.dataset.clientId,
  hostedDomain: root.dataset.hostedDomain,
  dev: root.dataset.dev === "true",
};

const TOKEN = "moqom.operator.token";
const PENDING = "moqom.operator.pending";

const $ = (id) => document.getElementById(id);
const views = [...document.querySelectorAll("[data-view]")];

let token = null;
let tenants = [];
let current = null;
let adjustKey = null;
let expiryTimer = null;

// ---- helpers --------------------------------------------------------------------------------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (name === "class") node.className = value;
    else if (name === "text") node.textContent = value;
    else node.setAttribute(name, value === true ? "" : value);
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

const when = (value) => (value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
const day = (value) => (value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");
// Cents, except an amount under a cent, which would otherwise read as $0.00.
const usd = (micros) => {
  const digits = micros !== 0 && Math.abs(micros) < 10_000 ? 4 : 2;
  return (micros / 1e6).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const shown = (m) => usd(m.micros);

function relative(value) {
  if (!value) return "never";
  const seconds = (Date.now() - new Date(value).getTime()) / 1000;
  if (seconds < 90) return "just now";
  if (seconds < 5400) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 129600) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} days ago`;
}

const statusPill = {
  active: "pill pill-ok",
  pending: "pill pill-warn",
  suspended: "pill pill-danger",
  archived: "pill",
  deleted: "pill",
};

function showError(message) {
  const node = $("error");
  node.textContent = message || "";
  node.hidden = !message;
}

function random(bytes = 24) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...values)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function claims(raw) {
  try {
    const part = raw.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=")));
  } catch {
    return null;
  }
}

// ---- API --------------------------------------------------------------------------------------

class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function call(path, options = {}) {
  if (!token) throw new ApiError(401, "Signed out.");
  let response;
  try {
    response = await fetch(config.api + path, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, `Couldn't reach ${config.api}.`);
  }
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    signOut("Your sign-in was refused or has expired. Sign in again.");
    throw new ApiError(401, body.error || "unauthorized");
  }
  if (!response.ok) throw new ApiError(response.status, body.error || `HTTP ${response.status}`, body.code);
  return { status: response.status, body };
}

// ---- sign-in ---------------------------------------------------------------------------------

function redirectUri() {
  return `${location.origin}/`;
}

function signIn() {
  const pending = { state: random(), nonce: random() };
  sessionStorage.setItem(PENDING, JSON.stringify(pending));
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri(),
    response_type: "id_token",
    scope: "openid email",
    nonce: pending.nonce,
    state: pending.state,
    prompt: "select_account",
  });
  if (config.hostedDomain) params.set("hd", config.hostedDomain);
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

// completeSignIn takes the ID token out of the redirect fragment, checks it answers the request
// this tab made (state and nonce), and removes it from the address bar and history.
function completeSignIn() {
  if (!location.hash.includes("id_token=") && !location.hash.includes("error=")) return;
  const fragment = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, "", `${location.pathname}#/tenants`);
  const pending = JSON.parse(sessionStorage.getItem(PENDING) || "null");
  sessionStorage.removeItem(PENDING);
  if (fragment.get("error")) {
    showError(`Google sign-in failed: ${fragment.get("error")}.`);
    return;
  }
  const raw = fragment.get("id_token");
  const payload = raw && claims(raw);
  if (!pending || fragment.get("state") !== pending.state || !payload || payload.nonce !== pending.nonce) {
    showError("That sign-in response wasn't requested by this tab, so it was ignored. Sign in again.");
    return;
  }
  sessionStorage.setItem(TOKEN, raw);
}

function useToken(raw) {
  const payload = claims(raw);
  if (!payload || typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
    sessionStorage.removeItem(TOKEN);
    return false;
  }
  token = raw;
  clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => signOut("Your sign-in expired. Sign in again."), payload.exp * 1000 - Date.now());
  return true;
}

function signOut(message) {
  token = null;
  tenants = [];
  current = null;
  clearTimeout(expiryTimer);
  sessionStorage.removeItem(TOKEN);
  for (const id of ["tenants", "t-ledger", "t-keys", "t-audit", "audit"]) $(id).replaceChildren();
  $("who").textContent = "";
  $("sign-out").hidden = true;
  $("nav").hidden = true;
  for (const view of views) view.hidden = true;
  $("signin").hidden = false;
  showError(message || "");
}

// ---- routing ---------------------------------------------------------------------------------

function route() {
  if (!token) return;
  const [, name = "tenants", id] = location.hash.split("/");
  for (const view of views) view.hidden = view.dataset.view !== name;
  for (const link of document.querySelectorAll("#nav a")) {
    link.toggleAttribute("aria-current", link.dataset.route === name || (name === "tenant" && link.dataset.route === "tenants"));
  }
  showError("");
  if (name === "tenants") loadTenants();
  else if (name === "tenant" && id) loadTenant(decodeURIComponent(id));
  else if (name === "signups") loadSignups();
  else if (name === "audit") loadAudit();
  else location.hash = "#/tenants";
}

// ---- tenants ---------------------------------------------------------------------------------

async function loadTenants() {
  try {
    const { body } = await call("/v1/operator/tenants");
    tenants = body.tenants || [];
    $("count-total").textContent = String(tenants.length);
    $("count-active").textContent = String(tenants.filter((t) => t.status === "active").length);
    $("sum-balance").textContent = usd(tenants.reduce((sum, t) => sum + t.balance.micros, 0));
    $("sum-spend").textContent = usd(tenants.reduce((sum, t) => sum + t.month_spend.micros, 0));
    renderTenants();
  } catch (error) {
    if (error.status !== 401) showError(error.message);
  }
}

function renderTenants() {
  const query = $("filter").value.trim().toLowerCase();
  const status = $("status-filter").value;
  const rows = tenants
    .filter((t) => !status || t.status === status)
    .filter((t) => !query || [t.name, t.email, t.id].some((v) => (v || "").toLowerCase().includes(query)))
    .map((t) =>
      el(
        "tr",
        {},
        el("td", {}, el("a", { href: `#/tenant/${encodeURIComponent(t.id)}`, text: t.name || t.email }), el("br"), el("span", { class: "small faint mono", text: t.id })),
        el("td", {}, el("span", { class: statusPill[t.status] || "pill", text: t.status }), t.exempt ? el("span", { class: "pill", text: "exempt" }) : null),
        el("td", { class: "small nowrap", text: day(t.created_at) }),
        el("td", { class: `num mono${t.balance.micros < 0 ? " warn" : ""}`, text: shown(t.balance) }),
        el("td", { class: "num mono", text: shown(t.month_spend) }),
        el("td", { class: "small", text: relative(t.last_activity), title: t.last_activity ? when(t.last_activity) : undefined }),
      ),
    );
  $("tenants").replaceChildren(...(rows.length ? rows : [el("tr", {}, el("td", { colspan: 6, class: "faint", text: "No tenants match." }))]));
}

// ---- tenant detail ---------------------------------------------------------------------------

async function loadTenant(id) {
  try {
    const [{ body }, audit] = await Promise.all([
      call(`/v1/operator/tenants/${encodeURIComponent(id)}`),
      call(`/v1/operator/audit?tenant=${encodeURIComponent(id)}&limit=200`),
    ]);
    current = body;
    if (!adjustKey || adjustKey.tenant !== id) newAdjustKey(id);
    renderTenant(body, audit.body.entries || []);
  } catch (error) {
    if (error.status !== 401) showError(error.status === 404 ? `No tenant ${id}.` : error.message);
  }
}

function newAdjustKey(tenant) {
  adjustKey = { tenant, value: `op_${random(18)}` };
  $("adjust-key").textContent = adjustKey.value;
}

function describeDetail(entry) {
  if (!entry.detail) return "";
  try {
    const detail = JSON.parse(entry.detail);
    if (detail && typeof detail === "object") {
      return Object.entries(detail)
        .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
        .join(" · ");
    }
  } catch {}
  return entry.detail;
}

function renderTenant(body, audit) {
  const t = body.tenant;
  $("t-name").textContent = t.name || t.email;
  $("t-status").className = statusPill[t.status] || "pill";
  $("t-status").textContent = t.status + (body.exempt ? " · exempt" : "");
  $("t-id").textContent = t.id;
  $("t-email").textContent = t.email;
  $("t-created").textContent = when(t.created_at);
  $("t-card").textContent = t.has_card ? "Yes" : "No";
  $("t-balance").textContent = shown(body.balance);
  $("t-spend").textContent = `${shown(body.month_spend)} (${body.month})`;
  $("t-limit").textContent = body.spend_limit ? `${shown(body.spend_limit)}${body.limit_reached ? " · reached" : ""}` : "None";
  $("t-auto").textContent = t.auto_top_up.enabled
    ? `${shown(t.auto_top_up.amount)} when below ${shown(t.auto_top_up.below)}${t.last_top_up_error ? ` · last attempt failed: ${t.last_top_up_error}` : ""}`
    : "Off";
  $("t-admission").hidden = body.admitted;
  $("t-refusal").textContent = body.admitted ? "" : `New sessions are refused: ${body.refusal}.`;

  const go = $("status-go");
  const note = $("status-note");
  const form = $("status-form");
  if (t.status === "active") {
    go.textContent = "Suspend tenant";
    go.className = "btn btn-danger";
    form.dataset.target = "suspended";
    go.disabled = false;
    note.hidden = true;
  } else if (t.status === "suspended") {
    go.textContent = "Reactivate tenant";
    go.className = "btn btn-primary";
    form.dataset.target = "active";
    go.disabled = false;
    note.hidden = true;
  } else {
    go.textContent = "No status action";
    go.className = "btn";
    go.disabled = true;
    form.dataset.target = "";
    note.hidden = false;
    note.textContent = `A ${t.status} tenant can't be suspended or reactivated from here.`;
  }

  $("t-ledger").replaceChildren(
    ...(body.ledger.length
      ? body.ledger.map((e) =>
          el(
            "tr",
            {},
            el("td", { class: "small nowrap", text: when(e.at) }),
            el("td", {}, el("span", { class: e.kind === "adjustment" ? "pill pill-accent" : "pill", text: e.kind }), e.capped ? el("span", { class: "pill", text: "capped" }) : null),
            el("td", { class: `num mono${e.amount.micros < 0 ? "" : " ok"}`, text: shown(e.amount) }),
            el("td", { class: "num mono faint", text: e.cost.micros ? shown(e.cost) : "" }),
            el("td", { class: "small mono", text: e.reference || "" }),
            el("td", { class: "small", text: describeDetail(e) }),
          ),
        )
      : [el("tr", {}, el("td", { colspan: 6, class: "faint", text: "No ledger entries." }))]),
  );

  $("t-keys").replaceChildren(
    ...(body.keys.length
      ? body.keys.map((k) =>
          el(
            "tr",
            {},
            el("td", { text: k.name }),
            el("td", { class: "small", text: k.kind }),
            el("td", { class: "small mono", text: k.id }),
            el("td", { class: "small nowrap", text: when(k.created_at) }),
            el("td", { class: "small", text: k.revoked_at ? `Revoked ${when(k.revoked_at)}` : k.retires_at ? `Retires ${when(k.retires_at)}` : "Active" }),
          ),
        )
      : [el("tr", {}, el("td", { colspan: 5, class: "faint", text: "No keys." }))]),
  );

  $("t-audit").replaceChildren(...auditRows(audit, false));
}

function auditRows(entries, wide) {
  if (!entries.length) return [el("tr", {}, el("td", { colspan: wide ? 7 : 5, class: "faint", text: "Nothing recorded." }))];
  return entries.map((a) =>
    el(
      "tr",
      {},
      el("td", { class: "small nowrap", text: when(a.at) }),
      el("td", { class: "small", text: a.operator }),
      wide ? el("td", { class: "small mono", text: a.address }) : null,
      el("td", { class: "small mono", text: a.action }),
      wide ? el("td", {}, a.tenant ? el("a", { class: "small mono", href: `#/tenant/${encodeURIComponent(a.tenant)}`, text: a.tenant }) : "") : null,
      el("td", {}, el("span", { class: a.outcome === "ok" ? "pill pill-ok" : a.outcome === "requested" ? "pill" : "pill pill-danger", text: a.outcome })),
      el("td", { class: "small", text: describeDetail(a) }),
    ),
  );
}

async function submitStatus(event) {
  event.preventDefault();
  if (!current) return;
  const target = $("status-form").dataset.target;
  const reason = $("status-reason").value.trim();
  if (!target) return;
  if (reason.length < 4) {
    showError("Give a reason of at least 4 characters.");
    return;
  }
  const name = current.tenant.name || current.tenant.email;
  const prompt = target === "suspended"
    ? `Suspend ${name}? New sessions will be refused immediately.`
    : `Reactivate ${name}? New sessions will be admitted again if the account has credit.`;
  if (!confirm(prompt)) return;
  try {
    await call(`/v1/operator/tenants/${encodeURIComponent(current.tenant.id)}/status`, { method: "POST", body: { status: target, reason } });
    $("status-reason").value = "";
    await loadTenant(current.tenant.id);
  } catch (error) {
    if (error.status !== 401) showError(error.message);
  }
}

async function submitAdjustment(event) {
  event.preventDefault();
  if (!current) return;
  const amount = Number($("adjust-amount").value);
  const reason = $("adjust-reason").value.trim();
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || cents === 0) {
    showError("Enter a non-zero amount in dollars.");
    return;
  }
  if (Math.abs(cents) > 1_000_000) {
    showError("An adjustment is at most $10,000 either way.");
    return;
  }
  if (reason.length < 4) {
    showError("Give a reason of at least 4 characters. The tenant will see it.");
    return;
  }
  const name = current.tenant.name || current.tenant.email;
  if (!confirm(`${cents > 0 ? "Credit" : "Debit"} ${usd(Math.abs(cents) * 1e4)} ${cents > 0 ? "to" : "from"} ${name}?\n\nReason: ${reason}`)) return;
  const status = $("adjust-status");
  status.textContent = "Applying…";
  try {
    const { body } = await call(`/v1/operator/tenants/${encodeURIComponent(current.tenant.id)}/adjustments`, {
      method: "POST",
      body: { amount_cents: cents, reason, idempotency_key: adjustKey.value },
    });
    status.textContent = body.duplicate
      ? `Already applied as ${body.entry.reference}; nothing changed. Balance ${shown(body.balance)}.`
      : `Applied as ${body.entry.reference}. Balance ${shown(body.balance)}.`;
    $("adjust-amount").value = "";
    $("adjust-reason").value = "";
    newAdjustKey(current.tenant.id);
    await loadTenant(current.tenant.id);
  } catch (error) {
    // The request ID is kept on failure, so retrying can't apply the adjustment twice.
    status.textContent = "";
    if (error.status !== 401) showError(error.message);
  }
}

// ---- signups ---------------------------------------------------------------------------------

async function loadSignups() {
  try {
    const { body } = await call(`/v1/operator/signups?days=${$("signup-days").value}`);
    const days = body.days || [];
    const inWindow = days.reduce((sum, d) => sum + d.signups, 0);
    const peak = days.reduce((best, d) => (d.signups > (best?.signups ?? 0) ? d : best), null);
    $("s-window").textContent = String(inWindow);
    $("s-total").textContent = String(body.total);
    $("s-active").textContent = String(body.active);
    $("s-peak").textContent = peak ? `${peak.signups} on ${peak.date}` : "—";
    drawSignups(days);
  } catch (error) {
    if (error.status !== 401) showError(error.message);
  }
}

function drawSignups(days) {
  const chart = $("signup-chart");
  const title = chart.querySelector("title");
  chart.replaceChildren(title);
  const width = 900;
  const height = 240;
  const left = 36;
  const bottom = 24;
  const top = 12;
  const plot = height - bottom - top;
  const max = Math.max(1, ...days.map((d) => d.signups));
  const step = Math.max(1, Math.ceil(max / 4));
  for (let v = 0; v <= max; v += step) {
    const y = top + plot - (v / max) * plot;
    chart.append(svg("line", { x1: left, x2: width, y1: y, y2: y, class: "grid-line" }));
    const label = svg("text", { x: left - 6, y: y + 4, "text-anchor": "end", class: "axis" });
    label.textContent = String(v);
    chart.append(label);
  }
  const band = (width - left) / Math.max(1, days.length);
  days.forEach((d, i) => {
    const h = (d.signups / max) * plot;
    const bar = svg("rect", {
      x: left + i * band + band * 0.15,
      y: top + plot - h,
      width: Math.max(1, band * 0.7),
      height: Math.max(d.signups ? 1 : 0, h),
      rx: Math.min(3, band * 0.2),
      class: "bar",
    });
    const tip = svg("title");
    tip.textContent = `${d.date}: ${d.signups}`;
    bar.append(tip);
    chart.append(bar);
  });
  const labels = Math.min(6, days.length);
  for (let i = 0; i < labels; i++) {
    const index = Math.round((i * (days.length - 1)) / Math.max(1, labels - 1));
    const edge = i === 0 ? "start" : i === labels - 1 ? "end" : "middle";
    const x = edge === "start" ? left + index * band : edge === "end" ? left + (index + 1) * band : left + index * band + band / 2;
    const label = svg("text", { x, y: height - 6, "text-anchor": edge, class: "axis" });
    label.textContent = days[index].date.slice(5);
    chart.append(label);
  }
}

// ---- audit -----------------------------------------------------------------------------------

async function loadAudit() {
  try {
    const { body } = await call("/v1/operator/audit?limit=500");
    $("audit").replaceChildren(...auditRows(body.entries || [], true));
  } catch (error) {
    if (error.status !== 401) showError(error.message);
  }
}

// ---- start -----------------------------------------------------------------------------------

async function start() {
  const raw = sessionStorage.getItem(TOKEN);
  if (!raw || !useToken(raw)) {
    signOut();
    return;
  }
  try {
    const { body } = await call("/v1/operator/whoami");
    $("who").textContent = body.email;
  } catch (error) {
    if (error.status !== 401) {
      signOut(error.status === 0 ? error.message : `Sign-in refused: ${error.message}`);
    }
    return;
  }
  $("signin").hidden = true;
  $("nav").hidden = false;
  $("sign-out").hidden = false;
  if (!location.hash.startsWith("#/")) history.replaceState(null, "", "#/tenants");
  route();
}

$("google").addEventListener("click", signIn);
$("google").disabled = !config.clientId;
$("config-error").hidden = Boolean(config.clientId) || config.dev;
$("sign-out").addEventListener("click", () => signOut("Signed out."));
$("filter").addEventListener("input", renderTenants);
$("status-filter").addEventListener("change", renderTenants);
$("tenants-reload").addEventListener("click", loadTenants);
$("audit-reload").addEventListener("click", loadAudit);
$("signup-days").addEventListener("change", loadSignups);
$("status-form").addEventListener("submit", submitStatus);
$("adjust-form").addEventListener("submit", submitAdjustment);
window.addEventListener("hashchange", route);

if (config.dev) {
  $("dev-form").hidden = false;
  $("dev-form").addEventListener("submit", (event) => {
    event.preventDefault();
    sessionStorage.setItem(TOKEN, $("dev-token").value.trim());
    $("dev-token").value = "";
    start();
  });
}

completeSignIn();
start();
