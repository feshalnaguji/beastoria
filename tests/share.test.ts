import { describe, expect, it } from 'vitest';
import { formatValleyUrl, parseValleyParam } from '../src/app/share';
import { SITE } from '../src/content/site';

describe('valley share links', () => {
  it('round-trips seeds through base36', () => {
    for (const seed of [0, 1, 1234, 0x7fffffff, 0xffffffff, 3141592653]) {
      const url = formatValleyUrl(seed);
      expect(url.startsWith(`${SITE.baseUrl}?valley=`)).toBe(true);
      expect(parseValleyParam(new URL(url).search)).toBe(seed);
    }
  });
  it('rejects junk and out-of-range values', () => {
    for (const s of ['', '?valley=', '?valley=hello!', '?valley=zzzzzzzz', '?valley=-5', '?other=1z']) {
      expect(parseValleyParam(s)).toBeNull();
    }
  });
});
