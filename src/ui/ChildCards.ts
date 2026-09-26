/**
 * Child-mode DOM: the start card, the tap-to-start veil, the 🔒 hold button,
 * the grown-up question, the grown-ups panel and the sleep screen. Rendering
 * only — every decision lives in ChildMode / the pure child modules.
 */
import { DEFAULT_TIMER_MIN, TIMER_CHOICES } from '../app/childSettings';
import { HOLD_MS, type GateQuestion } from '../app/parentGate';

const CARD_CSS = [
  'position:fixed', 'left:50%', 'top:50%', 'transform:translate(-50%,-50%)', 'z-index:40',
  'background:rgba(252,247,235,.97)', 'color:#3a3a2e', 'font-family:Georgia,serif',
  'border-radius:14px', 'box-shadow:0 8px 40px rgba(30,40,30,.35)', 'padding:20px 22px',
  'width:min(360px, calc(100vw - 32px))', 'box-sizing:border-box', 'font-size:14px', 'line-height:1.45',
].join(';');
const BUTTON_CSS =
  'font:14px Georgia,serif;padding:7px 14px;border-radius:999px;border:1px solid #b9b39c;' +
  'background:#efe9d8;color:#3a3a2e;cursor:pointer;margin:4px 6px 0 0;';
const PRIMARY_CSS = BUTTON_CSS + 'background:#87a96b;color:#fff;border-color:#87a96b;';

/** Clicks and keys inside a child-mode surface never reach the valley or other window listeners. */
function shield(el: HTMLElement): void {
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('keydown', (e) => e.stopPropagation());
}

function makeCard(testId: string): HTMLDivElement {
  const card = document.createElement('div');
  card.style.cssText = CARD_CSS;
  card.setAttribute('data-testid', testId);
  shield(card);
  document.body.appendChild(card);
  return card;
}

function heading(card: HTMLElement, text: string): void {
  const h = document.createElement('div');
  h.textContent = text;
  h.style.cssText = 'font-weight:bold;font-size:17px;margin-bottom:6px;';
  card.append(h);
}

function para(card: HTMLElement, text: string): void {
  const p = document.createElement('p');
  p.textContent = text;
  p.style.margin = '4px 0';
  card.append(p);
}

function button(label: string, css: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = css;
  b.addEventListener('click', onClick);
  return b;
}

function timerLabel(m: number | null): string {
  return m === null ? 'no limit' : `${m} min`;
}

/** A row of timer buttons with the current choice highlighted. */
function timerRow(current: number | null, onPick: (m: number | null) => void): HTMLDivElement {
  const row = document.createElement('div');
  row.style.margin = '10px 0 6px';
  row.append('Play time: ');
  for (const m of TIMER_CHOICES) {
    const b = button(timerLabel(m), BUTTON_CSS + (m === current ? 'background:#c9dcb6;' : ''), () => onPick(m));
    b.setAttribute('aria-pressed', String(m === current));
    row.append(b);
  }
  return row;
}

export function showChildStartCard(opts: { touch: boolean; onStart: (timerMin: number | null) => void }): void {
  document.querySelector('[data-testid="child-start"]')?.remove(); // replace, never stack
  const card = makeCard('child-start');
  heading(card, 'Child mode');
  para(card, 'Keeps little hands in the valley: no links, no sharing, no settings.');
  para(card, 'To leave, a grown-up holds the 🔒 for 3 seconds and answers a question.');
  if (opts.touch) {
    para(card, 'For a full lock on a tablet:');
    para(card, '• iPad: Settings › Accessibility › Guided Access, then triple-click the side or home button.');
    para(card, '• Android: turn on App pinning (in Security settings), then pin this app from Recents.');
  } else {
    para(card, 'Holding Esc leaves full screen, but child mode stays on. Ctrl+Alt+Del and power keys can’t be blocked.');
  }
  let chosen: number | null = DEFAULT_TIMER_MIN;
  let row = timerRow(chosen, pick);
  card.append(row);
  function pick(m: number | null): void {
    chosen = m;
    const next = timerRow(chosen, pick);
    row.replaceWith(next);
    row = next;
  }
  card.append(
    button('Start child mode', PRIMARY_CSS, () => {
      card.remove();
      opts.onStart(chosen);
    }),
    button('Not now', BUTTON_CSS, () => card.remove()),
  );
}

