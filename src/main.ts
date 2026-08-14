/**
 * Bootstrap: create world → renderer → dev panel → game loop.
 * M1: six rabbits with needs and behaviors, day/night cycle, ~ dev panel.
 */
import { DevPanel } from './app/DevPanel';
import { GameLoop } from './app/GameLoop';
import { AudioEngine } from './audio/AudioEngine';
import { CallScheduler } from './audio/CallScheduler';
import type { BedName } from './audio/manifest';
import { computeMix } from './audio/Mixer';
import { getClock } from './sim/clock';
import { tick } from './sim/Sim';
import { createWorld, WORLD_HEIGHT, WORLD_WIDTH } from './sim/state';
import { Renderer } from './render/Renderer';

async function start(): Promise<void> {
  const mount = document.getElementById('app');
  if (!mount) throw new Error('#app mount point missing');

  const state = createWorld(1234);

  const renderer = new Renderer();
  await renderer.init(mount);
  renderer.sync(state); // initial snapshot so frame 0 has positions

  renderer.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 0.21); // whole valley in view

  const audio = new AudioEngine();
  const scheduler = new CallScheduler(audio);
  void audio.preload();
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  const loop = new GameLoop(
    () => {
      const out = tick(state, []);
      renderer.sync(state);
      const mix = computeMix(getClock(state.tick), renderer.viewInfo(), state);
      for (const [bed, gain] of Object.entries(mix.beds) as [BedName, number][]) {
        audio.setBedTarget(bed, gain);
      }
      scheduler.onTick(out.vocalizations, mix, performance.now());
    },
    (alpha) => {
      renderer.render(alpha);
      devPanel.update();
    },
  );
  const devPanel = new DevPanel(state, loop, renderer);
  loop.start();
}

void start();
