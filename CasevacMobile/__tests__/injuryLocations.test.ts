import {
  codeForTap,
  describeInjuryCode,
  highlightedParts,
  injuryLine,
  isInjuryCode,
  sortInjuryCodes,
  toggleInjuryCode,
} from '../src/services/evacuation/injuryLocations';
import {
  emptyInterventions,
  normaliseInterventions,
  validateInterventions,
} from '../src/services/evacuation/interventions';

describe('location of injury codes', () => {
  test('codes read back as the casualty’s side and the view', () => {
    expect(describeInjuryCode('THR-F')).toBe('Right thigh (front)');
    expect(describeInjuryCode('ABL-F')).toBe('Left abdomen (front)');
    expect(describeInjuryCode('LBR-B')).toBe('Right lower back (back)');
    expect(describeInjuryCode('HD-B')).toBe('Head (back)');
    expect(injuryLine('THR-F')).toBe('THR-F — Right thigh (front)');
  });

  test('impossible or unknown codes are not given a meaning', () => {
    expect(describeInjuryCode('TH-F')).toBeNull(); // thigh needs a side
    expect(describeInjuryCode('HDR-F')).toBeNull(); // head has none
    expect(describeInjuryCode('CHR-B')).toBeNull(); // no chest on the back
    expect(describeInjuryCode('ZZR-F')).toBeNull();
    // …but a code shaped right (from a newer tablet) is still kept.
    expect(isInjuryCode('ZZR-F')).toBe(true);
    expect(isInjuryCode('thigh')).toBe(false);
    expect(injuryLine('ZZR-F')).toMatch(/not recognised/);
  });

  test('front view: the screen’s left is the casualty’s RIGHT', () => {
    expect(codeForTap('F', 'quadriceps', 'left')).toBe('THR-F');
    expect(codeForTap('F', 'quadriceps', 'right')).toBe('THL-F');
    expect(highlightedParts(['THR-F'], 'F')).toEqual([
      { slug: 'quadriceps', side: 'left' },
    ]);
  });

  test('back view: the screen’s left is the casualty’s LEFT', () => {
    expect(codeForTap('B', 'hamstring', 'left')).toBe('THL-B');
    expect(codeForTap('B', 'hamstring', 'right')).toBe('THR-B');
    expect(highlightedParts(['THR-B'], 'B')).toEqual([
      { slug: 'hamstring', side: 'right' },
      { slug: 'adductors', side: 'right' },
    ]);
  });

  test('midline parts ignore the side; both sides marked colour the whole part', () => {
    expect(codeForTap('F', 'head', undefined)).toBe('HD-F');
    expect(codeForTap('F', 'neck', 'left')).toBe('NK-F');
    expect(codeForTap('F', 'quadriceps', undefined)).toBeNull();
    expect(codeForTap('F', 'not-a-part', 'left')).toBeNull();
    expect(highlightedParts(['THR-F', 'THL-F', 'HD-B'], 'F')).toEqual([
      { slug: 'quadriceps' },
    ]);
  });

  test('tapping again clears; the list stays front→back, head→toe, right first', () => {
    let codes: string[] = [];
    for (const c of ['FTL-B', 'THL-F', 'HD-F', 'THR-F']) {
      codes = toggleInjuryCode(codes, c);
    }
    expect(codes).toEqual(['HD-F', 'THR-F', 'THL-F', 'FTL-B']);
    expect(toggleInjuryCode(codes, 'THR-F')).toEqual([
      'HD-F',
      'THL-F',
      'FTL-B',
    ]);
    expect(sortInjuryCodes(['THR-F', 'THR-F'])).toEqual(['THR-F']);
  });
});

describe('interventions record keeps the codes', () => {
  test('saved from the form and read back from storage or a transfer', () => {
    const form = {
      ...emptyInterventions('RED'),
      injuryLocations: ['THL-F', 'THR-F', 'junk'],
    };
    const result = validateInterventions(form);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.injuryLocations).toEqual(['THR-F', 'THL-F']);

    const stored = normaliseInterventions({
      id: 'INT-1',
      triage: { category: 'RED' },
      injuryLocations: ['ABL-F', 42, 'THR-F'],
    });
    // Head to toe: abdomen before thigh.
    expect(stored?.injuryLocations).toEqual(['ABL-F', 'THR-F']);
  });

  test('records and drafts from before this field load with no locations', () => {
    expect(
      normaliseInterventions({ id: 'INT-0', triage: { category: 'GREEN' } })
        ?.injuryLocations,
    ).toEqual([]);
    const oldDraft: Partial<ReturnType<typeof emptyInterventions>> =
      emptyInterventions('RED');
    delete oldDraft.injuryLocations;
    const result = validateInterventions(oldDraft as never);
    expect(result.ok && result.value.injuryLocations).toEqual([]);
  });
});
