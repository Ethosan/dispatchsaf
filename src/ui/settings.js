/* Settings sheet: users, status codes, preferences and backup. */
import { S, save, dedupeBlocklist, DEFAULT_BLOCKLIST, exportBackup, importBackup } from "../store.js";
import { $, escapeHtml, replay, toast, confirmDialog } from "./dom.js";

let lastFocus = null;

export function renderActiveUser() {
  const u = S.users[S.activeIdx];
  const el = $("auName");
  el.textContent = u ? `${u.rank} ${u.name.toUpperCase()}` : "Not set";
  el.classList.toggle("empty", !u);
}

function renderUsers() {
  const el = $("savedList");
  $("userCount").textContent = S.users.length;
  if (!S.users.length) {
    el.innerHTML = '<div class="empty-state">No saved users yet</div>';
    return;
  }
  el.innerHTML = S.users.map((u, i) => {
    const aliases = (u.aliases || []).filter(a => a && a.trim());
    return `
      <div class="user-card${i === S.activeIdx ? " active" : ""}">
        <button type="button" class="user-card-info" data-action="select" data-i="${i}" aria-pressed="${i === S.activeIdx}">
          <span class="user-card-name">${escapeHtml(u.rank)} ${escapeHtml(u.name.toUpperCase())}</span>
          ${aliases.length ? `<span class="user-card-aliases">${aliases.map(a => `<span class="alias-pill">${escapeHtml(a)}</span>`).join("")}</span>` : ""}
        </button>
        <button type="button" class="user-card-edit" data-action="edit" data-i="${i}" aria-label="Edit ${escapeHtml(u.name)}">Edit</button>
        <button type="button" class="user-card-del" data-action="del" data-i="${i}" aria-label="Delete ${escapeHtml(u.name)}">×</button>
      </div>`;
  }).join("");
}

function renderBlocklist() {
  $("blocklist").innerHTML = S.blocklist
    .map((code, i) => `<span class="bl-chip"><span>${escapeHtml(code)}</span><button type="button" class="x" data-i="${i}" aria-label="Remove ${escapeHtml(code)}">×</button></span>`)
    .join("");
  $("blocklistCount").textContent = S.blocklist.length;
}

function clearUserForm() {
  $("userName").value = "";
  $("userAliases").value = "";
  $("userRank").value = "PTE";
}

/* ------------------------------------------------------------ modal shell */
function updateTabIndicator() {
  const active = document.querySelector(".modal-tabs .tab.active");
  if (!active) return;
  const ind = $("tabIndicator");
  ind.style.width = active.offsetWidth + "px";
  ind.style.transform = `translateX(${active.offsetLeft - 4}px)`;
}

function switchTab(name) {
  document.querySelectorAll(".modal-tabs .tab").forEach(t => {
    const on = t.dataset.tab === name;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", String(on));
  });
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === "tab-" + name));
  updateTabIndicator();
}

export function openSettings(tab) {
  lastFocus = document.activeElement;
  $("modal").classList.add("show");
  $("modal").setAttribute("aria-hidden", "false");
  if (tab) switchTab(tab);
  requestAnimationFrame(() => { updateTabIndicator(); $("closeModal").focus(); });
}

export function closeSettings() {
  $("modal").classList.remove("show");
  $("modal").setAttribute("aria-hidden", "true");
  lastFocus?.focus?.();
}

