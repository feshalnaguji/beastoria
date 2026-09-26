/**
 * Bootstrap: create world → renderer → dev panel → game loop.
 * M1: six rabbits with needs and behaviors, day/night cycle, ~ dev panel.
 */
import { DevPanel } from './app/DevPanel';
import { GameLoop } from './app/GameLoop';
import { drainCatchUp, owedTicks, summarizeEvents } from './app/CatchUp';
import { formatValleyUrl, parseValleyParam, randomSeed } from './app/share';
import { AudioEngine } from './audio/AudioEngine';
import { CallScheduler } from './audio/CallScheduler';
import type { BedName } from './audio/manifest';
import { computeMix } from './audio/Mixer';
import { emptyNames } from './persist/schema';
import { loadSave, saveWorld, setSaveMeta, suppressSaves } from './persist/store';
import { getClock, TICKS_PER_DAY } from './sim/clock';
import { tick } from './sim/Sim';
import { createWorld, WORLD_HEIGHT, WORLD_WIDTH, type SpeciesId } from './sim/state';
import { SPECIES } from './sim/species';
import { Hud, PILL_CSS } from './ui/Hud';
import { InspectCard } from './ui/InspectCard';
import { NameBook } from './ui/names';
import { buildPostcard, canvasToPng } from './ui/postcard';
import { closeShareCard, showShareCard } from './ui/ShareCard';
import { showChildStartCard } from './ui/ChildCards';
import { ChildMode } from './app/ChildMode';
import { browserStore, loadChildSettings } from './app/childSettings';
import { showCard, showWelcomeBack } from './ui/WelcomeBack';
import { Renderer } from './render/Renderer';
import { renderPortraitStudio } from './app/PortraitStudio';

/** Tap-vs-drag threshold, in CSS px between pointerdown and pointerup — a
 * movement past this reads as a camera drag (Camera.ts owns panning off its
 * own pointer listeners on the same canvas), not a tap. Matches the value
 * DevPanel's own inspector used before tap-to-inspect became an always-on
 * game feature (M10 task 5) rather than a dev-only tool. */
const TAP_DRAG_THRESHOLD_PX = 6;

const AUTOSAVE_INTERVAL_TICKS = 300; // 30s of sim time at 1x

/** Full-screen catch-up overlay: text line + a thin progress bar, shown while
 * offline catch-up drains (spec §4.6). `setProgress` updates both. */
function showDawnOverlay(): {
  el: HTMLDivElement;
  setProgress: (done: number, total: number, fromDay: number, toDay: number) => void;
} {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:15',
    'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
    'gap:12px',
    'background:rgba(252,247,235,.92)', 'color:#3a3a2e',
    'font-family:Georgia,serif', 'font-size:18px',
  ].join(';');

  const text = document.createElement('div');
  el.appendChild(text);

  const track = document.createElement('div');
  track.style.cssText = 'width:240px;height:4px;background:rgba(58,74,51,.15);border-radius:2px;overflow:hidden;';
  const bar = document.createElement('div');
  bar.style.cssText = 'width:0%;height:100%;background:#87a96b;';
  track.appendChild(bar);
  el.appendChild(track);

  document.body.appendChild(el);

  const setProgress = (done: number, total: number, fromDay: number, toDay: number): void => {
    text.textContent = `Catching up with the valley… Day ${fromDay} → Day ${toDay}`;
    bar.style.width = `${total > 0 ? Math.min(100, (100 * done) / total) : 100}%`;
  };
  return { el, setProgress };
}

