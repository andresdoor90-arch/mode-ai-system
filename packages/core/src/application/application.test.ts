import { describe, it, expect, beforeEach } from 'vitest';

import { toId, type GarmentId } from '../shared/Identifier';
import { unwrap } from '../shared/Result';
import { GarmentCategory } from '../domain/value-objects/GarmentCategory';
import {
  TopSubcategory,
  BottomSubcategory,
  ShoeSubcategory,
} from '../domain/value-objects/GarmentSubcategory';
import { Occasion } from '../domain/value-objects/Occasion';
import { Season } from '../domain/value-objects/Season';
import { UserProfile } from '../domain/entities/UserProfile';
import { StylePreference } from '../domain/value-objects/StylePreference';

import { CommandBus } from './bus/CommandBus';
import { QueryBus } from './bus/QueryBus';
import { MessageBus } from './bus/MessageBus';
import { ValidationMiddleware } from './bus/ValidationMiddleware';
import type { Command } from './bus/types';

import {
  AddGarmentCommand,
  AddGarmentHandler,
  ADD_GARMENT,
  RemoveGarmentCommand,
  RemoveGarmentHandler,
  REMOVE_GARMENT,
} from './commands/garmentCommands';
import {
  CreateOutfitCommand,
  CreateOutfitHandler,
  CREATE_OUTFIT,
  RateOutfitCommand,
  RateOutfitHandler,
  RATE_OUTFIT,
} from './commands/outfitCommands';
import {
  CreateCollectionCommand,
  CreateCollectionHandler,
  CREATE_COLLECTION,
} from './commands/collectionCommands';
import {
  SetPreferencesCommand,
  SetPreferencesHandler,
  SET_PREFERENCES,
} from './commands/profileCommands';
import {
  GetWardrobeQuery,
  GetWardrobeHandler,
  GET_WARDROBE,
  GetGarmentsByCategoryQuery,
  GetGarmentsByCategoryHandler,
  GET_GARMENTS_BY_CATEGORY,
} from './queries/wardrobeQueries';
import {
  GetStyleAnalysisQuery,
  GetStyleAnalysisHandler,
  GET_STYLE_ANALYSIS,
  GetColorPaletteQuery,
  GetColorPaletteHandler,
  GET_COLOR_PALETTE,
} from './queries/styleQueries';
import {
  GetOutfitSuggestionsQuery,
  GetOutfitSuggestionsHandler,
  GET_OUTFIT_SUGGESTIONS,
} from './queries/suggestionQueries';

import {
  FakeIdGenerator,
  InMemoryGarmentRepository,
  InMemoryOutfitRepository,
  InMemoryCollectionRepository,
  InMemoryUserProfileRepository,
  color,
} from '../__fixtures__/testSupport';

const topInput = {
  name: 'Oxford shirt',
  category: GarmentCategory.Tops,
  subcategory: TopSubcategory.Shirt,
  color: color('#1d3f72', 'navy'),
  seasons: [Season.AllSeason],
};
const bottomInput = {
  name: 'Wool trousers',
  category: GarmentCategory.Bottoms,
  subcategory: BottomSubcategory.Trousers,
  color: color('#808080', 'gray'),
  seasons: [Season.AllSeason],
};
const shoesInput = {
  name: 'Leather loafers',
  category: GarmentCategory.Shoes,
  subcategory: ShoeSubcategory.Loafers,
  color: color('#222222', 'black'),
  seasons: [Season.AllSeason],
};

describe('MessageBus', () => {
  it('returns a HandlerNotFound error when nothing is registered', async () => {
    const bus = new MessageBus();
    const result = await bus.dispatch({ type: 'nope' });
    expect(result.ok).toBe(false);
  });

  it('refuses to register two handlers for the same type', () => {
    const bus = new MessageBus();
    const garments = new InMemoryGarmentRepository();
    const handler = new AddGarmentHandler(garments, new FakeIdGenerator());
    bus.register(ADD_GARMENT, handler);
    expect(() => bus.register(ADD_GARMENT, handler)).toThrow();
  });
});

describe('ValidationMiddleware', () => {
  it('short-circuits the chain when validation fails', async () => {
    const bus = new CommandBus();
    const garments = new InMemoryGarmentRepository();
    bus.use(
      new ValidationMiddleware()
        .register(ADD_GARMENT, (message: Command) => {
          // Reject everything to prove the handler is never reached.
          return { ok: false, error: new Error('blocked') as never };
        })
        .toMiddleware(),
    );
    bus.register(ADD_GARMENT, new AddGarmentHandler(garments, new FakeIdGenerator()));

    const result = await bus.send(new AddGarmentCommand(topInput));
    expect(result.ok).toBe(false);
    expect(await garments.count()).toBe(0);
  });
});

