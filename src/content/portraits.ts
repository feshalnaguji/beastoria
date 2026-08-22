import type { SpeciesGuideId } from './guide';

/** Shared calm-valley backdrop. bodySvg draws inside a 240x180 canvas. */
function frame(label: string, sky: string, bodySvg: string): string {
  return (
    `<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">` +
    `<rect width="240" height="180" fill="${sky}"/>` +
    `<circle cx="196" cy="38" r="18" fill="#f4e9c8" opacity="0.9"/>` +
    `<path d="M0 120 Q 60 96 130 116 T 240 108 V 180 H 0 Z" fill="#9ab77e"/>` +
    `<path d="M0 142 Q 80 124 160 140 T 240 136 V 180 H 0 Z" fill="#87a96b"/>` +
    bodySvg +
    `</svg>`
  );
}

/** Full-bleed water backdrop (no hills) — used only for koi's underwater view. */
function frameWater(label: string, water: string, bodySvg: string): string {
  return (
    `<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">` +
    `<rect width="240" height="180" fill="${water}"/>` +
    `<circle cx="196" cy="30" r="20" fill="#f4e9c8" opacity="0.35"/>` +
    bodySvg +
    `</svg>`
  );
}

export const PORTRAITS: Record<SpeciesGuideId, string> = {
  rabbit: frame(
    'A rabbit sitting in the meadow',
    '#dce9d5',
    // body: seated silhouette — haunch, head, two long ears, tail dot, eye
    `<ellipse cx="112" cy="138" rx="34" ry="24" fill="#8a7d6b"/>` +
      `<circle cx="140" cy="118" r="16" fill="#8a7d6b"/>` +
      `<path d="M132 106 Q 128 76 136 74 Q 142 76 141 104 Z" fill="#8a7d6b"/>` +
      `<path d="M146 106 Q 150 74 157 76 Q 162 80 152 106 Z" fill="#8a7d6b"/>` +
      `<circle cx="82" cy="132" r="7" fill="#a99a86"/>` +
      `<circle cx="146" cy="116" r="2.2" fill="#2f2a24"/>`,
  ),

  robin: frame(
    'A robin perched on a branch',
    '#d9e6ee',
    // body: perched profile — dark body, orange breast patch, head, beak, tail, legs on a branch
    `<line x1="70" y1="146" x2="190" y2="146" stroke="#7a6a52" stroke-width="4"/>` +
      `<ellipse cx="120" cy="120" rx="28" ry="20" fill="#5a5148"/>` +
      `<ellipse cx="104" cy="126" rx="16" ry="14" fill="#b0552f"/>` +
      `<circle cx="146" cy="102" r="15" fill="#5a5148"/>` +
      `<path d="M160 100 L 172 104 L 160 108 Z" fill="#d9a441"/>` +
      `<path d="M94 116 L 64 108 L 96 128 Z" fill="#5a5148"/>` +
      `<circle cx="150" cy="98" r="2" fill="#2f2a24"/>` +
      `<path d="M112 138 L 112 146 M 128 138 L 128 146" stroke="#d9a441" stroke-width="3" fill="none"/>`,
  ),

  deer: frame(
    'A deer standing near the trees',
    '#e3ead6',
    // body: standing profile — barrel body, neck, head, ear, four legs, tail, two fawn spots
    `<ellipse cx="115" cy="128" rx="32" ry="18" fill="#a9835f"/>` +
      `<path d="M138 118 L 152 90 L 160 92 L 148 122 Z" fill="#a9835f"/>` +
      `<circle cx="158" cy="86" r="12" fill="#a9835f"/>` +
      `<path d="M154 76 L 148 62 L 160 74 Z" fill="#a9835f"/>` +
      `<path d="M96 144 L 94 168 M 108 146 L 106 168 M 124 144 L 126 168 M 136 142 L 140 166" ` +
      `stroke="#a9835f" stroke-width="5" fill="none"/>` +
      `<ellipse cx="86" cy="126" rx="5" ry="8" fill="#a9835f"/>` +
      `<circle cx="108" cy="122" r="4" fill="#f2ead9"/>` +
      `<circle cx="122" cy="130" r="4" fill="#f2ead9"/>`,
  ),

  duck: frame(
    'A duck floating on the pond',
    '#d7e6e2',
    // body: floating on a water band — body oval, green head, bill, eye, wing patch, ripples
    `<ellipse cx="120" cy="158" rx="130" ry="26" fill="#7fa7a0"/>` +
      `<ellipse cx="112" cy="140" rx="30" ry="18" fill="#6b705c"/>` +
      `<circle cx="148" cy="120" r="14" fill="#3f6b4f"/>` +
      `<path d="M160 120 L 176 116 L 176 126 Z" fill="#d9a441"/>` +
      `<circle cx="152" cy="116" r="2" fill="#2f2a24"/>` +
      `<ellipse cx="104" cy="138" rx="14" ry="8" fill="#565c4a"/>` +
      `<path d="M40 156 Q 60 150 80 156" stroke="#c9ded9" stroke-width="3" fill="none"/>` +
      `<path d="M150 162 Q 172 156 194 162" stroke="#c9ded9" stroke-width="3" fill="none"/>`,
  ),

  koi: frameWater(
    'A koi swimming underwater',
    '#9fbfb9',
    // body: curved fish silhouette, cream patch, tail fan, fin, eye, rising bubbles
    `<path d="M70 120 Q 100 96 150 110 Q 170 118 168 132 Q 150 150 110 144 Q 80 140 70 120 Z" fill="#d97742"/>` +
      `<ellipse cx="120" cy="118" rx="14" ry="9" fill="#f2ead9"/>` +
      `<path d="M68 118 L 44 100 L 50 122 L 44 142 Z" fill="#d97742"/>` +
      `<path d="M110 138 L 100 154 L 122 144 Z" fill="#d97742"/>` +
      `<circle cx="150" cy="112" r="2.5" fill="#2f2a24"/>` +
      `<circle cx="180" cy="70" r="4" fill="#e7f3f0" opacity="0.8"/>` +
      `<circle cx="192" cy="90" r="3" fill="#e7f3f0" opacity="0.8"/>` +
      `<circle cx="170" cy="54" r="2.5" fill="#e7f3f0" opacity="0.8"/>`,
  ),

  owl: frame(
    'An owl perched on a branch at dusk',
    '#4a5568',
    // body: upright owl — round body, ear tufts, big eye discs with pupils, beak, branch
    `<line x1="60" y1="150" x2="200" y2="150" stroke="#5a4a38" stroke-width="5"/>` +
      `<ellipse cx="120" cy="120" rx="26" ry="30" fill="#7d6f5d"/>` +
      `<path d="M100 92 L 96 74 L 108 90 Z M 140 92 L 144 74 L 132 90 Z" fill="#7d6f5d"/>` +
      `<circle cx="108" cy="112" r="11" fill="#f2ead9"/>` +
      `<circle cx="132" cy="112" r="11" fill="#f2ead9"/>` +
      `<circle cx="108" cy="112" r="4" fill="#2f2a24"/>` +
      `<circle cx="132" cy="112" r="4" fill="#2f2a24"/>` +
      `<path d="M116 122 L 124 122 L 120 130 Z" fill="#d9a441"/>`,
  ),

  squirrel: frame(
    'A squirrel sitting up with its tail raised',
    '#e8e4d0',
    // body: seated profile — body, head, ear, big S-curve tail, paws, eye, belly patch
    `<ellipse cx="110" cy="136" rx="20" ry="24" fill="#8f5f3f"/>` +
      `<circle cx="122" cy="106" r="14" fill="#8f5f3f"/>` +
      `<path d="M116 94 L 112 82 L 124 92 Z" fill="#8f5f3f"/>` +
      `<path d="M92 130 Q 60 130 66 100 Q 70 76 96 78 Q 84 90 90 108 Q 94 122 108 128 Z" fill="#8f5f3f"/>` +
      `<ellipse cx="98" cy="152" rx="7" ry="5" fill="#8f5f3f"/>` +
      `<ellipse cx="118" cy="154" rx="7" ry="5" fill="#8f5f3f"/>` +
      `<circle cx="128" cy="102" r="2" fill="#2f2a24"/>` +
      `<ellipse cx="106" cy="140" rx="10" ry="14" fill="#c9b38a"/>`,
  ),

  frog: frame(
    "A frog crouched at the water's edge",
    '#d5e8d0',
    // body: crouched mound, two bulging eye bumps with pupils, lily pad, front and back legs
    `<ellipse cx="80" cy="158" rx="34" ry="10" fill="#7fa7a0"/>` +
      `<path d="M90 150 Q 90 118 130 116 Q 168 118 166 148 Q 150 160 128 160 Q 106 160 90 150 Z" fill="#5f8f4f"/>` +
      `<circle cx="114" cy="112" r="10" fill="#5f8f4f"/>` +
      `<circle cx="140" cy="112" r="10" fill="#5f8f4f"/>` +
      `<circle cx="114" cy="110" r="3.5" fill="#2f2a24"/>` +
      `<circle cx="140" cy="110" r="3.5" fill="#2f2a24"/>` +
      `<path d="M100 152 Q 92 160 82 158" stroke="#4a7540" stroke-width="4" fill="none"/>` +
      `<path d="M156 150 Q 168 158 178 152" stroke="#4a7540" stroke-width="4" fill="none"/>`,
  ),

  turtle: frame(
    'A turtle walking slowly through the grass',
    '#e0e8d8',
    // body: shell dome with scute arcs, head, legs, tail, grass tufts
    `<path d="M76 148 Q 80 108 130 106 Q 180 108 184 148 Z" fill="#6f7f4f"/>` +
      `<path d="M100 116 Q 108 108 118 116" stroke="#5a6b3f" stroke-width="3" fill="none"/>` +
      `<path d="M128 114 Q 136 104 146 114" stroke="#5a6b3f" stroke-width="3" fill="none"/>` +
      `<path d="M154 118 Q 162 110 170 120" stroke="#5a6b3f" stroke-width="3" fill="none"/>` +
      `<ellipse cx="196" cy="140" rx="12" ry="9" fill="#8fa06f"/>` +
      `<path d="M90 148 L 86 160 M 118 150 L 116 162 M 150 150 L 152 162 M 172 146 L 176 158" ` +
      `stroke="#8fa06f" stroke-width="5" fill="none"/>` +
      `<path d="M76 144 L 64 142" stroke="#8fa06f" stroke-width="4" fill="none"/>` +
      `<path d="M40 158 L 36 146 M 46 158 L 44 148 M 52 158 L 52 146" stroke="#7a8f5a" stroke-width="2" fill="none"/>`,
  ),

  kangaroo: frame(
    'A kangaroo mother standing with a joey peeking from her pouch',
    '#ecdfc8',
    // body: upright haunch, thick ground tail, head, ear, pouch arc with joey head, eye, paw
    `<ellipse cx="118" cy="128" rx="30" ry="34" fill="#a97c50"/>` +
      `<path d="M96 140 Q 60 148 54 172 Q 74 168 100 152 Z" fill="#a97c50"/>` +
      `<circle cx="146" cy="90" r="14" fill="#a97c50"/>` +
      `<path d="M150 78 L 146 62 L 158 76 Z" fill="#a97c50"/>` +
      `<path d="M104 132 Q 122 148 140 132 Q 130 152 112 152 Q 100 148 104 132 Z" fill="#8a6540"/>` +
      `<circle cx="122" cy="136" r="8" fill="#8a6540"/>` +
      `<circle cx="150" cy="86" r="2" fill="#2f2a24"/>` +
      `<ellipse cx="140" cy="120" rx="6" ry="9" fill="#a97c50"/>`,
  ),

  dodo: frame(
    'A plump dodo standing in the meadow',
    '#dce9d5',
    // body: round plump body, head, hooked beak, wing stub, legs, eye, tail tuft
    `<ellipse cx="112" cy="130" rx="34" ry="28" fill="#8d8578"/>` +
      `<circle cx="156" cy="104" r="16" fill="#8d8578"/>` +
      `<path d="M170 100 Q 190 98 192 108 Q 190 116 176 112 Q 170 108 170 100 Z" fill="#c9b38a"/>` +
      `<ellipse cx="100" cy="128" rx="14" ry="20" fill="#726b5e"/>` +
      `<path d="M100 156 L 98 172" stroke="#c9b38a" stroke-width="5"/>` +
      `<path d="M124 156 L 126 172" stroke="#c9b38a" stroke-width="5"/>` +
      `<circle cx="160" cy="100" r="2.5" fill="#2f2a24"/>` +
      `<path d="M74 118 L 58 110 L 72 128 Z" fill="#8d8578"/>`,
  ),

  phoenix: frame(
    'A phoenix rising in ember-lit dusk light',
    '#3f3a4a',
    // body: glow behind, body, head, swept wing, two long tail plumes with a bright tip, eye
    `<circle cx="120" cy="110" r="38" fill="#f4e9c8" opacity="0.35"/>` +
      `<ellipse cx="118" cy="112" rx="18" ry="26" fill="#d97742"/>` +
      `<path d="M112 90 Q 108 76 118 72 Q 128 76 122 92 Z" fill="#d97742"/>` +
      `<path d="M100 100 Q 60 92 50 68 Q 76 82 104 96 Z" fill="#d97742"/>` +
      `<path d="M126 132 Q 140 158 132 180 Q 122 156 118 134 Z" fill="#d97742"/>` +
      `<ellipse cx="130" cy="176" rx="6" ry="10" fill="#f2b544"/>` +
      `<path d="M140 128 Q 160 148 158 174 Q 144 152 132 132 Z" fill="#d97742"/>` +
      `<circle cx="120" cy="80" r="2" fill="#2f2a24"/>`,
  ),
} as const;