async function start(): Promise<void> {
  const mount = document.getElementById('app');
  if (!mount) throw new Error('#app mount point missing');

  const portrait = new URLSearchParams(location.search).get('portrait');
  if (portrait && Object.hasOwn(SPECIES, portrait)) {
    await renderPortraitStudio(mount, portrait as SpeciesId);
    return; // dev-only: no sim, no HUD, no save
  }

  const childSettings = loadChildSettings(browserStore());
  // Child mode never visits: a `?valley=` link is ignored (and stripped) while it's on.
  const sharedSeed = childSettings.on ? null : parseValleyParam(location.search);
  if (childSettings.on && new URLSearchParams(location.search).has('valley')) {
    history.replaceState(null, '', location.pathname);
  }
  const save = await loadSave();
  // A `?valley=` link pointing at the exact seed already saved on this
  // device is neither a visit nor an adoption — it's the child's own valley
  // (e.g. their own share link, reopened). Only a *different* seed than the
  // existing save counts as visiting someone else's.
  const ownValley = sharedSeed !== null && save !== null && sharedSeed === save.seed;
  /** A friend's link opened by someone who already has a different valley: live, in memory, never saved. */
  const visiting = sharedSeed !== null && save !== null && sharedSeed !== save.seed;
  const adopting = sharedSeed !== null && save === null;
  // Strip `?valley=` once its one-time job (adopt / no-op own-valley
  // recognition) is done, so a reload doesn't re-enter the link path — e.g.
  // re-adopting on every refresh, or drifting `visiting` back to true if the
  // save is later cleared.
  if (adopting || ownValley) history.replaceState(null, '', location.pathname);
  const seed = sharedSeed ?? save?.seed ?? randomSeed();
  const fresh = visiting || save === null;
  const state = save === null || visiting ? createWorld(seed) : save.sim;
  const names = save === null || visiting ? emptyNames() : save.names;
  const nameBook = new NameBook(names);
  /** A fresh valley opens mid-morning, not at grey dawn — first screens should be sunny. */
  const MORNING_START_TICK = Math.round(0.2 * TICKS_PER_DAY);
  if (fresh) state.tick = MORNING_START_TICK;
  if (visiting) suppressSaves(); else setSaveMeta({ seed, names });
  const sinceTick = state.tick;
  const owed = save && !visiting ? owedTicks(Date.now() - save.savedAtEpochMs) : 0;

  const renderer = new Renderer();
  await renderer.init(mount);
  renderer.familyDisplayName = (id) => nameBook.family(id);
  renderer.sync(state); // initial snapshot so frame 0 has positions

  renderer.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 0.21); // as far out as the min-zoom floor allows (whole valley where the viewport fits it)

  const audio = new AudioEngine();
  const scheduler = new CallScheduler(audio);
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  const hud = new Hud(audio);
  hud.setClock(getClock(state.tick)); // render the clock pill immediately, don't wait ~100ms for the first sim tick
  hud.onShare = () => {
    const day = getClock(state.tick).day;
    const url = formatValleyUrl(seed);
    showShareCard({
      url,
      day,
      postcard: () => canvasToPng(buildPostcard(renderer.snapshot(), `Beastoria · Day ${day}`, url.replace(/^https?:\/\//, ''))),
    });
  };

  // Offline catch-up (spec §4.6): drain owed ticks under a dawn overlay before
  // the live loop starts, so vocalizations from unobserved ticks stay unheard
  // and the welcome card reflects a settled, post-catch-up state.
  if (owed > 0) {
    const overlay = showDawnOverlay();
    const fromDay = getClock(state.tick).day;
    const toDay = getClock(state.tick + owed).day;
    await drainCatchUp(state, owed, (d, t) => overlay.setProgress(d, t, fromDay, toDay));
    overlay.el.remove();
    renderer.sync(state);
    showWelcomeBack(summarizeEvents(state.eventLog, sinceTick, (id) => nameBook.customFamily(id)));
  }

  // Tap-to-inspect (M10 task 5): available always, not just in the DevPanel.
  // renderer.selectedId is the single source of truth for "who's selected"
  // (DevPanel's own inspector reads the same field instead of keeping a
  // copy); `inspectedId` here additionally tracks whether *this* card is the
  // one showing it, so the tick loop below can tell "still selected, just
  // update the text" apart from "gone — renderer.sync() already cleared
  // selectedId for us, now hide the card" without racing that clear.
  const inspectCard = new InspectCard(() => dismissInspect(), nameBook, { canRename: !visiting });
  let inspectedId: number | null = null;
  function dismissInspect(): void {
    renderer.selectedId = null;
    renderer.followId = null;
    inspectCard.hide();
    inspectedId = null;
  }
  // Multi-touch guard: only a single finger's down→up pair may register as a
  // tap. Without this, a two-finger pinch-zoom's second pointerdown
  // overwrites downAt with that finger's position, and if its pointerup
  // lands within TAP_DRAG_THRESHOLD_PX of its own pointerdown (common — one
  // finger often does most of the pinch motion while the other pivots), the
  // tap-vs-drag check below fires a spurious "tap" that selects a creature
  // and sets renderer.followId, which then fights the user's own pinch/pan
  // by re-centering the camera on it every frame. activePointers tracks how
  // many fingers are currently down; a second pointerdown while one is
  // already active clears downAt so no tap can fire until every finger has
  // fully lifted and a fresh single pointerdown/pointerup pair occurs.
  let downAt: { x: number; y: number } | null = null;
  let activePointers = 0;
  renderer.canvas.addEventListener('pointerdown', (e) => {
    downAt = activePointers > 0 ? null : { x: e.clientX, y: e.clientY };
    activePointers++;
  });
  renderer.canvas.addEventListener('pointerup', (e) => {
    activePointers = Math.max(0, activePointers - 1);
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > TAP_DRAG_THRESHOLD_PX) return; // it was a drag, Camera already panned
    const picked = renderer.pickCreature(state, e.clientX, e.clientY);
    if (picked) {
      renderer.selectedId = picked.id;
      renderer.followId = picked.id; // tap = inspect + soft follow
      inspectCard.show(state, picked, renderer.presentationFor(picked.id));
      inspectedId = picked.id;
    } else {
      if (inspectCard.isEditing()) return; // a stray tap must not abandon an open editor
      dismissInspect(); // tap on empty ground dismisses both card and follow
    }
  });
  // Matches Camera.ts's own pointercancel handling on the same canvas (a
  // cancelled gesture — e.g. the browser taking over for a system gesture —
  // must not leave downAt/activePointers stale for the next unrelated tap).
  renderer.canvas.addEventListener('pointercancel', () => {
    activePointers = Math.max(0, activePointers - 1);
    downAt = null;
  });

  let ticksSinceSave = 0;
  const loop = new GameLoop(
    () => {
      const out = tick(state, []);
      renderer.sync(state);
      renderer.onFeedings(out.feedings);
      const clock = getClock(state.tick);
      const mix = computeMix(clock, renderer.viewInfo(), state);
      for (const [bed, gain] of Object.entries(mix.beds) as [BedName, number][]) {
        audio.setBedTarget(bed, gain);
      }
      scheduler.onTick(out.vocalizations, mix, performance.now());
      hud.setClock(clock);

      // Keep the open InspectCard live (activity/doing text tracks the sim)
      // and close it the moment its creature is gone.
      if (inspectedId !== null) {
        const selected = state.creatures.find((x) => x.id === inspectedId);
        if (selected) inspectCard.show(state, selected, renderer.presentationFor(selected.id));
        else dismissInspect();
      }

      ticksSinceSave++;
      if (ticksSinceSave >= AUTOSAVE_INTERVAL_TICKS) {
        ticksSinceSave = 0;
        nameBook.prune(state);
        void saveWorld(state, Date.now());
      }
    },
    (alpha) => {
      renderer.render(alpha);
      devPanel.update();
      renderer.renderFrame(); // single render loop — draw last, after camera/ambient updates
    },
  );
  const devPanel = new DevPanel(state, loop, renderer, { allowReset: !visiting });

  const childMode = new ChildMode(childSettings, {
    onChange: (on) => {
      hud.setChildMode(on);
      devPanel.setLocked(on);
      if (on) {
        closeShareCard();
        loop.setSpeed(1);
      }
    },
    onSleep: () => {
      loop.stop();
      audio.setSleeping(true);
    },
    onWake: () => {
      audio.setSleeping(false);
      loop.start();
    },
    onTap: () => audio.unlock(),
  });
  hud.setChildModeAvailable(!visiting);
  hud.onChildMode = () =>
    showChildStartCard({
      touch: window.matchMedia('(pointer: coarse)').matches,
      onStart: (timerMin) => childMode.start(timerMin),
    });

  let hiddenAt: { epochMs: number; tick: number } | null = null;
  let draining = false;
  document.addEventListener('visibilitychange', () => {
    if (visiting) return;
    if (document.visibilityState === 'hidden') {
      hiddenAt = { epochMs: Date.now(), tick: state.tick };
      nameBook.prune(state);
      void saveWorld(state, Date.now());
      return;
    }
    if (!hiddenAt) return;
    const { epochMs, tick: tickAtHide } = hiddenAt;
    hiddenAt = null;
    // The throttled loop already ran some ticks while hidden; only the shortfall is owed.
    const owedNow = Math.max(0, owedTicks(Date.now() - epochMs) - (state.tick - tickAtHide));
    if (owedNow < 50) return; // a quick tab-flip — nothing worth a ceremony
    if (draining) return; // a drain is already in flight — don't stack another
    draining = true;
    loop.stop();
    const overlay = showDawnOverlay();
    const fromDay = getClock(state.tick).day;
    const toDay = getClock(state.tick + owedNow).day;
    void drainCatchUp(state, owedNow, (d, t) => overlay.setProgress(d, t, fromDay, toDay)).then(() => {
      overlay.el.remove();
      renderer.sync(state);
      showWelcomeBack(summarizeEvents(state.eventLog, tickAtHide, (id) => nameBook.customFamily(id)));
    }).catch((err) => console.warn('[catchup] resume after error:', err))
      .finally(() => {
        draining = false;
        if (!childMode.isAsleep) loop.start(); // never wake a child-mode bedtime from under the sleep screen
      });
  });
  window.addEventListener('pagehide', () => {
    nameBook.prune(state);
    void saveWorld(state, Date.now());
  });

  loop.start();
  if (childMode.on) {
    childMode.resumeSticky();
  } else if (visiting) {
    showVisitBanner();
  } else if (save === null) {
    showCard('Welcome to Beastoria', [
      ...(adopting ? ['This valley came from a friend’s link — it’s yours now.'] : []),
      'A calm little valley where creature families live their lives.',
      'Drag to look around · pinch or scroll to zoom in close.',
      'Tap any creature to meet them.',
    ]);
  }
}

/** Visit mode: a friend's valley, running live but never saved over your own (spec G2 §3). */
function showVisitBanner(): void {
  const bar = document.createElement('div');
  // Sits below the whole HUD column (clock/creatures/share pills end ~130px)
  // rather than between the top-corner pills: at 375px only ~120px is free
  // between the clock and sound pills, which forced a 3-4 line banner that
  // still collided with the sound chip.
  bar.style.cssText = [
    ...PILL_CSS, 'top:140px', 'left:50%', 'transform:translateX(-50%)',
    'max-width:calc(100% - 24px)', 'box-sizing:border-box', 'font-size:13px',
    'white-space:normal', 'text-align:center',
  ].join(';');
  bar.setAttribute('data-testid', 'visit-banner');
  bar.append('Visiting a friend’s valley · ');
  const back = document.createElement('a');
  back.href = './';
  back.textContent = '⟵ back to mine';
  back.style.cssText = 'color:#fff;text-decoration:underline;';
  bar.appendChild(back);
  document.body.appendChild(bar);
}

function showBootFailure(err: unknown): void {
  console.error('[boot] Beastoria could not start:', err);
  const card = document.createElement('div');
  card.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;' +
    'background:#f6f2e7;color:#3a4a33;font-family:Georgia,serif;text-align:center;z-index:30';
  card.innerHTML =
    '<div style="max-width:28rem"><h1 style="font-size:1.5rem;margin:0 0 .5rem">The valley couldn’t wake up</h1>' +
    '<p>Beastoria needs a browser with WebGL to draw its creatures. Try another browser or device — ' +
    'or <a href="./guide/" style="color:#4a6b3a">meet the creatures in the guide</a> meanwhile.</p></div>';
  document.body.appendChild(card);
}

start().catch(showBootFailure);
