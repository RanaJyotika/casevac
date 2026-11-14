/**
 * Location of injury — body regions, short codes and their meaning.
 *
 * The medic taps the front/back body diagram (react-native-body-highlighter).
 * Each tap becomes a short code that is saved with the record and travels in
 * the handover QR / Bluetooth package:
 *
 *   <region><side>-<view>      THR-F  = Right thigh (front)
 *                              ABL-F  = Left abdomen (front)
 *   <region>-<view> (midline)  HD-B   = Head (back)
 *
 * The receiving tablet turns each code back into its meaning with the same
 * table, so both teams read exactly the same thing.
 *
 * LEFT / RIGHT ARE ALWAYS THE CASUALTY'S. The diagram library names its
 * paths by the side of the screen they are drawn on. Facing the casualty
 * (front view) the screen's left is the casualty's RIGHT; seen from behind
 * (back view) the screen's left is the casualty's LEFT. Every conversion
 * goes through patientSide()/screenSide() below.
 */
import type { Slug } from 'react-native-body-highlighter';

/** F = front of the body, B = back. */
export type BodyView = 'F' | 'B';
/** The casualty's own right or left. */
export type PatientSide = 'R' | 'L';
/** Side of the screen, as the diagram library reports taps. */
export type ScreenSide = 'left' | 'right';

export interface BodyRegion {
  /** Two letters, e.g. TH. */
  code: string;
  name: string;
  /** Has a right and a left (false for head and neck). */
  sided: boolean;
  /** Diagram parts that make up this region in each view. */
  front: Slug[];
  back: Slug[];
}

/** In head-to-toe order; this is also the order codes are listed in. */
export const BODY_REGIONS: readonly BodyRegion[] = [
  {
    code: 'HD',
    name: 'Head',
    sided: false,
    front: ['head', 'hair'],
    back: ['head', 'hair'],
  },
  { code: 'NK', name: 'Neck', sided: false, front: ['neck'], back: ['neck'] },
  {
    code: 'SH',
    name: 'Shoulder',
    sided: true,
    front: ['deltoids', 'trapezius'],
    back: ['deltoids'],
  },
  { code: 'CH', name: 'Chest', sided: true, front: ['chest'], back: [] },
  {
    code: 'UB',
    name: 'Upper back',
    sided: true,
    front: [],
    back: ['upper-back', 'trapezius'],
  },
  {
    code: 'AB',
    name: 'Abdomen',
    sided: true,
    front: ['abs', 'obliques'],
    back: [],
  },
  {
    code: 'LB',
    name: 'Lower back',
    sided: true,
    front: [],
    back: ['lower-back'],
  },
  {
    code: 'UA',
    name: 'Upper arm',
    sided: true,
    front: ['biceps', 'triceps'],
    back: ['triceps'],
  },
  {
    code: 'FA',
    name: 'Forearm',
    sided: true,
    front: ['forearm'],
    back: ['forearm'],
  },
  { code: 'HN', name: 'Hand', sided: true, front: ['hands'], back: ['hands'] },
  { code: 'GR', name: 'Groin', sided: true, front: ['adductors'], back: [] },
  { code: 'BT', name: 'Buttock', sided: true, front: [], back: ['gluteal'] },
  {
    code: 'TH',
    name: 'Thigh',
    sided: true,
    front: ['quadriceps'],
    back: ['hamstring', 'adductors'],
  },
  { code: 'KN', name: 'Knee', sided: true, front: ['knees'], back: [] },
  {
    code: 'LL',
    name: 'Lower leg',
    sided: true,
    front: ['tibialis', 'calves'],
    back: ['calves'],
  },
  {
    code: 'FT',
    name: 'Foot / ankle',
    sided: true,
    front: ['ankles', 'feet'],
    back: ['ankles', 'feet'],
  },
];

const VIEW_NAME: Record<BodyView, string> = { F: 'front', B: 'back' };
const SIDE_NAME: Record<PatientSide, string> = { R: 'Right', L: 'Left' };

/** Shape of any location code — also ones a newer tablet may send. */
const CODE_SHAPE = /^([A-Z]{2})([RL])?-([FB])$/;

const regionParts = (r: BodyRegion, view: BodyView) =>
  view === 'F' ? r.front : r.back;

/* ----------------------------- Left / right ----------------------------- */

/** Screen side of a tap → the casualty's side, for the given view. */
export function patientSide(view: BodyView, screen: ScreenSide): PatientSide {
  if (view === 'F') {
    return screen === 'left' ? 'R' : 'L';
  }
  return screen === 'left' ? 'L' : 'R';
}

