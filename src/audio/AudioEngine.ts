/**
 * Custom Web Audio wrapper (spec §4.5): buffers, bus graph, fades.
 * Graph: oneShotBus ─┐
 *        ambienceBus ─┴→ masterGain → destination
 * Starts suspended; unlock() on first gesture resumes + fades ambience in.
 * A species with no manifest entry stays silent — never an error.
 */
import { AUDIO_MANIFEST, type BedName, type CallKind } from './manifest';
import type { SpeciesId } from '../sim/state';

const MUTE_KEY = 'beastoria.muted';
const EXT = document.createElement('audio').canPlayType('audio/webm; codecs=opus') ? '.webm' : '.m4a';

interface Bed {
  source: AudioBufferSourceNode;
  gain: GainNode;
  target: number;
}

export class AudioEngine {
  private ctx = new AudioContext();
  private master = this.ctx.createGain();
  private oneShotBus = this.ctx.createGain();
  private ambienceBus = this.ctx.createGain();
  private buffers = new Map<string, AudioBuffer>();
  private beds = new Map<BedName, Bed>();
  private unlocked = false;

  /** Fired once, at the end of unlock(); lets UI (e.g. the sound chip) react without polling. */
  onUnlock?: () => void;

  constructor() {
    this.oneShotBus.connect(this.master);
    this.ambienceBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.ambienceBus.gain.value = 0;
    this.master.gain.value = this.muted ? 0 : 1;
  }

  get muted(): boolean {
    return localStorage.getItem(MUTE_KEY) === '1';
  }

  set muted(m: boolean) {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /** First user gesture: resume the context and breathe the ambience in. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    void this.ctx.resume();
    this.ambienceBus.gain.setTargetAtTime(1, this.ctx.currentTime, 0.7); // ~2s fade
    this.onUnlock?.();
  }

  /** Fetch+decode everything in the manifest; missing files log once and stay silent. */
  async preload(): Promise<void> {
    const urls = new Set<string>();
    for (const kinds of Object.values(AUDIO_MANIFEST.families)) {
      for (const variants of Object.values(kinds)) for (const u of variants ?? []) urls.add(u);
    }
    for (const u of Object.values(AUDIO_MANIFEST.beds)) urls.add(u);
    await Promise.all(
      [...urls].map(async (base) => {
        try {
          const res = await fetch(base + EXT);
          if (!res.ok) throw new Error(String(res.status));
          this.buffers.set(base, await this.ctx.decodeAudioData(await res.arrayBuffer()));
        } catch {
          console.warn('[audio] missing, staying silent:', base + EXT);
        }
      }),
    );
    this.startBeds();
  }

  private startBeds(): void {
    for (const [name, base] of Object.entries(AUDIO_MANIFEST.beds) as [BedName, string][]) {
      const buffer = this.buffers.get(base);
      if (!buffer) continue;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(this.ambienceBus);
      source.start();
      this.beds.set(name, { source, gain, target: 0 });
    }
  }

  /** Mixer sets targets each frame; ramps are short so crossfades stay soft. */
  setBedTarget(bed: BedName, gain01: number): void {
    const b = this.beds.get(bed);
    if (!b || b.target === gain01) return;
    b.target = gain01;
    b.gain.gain.setTargetAtTime(gain01, this.ctx.currentTime, 0.4);
  }

  playCall(species: SpeciesId, kind: CallKind, gainDb: number, variantRoll: number): void {
    if (!this.unlocked || this.muted) return;
    const variants = AUDIO_MANIFEST.families[species]?.[kind];
    if (!variants || variants.length === 0) return;
    const base = variants[Math.floor(variantRoll * variants.length) % variants.length];
    const buffer = base === undefined ? undefined : this.buffers.get(base);
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = Math.pow(10, gainDb / 20);
    source.connect(gain).connect(this.oneShotBus);
    source.start();
  }

  /** Advance bed gain ramps; currently handled by setTargetAtTime, so this is a no-op hook
   *  reserved for future frame-driven mixing logic (e.g. per-frame LFOs). */
  update(_dtMs: number): void {
    // Ramps are driven by the Web Audio clock via setTargetAtTime; nothing to do per frame yet.
  }
}
