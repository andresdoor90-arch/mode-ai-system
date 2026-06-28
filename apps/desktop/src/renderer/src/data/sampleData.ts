/**
 * Sample data for the Phase 4 UI.
 *
 * The desktop main process seeds a real wardrobe through the application layer,
 * so the wired screens (Dashboard, Wardrobe, Garments) display live data over
 * IPC. This module provides realistic fallback/illustrative content for screens
 * whose full functionality arrives in later phases (history, profile) and as a
 * graceful fallback when the IPC bridge is unavailable (e.g. a browser preview).
 *
 * It is sample *content*, never throwaway UI: the visual structure it feeds is
 * the definitive design.
 */
import type { GarmentDTO, OutfitDTO } from '@shared/ipc';

function g(partial: Partial<GarmentDTO> & Pick<GarmentDTO, 'id' | 'name' | 'category' | 'subcategory'>): GarmentDTO {
  return {
    color: { hex: '#334155', name: 'Slate', category: 'cool', isNeutral: false },
    brand: null,
    seasons: ['all-season'],
    images: [],
    tags: [],
    status: 'available',
    wearCount: 0,
    lastWornAt: null,
    ...partial,
  };
}

export const sampleGarments: GarmentDTO[] = [
  g({ id: 's1', name: 'Oxford Cotton Shirt', category: 'tops', subcategory: 'shirt', brand: 'Atelier', color: { hex: '#1d3f72', name: 'Navy', category: 'cool', isNeutral: false }, tags: ['work', 'classic'], wearCount: 18, lastWornAt: '2026-06-22' }),
  g({ id: 's2', name: 'Merino Crew Sweater', category: 'tops', subcategory: 'sweater', brand: 'NordKnit', color: { hex: '#6b705c', name: 'Sage', category: 'warm', isNeutral: false }, seasons: ['autumn', 'winter'], tags: ['cozy'], wearCount: 9, lastWornAt: '2026-05-30' }),
  g({ id: 's3', name: 'Linen Tee', category: 'tops', subcategory: 't-shirt', color: { hex: '#f2f0e6', name: 'Ivory', category: 'neutral', isNeutral: true }, seasons: ['spring', 'summer'], tags: ['casual'], wearCount: 24, lastWornAt: '2026-06-28' }),
  g({ id: 's4', name: 'Tailored Wool Trousers', category: 'bottoms', subcategory: 'trousers', brand: 'Atelier', color: { hex: '#3a3a3a', name: 'Charcoal', category: 'neutral', isNeutral: true }, tags: ['work'], wearCount: 14, lastWornAt: '2026-06-20' }),
  g({ id: 's5', name: 'Slim Indigo Jeans', category: 'bottoms', subcategory: 'jeans', color: { hex: '#2a3b55', name: 'Indigo', category: 'cool', isNeutral: false }, tags: ['casual', 'everyday'], wearCount: 31, lastWornAt: '2026-06-27' }),
  g({ id: 's6', name: 'Wool Overcoat', category: 'outerwear', subcategory: 'coat', brand: 'NordKnit', color: { hex: '#4a3b2f', name: 'Camel', category: 'warm', isNeutral: false }, seasons: ['winter'], tags: ['warm'], wearCount: 6, lastWornAt: '2026-02-11' }),
  g({ id: 's7', name: 'Structured Blazer', category: 'outerwear', subcategory: 'blazer', brand: 'Atelier', color: { hex: '#23262b', name: 'Onyx', category: 'neutral', isNeutral: true }, tags: ['work', 'formal'], wearCount: 11, lastWornAt: '2026-06-18' }),
  g({ id: 's8', name: 'Leather Derby Shoes', category: 'shoes', subcategory: 'dress-shoes', color: { hex: '#3b2417', name: 'Cognac', category: 'warm', isNeutral: false }, tags: ['work', 'formal'], wearCount: 16, lastWornAt: '2026-06-20' }),
  g({ id: 's9', name: 'Canvas Sneakers', category: 'shoes', subcategory: 'sneakers', color: { hex: '#e9e9e9', name: 'Off-white', category: 'neutral', isNeutral: true }, seasons: ['spring', 'summer'], tags: ['casual'], wearCount: 28, lastWornAt: '2026-06-26' }),
  g({ id: 's10', name: 'Wrap Day Dress', category: 'dresses', subcategory: 'casual-dress', brand: 'Lumière', color: { hex: '#2f6b5e', name: 'Emerald', category: 'cool', isNeutral: false }, seasons: ['spring', 'summer'], tags: ['date', 'party'], wearCount: 7, lastWornAt: '2026-06-12' }),
  g({ id: 's11', name: 'Pleated Midi Skirt', category: 'bottoms', subcategory: 'skirt', color: { hex: '#7a2e3b', name: 'Burgundy', category: 'warm', isNeutral: false }, seasons: ['autumn'], tags: ['date'], wearCount: 4, lastWornAt: '2026-04-09', status: 'in-laundry' }),
  g({ id: 's12', name: 'Silk Pocket Square', category: 'accessories', subcategory: 'scarf', color: { hex: '#b08968', name: 'Bronze', category: 'warm', isNeutral: false }, tags: ['formal'], wearCount: 3, lastWornAt: '2026-06-18' }),
];

