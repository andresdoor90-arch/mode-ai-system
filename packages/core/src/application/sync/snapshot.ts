import { type Garment } from '../../domain/entities/Garment';
import { type GarmentSnapshot } from '../../domain/events/wardrobeEvents';
import { garmentSearchText } from './SemanticIndexProjection';

/** Build the light, serialisable snapshot carried on garment change events. */
export const buildGarmentSnapshot = (garment: Garment): GarmentSnapshot => ({
  id: garment.id,
  name: garment.name,
  category: garment.category,
  subcategory: garment.subcategory,
  categoryId: garment.categoryId,
  status: garment.status,
  tags: [...garment.tags],
  searchText: garmentSearchText(garment),
});
