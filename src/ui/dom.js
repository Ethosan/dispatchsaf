/* Small DOM helpers shared by every page. */

export const $ = id => document.getElementById(id);

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* Restart a CSS animation class on an element. */
export function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

let toastTimer = null;
export function toast(msg) {
  $("toastMsg").textContent = msg;
  const t = $("toast");
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1600);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch { /* nothing else to try */ }
    ta.remove();
  }
}

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

/* Status line above an output box. ids: { dot, text, meta }. */
export function setStatus(ids, kind, text, meta) {
  const dot = $(ids.dot);
  const next = "status-dot" + (kind ? " " + kind : "");
  if (dot.className.replace(" pop", "") !== next) {
    dot.className = next;
    replay(dot, "pop");
  }
  $(ids.text).textContent = text;
  $(ids.meta).textContent = meta || "—";
}

export function setMessages(container, msgs) {
  container.replaceChildren(...msgs.map(m => {
    const div = document.createElement("div");
    div.className = "msg " + (m.kind || "info");
    div.setAttribute("role", m.kind === "err" ? "alert" : "status");
    div.textContent = m.text;
    return div;
  }));
}

/* Render output blocks. Each block can be tapped to copy just that block. */
export function setOutputBlocks(el, blocks, copyBtn, emptyText = "Output appears here") {
  if (!blocks || blocks.length === 0) {
    el.classList.add("empty");
    el.textContent = emptyText;
    if (copyBtn) copyBtn.disabled = true;
    return;
  }
  el.classList.remove("empty");
  el.replaceChildren(...blocks.map((b, i) => {
    const div = document.createElement("button");
    div.type = "button";
    div.className = "dispatch-block";
    div.textContent = b.text;
    div.title = "Tap to copy this block";
    div.style.animationDelay = Math.min(i * 40, 300) + "ms";
    div.addEventListener("click", async () => {
      await copyText(b.text);
      replay(div, "copied");
      toast(blocks.length > 1 ? `Copied block ${i + 1} of ${blocks.length}` : "Copied");
    });
    return div;
  }));
  if (copyBtn) copyBtn.disabled = false;
}

export function setOutputText(el, text, copyBtn, emptyText) {
  setOutputBlocks(el, text ? [{ text }] : [], copyBtn, emptyText);
}

export function getOutputText(el) {
  if (el.classList.contains("empty")) return "";
  return [...el.querySelectorAll(".dispatch-block")].map(b => b.textContent).join("\n\n");
}

/* Confirm dialog. Resolves true on OK, false on cancel/escape. */
export function confirmDialog(title, msg, okLabel = "Confirm") {
  return new Promise(resolve => {
    const overlay = $("confirmOverlay"), ok = $("confirmOk"), cancel = $("confirmCancel");
    $("confirmTitle").textContent = title;
    $("confirmMsg").textContent = msg;
    ok.textContent = okLabel;
    const prevFocus = document.activeElement;
    overlay.classList.add("show");
    cancel.focus();
    const done = result => {
      overlay.classList.remove("show");
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
      resolve(result);
    };
    const onOk = () => done(true);
    const onCancel = () => done(false);
    const onKey = e => { if (e.key === "Escape") done(false); };
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKey);
  });
}

/* Copy button with a brief "Copied" state. */
export function wireCopyButton(btn, getText, after) {
  btn.addEventListener("click", async () => {
    const text = getText();
    if (!text) return;
    await copyText(text);
    btn.classList.add("success");
    setTimeout(() => btn.classList.remove("success"), 1000);
    after?.();
  });
}
