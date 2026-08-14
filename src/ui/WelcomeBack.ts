/**
 * Welcome-back card (game UI, not dev tool): a warm little summary of what
 * happened while the valley ran unobserved (spec §4.6). Self-dismissing —
 * fades in, closes on any tap, and times out on its own if ignored.
 */
const AUTO_DISMISS_MS = 14000;
const FADE_MS = 400;

/** No-op if `lines` is empty (nothing worth telling). */
export function showWelcomeBack(lines: string[]): void {
  if (lines.length === 0) return;

  const card = document.createElement('div');
  card.style.cssText = [
    'position:fixed', 'top:18%', 'left:50%',
    'transform:translateX(-50%)', 'max-width:340px', 'z-index:20',
    'background:rgba(252,247,235,.96)', 'color:#3a3a2e',
    'font-family:Georgia,serif', 'border-radius:14px',
    'box-shadow:0 8px 40px rgba(30,40,30,.35)', 'padding:18px 22px',
    'opacity:0', `transition:opacity ${FADE_MS}ms ease-in-out`,
    'user-select:none', 'cursor:pointer',
  ].join(';');

  const header = document.createElement('div');
  header.textContent = 'While you were away…';
  header.style.cssText = 'font-weight:bold;font-size:16px;margin:0 0 8px;';
  card.appendChild(header);

  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line;
    p.style.cssText = 'margin:4px 0;font-size:14px;';
    card.appendChild(p);
  }

  const footer = document.createElement('div');
  footer.textContent = '(tap to continue)';
  footer.style.cssText = 'margin-top:10px;font-size:12px;font-style:italic;opacity:.7;';
  card.appendChild(footer);

  document.body.appendChild(card);
  requestAnimationFrame(() => {
    card.style.opacity = '1';
  });

  let dismissed = false;
  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    window.removeEventListener('pointerdown', dismiss);
    clearTimeout(timer);
    card.remove();
  };
  window.addEventListener('pointerdown', dismiss);
  const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
}