describe('garment + outfit command/query flow', () => {
  let commands: CommandBus;
  let queries: QueryBus;
  let garments: InMemoryGarmentRepository;
  let outfits: InMemoryOutfitRepository;
  let collections: InMemoryCollectionRepository;
  let profiles: InMemoryUserProfileRepository;
  let ids: FakeIdGenerator;

  beforeEach(() => {
    garments = new InMemoryGarmentRepository();
    outfits = new InMemoryOutfitRepository();
    collections = new InMemoryCollectionRepository();
    profiles = new InMemoryUserProfileRepository();
    ids = new FakeIdGenerator();

    commands = new CommandBus();
    commands.register(ADD_GARMENT, new AddGarmentHandler(garments, ids));
    commands.register(REMOVE_GARMENT, new RemoveGarmentHandler(garments));
    commands.register(CREATE_OUTFIT, new CreateOutfitHandler(garments, outfits, ids));
    commands.register(RATE_OUTFIT, new RateOutfitHandler(outfits));
    commands.register(CREATE_COLLECTION, new CreateCollectionHandler(garments, collections, ids));
    commands.register(SET_PREFERENCES, new SetPreferencesHandler(profiles));

    queries = new QueryBus();
    queries.register(GET_WARDROBE, new GetWardrobeHandler(garments, collections));
    queries.register(GET_GARMENTS_BY_CATEGORY, new GetGarmentsByCategoryHandler(garments));
    queries.register(GET_STYLE_ANALYSIS, new GetStyleAnalysisHandler(garments));
    queries.register(GET_COLOR_PALETTE, new GetColorPaletteHandler(garments, profiles));
    queries.register(
      GET_OUTFIT_SUGGESTIONS,
      new GetOutfitSuggestionsHandler(garments, profiles),
    );
  });

  const seedThree = async (): Promise<GarmentId[]> => {
    const a = unwrap(await commands.send(new AddGarmentCommand(topInput)));
    const b = unwrap(await commands.send(new AddGarmentCommand(bottomInput)));
    const c = unwrap(await commands.send(new AddGarmentCommand(shoesInput)));
    return [a, b, c];
  };

  it('adds garments and reads them back by category', async () => {
    await seedThree();
    expect(await garments.count()).toBe(3);
    const tops = unwrap(await queries.ask(new GetGarmentsByCategoryQuery(GarmentCategory.Tops)));
    expect(tops).toHaveLength(1);
  });

  it('rejects an invalid garment via the command', async () => {
    const result = await commands.send(
      new AddGarmentCommand({ ...topInput, subcategory: ShoeSubcategory.Boots }),
    );
    expect(result.ok).toBe(false);
  });

  it('creates and rates an outfit from existing garments', async () => {
    const [a, b, c] = await seedThree();
    const outfitId = unwrap(
      await commands.send(
        new CreateOutfitCommand({
          name: 'Work look',
          garmentIds: [a, b, c],
          occasion: Occasion.Business,
          season: Season.AllSeason,
          createdAt: '2026-06-01T08:00:00.000Z',
        }),
      ),
    );
    expect(await outfits.findById(outfitId)).not.toBeNull();

    const rated = await commands.send(new RateOutfitCommand({ outfitId, rating: 88 }));
    expect(rated.ok).toBe(true);
    expect((await outfits.findById(outfitId))?.rating).toBe(88);
  });

  it('fails to create an outfit referencing a missing garment', async () => {
    const result = await commands.send(
      new CreateOutfitCommand({
        name: 'Broken',
        garmentIds: [toId<'Garment'>('ghost')],
        occasion: Occasion.Casual,
        season: Season.AllSeason,
        createdAt: '2026-06-01T08:00:00.000Z',
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('removes a garment', async () => {
    const [a] = await seedThree();
    expect((await commands.send(new RemoveGarmentCommand(a))).ok).toBe(true);
    expect(await garments.count()).toBe(2);
    expect((await commands.send(new RemoveGarmentCommand(a))).ok).toBe(false);
  });

  it('creates a collection only when garments exist', async () => {
    const [a, b] = await seedThree();
    const ok = await commands.send(
      new CreateCollectionCommand({ name: 'Capsule', garmentIds: [a, b] }),
    );
    expect(ok.ok).toBe(true);
    const bad = await commands.send(
      new CreateCollectionCommand({ name: 'Bad', garmentIds: [toId<'Garment'>('ghost')] }),
    );
    expect(bad.ok).toBe(false);
  });

  it('returns the whole wardrobe', async () => {
    await seedThree();
    const view = unwrap(await queries.ask(new GetWardrobeQuery()));
    expect(view.garments).toHaveLength(3);
    expect(view.collections).toHaveLength(0);
  });

  it('analyses the wardrobe', async () => {
    await seedThree();
    const analysis = unwrap(await queries.ask(new GetStyleAnalysisQuery()));
    expect(analysis.totalGarments).toBe(3);
    expect(analysis.byCategory[GarmentCategory.Tops]).toBe(1);
    expect(analysis.averageFormality).toBeGreaterThan(0);
  });

  it('derives a colour palette from the wardrobe', async () => {
    await seedThree();
    const palette = unwrap(await queries.ask(new GetColorPaletteQuery()));
    expect(palette.colors).toHaveLength(4);
  });

  it('prefers a user-set palette is reflected via preferences flow', async () => {
    // Seed a current profile with preferences, then set new ones via command.
    await profiles.save(unwrap(UserProfile.create(toId('u1'), { name: 'Ada' })));
    const result = await commands.send(
      new SetPreferencesCommand({
        stylePreference: unwrap(StylePreference.create({ preferredColors: ['navy'] })),
      }),
    );
    expect(result.ok).toBe(true);
    expect((await profiles.getCurrent())?.stylePreference?.preferredColors).toContain('navy');
  });

  it('generates ranked outfit suggestions', async () => {
    await seedThree();
    const suggestions = unwrap(
      await queries.ask(
        new GetOutfitSuggestionsQuery({
          occasion: Occasion.Casual,
          season: Season.AllSeason,
          limit: 3,
        }),
      ),
    );
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.score).toBeGreaterThan(0);
    // Sorted descending by score.
    for (let i = 1; i < suggestions.length; i += 1) {
      expect(suggestions[i - 1]!.score).toBeGreaterThanOrEqual(suggestions[i]!.score);
    }
  });
});
