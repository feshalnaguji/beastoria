/**
 * Share card (G2 Task 5): copy-link / native-share / save-postcard, opened
 * from the HUD's 🔗 pill. Same visual language as WelcomeBack's card (cream,
 * Georgia, radius 14, shadow, z-index 20) but does NOT auto-dismiss — only
 * Escape or the ✕ closes it. Never renders any user-typed name (spec §2):
 * the only text on the card or the postcard is the link and the day count.
 */
const COPIED_MS = 1500;

let current: HTMLDivElement | null = null;
let currentCleanup: (() => void) | null = null;

function closeCurrent(): void {
  current?.remove();
  current = null;
  currentCleanup?.();
  currentCleanup = null;
}

export function closeShareCard(): void {
  closeCurrent();
}

export function showShareCard(opts: { url: string; day: number; postcard: () => Promise<Blob> }): void {
  closeCurrent(); // opening twice replaces, never stacks

  // Start building the postcard the moment the card opens, not on click:
  // iOS WebKit drops navigator.share()'s user-activation grant across any
  // `await` between the click and the call, so by the time Share… is
  // clicked the File must already exist for the click handler to pass
  // synchronously. Save postcard reuses this same promise instead of
  // capturing a second frame.
  const postcardPromise = opts.postcard();
  postcardPromise.catch((err: unknown) => console.warn('[share] postcard capture failed:', err));

  const card = document.createElement('div');
  current = card;
  card.style.cssText = [
    'position:fixed', 'top:18%', 'left:50%',
    'transform:translateX(-50%)', 'max-width:340px', 'z-index:20',
    'background:rgba(252,247,235,.96)', 'color:#3a3a2e',
    'font-family:Georgia,serif', 'border-radius:14px',
    'box-shadow:0 8px 40px rgba(30,40,30,.35)', 'padding:18px 22px',
    'user-select:none',
  ].join(';');
  // Never let taps/keys inside the card reach window-level listeners
  // (WelcomeBack's dismiss-on-any-pointerdown, DevPanel's backtick toggle) —
  // same guard InspectCard's inline editor uses.
  card.addEventListener('pointerdown', (e) => e.stopPropagation());
  card.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') closeCurrent();
  });

  const closeBtn = document.createElement('div');
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('role', 'button');
  closeBtn.setAttribute('tabindex', '0');
  closeBtn.setAttribute('aria-label', 'close');
  closeBtn.style.cssText = [
    'position:absolute', 'top:8px', 'right:12px', 'cursor:pointer',
    'font-size:14px', 'line-height:1', 'opacity:.7',
  ].join(';');
  closeBtn.addEventListener('click', () => closeCurrent());
  closeBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      closeCurrent();
    }
  });
  card.appendChild(closeBtn);

  const header = document.createElement('div');
  header.textContent = 'Share your valley';
  header.style.cssText = 'font-weight:bold;font-size:16px;margin:0 22px 8px 0;';
  card.appendChild(header);

  const line = document.createElement('p');
  line.textContent = 'Friends who open this link get the same valley, from day 0.';
  line.style.cssText = 'margin:4px 0 12px;font-size:14px;';
  card.appendChild(line);

  const input = document.createElement('input');
  input.type = 'text';
  input.readOnly = true;
  input.value = opts.url;
  input.style.cssText = 'font:13px Georgia,serif;width:100%;box-sizing:border-box;padding:6px 8px;margin-bottom:10px;border:1px solid rgba(58,74,51,.3);border-radius:6px;background:#fff;color:inherit;';
  card.appendChild(input);

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
  card.appendChild(row);

  const makeButton = (label: string): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = [
      'font:13px Georgia,serif', 'padding:6px 12px', 'border-radius:999px',
      'border:1px solid rgba(58,74,51,.3)', 'background:rgba(135,169,107,.15)',
      'color:inherit', 'cursor:pointer',
    ].join(';');
    row.appendChild(btn);
    return btn;
  };

  const copyBtn = makeButton('Copy link');
  copyBtn.addEventListener('click', () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(opts.url);
        copyBtn.textContent = 'Copied!';
      } catch {
        input.select();
        copyBtn.textContent = 'Press Ctrl+C';
      }
      setTimeout(() => { copyBtn.textContent = 'Copy link'; }, COPIED_MS);
    })();
  });

  const postcardBtn = makeButton('Save postcard');
  postcardBtn.addEventListener('click', () => {
    void (async () => {
      const blob = await postcardPromise;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `beastoria-day-${opts.day}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    })();
  });

  document.body.appendChild(card);

  // Share… only appears once the real postcard blob is ready — canShare()
  // needs a File built from the actual capture (an empty placeholder can't
  // tell us whether the real, larger image will actually share) — and its
  // click handler calls navigator.share() with that already-built File as
  // its very first statement, no await beforehand, to preserve iOS
  // WebKit's transient user-activation grant.
  void postcardPromise.then((blob) => {
    if (current !== card) return; // this card was closed/replaced before capture finished
    const shareFile = new File([blob], 'beastoria.png', { type: 'image/png' });
    if (!navigator.canShare?.({ files: [shareFile] })) return;
    const shareBtn = makeButton('Share…');
    row.insertBefore(shareBtn, row.firstChild); // restore Share…/Copy/Save order
    shareBtn.addEventListener('click', () => {
      navigator.share({ files: [shareFile], url: opts.url, title: 'Beastoria' }).catch((err: unknown) => {
        if ((err as { name?: string }).name !== 'AbortError') {
          console.warn('[share] native share failed:', err);
        }
      });
    });
  });

  // Escape closes even when focus is outside the card entirely. When focus
  // IS inside the card, the card's own keydown handler above stops the
  // event from ever bubbling up to this window listener — its own Escape
  // check (also calling closeCurrent) covers that case instead.
  const onWindowKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') closeCurrent();
  };
  window.addEventListener('keydown', onWindowKeydown);
  currentCleanup = () => window.removeEventListener('keydown', onWindowKeydown);
}
