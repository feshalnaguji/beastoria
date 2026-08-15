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
import { showWelcomeBack } from './ui/WelcomeBack';
import { Renderer } from './render/Renderer';

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

  let ticksSinceSave = 0;
  const loop = new GameLoop(
    () => {
      const out = tick(state, []);
      renderer.sync(state);
      const clock = getClock(state.tick);
      const mix = computeMix(clock, renderer.viewInfo(), state);
      for (const [bed, gain] of Object.entries(mix.beds) as [BedName, number][]) {
        audio.setBedTarget(bed, gain);
      }
      scheduler.onTick(out.vocalizations, mix, performance.now());
      hud.setClock(clock);

      ticksSinceSave++;
      if (ticksSinceSave >= AUTOSAVE_INTERVAL_TICKS) {
        ticksSinceSave = 0;
        void saveWorld(state, Date.now());
      }
    },
    (alpha) => {
      renderer.render(alpha);
      devPanel.update();
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
