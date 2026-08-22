/** Kid-facing guide content. Pure data — no imports from src/sim. */

export type SpeciesGuideId =
  | 'rabbit' | 'robin' | 'deer' | 'duck' | 'koi' | 'owl'
  | 'squirrel' | 'frog' | 'turtle' | 'kangaroo' | 'dodo' | 'phoenix';

export interface VoiceCredit {
  /** e.g. "American Robin song" */
  label: string;
  author: string;
  license: string; // e.g. "CC BY-SA 3.0", "Public domain", "Pixabay Content License"
  url: string;
}

export type VoiceInfo =
  | { kind: 'recorded' | 'designed'; note: string; credits: VoiceCredit[] }
  | { kind: 'silent'; note: string };

export interface GuideEntry {
  id: SpeciesGuideId;
  name: string;
  emoji: string;
  tagline: string;
  /** 3-4 short, true, kid-friendly facts about the real animal. */
  facts: string[];
  /** What this species' family life looks like in the game. */
  inBeastoria: string;
  voice: VoiceInfo;
}

export const GUIDE: GuideEntry[] = [
  {
    id: 'rabbit',
    name: 'Rabbit',
    emoji: '🐇',
    tagline: 'Soft-footed families in the meadow grass',
    facts: [
      'A mother rabbit is called a doe, and her babies are called kits — they are born with their eyes closed and grow fast.',
      'Rabbits talk with their feet: a thump on the ground warns the whole warren.',
      "A rabbit's teeth never stop growing, so nibbling all day keeps them just right.",
    ],
    inBeastoria:
      'Rabbit families dig burrow homes in the meadow. Mothers rest inside while expecting, then nurse ' +
      'their kits at the burrow — watch the little ones gather in close. When they grow up, young rabbits ' +
      'hop off to start families of their own.',
    voice: {
      kind: 'recorded',
      note: 'Rabbits are mostly quiet animals, so in Beastoria you hear their soft foot-thumps.',
      credits: [
        {
          label: 'Soft thump foley',
          author: 'toddcircle (Freesound) / freesound_community (Pixabay)',
          license: 'Pixabay Content License',
          url: 'https://pixabay.com/sound-effects/nature-quiet-thud-hits-100179/',
        },
      ],
    },
  },
  {
    id: 'robin',
    name: 'Robin',
    emoji: '🐦',
    tagline: "The valley's morning singers",
    facts: [
      'American robins are often the first birds singing before sunrise — the dawn chorus.',
      'Robin eggs are a famous bright blue.',
      'Both robin parents take turns bringing food back to their chicks.',
    ],
    inBeastoria:
      'Robin pairs build a nest, take turns keeping their blue eggs warm, and fly out to fetch food for ' +
      'their chicks — you can watch a parent carry each meal home. At dawn, listen for their song.',
    voice: {
      kind: 'recorded',
      note: 'Real American Robin song, recorded in Ontario.',
      credits: [
        {
          label: 'American Robin song',
          author: 'Mdf (Wikimedia Commons)',
          license: 'CC BY-SA 3.0',
          url: 'https://commons.wikimedia.org/wiki/File:Turdus-migratorius-003.ogg',
        },
      ],
    },
  },
  {
    id: 'deer',
    name: 'Deer',
    emoji: '🦌',
    tagline: 'Gentle herds by the tree line',
    facts: [
      'Fawns are born with white spots that help them hide in dappled light.',
      'Deer live in small herds and keep gently close to each other.',
      'Mother deer and their fawns call to each other with soft bleats.',
    ],
    inBeastoria:
      'Deer drift together in a little herd near the trees. Mothers give birth to spotted fawns and nurse ' +
      'them in the shade, and the whole herd keeps calm company as the fawns grow.',
    voice: {
      kind: 'designed',
      note:
        "A gentle bleat, adapted from a real lamb recording — the classic film stand-in for a deer's call.",
      credits: [
        {
          label: 'Lamb bleat (deer-call stand-in)',
          author: 'Yosef Ben Melamed (Wikimedia Commons)',
          license: 'CC BY-SA 4.0',
          url: 'https://commons.wikimedia.org/wiki/File:Lamb_bleating_and_its_mother%27s_response.flac',
        },
      ],
    },
  },
  {
    id: 'duck',
    name: 'Duck',
    emoji: '🦆',
    tagline: 'Paddlers of the pond edge',
    facts: [
      'Ducklings can swim on their very first day.',
      'Ducks spread oil through their feathers with their beaks to stay waterproof.',
      'The classic "quack" is usually the female mallard — males are quieter.',
    ],
    inBeastoria:
      'Duck families live where the meadow meets the pond. They waddle on land and paddle on water, nest ' +
      'near the bank, and lead their ducklings between the two all day long.',
    voice: {
      kind: 'recorded',
      note: "A real mallard quack from the British Library's wildlife collection.",
      credits: [
        {
          label: 'Mallard quack',
          author: 'Ndalyrose (Wikimedia Commons); British Library Wildlife Sound Collection',
          license: 'CC BY-SA 4.0',
          url: 'https://commons.wikimedia.org/wiki/File:Mallard_(Anas_platyrhynchos)_(W1CDR0001518_BD17).ogg',
        },
      ],
    },
  },
  {
    id: 'koi',
    name: 'Koi',
    emoji: '🐟',
    tagline: 'Quiet gold beneath the water',
    facts: [
      'Koi can live a very long time — one famous koi in Japan, Hanako, was said to be over 200 years old.',
      'Koi come in orange, gold, white, and calico patterns.',
      'Koi can learn to recognize the person who feeds them.',
    ],
    inBeastoria:
      'Koi glide below the pond surface in slow, glinting circles. Their young hatch in the water and feed ' +
      'themselves from the start, growing from tiny fry into calm golden elders.',
    voice: {
      kind: 'recorded',
      note: "Koi don't call — you hear the small, real splashes of the pond.",
      credits: [
        {
          label: 'Small water splash',
          author: 'freesounds123 (Pixabay)',
          license: 'Pixabay Content License',
          url: 'https://pixabay.com/sound-effects/nature-small-water-splash-374843/',
        },
        {
          label: 'Tiny splash',
          author: 'dslrguide (Freesound) / freesound_community (Pixabay)',
          license: 'Pixabay Content License',
          url: 'https://pixabay.com/sound-effects/film-special-effects-tiny-splash-83778/',
        },
      ],
    },
  },
  {
    id: 'owl',
    name: 'Owl',
    emoji: '🦉',
    tagline: 'Night watch over the valley',
    facts: [
      'Owls are awake at night and asleep in the day.',
      "Special soft-edged feathers make an owl's flight almost silent.",
      "An owl can't move its eyes in their sockets — it turns its whole head instead, very far around.",
    ],
    inBeastoria:
      'When the valley goes dark and everyone else sleeps, the owls wake. They fly the night sky, raise ' +
      'their owlets in a hollow, and hoot across the quiet — listen after dusk.',
    voice: {
      kind: 'recorded',
      note: 'Real Tawny Owl hoots, recorded in France and Sweden.',
      credits: [
        {
          label: 'Tawny Owl male hoot',
          author: 'Vianney Bajart (Wikimedia Commons)',
          license: 'CC BY-SA 4.0',
          url: 'https://commons.wikimedia.org/wiki/File:Strix_aluco_male.oga',
        },
        {
          label: 'Tawny Owl calling at night',
          author: 'W.carter (Wikimedia Commons)',
          license: 'CC BY 4.0',
          url: 'https://commons.wikimedia.org/wiki/File:Tawny_owl_calling_at_night_in_Tuntorp,_Brastad,_Sweden.ogg',
        },
      ],
    },
  },
  {
    id: 'squirrel',
    name: 'Squirrel',
    emoji: '🐿️',
    tagline: 'Dart-and-pause acrobats',
    facts: [
      "A squirrel's fluffy tail is a balance pole, a parasol, and a blanket all in one.",
      'Squirrels bury nuts to eat later — the forgotten ones can grow into new trees.',
      'Squirrels chatter fast when something surprises them.',
    ],
    inBeastoria:
      'Squirrels move in quick darts and sudden stillness — watch one freeze mid-hop. Mothers nurse their ' +
      'kittens at the drey, and the young ones soon race each other around the trees.',
    voice: {
      kind: 'recorded',
      note: "A real Douglas Squirrel's chatter, recorded at Puget Sound.",
      credits: [
        {
          label: 'Douglas Squirrel chatter',
          author: 'Parande (Wikimedia Commons)',
          license: 'CC BY-SA 3.0',
          url: 'https://commons.wikimedia.org/wiki/File:Tamiasciurus_douglasii.ogg',
        },
      ],
    },
  },
  {
    id: 'frog',
    name: 'Frog',
    emoji: '🐸',
    tagline: "Small voices at the water's edge",
    facts: [
      'Wood frogs can freeze almost solid in winter and thaw out alive in spring.',
      'In spring, frogs sing together in a chorus you can hear from far away.',
      'Frog babies — tadpoles — breathe underwater before they grow legs.',
    ],
    inBeastoria:
      'Frogs hop between the bank and the shallows. Their young hatch in the water and look after ' +
      'themselves from the first day, and on some evenings the pond edge fills with croaking.',
    voice: {
      kind: 'recorded',
      note: 'Real Wood Frogs calling in spring, recorded in Ottawa.',
      credits: [
        {
          label: 'Wood Frogs calling in spring',
          author: 'D. Gordon E. Robertson (Wikimedia Commons)',
          license: 'CC BY-SA 3.0',
          url: 'https://commons.wikimedia.org/wiki/File:Wood_Frogs_calling_in_spring.ogg',
        },
      ],
    },
  },
  {
    id: 'turtle',
    name: 'Turtle',
    emoji: '🐢',
    tagline: "The valley's slowest, calmest neighbors",
    facts: [
      "A turtle's shell is part of its skeleton — it can never crawl out of it.",
      'Turtles love to bask in warm sunshine to heat up.',
      'Turtles are almost completely voiceless — quiet is simply their way.',
    ],
    inBeastoria:
      'Turtles take the valley at their own speed. They lay eggs near the water, and their hatchlings look ' +
      'after themselves from the start — slow, steady, and entirely unbothered.',
    voice: {
      kind: 'silent',
      note:
        "Turtles are essentially voiceless in real life, so Beastoria's turtles are quiet on purpose — " +
        "it's the realistic choice, not a missing sound.",
    },
  },
  {
    id: 'kangaroo',
    name: 'Kangaroo',
    emoji: '🦘',
    tagline: 'Pouch-riding joeys on the far meadow',
    facts: [
      "A baby kangaroo — a joey — lives and rides in its mother's pouch for months.",
      "Kangaroos can't easily walk backwards — their big tail and feet are built for bounding forward.",
      'Instead of calling, kangaroos mostly chuff softly and thump the ground.',
    ],
    inBeastoria:
      'The kangaroo mother is the fastest creature in the valley, and her joey rides in her pouch to keep ' +
      'up. Watch it clamber aboard, peek out as she bounds along, and hop down for a nibble of grass ' +
      'before climbing back in.',
    voice: {
      kind: 'silent',
      note:
        "Real kangaroos chuff and thump rather than call, so Beastoria's kangaroos are quiet on purpose.",
    },
  },
  {
    id: 'dodo',
    name: 'Dodo',
    emoji: '🦤',
    tagline: 'Back from memory, safe in the valley',
    facts: [
      'Dodos really lived, on the island of Mauritius, until about 340 years ago.',
      "The dodo's closest living relatives are pigeons and doves — it was like a giant ground pigeon.",
      'Nobody ever recorded a dodo, so no one alive has heard one.',
    ],
    inBeastoria:
      'In Beastoria the dodos have a safe meadow of their own. They pair up, tend their eggs, and raise ' +
      'fluffy chicks — a gentle look at a bird the world lost.',
    voice: {
      kind: 'designed',
      note:
        'No dodo was ever recorded, so its voice here is designed from its real closest relatives: dove ' +
        'coos, deepened to fit a big, gentle ground bird.',
      credits: [
        {
          label: 'Dove cooing',
          author: 'Fæ (Wikimedia Commons)',
          license: 'Public domain',
          url: 'https://commons.wikimedia.org/wiki/File:Dove_cooing.ogg',
        },
        {
          label: 'Cape Turtle Dove call',
          author: 'MilesWelsh (Wikimedia Commons)',
          license: 'CC BY-SA 3.0',
          url: 'https://commons.wikimedia.org/wiki/File:CapeTurtleDove.ogg',
        },
      ],
    },
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    emoji: '🔥',
    tagline: 'One family, reborn in ember-light',
    facts: [
      'The phoenix is a mythical firebird from very old stories, told for thousands of years.',
      'In the legends, when a phoenix grows old, a new one rises — the family never truly ends.',
      "Beastoria's phoenix voice is woven from three real birds: a crane, a swan, and a loon.",
    ],
    inBeastoria:
      "There is exactly one phoenix family in the whole valley, glowing by their ember grove. When a " +
      "phoenix elder's time comes, a new chick appears at the grove — the one family, always continuing.",
    voice: {
      kind: 'designed',
      note: 'A mythical bird needs a designed voice: real crane, swan, and loon calls layered into one.',
      credits: [
        {
          label: 'Sandhill Crane bugle',
          author: 'Innotata (Wikimedia Commons), Denali National Park',
          license: 'Public domain',
          url: 'https://commons.wikimedia.org/wiki/File:Grus_canadensis_Denali_National_Park.ogg',
        },
        {
          label: 'Whooper Swan call',
          author: 'Beeld en Geluid Collecties (Wikimedia Commons)',
          license: 'CC BY 4.0',
          url: 'https://commons.wikimedia.org/wiki/File:Whooper_Swan_(Cygnus_cygnus)_(W_CYGNUS_CYGNUS_R1_C6).ogg',
        },
        {
          label: 'Common Loon wail',
          author: 'Thesupermat / Yellowstone NPS sound library (Wikimedia Commons)',
          license: 'Public domain',
          url: 'https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_Common_Loon_-_001.mp3',
        },
        {
          label: 'Mourning Dove coo',
          author: 'DRAGON-STUDIO (Pixabay)',
          license: 'Pixabay Content License',
          url: 'https://pixabay.com/sound-effects/nature-mourning-dove-coo-335480/',
        },
      ],
    },
  },
];

