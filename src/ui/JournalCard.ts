/**
 * The valley journal card (G4): a family storybook. A list of families (named
 * ones first, then the most recently active), and each family's page of short
 * entries. Read-only; words are built here so renames show their current name.
 */
import { entryText, pageSummary, type FamilyPage, type Journal } from '../app/journal';
import { GUIDE } from '../content/guide';
import { getClock } from '../sim/clock';

const EMOJI: Record<string, string> = Object.fromEntries(GUIDE.map((g) => [g.id, g.emoji]));

const CARD_CSS = [
  'position:fixed', 'left:50%', 'top:50%', 'transform:translate(-50%,-50%)', 'z-index:20',
  'background:rgba(252,247,235,.97)', 'color:#3a3a2e', 'font-family:Georgia,serif',
  'border-radius:14px', 'box-shadow:0 8px 40px rgba(30,40,30,.35)', 'padding:18px 20px',
  'width:min(380px, calc(100vw - 32px))', 'max-height:min(70vh, 560px)', 'overflow:auto',
  'box-sizing:border-box', 'font-size:14px', 'line-height:1.45',
].join(';');
const ROW_CSS =
  'display:block;width:100%;text-align:left;font:14px Georgia,serif;color:#3a3a2e;background:#efe9d8;' +
  'border:1px solid #d8d2bd;border-radius:10px;padding:8px 12px;margin:6px 0;cursor:pointer;';
const LINK_CSS = 'font:13px Georgia,serif;color:#4a6b3a;background:none;border:none;cursor:pointer;padding:0;margin:0 0 8px;';

export interface JournalView {
  journal: Journal;
  familyName: (id: number) => string;
  hasCustomName: (id: number) => boolean;
  creatureName: (id: number, fallback: string) => string;
}

let current: HTMLDivElement | null = null;
let currentCleanup: (() => void) | null = null;

export function closeJournal(): void {
  current?.remove();
  current = null;
  currentCleanup?.();
  currentCleanup = null;
}

export function showJournal(view: JournalView): void {
  closeJournal();
  const card = document.createElement('div');
  card.style.cssText = CARD_CSS;
  card.setAttribute('data-testid', 'journal-card');
  card.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.body.appendChild(card);
  current = card;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeJournal();
  };
  window.addEventListener('keydown', onKey);
  currentCleanup = () => window.removeEventListener('keydown', onKey);
  renderList(card, view);
}

function header(card: HTMLElement, text: string): void {
  const top = document.createElement('div');
  top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
  const h = document.createElement('div');
  h.textContent = text;
  h.style.cssText = 'font-weight:bold;font-size:17px;';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  close.setAttribute('aria-label', 'close');
  close.style.cssText = 'font:16px Georgia,serif;background:none;border:none;cursor:pointer;color:#3a3a2e;';
  close.addEventListener('click', closeJournal);
  top.append(h, close);
  card.append(top);
}

function sortedPages(view: JournalView): FamilyPage[] {
  return [...view.journal.pages].sort((a, b) => {
    const named = Number(view.hasCustomName(b.familyId)) - Number(view.hasCustomName(a.familyId));
    return named !== 0 ? named : b.lastTick - a.lastTick;
  });
}

function renderList(card: HTMLDivElement, view: JournalView): void {
  card.textContent = '';
  header(card, '📖 Valley journal');
  const pages = sortedPages(view);
  if (pages.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'The journal fills itself as the valley’s families grow. Come back soon to see what’s new!';
    p.style.margin = '6px 0';
    card.append(p);
    return;
  }
  for (const page of pages) {
    const { little, grown } = pageSummary(page);
    const row = document.createElement('button');
    row.type = 'button';
    row.style.cssText = ROW_CSS;
    const title = document.createElement('div');
    title.textContent = `${EMOJI[page.species] ?? '🐾'} The ${view.familyName(page.familyId)} family`;
    title.style.fontWeight = 'bold';
    const sub = document.createElement('div');
    // A family with no little ones yet shows its latest moment instead of a row of zeros.
    const latest = page.entries[page.entries.length - 1];
    sub.textContent = little > 0 || !latest
      ? `${little} little ${little === 1 ? 'one' : 'ones'} · ${grown} grown`
      : entryText(latest, view.creatureName);
    sub.style.cssText = 'font-size:12px;opacity:.75;';
    row.append(title, sub);
    row.addEventListener('click', () => renderPage(card, view, page));
    card.append(row);
  }
}

function renderPage(card: HTMLDivElement, view: JournalView, page: FamilyPage): void {
  card.textContent = '';
  header(card, `${EMOJI[page.species] ?? '🐾'} The ${view.familyName(page.familyId)} family`);
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '← all families';
  back.style.cssText = LINK_CSS;
  back.addEventListener('click', () => renderList(card, view));
  card.append(back);
  for (const e of page.entries) {
    const line = document.createElement('p');
    line.style.margin = '4px 0';
    const day = document.createElement('span');
    day.textContent = `Day ${getClock(e.tick).day} — `;
    day.style.opacity = '.7';
    line.append(day, entryText(e, view.creatureName));
    card.append(line);
  }
  card.scrollTop = 0;
}
