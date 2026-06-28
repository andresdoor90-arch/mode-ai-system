import { describe, it, expect } from 'vitest';

import { toId } from '../../shared/Identifier';
import { unwrap } from '../../shared/Result';
import { Garment, GarmentStatus } from './Garment';
import { Outfit } from './Outfit';
import { UserProfile } from './UserProfile';
import { StyleRule, RuleEffect } from './StyleRule';
import { WardrobeCollection } from './WardrobeCollection';
import { CalendarEvent, DressCode } from './CalendarEvent';
import { Wardrobe } from './Wardrobe';
import { GarmentCategory } from '../value-objects/GarmentCategory';
import {
  TopSubcategory,
  BottomSubcategory,
  DressSubcategory,
  ShoeSubcategory,
} from '../value-objects/GarmentSubcategory';
import { Occasion } from '../value-objects/Occasion';
import { Season } from '../value-objects/Season';
import { StylePreference } from '../value-objects/StylePreference';
import { makeGarment, color } from '../../__fixtures__/testSupport';

describe('Garment', () => {
  it('rejects an invalid subcategory for the category', () => {
    const r = Garment.create(toId('g1'), {
      name: 'Bad',
      category: GarmentCategory.Tops,
      subcategory: ShoeSubcategory.Boots,
      color: color('#000000'),
      seasons: [Season.AllSeason],
    });
    expect(r.ok).toBe(false);
  });

  it('requires a name and at least one season', () => {
    expect(
      Garment.create(toId('g2'), {
        name: '  ',
        category: GarmentCategory.Tops,
        subcategory: TopSubcategory.TShirt,
        color: color('#000000'),
        seasons: [Season.Summer],
      }).ok,
    ).toBe(false);
    expect(
      Garment.create(toId('g3'), {
        name: 'No season',
        category: GarmentCategory.Tops,
        subcategory: TopSubcategory.TShirt,
        color: color('#000000'),
        seasons: [],
      }).ok,
    ).toBe(false);
  });

  it('only counts as wearable when Available', () => {
    const g = makeGarment({ status: GarmentStatus.InLaundry });
    expect(g.isWearable).toBe(false);
    expect(g.changeStatus(GarmentStatus.Available).ok).toBe(true);
    expect(g.isWearable).toBe(true);
  });

  it('supports a season directly or via AllSeason', () => {
    const summer = makeGarment({ seasons: [Season.Summer] });
    expect(summer.supportsSeason(Season.Summer)).toBe(true);
    expect(summer.supportsSeason(Season.Winter)).toBe(false);
    const any = makeGarment({ seasons: [Season.AllSeason] });
    expect(any.supportsSeason(Season.Winter)).toBe(true);
  });

  it('tracks wear and rejects malformed dates', () => {
    const g = makeGarment();
    expect(g.markWorn('not-a-date').ok).toBe(false);
    unwrap(g.markWorn('2026-06-01'));
    expect(g.wearCount).toBe(1);
    expect(g.lastWornAt).toBe('2026-06-01');
  });
});

describe('Outfit', () => {
  const top = (): Garment => makeGarment({ category: GarmentCategory.Tops, subcategory: TopSubcategory.Shirt });
  const bottom = (): Garment =>
    makeGarment({ category: GarmentCategory.Bottoms, subcategory: BottomSubcategory.Trousers });
  const shoe = (): Garment =>
    makeGarment({ category: GarmentCategory.Shoes, subcategory: ShoeSubcategory.Loafers });
  const dress = (): Garment =>
    makeGarment({ category: GarmentCategory.Dresses, subcategory: DressSubcategory.Casual });

  const build = (garments: Garment[]) =>
    Outfit.create(toId('o1'), {
      name: 'Look',
      garments,
      occasion: Occasion.Business,
      season: Season.AllSeason,
      createdAt: '2026-06-01T08:00:00.000Z',
    });

  it('accepts a coherent top + bottom + shoes combination', () => {
    expect(build([top(), bottom(), shoe()]).ok).toBe(true);
  });

  it('rejects an empty outfit', () => {
    expect(build([]).ok).toBe(false);
  });

  it('rejects duplicate garments', () => {
    const t = top();
    expect(build([t, t]).ok).toBe(false);
  });

  it('rejects two garments in an exclusive slot', () => {
    expect(build([shoe(), shoe()]).ok).toBe(false);
  });

  it('rejects a dress combined with a separate top', () => {
    expect(build([dress(), top()]).ok).toBe(false);
  });

  it('validates and applies a rating', () => {
    const outfit = unwrap(build([dress(), shoe()]));
    expect(outfit.rate(150).ok).toBe(false);
    unwrap(outfit.rate(82));
    expect(outfit.rating).toBe(82);
  });
});