/* -------------------------------------------------------------- preferences */
export function applyTheme(pref) {
  S.theme = pref;
  save.theme();
  const actual = pref === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : pref;
  document.documentElement.setAttribute("data-theme", actual);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", actual === "dark" ? "#0f1117" : "#f3f4f6");
  document.querySelectorAll("#themeSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.theme === pref)));
  document.querySelectorAll("#themeSeg button").forEach(b => b.classList.toggle("active", b.dataset.theme === pref));
}

function setToggle(pref, on) {
  document.querySelectorAll(`.pref-toggle[data-pref="${pref}"]`).forEach(b => {
    const active = (b.dataset.value === "on") === on;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
}

export function applyAutoGen(on) {
  S.autoGen = on;
  save.autoGen();
  setToggle("autoGen", on);
}

let onTrackerToggle = () => {};
export function applyTrackerEnabled(on) {
  S.trackerEnabled = on;
  save.trackerEnabled();
  setToggle("tracker", on);
  $("trackerTab").hidden = !on;
  onTrackerToggle(on);
}

/* ------------------------------------------------------------------ init */
export function initSettings({ onTrackerChange }) {
  onTrackerToggle = onTrackerChange;

  document.querySelectorAll(".modal-tabs .tab").forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  $("settingsBtn").addEventListener("click", () => openSettings("users"));
  $("activeUserCard").addEventListener("click", () => openSettings("users"));
  $("closeModal").addEventListener("click", closeSettings);
  $("modal").addEventListener("click", e => { if (e.target === $("modal")) closeSettings(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && $("modal").classList.contains("show") && !$("confirmOverlay").classList.contains("show")) closeSettings();
  });
  addEventListener("resize", updateTabIndicator);

  /* Users */
  $("saveUserBtn").addEventListener("click", () => {
    const name = $("userName").value.trim();
    if (!name) { toast("Name required"); $("userName").focus(); return; }
    const user = {
      rank: $("userRank").value,
      name,
      aliases: $("userAliases").value.split(",").map(a => a.trim()).filter(Boolean),
    };
    const idx = S.users.findIndex(u => u.name.toLowerCase() === name.toLowerCase());
    if (idx >= 0) { S.users[idx] = user; S.activeIdx = idx; }
    else { S.users.push(user); S.activeIdx = S.users.length - 1; }
    save.users();
    renderUsers();
    renderActiveUser();
    clearUserForm();
    toast("Saved and set active");
  });
  $("clearUserFormBtn").addEventListener("click", clearUserForm);

  $("savedList").addEventListener("click", async e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const i = +btn.dataset.i;
    const u = S.users[i];
    if (btn.dataset.action === "select") {
      S.activeIdx = i;
      save.users();
      renderUsers();
      renderActiveUser();
      replay($("activeUserCard"), "pulse");
      toast("Active user set");
    } else if (btn.dataset.action === "edit") {
      $("userName").value = u.name;
      $("userRank").value = u.rank;
      $("userAliases").value = (u.aliases || []).join(", ");
      $("userName").focus();
    } else if (btn.dataset.action === "del") {
      if (!(await confirmDialog("Delete user?", `${u.rank} ${u.name.toUpperCase()} will be removed from this device.`, "Delete"))) return;
      S.users.splice(i, 1);
      if (S.activeIdx === i) S.activeIdx = -1;
      else if (S.activeIdx > i) S.activeIdx--;
      save.users();
      renderUsers();
      renderActiveUser();
    }
  });

  /* Status codes */
  $("blocklist").addEventListener("click", e => {
    const x = e.target.closest(".x");
    if (!x) return;
    S.blocklist.splice(+x.dataset.i, 1);
    save.blocklist();
    renderBlocklist();
  });
  $("addStatusBtn").addEventListener("click", () => {
    const v = $("addStatus").value.trim();
    if (!v) return;
    if (!S.blocklist.some(c => c.toLowerCase() === v.toLowerCase())) {
      S.blocklist.push(v);
      save.blocklist();
      renderBlocklist();
      toast("Added");
    } else {
      toast("Already in the list");
    }
    $("addStatus").value = "";
  });
  $("addStatus").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); $("addStatusBtn").click(); }
  });
  $("resetBlocklistBtn").addEventListener("click", async () => {
    if (!(await confirmDialog("Reset status codes?", "Your custom codes will be replaced with the default list.", "Reset"))) return;
    S.blocklist = dedupeBlocklist(DEFAULT_BLOCKLIST);
    save.blocklist();
    renderBlocklist();
    toast("Reset to defaults");
  });

  /* Preferences */
  document.querySelectorAll("#themeSeg button").forEach(b => b.addEventListener("click", () => applyTheme(b.dataset.theme)));
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (S.theme === "auto") applyTheme("auto"); });
  document.querySelectorAll('.pref-toggle[data-pref="autoGen"]').forEach(b => b.addEventListener("click", () => applyAutoGen(b.dataset.value === "on")));
  document.querySelectorAll('.pref-toggle[data-pref="tracker"]').forEach(b => b.addEventListener("click", () => applyTrackerEnabled(b.dataset.value === "on")));

  /* Backup */
  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dispatch-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      importBackup(await file.text());
      renderUsers();
      renderBlocklist();
      renderActiveUser();
      toast("Backup restored");
    } catch (err) {
      toast(err.message || "Could not read that file");
    }
  });

  $("appVersion").textContent = "v" + __APP_VERSION__;

  renderUsers();
  renderBlocklist();
  renderActiveUser();
}