export const ABOUT_HTML = `
<p>Beastoria is a calm little living world that runs all by itself. Rabbits, robins,
deer, ducks, koi, owls, squirrels, frogs, turtles, kangaroos, dodos, and one phoenix
family pair up, build homes, lay eggs or have babies, feed their little ones, and
slowly grow up and grow old — gently, the way real families do.</p>
<p>There is nothing to manage and nothing to win. You watch, you zoom in close to one
family or out to the whole valley, and you listen — every creature voice comes from a
real recording of a real animal. Nothing scary ever happens on screen.</p>
<p>Beastoria is free, plays in your browser on a computer, tablet, or phone, and saves
your valley on your own device.</p>`;

export const PRIVACY_SECTIONS: { heading: string; bodyHtml: string }[] = [
  {
    heading: 'The short version',
    bodyHtml:
      '<p>Beastoria collects <strong>nothing</strong>. No accounts, no names, no emails, ' +
      'no tracking, no analytics, no cookies used to follow you, and no ads. ' +
      'This page exists so parents can check that for themselves.</p>',
  },
  {
    heading: 'Your valley is saved on your device',
    bodyHtml:
      '<p>The world you watch is simulated in your own browser and saved in your ' +
      "browser's local storage (IndexedDB). It never leaves your device, and we " +
      'cannot see it. Clearing your browser data clears your valley.</p>',
  },
  {
    heading: 'Made with children in mind',
    bodyHtml:
      '<p>Beastoria is designed to be suitable for children. We treat it as a ' +
      'child-directed site: we do not collect personal information from anyone, ' +
      'and if ads ever appear in the future they will be non-tracking, ' +
      'contextual-only, and never over the game itself. This policy will be ' +
      'updated first.</p>',
  },
  {
    heading: 'Creature voices',
    bodyHtml:
      '<p>The creature calls are real recordings by generous people who shared them ' +
      'under open licenses. Every recording is credited on that creature’s page in ' +
      'the <a href="../guide/">creature guide</a>.</p>',
  },
  {
    heading: 'Questions',
    bodyHtml:
      '<p>Beastoria is an open project — you can read all of its code, or reach us, at ' +
      '<a href="https://github.com/feshalnaguji/beastoria">github.com/feshalnaguji/beastoria</a>.</p>',
  },
];
