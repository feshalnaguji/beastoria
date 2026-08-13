/**
 * Bootstrap: create world → renderer → game loop.
 * M0 walking skeleton: one rabbit wandering a meadow, camera pan/zoom.
 */
import { GameLoop } from './app/GameLoop';
import { tick } from './sim/Sim';
import { createWorld } from './sim/state';
import { Renderer } from './render/Renderer';

async function start(): Promise<void> {
  const mount = document.getElementById('app');
  if (!mount) throw new Error('#app mount point missing');

  const state = createWorld(1234);

  const renderer = new Renderer();
  await renderer.init(mount);
  renderer.sync(state); // initial snapshot so frame 0 has positions

  const first = state.creatures[0];
  if (first) renderer.centerOn(first.pos.x, first.pos.y, 0.9);

  const loop = new GameLoop(
    () => {
      tick(state, []);
      renderer.sync(state);
    },
    (alpha) => renderer.render(alpha),
  );
  loop.start();
}

void start();