/** Full-screen "Tap to start" veil: the child's tap is the user gesture fullscreen needs. */
export function showTapCard(onTap: () => void): HTMLDivElement {
  const veil = document.createElement('div');
  veil.style.cssText =
    'position:fixed;inset:0;z-index:35;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(252,247,235,.9);color:#3a3a2e;font:22px Georgia,serif;cursor:pointer;';
  veil.textContent = 'Tap to start 🌿';
  veil.setAttribute('data-testid', 'child-tap');
  shield(veil);
  veil.addEventListener('click', () => {
    veil.remove();
    onTap();
  });
  document.body.appendChild(veil);
  return veil;
}

/** The grown-ups' 🔒: must be held for HOLD_MS; a ring fills while held. Touch/mouse only by design. */
export function showLockButton(onHeld: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '🔒';
  btn.setAttribute('aria-label', 'grown-ups: hold to unlock');
  btn.setAttribute('data-testid', 'child-lock');
  const base =
    'position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:45;' +
    'width:44px;height:44px;border-radius:50%;border:none;font-size:18px;cursor:pointer;' +
    'box-shadow:0 2px 8px rgba(30,40,30,.3);touch-action:none;';
  const paint = (frac: number) => {
    btn.style.cssText = base + `background:conic-gradient(#87a96b ${Math.round(frac * 360)}deg, #efe9d8 0);`;
  };
  paint(0);
  let startedAt: number | null = null;
  let raf = 0;
  let holdTimer = 0;
  const reset = () => {
    startedAt = null;
    cancelAnimationFrame(raf);
    clearTimeout(holdTimer);
    paint(0);
  };
  // The ring is cosmetic (animation frames can be throttled); completion runs off a plain timer.
  const step = () => {
    if (startedAt === null) return;
    paint(Math.min(1, (performance.now() - startedAt) / HOLD_MS));
    raf = requestAnimationFrame(step);
  };
  btn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (startedAt !== null) return; // a second finger must not start a second, unclearable hold
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer: the hold still times correctly */
    }
    startedAt = performance.now();
    raf = requestAnimationFrame(step);
    holdTimer = window.setTimeout(() => {
      reset();
      onHeld();
    }, HOLD_MS);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) btn.addEventListener(ev, reset);
  btn.addEventListener('keydown', (e) => e.stopPropagation());
  document.body.appendChild(btn);
  return btn;
}

export function showGateQuestion(opts: {
  question: GateQuestion;
  lockedMsLeft: number;
  onAnswer: (choice: number) => void;
  onClose: () => void;
}): HTMLDivElement {
  const card = makeCard('child-gate');
  heading(card, 'For grown-ups');
  if (opts.lockedMsLeft > 0) {
    para(card, 'Let’s try again in a little while.');
  } else {
    para(card, `What is ${opts.question.a} × ${opts.question.b}?`);
    const row = document.createElement('div');
    for (const o of opts.question.options) {
      row.append(button(String(o), BUTTON_CSS + 'min-width:64px;font-size:18px;', () => opts.onAnswer(o)));
    }
    card.append(row);
  }
  card.append(button('Close', BUTTON_CSS, opts.onClose));
  return card;
}

export function showParentPanel(opts: {
  timerMin: number | null;
  onTimer: (m: number | null) => void;
  onPlus15: () => void;
  onResume: () => void;
  onExit: () => void;
}): HTMLDivElement {
  const card = makeCard('child-panel');
  heading(card, 'Grown-ups');
  card.append(timerRow(opts.timerMin, opts.onTimer));
  const row = document.createElement('div');
  if (opts.timerMin !== null) row.append(button('+15 minutes', BUTTON_CSS, opts.onPlus15));
  row.append(button('Resume', PRIMARY_CSS, opts.onResume), button('Exit child mode', BUTTON_CSS, opts.onExit));
  card.append(row);
  return card;
}

/** Undismissable bedtime screen — only the 🔒 (z-index 45) sits above it. */
export function showSleepScreen(): HTMLDivElement {
  const veil = document.createElement('div');
  veil.style.cssText =
    'position:fixed;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;gap:8px;background:rgba(22,32,62,.88);color:#f6f2e7;' +
    'font:22px Georgia,serif;text-align:center;padding:24px;box-sizing:border-box;';
  veil.setAttribute('data-testid', 'child-sleep');
  const a = document.createElement('div');
  a.textContent = 'The creatures are curling up to sleep 🌙';
  const b = document.createElement('div');
  b.textContent = 'Time to rest too.';
  b.style.fontSize = '17px';
  veil.append(a, b);
  shield(veil);
  veil.addEventListener('click', (e) => e.stopPropagation());
  document.body.appendChild(veil);
  return veil;
}
