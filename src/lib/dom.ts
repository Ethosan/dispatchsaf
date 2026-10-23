// ─── DOM helpers ────────────────────────────────────────────────────────────

/** Get an element by ID, throwing if not found. */
export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Element #${id} not found`);
  return node as T;
}

/** Escape HTML special characters. */
export function escapeHtml(text: string): string {
  return String(text).replace(/[&<>"']/g, c => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[c];
  });
}

/** Trigger a CSS animation by removing and re-adding a class (forces reflow). */
export function retriggerAnimation(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  void element.offsetWidth; // force reflow
  element.classList.add(className);
}

/** Copy text to clipboard with a fallback for older browsers. */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {
      // Clipboard unavailable
    }
    ta.remove();
  }
}

/** Vibrate the device if supported. */
export function haptic(pattern: number | number[] = 20): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported
  }
}

/** Set status indicator (dot + text + meta). */
export function setStatus(
  ids: { dot: string; text: string; meta: string },
  tone: '' | 'ok' | 'warn' | 'err',
  text: string,
  meta: string = '—'
): void {
  const dot = el(ids.dot);
  const targetClass = 'status-dot' + (tone ? ` ${tone}` : '');
  if (dot.className.replace(' pop', '') !== targetClass) {
    dot.className = targetClass;
    retriggerAnimation(dot, 'pop');
  }
  el(ids.text).textContent = text;
  el(ids.meta).textContent = meta || '—';
}

/** Render messages into a container. */
export function renderMessages(containerId: string, messages: Array<{ kind: string; text: string }>): void {
  const container = el(containerId);
  container.replaceChildren(
    ...messages.map(m => {
      const div = document.createElement('div');
      div.className = `msg ${m.kind || 'info'}`;
      div.setAttribute('role', m.kind === 'err' ? 'alert' : 'status');
      div.textContent = m.text;
      return div;
    })
  );
}

/** Render dispatch blocks into an output container. Returns the joined text. */
export function renderBlocks(
  containerId: string,
  blocks: Array<{ text: string }>,
  copyBtnId?: string,
  emptyText: string = 'Output appears here'
): string {
  const container = el(containerId);
  const copyBtn = copyBtnId ? el<HTMLButtonElement>(copyBtnId) : null;

  if (!blocks || blocks.length === 0) {
    container.classList.add('empty');
    container.textContent = emptyText;
    if (copyBtn) copyBtn.disabled = true;
    return '';
  }

  container.classList.remove('empty');
  container.replaceChildren(
    ...blocks.map((block, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dispatch-block';
      btn.textContent = block.text;
      btn.title = 'Tap to copy this block';
      btn.style.animationDelay = `${Math.min(idx * 40, 300)}ms`;
      btn.addEventListener('click', async () => {
        await copyToClipboard(block.text);
        retriggerAnimation(btn, 'copied');
        showToast(blocks.length > 1 ? `Copied block ${idx + 1} of ${blocks.length}` : 'Copied');
      });
      return btn;
    })
  );
  if (copyBtn) copyBtn.disabled = false;

  return blocks.map(b => b.text).join('\n\n');
}

/** Extract all block texts from an output container. */
export function extractBlockText(containerId: string): string {
  const container = el(containerId);
  if (container.classList.contains('empty')) return '';
  return [...container.querySelectorAll('.dispatch-block')]
    .map(b => b.textContent)
    .join('\n\n');
}

// ─── Toast ──────────────────────────────────────────────────────────────────

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string): void {
  el('toastMsg').textContent = message;
  const toast = el('toast');
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
}

// ─── Confirm dialog ─────────────────────────────────────────────────────────

export function showConfirm(
  title: string,
  message: string,
  confirmLabel: string = 'Confirm'
): Promise<boolean> {
  return new Promise(resolve => {
    const overlay = el('confirmOverlay');
    const okBtn = el<HTMLButtonElement>('confirmOk');
    const cancelBtn = el<HTMLButtonElement>('confirmCancel');

    el('confirmTitle').textContent = title;
    el('confirmMsg').textContent = message;
    okBtn.textContent = confirmLabel;

    const previousFocus = document.activeElement as HTMLElement | null;
    overlay.classList.add('show');
    cancelBtn.focus();

    const cleanup = (result: boolean) => {
      overlay.classList.remove('show');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus?.();
      resolve(result);
    };

    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cleanup(false);
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKey);
  });
}
