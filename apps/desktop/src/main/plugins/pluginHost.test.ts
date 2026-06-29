import { generateKeyPairSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  Color,
  GarmentCategory,
  GetWardrobeHandler,
  GET_WARDROBE,
  Garment,
  QueryBus,
  Season,
  SequentialIdGenerator,
  TopSubcategory,
  unwrap,
} from '@mas/core';
import {
  ExtensionPointId,
  InProcessPluginSandbox,
  PERMISSIVE_SIGNATURE_POLICY,
  PluginLifecycleState,
  createInProcessSource,
  type PluginManifest,
  type PluginModule,
} from '@mas/plugin-sdk';

import {
  InMemoryCollectionRepository,
  InMemoryGarmentRepository,
} from '../container/inMemoryRepositories';
import { PluginHost, createCoreHostBackend, garmentToView } from './PluginHost';

/** A small, self-contained sample plugin for the desktop bridge test. */
const SAMPLE_PLUGIN_MANIFEST: PluginManifest = {
  id: 'studio.colorpalette',
  name: 'Color Palette Studio',
  version: '1.0.0',
  manifestSchemaVersion: 1,
  engines: { mas: '>=0.7.0 <1.0.0', sdk: '^0.7.0' },
  permissions: ['wardrobe:read', 'recommendation:contribute', 'import:provide', 'ui:contribute'],
  contributes: [
    ExtensionPointId.RecommendationRule,
    ExtensionPointId.Importer,
    ExtensionPointId.UiPanel,
  ],
};

const createSampleColorPalettePlugin = (): { module: PluginModule } => ({
  module: {
    async activate(context): Promise<void> {
      await context.host.wardrobe.listGarments();
      context.host.register({
        point: ExtensionPointId.RecommendationRule,
        ruleId: 'prefer-navy',
        description: 'Nudge toward navy + tailored.',
        weights: { colors: { navy: 0.6 }, tags: { tailored: 0.3 } },
      });
      context.host.register({
        point: ExtensionPointId.Importer,
        formatId: 'palette-csv',
        label: 'Palette CSV',
        extensions: ['.csv'],
        canImport: (name: string): boolean => name.endsWith('.csv'),
        import: (): Promise<readonly never[]> => Promise.resolve([]),
      });
      context.host.register({
        point: ExtensionPointId.UiPanel,
        panelId: 'color-palette-panel',
        title: 'Paleta de color',
        route: '/plugins/color-palette',
      });
    },
  },
});

const buildWardrobeQueryBus = async (): Promise<QueryBus> => {
  const ids = new SequentialIdGenerator('t');
  const garments = new InMemoryGarmentRepository();
  const collections = new InMemoryCollectionRepository();
  const navy = unwrap(
    Garment.create(ids.next<'Garment'>(), {
      name: 'Oxford Shirt',
      category: GarmentCategory.Tops,
      subcategory: TopSubcategory.Shirt,
      color: unwrap(Color.fromHex('#1d3f72', 'Navy')),
      seasons: [Season.AllSeason],
      tags: ['tailored'],
    }),
  );
  await garments.save(navy);
  const queries = new QueryBus();
  queries.register(GET_WARDROBE, new GetWardrobeHandler(garments, collections));
  return queries;
};

const activateSample = async (host: PluginHost): Promise<void> => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  void publicKey;
  const { module } = createSampleColorPalettePlugin();
  const source = createInProcessSource({
    manifest: SAMPLE_PLUGIN_MANIFEST,
    module,
    signing: { keyId: 'k', privateKey },
  });
  // Permissive policy so the locally-generated (untrusted) key is accepted.
  host.manager.discover(source);
  host.manager.install(SAMPLE_PLUGIN_MANIFEST.id);
  await host.manager.validate(SAMPLE_PLUGIN_MANIFEST.id);
  await host.manager.activate(SAMPLE_PLUGIN_MANIFEST.id);
};

describe('PluginHost (desktop bridge to the core CQRS bus)', () => {
  it('maps domain garments to read-only views through the query bus', async () => {
    const queries = await buildWardrobeQueryBus();
    const backend = createCoreHostBackend(queries);
    const views = await backend.listGarments();
    expect(views).toHaveLength(1);
    expect(views[0]?.colorName).toBe('Navy');
    expect(views[0]?.category).toBe(GarmentCategory.Tops);
    expect(await backend.countGarments()).toBe(1);
  });

  it('garmentToView preserves the fields plugins are allowed to read', async () => {
    const ids = new SequentialIdGenerator('t');
    const g = unwrap(
      Garment.create(ids.next<'Garment'>(), {
        name: 'Tee',
        category: GarmentCategory.Tops,
        subcategory: TopSubcategory.TShirt,
        color: unwrap(Color.fromHex('#ffffff', 'White')),
        seasons: [Season.Summer],
        tags: ['casual'],
      }),
    );
    const view = garmentToView(g);
    expect(view.name).toBe('Tee');
    expect(view.tags).toEqual(['casual']);
    expect(typeof view.formality).toBe('number');
  });

  it('surfaces a contributed declarative rule as the core additive bias', async () => {
    const queries = await buildWardrobeQueryBus();
    const host = new PluginHost({
      queries,
      sandbox: new InProcessPluginSandbox(),
      signaturePolicy: PERMISSIVE_SIGNATURE_POLICY,
    });
    await activateSample(host);
    expect(host.manager.stateOf(SAMPLE_PLUGIN_MANIFEST.id)).toBe(PluginLifecycleState.Active);

    const enrichment = host.rankingEnrichment();
    expect(enrichment.affinityBias).toBeDefined();

    const ids = new SequentialIdGenerator('b');
    const navyTailored = unwrap(
      Garment.create(ids.next<'Garment'>(), {
        name: 'Navy Blazer',
        category: GarmentCategory.Tops,
        subcategory: TopSubcategory.Shirt,
        color: unwrap(Color.fromHex('#1d3f72', 'Navy')),
        seasons: [Season.AllSeason],
        tags: ['tailored'],
      }),
    );
    expect(enrichment.affinityBias?.([navyTailored])).toBeGreaterThan(0);
  });

  it('exposes contributed importers and a UI panel for their seams', async () => {
    const queries = await buildWardrobeQueryBus();
    const host = new PluginHost({
      queries,
      sandbox: new InProcessPluginSandbox(),
      signaturePolicy: PERMISSIVE_SIGNATURE_POLICY,
    });
    await activateSample(host);
    expect(host.importers()).toHaveLength(1);
    expect(host.uiPanels()).toHaveLength(1);
    expect(host.uiPanels()[0]?.route).toBe('/plugins/color-palette');
  });

  it('text-provider router includes the base providers when no plugin adds one', async () => {
    const queries = await buildWardrobeQueryBus();
    const host = new PluginHost({
      queries,
      sandbox: new InProcessPluginSandbox(),
      signaturePolicy: PERMISSIVE_SIGNATURE_POLICY,
    });
    const router = host.textProviderRouter([]);
    expect(router.size).toBe(0);
  });
});
