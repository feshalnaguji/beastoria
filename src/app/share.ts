/** Share links carry ONLY the world seed (spec: names never enter a URL). */
import { SITE } from '../content/site';

export function randomSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0; // app layer — Math.random is banned only inside src/sim
}

export function formatValleyUrl(seed: number): string {
  return `${SITE.baseUrl}?valley=${(seed >>> 0).toString(36)}`;
}

export function parseValleyParam(search: string): number | null {
  const raw = new URLSearchParams(search).get('valley');
  if (raw === null || !/^[0-9a-z]{1,7}$/.test(raw)) return null;
  const n = parseInt(raw, 36);
  return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : null;
}
