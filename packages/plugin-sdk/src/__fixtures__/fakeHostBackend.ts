/**
 * A fake {@link HostBackend} for offline tests.
 *
 * Stands in for the desktop host's real backing (which delegates to the
 * `@mas/core` CQRS buses). It serves a small fixed wardrobe of {@link GarmentView}s
 * and an in-memory plugin storage provider, so the host kernel can be exercised
 * end-to-end without Electron, the database or the application layer.
 */
import {
  InMemoryPluginStorageProvider,
  type GarmentView,
  type HostBackend,
  type PluginStorageApi,
  type RecommendationSummary,
} from '../index';

/** A few garment views the fake wardrobe serves. */
export const SAMPLE_GARMENT_VIEWS: readonly GarmentView[] = [
  {
    id: 'g1',
    name: 'Oxford Shirt',
    category: 'tops',
    subcategory: 'shirt',
    colorName: 'navy',
    tags: ['work', 'classic'],
    formality: 7,
  },
  {
    id: 'g2',
    name: 'Wool Trousers',
    category: 'bottoms',
    subcategory: 'trousers',
    colorName: 'charcoal',
    tags: ['work', 'tailored'],
    formality: 7,
  },
  {
    id: 'g3',
    name: 'Canvas Sneakers',
    category: 'shoes',
    subcategory: 'sneakers',
    colorName: 'white',
    tags: ['casual'],
    formality: 2,
  },
];

/** Build a fake backend; the storage provider is shared so tests can inspect it. */
export const createFakeHostBackend = (
  garments: readonly GarmentView[] = SAMPLE_GARMENT_VIEWS,
): { backend: HostBackend; storage: InMemoryPluginStorageProvider } => {
  const storage = new InMemoryPluginStorageProvider();
  const backend: HostBackend = {
    hostVersion: '0.7.0',
    sdkVersion: '0.7.0',
    listGarments: (): Promise<readonly GarmentView[]> => Promise.resolve(garments),
    getGarment: (id: string): Promise<GarmentView | null> =>
      Promise.resolve(garments.find((g) => g.id === id) ?? null),
    countGarments: (): Promise<number> => Promise.resolve(garments.length),
    requestRecommendations: (message: string): Promise<readonly RecommendationSummary[]> =>
      Promise.resolve([
        {
          kind: 'principal',
          label: 'Principal',
          score: 88,
          garmentIds: ['g1', 'g2'],
          explanation: `Stub recommendation for "${message}".`,
        },
      ]),
    storageFor: (pluginId: string): PluginStorageApi => storage.storageFor(pluginId),
  };
  return { backend, storage };
};
