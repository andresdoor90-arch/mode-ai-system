import { describe, expect, it } from 'vitest';

import { makeGarment } from '../../__fixtures__/testSupport';
import { type Inventory } from './InventoryAnalyzer';
import { OutfitCandidateGenerator } from './OutfitCandidateGenerator';
import { type RecommendationContext } from './types';

const inventory = (over: Partial<Inventory>): Inventory => ({
  all: [],
  tops: [],
  bottoms: [],
  dresses: [],
  shoes: [],
  outerwear: [],
  accessories: [],
  ...over,
});

const ctx = {} as unknown as RecommendationContext;

describe('OutfitCandidateGenerator — complementary accessories', () => {
  it('offers a complete look with one accessory PER ZONE (belt + tie + watch)', () => {
    const top = makeGarment({ id: 'top', name: 'Camisa' });
    const bottom = makeGarment({ id: 'bottom', name: 'Pantalón' });
    const belt = makeGarment({ id: 'belt', name: 'Correa café' });
    const tie = makeGarment({ id: 'tie', name: 'Corbata azul' });
    const watch = makeGarment({ id: 'watch', name: 'Reloj plateado' });

    const candidates = new OutfitCandidateGenerator().generate(
      inventory({
        all: [top, bottom, belt, tie, watch],
        tops: [top],
        bottoms: [bottom],
        accessories: [belt, tie, watch],
      }),
      ctx,
    );

    // A candidate carrying all three distinct accessories at once must exist.
    const full = candidates.find(
      (c) =>
        c.some((g) => g.id === 'belt') &&
        c.some((g) => g.id === 'tie') &&
        c.some((g) => g.id === 'watch'),
    );
    expect(full).toBeDefined();

    // ...and a bare top+bottom candidate (no accessories) is still offered, so
    // the ranker can keep it simple for casual contexts.
    const bare = candidates.find((c) => !c.some((g) => ['belt', 'tie', 'watch'].includes(g.id)));
    expect(bare).toBeDefined();
  });

  it('keeps at most ONE accessory per zone (two belts never both appear)', () => {
    const top = makeGarment({ id: 'top', name: 'Camisa' });
    const bottom = makeGarment({ id: 'bottom', name: 'Pantalón' });
    const belt1 = makeGarment({ id: 'belt1', name: 'Correa café' });
    const belt2 = makeGarment({ id: 'belt2', name: 'Correa negra' });

    const candidates = new OutfitCandidateGenerator().generate(
      inventory({
        all: [top, bottom, belt1, belt2],
        tops: [top],
        bottoms: [bottom],
        accessories: [belt1, belt2],
      }),
      ctx,
    );

    for (const candidate of candidates) {
      const belts = candidate.filter((g) => g.id === 'belt1' || g.id === 'belt2');
      expect(belts.length).toBeLessThanOrEqual(1);
    }
  });
});
