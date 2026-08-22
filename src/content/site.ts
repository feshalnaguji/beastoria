/**
 * Site identity — the single source of truth for every URL-bearing tag.
 * The base URL appears in exactly one other place: package.json "homepage"
 * (npm metadata cannot import TS) — update both at custom-domain time.
 */
export const SITE = {
  /** Canonical origin + path, WITH trailing slash. */
  baseUrl: 'https://feshalnaguji.github.io/beastoria/',
  name: 'Beastoria',
  tagline: 'A calm little world of creature families',
  description:
    'Watch rabbits, robins, deer, and nine other creatures pair up, build homes, ' +
    'raise their babies, and grow old peacefully in a gentle living valley. ' +
    'A free, calm nature game for kids and families — no downloads, it plays right in your browser.',
  socialDescription:
    'A gentle living valley of creature families — watch, zoom in close, and listen. Free in your browser.',
  author: 'Feshal Naguji',
  repoUrl: 'https://github.com/feshalnaguji/beastoria',
  themeColor: '#87a96b',
} as const;
