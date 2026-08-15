/**
 * Audio asset manifest (spec §4.5). Pure data — paths WITHOUT extension;
 * AudioEngine picks `.webm` or `.m4a` via canPlayType. Species with no
 * shipped files simply get no entry (graceful silence, never an error).
 *
 * Cross-checked 1:1 against `public/audio/families` (per-species subfolders)
 * and `public/audio/ambience` as shipped by Tasks 2-3.
 */
import type { SpeciesId } from '../sim/state';

export type CallKind = 'call' | 'chatter' | 'baby';
export type BedName = 'dawnChorus' | 'dayMeadow' | 'nightCrickets' | 'waterLap' | 'windSoft' | 'emberGlow';

const BASE = import.meta.env.BASE_URL + 'audio/';

export const AUDIO_MANIFEST: {
  families: Partial<Record<SpeciesId, Partial<Record<CallKind, string[]>>>>;
  beds: Record<BedName, string>;
} = {
  families: {
    robin: {
      call: [BASE + 'families/robin/call1', BASE + 'families/robin/call2'],
      chatter: [BASE + 'families/robin/chatter1'],
    },
    duck: { call: [BASE + 'families/duck/call1', BASE + 'families/duck/call2'] },
    owl: { call: [BASE + 'families/owl/call1', BASE + 'families/owl/call2'] },
    deer: { call: [BASE + 'families/deer/call1'] },
    rabbit: { call: [BASE + 'families/rabbit/call1'] },
    koi: { call: [BASE + 'families/koi/call1', BASE + 'families/koi/call2'] },
    dodo: { call: [BASE + 'families/dodo/call1', BASE + 'families/dodo/call2'] },
    phoenix: { call: [BASE + 'families/phoenix/call1', BASE + 'families/phoenix/call2'] },
    squirrel: { call: [BASE + 'families/squirrel/call1'] },
    frog: { call: [BASE + 'families/frog/call1', BASE + 'families/frog/call2'] },
    // turtle: no entry — silent by design (species.ts's voice.rate: 0 means
    // it never rolls a vocalization in the first place; graceful silence
    // either way, per this file's header comment).
  },
  beds: {
    dawnChorus: BASE + 'ambience/dawn-chorus',
    dayMeadow: BASE + 'ambience/day-meadow',
    nightCrickets: BASE + 'ambience/night-crickets',
    waterLap: BASE + 'ambience/water-lap',
    windSoft: BASE + 'ambience/wind-soft',
    emberGlow: BASE + 'ambience/ember-glow',
  },
};
