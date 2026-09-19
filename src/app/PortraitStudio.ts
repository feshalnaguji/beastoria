/** Dev-only: `?portrait=<species>` renders one adult rig for the guide's PNG portraits. */
import { Application, Container, Graphics } from 'pixi.js';
import { rigFor } from '../render/Renderer';
import { buildRig } from '../render/creatures/RigRenderer';
import type { SpeciesId } from '../sim/state';

const SIZE = 600;
const SKY: Partial<Record<SpeciesId, number>> = { owl: 0x4a5568, phoenix: 0x3f3a4a, koi: 0x9fbfb9 };

export async function renderPortraitStudio(mount: HTMLElement, species: SpeciesId): Promise<void> {
  const app = new Application();
  await app.init({ width: SIZE, height: SIZE, background: SKY[species] ?? 0xdce9d5, antialias: true, resolution: 2, autoDensity: true, autoStart: false });
  mount.appendChild(app.canvas);
  const scene = new Container();
  if (species !== 'koi') {
    scene.addChild(new Graphics().ellipse(SIZE / 2, SIZE * 0.78, SIZE * 0.7, SIZE * 0.22).fill(0x9ab77e));
    scene.addChild(new Graphics().ellipse(SIZE / 2, SIZE * 0.86, SIZE * 0.8, SIZE * 0.2).fill(0x87a96b));
  }
  const rig = buildRig(rigFor(species), 'adult');
  rig.animator.play('idle');
  rig.animator.update(0);
  scene.addChild(rig.root);
  app.stage.addChild(scene);
  // Fit the rig into ~70% of the canvas, feet near the ground line.
  const b = rig.root.getLocalBounds();
  const s = (SIZE * 0.7) / Math.max(b.width, b.height);
  rig.root.scale.set(rig.root.scale.x * s);
  const bb = rig.root.getBounds();
  rig.root.position.set(SIZE / 2 - (bb.x + bb.width / 2), SIZE * 0.78 - (bb.y + bb.height));
  app.render();
  document.title = `portrait:${species}`;
  (window as unknown as { __portraitReady?: boolean }).__portraitReady = true;
}