/** The casualty's side → where it is drawn on the screen, for the view. */
export function screenSide(view: BodyView, side: PatientSide): ScreenSide {
  if (view === 'F') {
    return side === 'R' ? 'left' : 'right';
  }
  return side === 'L' ? 'left' : 'right';
}

/* --------------------------------- Codes --------------------------------- */

export interface InjuryLocation {
  code: string;
  region: BodyRegion;
  side: PatientSide | null;
  view: BodyView;
}

/** Looks a code up in this tablet's table; null if it is not one we know. */
export function parseInjuryCode(code: string): InjuryLocation | null {
  const match = CODE_SHAPE.exec(code);
  if (!match) {
    return null;
  }
  const [, regionCode, side, view] = match as unknown as [
    string,
    string,
    PatientSide | undefined,
    BodyView,
  ];
  const region = BODY_REGIONS.find(r => r.code === regionCode);
  if (
    !region ||
    region.sided !== Boolean(side) ||
    regionParts(region, view).length === 0
  ) {
    return null;
  }
  return { code, region, side: side ?? null, view };
}

/**
 * Worth keeping on a record: anything shaped like a location code. A code
 * this tablet does not know (sent by a newer app) is kept, not dropped, and
 * shown as not recognised.
 */
export function isInjuryCode(value: unknown): value is string {
  return typeof value === 'string' && CODE_SHAPE.test(value);
}

/** "Right thigh (front)" — null if the code is not one this tablet knows. */
export function describeInjuryCode(code: string): string | null {
  const loc = parseInjuryCode(code);
  if (!loc) {
    return null;
  }
  const where = loc.side
    ? `${SIDE_NAME[loc.side]} ${loc.region.name.toLowerCase()}`
    : loc.region.name;
  return `${where} (${VIEW_NAME[loc.view]})`;
}

/** "THR-F — Right thigh (front)", for reports and the receiving tablet. */
export function injuryLine(code: string): string {
  return `${code} — ${
    describeInjuryCode(code) ?? 'location code not recognised on this tablet'
  }`;
}

function sortKey(code: string): [number, number, number, string] {
  const loc = parseInjuryCode(code);
  if (!loc) {
    return [9, 99, 9, code];
  }
  return [
    loc.view === 'F' ? 0 : 1,
    BODY_REGIONS.indexOf(loc.region),
    loc.side === 'L' ? 1 : 0,
    code,
  ];
}

/** Unique codes in a fixed order: front then back, head to toe, right first. */
export function sortInjuryCodes(codes: readonly string[]): string[] {
  return Array.from(new Set(codes)).sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) {
        return ka[i] < kb[i] ? -1 : 1;
      }
    }
    return 0;
  });
}

/** Adds the code, or removes it if already marked. */
export function toggleInjuryCode(
  codes: readonly string[],
  code: string,
): string[] {
  return codes.includes(code)
    ? codes.filter(c => c !== code)
    : sortInjuryCodes([...codes, code]);
}

/* ------------------------------ The diagram ------------------------------ */

/** A tap on the diagram → its code; null for a tap we cannot place. */
export function codeForTap(
  view: BodyView,
  slug: string | undefined,
  screen: ScreenSide | undefined,
): string | null {
  const region = BODY_REGIONS.find(r =>
    regionParts(r, view).includes(slug as Slug),
  );
  if (!region) {
    return null;
  }
  if (!region.sided) {
    return `${region.code}-${view}`;
  }
  if (!screen) {
    return null;
  }
  return `${region.code}${patientSide(view, screen)}-${view}`;
}

export interface HighlightedPart {
  slug: Slug;
  /** Screen side; absent = both sides. */
  side?: ScreenSide;
}

/** Diagram parts to colour for the marked codes, in one view. */
export function highlightedParts(
  codes: readonly string[],
  view: BodyView,
): HighlightedPart[] {
  const marked = new Map<Slug, Set<ScreenSide>>();
  for (const code of codes) {
    const loc = parseInjuryCode(code);
    if (!loc || loc.view !== view) {
      continue;
    }
    for (const slug of regionParts(loc.region, view)) {
      const sides = marked.get(slug) ?? new Set<ScreenSide>();
      if (loc.side) {
        sides.add(screenSide(view, loc.side));
      } else {
        sides.add('left').add('right');
      }
      marked.set(slug, sides);
    }
  }
  // The library takes one entry per part: one side, or the whole part.
  return Array.from(marked, ([slug, sides]) =>
    sides.size === 2 ? { slug } : { slug, side: [...sides][0] },
  );
}