export const sampleOutfitHistory: OutfitDTO[] = [
  {
    id: 'o1',
    name: 'Monday Boardroom',
    garments: [sampleGarments[0]!, sampleGarments[3]!, sampleGarments[7]!, sampleGarments[6]!],
    occasion: 'business',
    season: 'all-season',
    rating: 92,
    notes: 'Sharp, reliable. Navy + charcoal never misses.',
    createdAt: '2026-06-22T08:10:00.000Z',
  },
  {
    id: 'o2',
    name: 'Weekend Market Run',
    garments: [sampleGarments[2]!, sampleGarments[4]!, sampleGarments[8]!],
    occasion: 'casual',
    season: 'summer',
    rating: 84,
    notes: 'Breezy and comfortable.',
    createdAt: '2026-06-26T10:30:00.000Z',
  },
  {
    id: 'o3',
    name: 'Dinner Date',
    garments: [sampleGarments[9]!, sampleGarments[8]!],
    occasion: 'date',
    season: 'summer',
    rating: 88,
    notes: 'Emerald wrap dress, complimented all night.',
    createdAt: '2026-06-12T19:00:00.000Z',
  },
  {
    id: 'o4',
    name: 'Crisp Autumn Walk',
    garments: [sampleGarments[1]!, sampleGarments[4]!, sampleGarments[8]!],
    occasion: 'casual',
    season: 'autumn',
    rating: 79,
    notes: null,
    createdAt: '2026-05-30T15:45:00.000Z',
  },
];

/** Human labels for the canonical garment categories used by the nav/filters. */
export const CATEGORY_LABELS: ReadonlyArray<{ id: string; label: string; description: string }> = [
  { id: 'tops', label: 'Tops', description: 'Shirts, tees, sweaters and blouses' },
  { id: 'bottoms', label: 'Bottoms', description: 'Trousers, jeans, skirts and shorts' },
  { id: 'dresses', label: 'Dresses', description: 'Day dresses, gowns and jumpsuits' },
  { id: 'outerwear', label: 'Outerwear', description: 'Coats, blazers, jackets and cardigans' },
  { id: 'shoes', label: 'Shoes', description: 'Sneakers, boots, heels and loafers' },
  { id: 'accessories', label: 'Accessories', description: 'Belts, scarves, bags and jewellery' },
];

/** Illustrative profile shown on the Profile screen until profiles are wired. */
export const sampleProfile = {
  name: 'Alex Rivera',
  handle: '@alex.style',
  joinedAt: '2026-01-15',
  preferredColors: ['Navy', 'Charcoal', 'Emerald', 'Camel'],
  styleKeywords: ['Minimal', 'Tailored', 'Smart-casual'],
  measurements: { height: '178 cm', chest: '98 cm', waist: '82 cm' },
} as const;
