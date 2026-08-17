/**
 * Bootstrap: create world → renderer → dev panel → game loop.
 * M1: six rabbits with needs and behaviors, day/night cycle, ~ dev panel.
 */
import { DevPanel } from './app/DevPanel';
import { GameLoop } from './app/GameLoop';
import { owedTicks, runCatchUp, summarizeEvents } from './app/CatchUp';
import { AudioEngine } from './audio/AudioEngine';
import { CallScheduler } from './audio/CallScheduler';
import type { BedName } from './audio/manifest';
import { computeMix } from './audio/Mixer';
import { loadSave, saveWorld } from './persist/store';
import { getClock } from './sim/clock';
import { tick } from './sim/Sim';
import { createWorld, WORLD_HEIGHT, WORLD_WIDTH } from './sim/state';
import { Hud } from './ui/Hud';
import { InspectCard } from './ui/InspectCard';
import { showWelcomeBack } from './ui/WelcomeBack';
import { Renderer } from './render/Renderer';

/** Tap-vs-drag threshold, in CSS px between pointerdown and pointerup — a
 * movement past this reads as a camera drag (Camera.ts owns panning off its
 * own pointer listeners on the same canvas), not a tap. Matches the value
 * DevPanel's own inspector used before tap-to-inspect became an always-on
 * game feature (M10 task 5) rather than a dev-only tool. */
const TAP_DRAG_THRESHOLD_PX = 6;

const AUTOSAVE_INTERVAL_TICKS = 300; // 30s of sim time at 1x

/** Full-screen dawn overlay shown while offline catch-up drains (spec §4.6). */
function showDawnOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:15',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(252,247,235,.92)', 'color:#3a3a2e',
    'font-family:Georgia,serif', 'font-size:18px',
  ].join(';');
  overlay.textContent = 'A new day drifts in…';
  document.body.appendChild(overlay);
  return overlay;
}

async function start(): Promise<void> {
  const mount = document.getElementById('app');
  if (!mount) throw new Error('#app mount point missing');

  const save = await loadSave();
  const state = save ? save.sim : createWorld(1234);
  const sinceTick = state.tick;
  let owed = save ? owedTicks(Date.now() - save.savedAtEpochMs) : 0;

  const renderer = new Renderer();
  await renderer.init(mount);
  renderer.sync(state); // initial snapshot so frame 0 has positions

  renderer.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 0.21); // as far out as the min-zoom floor allows (whole valley where the viewport fits it)

  const audio = new AudioEngine();
  const scheduler = new CallScheduler(audio);
  void audio.preload();
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  const hud = new Hud(audio);
  hud.setClock(getClock(state.tick)); // render the clock pill immediately, don't wait ~100ms for the first sim tick

  // Offline catch-up (spec §4.6): drain owed ticks under a dawn overlay before
  // the live loop starts, so vocalizations from unobserved ticks stay unheard
  // and the welcome card reflects a settled, post-catch-up state.
  if (owed > 0) {
    const overlay = showDawnOverlay();
    // Fail open: a throw inside runCatchUp must never strand the player on a
    // frozen overlay. Every exit from drain() — normal completion or error —
    // resolves the promise, so the await below always settles and boot
    // continues with whatever (still-valid) state was reached.
    await new Promise<void>((resolve) => {
      const drain = (): void => {
        try {
          const res = runCatchUp(state, owed, 8, () => performance.now());
          owed -= res.ticksRun;
          if (!res.done && owed > 0) {
            requestAnimationFrame(drain);
            return;
          }
        } catch (err) {
          console.warn('[catchup] aborted:', err);
        }
        resolve();
      };
      drain();
    });
    overlay.remove();
    renderer.sync(state);
    showWelcomeBack(summarizeEvents(state.eventLog, sinceTick));
  }

  // Tap-to-inspect (M10 task 5): available always, not just in the DevPanel.
  // renderer.selectedId is the single source of truth for "who's selected"
  // (DevPanel's own inspector reads the same field instead of keeping a
  // copy); `inspectedId` here additionally tracks whether *this* card is the
  // one showing it, so the tick loop below can tell "still selected, just
  // update the text" apart from "gone — renderer.sync() already cleared
  // selectedId for us, now hide the card" without racing that clear.
  const inspectCard = new InspectCard(() => dismissInspect());
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
        void saveWorld(state, Date.now());
      }
    },
    (alpha) => {
      renderer.render(alpha);
      devPanel.update();
      renderer.renderFrame(); // single render loop — draw last, after camera/ambient updates
    },
  );
  const devPanel = new DevPanel(state, loop, renderer);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void saveWorld(state, Date.now());
  });
  window.addEventListener('pagehide', () => void saveWorld(state, Date.now()));

  loop.start();
}

void start();
