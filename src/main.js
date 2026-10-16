import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/deploy.css";
import "./styles/tracker.css";
import "./styles/update.css";
import "./styles/settings.css";
import "./styles/feedback.css";

import { S } from "./store.js";
import { ddmmyy, pad } from "./lib/time.js";
import { $, toast, confirmDialog } from "./ui/dom.js";
import { clearTracker } from "./tracker/model.js";
import { initDeploy, updateDateShown } from "./ui/deploy.js";
import { initUpdate } from "./ui/update.js";
import { initTracker, renderTracker, renderSummary } from "./tracker/view.js";
import { initSettings, applyTheme, applyAutoGen, applyTrackerEnabled } from "./ui/settings.js";

/* ------------------------------------------------------------------ pages */
function switchPage(name) {
  S.page = name;
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + name));
  document.querySelectorAll(".tab-item").forEach(t => {
    const on = t.dataset.page === name;
    t.classList.toggle("active", on);
    if (on) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
  });
  if (name === "tracker") renderTracker();
  if (name === "update") renderSummary();
}
document.querySelectorAll(".tab-item").forEach(t => t.addEventListener("click", () => switchPage(t.dataset.page)));
$("goToUpdateBtn").addEventListener("click", () => switchPage("update"));

/* ------------------------------------------------------------------ clock */
function tickClock() {
  const now = new Date();
  $("headerDate").textContent = ddmmyy(now);
  $("headerTime").textContent = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
  updateDateShown();
}

/* ------------------------------------------------------------------ init */
applyTheme(S.theme);
initSettings({
  onTrackerChange: on => { if (!on && S.page === "tracker") switchPage("deploy"); },
});
applyAutoGen(S.autoGen);
applyTrackerEnabled(S.trackerEnabled);
initDeploy();
initTracker();
initUpdate();
renderTracker();
tickClock();
setInterval(tickClock, 1000);

$("clearTrackerBtn").addEventListener("click", async () => {
  if (!S.tracker.length) return;
  if (!(await confirmDialog("Clear tracker?", "This removes all vehicles and their progress. It can't be undone.", "Clear"))) return;
  clearTracker();
  renderTracker();
  toast("Tracker cleared");
});

/* ------------------------------------------------------------ install / PWA */
let installPrompt = null;
addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installPrompt = e;
  $("installBanner").classList.add("show");
});
$("installBtn").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  if (outcome === "accepted") { $("installBanner").classList.remove("show"); toast("Installing…"); }
  installPrompt = null;
});
addEventListener("appinstalled", () => $("installBanner").classList.remove("show"));

/* A new deploy installs a new service worker. When it is waiting, offer a
   one-tap update instead of making the user close every tab. */
function watchForUpdates(reg) {
  const offer = worker => {
    $("updateBanner").classList.add("show");
    $("updateBannerBtn").onclick = () => worker.postMessage({ type: "SKIP_WAITING" });
  };
  if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const w = reg.installing;
    w?.addEventListener("statechange", () => {
      if (w.state === "installed" && navigator.serviceWorker.controller) offer(w);
    });
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  const check = () => reg.update().catch(() => {});
  setInterval(check, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(watchForUpdates).catch(() => {});
  });
}