describe('UserProfile', () => {
  it('creates, renames and sets preferences', () => {
    const profile = unwrap(UserProfile.create(toId('u1'), { name: 'Ada' }));
    expect(profile.name).toBe('Ada');
    unwrap(profile.rename('Ada L.'));
    expect(profile.name).toBe('Ada L.');
    profile.setPreferences(unwrap(StylePreference.create({})));
    expect(profile.stylePreference).toBeDefined();
  });

  it('rejects an empty name', () => {
    expect(UserProfile.create(toId('u2'), { name: '' }).ok).toBe(false);
  });
});

describe('StyleRule', () => {
  it('fires only when all conditions match and it is enabled', () => {
    const rule = unwrap(
      StyleRule.create(toId('r1'), {
        name: 'Warm formal',
        condition: { occasions: [Occasion.Formal], seasons: [Season.Winter], maxTemperatureC: 10 },
        recommendation: { effect: RuleEffect.Require, message: 'Wear a coat' },
        priority: 10,
      }),
    );
    expect(
      rule.appliesTo({
        occasion: Occasion.Formal,
        season: Season.Winter,
        categories: [],
        subcategories: [],
        tags: [],
        temperatureC: 5,
      }),
    ).toBe(true);
    expect(
      rule.appliesTo({
        occasion: Occasion.Casual,
        season: Season.Winter,
        categories: [],
        subcategories: [],
        tags: [],
        temperatureC: 5,
      }),
    ).toBe(false);
    rule.disable();
    expect(
      rule.appliesTo({
        occasion: Occasion.Formal,
        season: Season.Winter,
        categories: [],
        subcategories: [],
        tags: [],
        temperatureC: 5,
      }),
    ).toBe(false);
  });
});

describe('WardrobeCollection', () => {
  it('adds garments uniquely and removes them', () => {
    const c = unwrap(WardrobeCollection.create(toId('c1'), { name: 'Capsule' }));
    c.addGarment(toId('g1'));
    c.addGarment(toId('g1'));
    expect(c.garmentIds).toHaveLength(1);
    c.removeGarment(toId('g1'));
    expect(c.garmentIds).toHaveLength(0);
  });
});

describe('CalendarEvent', () => {
  it('validates the date and tracks suggestions', () => {
    expect(
      CalendarEvent.create(toId('e1'), { title: 'Gala', date: '2026-13-40', occasion: Occasion.Formal }).ok,
    ).toBe(false);
    const event = unwrap(
      CalendarEvent.create(toId('e2'), {
        title: 'Gala',
        date: '2026-12-31',
        occasion: Occasion.Formal,
        dressCode: DressCode.BlackTie,
      }),
    );
    event.suggestOutfit(toId('o1'));
    event.suggestOutfit(toId('o1'));
    expect(event.suggestedOutfitIds).toHaveLength(1);
  });
});

describe('Wardrobe aggregate', () => {
  it('enforces unique garments and prunes collections on removal', () => {
    const wardrobe = Wardrobe.create(toId('w1'), toId('u1'));
    const shirt = makeGarment({ id: 'gw1' });
    expect(wardrobe.addGarment(shirt).ok).toBe(true);
    expect(wardrobe.addGarment(shirt).ok).toBe(false); // duplicate

    const collection = unwrap(
      WardrobeCollection.create(toId('cw1'), { name: 'Set', garmentIds: [toId('gw1')] }),
    );
    expect(wardrobe.addCollection(collection).ok).toBe(true);

    unwrap(wardrobe.removeGarment(toId('gw1')));
    expect(wardrobe.getCollection(toId('cw1'))?.garmentIds).toHaveLength(0);
  });

  it('refuses a collection that references missing garments', () => {
    const wardrobe = Wardrobe.create(toId('w2'), toId('u1'));
    const collection = unwrap(
      WardrobeCollection.create(toId('cw2'), { name: 'Ghost', garmentIds: [toId('missing')] }),
    );
    expect(wardrobe.addCollection(collection).ok).toBe(false);
  });
});
