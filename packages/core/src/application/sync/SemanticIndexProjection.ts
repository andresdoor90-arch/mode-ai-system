/**
 * Default semantic-index projection.
 *
 * Implements {@link ISemanticIndexProjection} on top of the existing
 * provider-agnostic {@link IEmbedder} + {@link IVectorIndex} ports (the very
 * same seams the AI orchestrator uses). When a garment changes, its search text
 * is embedded and upserted; when it is removed/archived, its vector is deleted.
 * Fully offline with the deterministic hashing embedder + in-memory index.
 */
import { type GarmentId } from '../../shared/Identifier';
import { type GarmentSnapshot } from '../../domain/events/wardrobeEvents';
import { type Garment } from '../../domain/entities/Garment';
import { type IEmbedder, type IVectorIndex } from '../orchestration/ports';
import { type ISemanticIndexProjection } from './ports';

/** Build the canonical search/embedding text for a garment. */
export const garmentSearchText = (garment: Garment): string =>
  [
    garment.name,
    garment.category,
    garment.subcategory,
    garment.brand ?? '',
    garment.material ?? '',
    garment.color.name ?? '',
    garment.color.category,
    ...garment.tags,
  ]
    .filter((p) => p.length > 0)
    .join(' ');

export class SemanticIndexProjection implements ISemanticIndexProjection {
  public constructor(
    private readonly embedder: IEmbedder,
    private readonly vectorIndex: IVectorIndex,
  ) {}

  public async index(snapshot: GarmentSnapshot): Promise<void> {
    const text = snapshot.searchText.trim();
    if (text.length === 0) {
      return;
    }
    const { vectors } = await this.embedder.embed([text]);
    await this.vectorIndex.upsert([
      {
        id: snapshot.id,
        vector: vectors[0] ?? [],
        metadata: {
          category: snapshot.category,
          subcategory: snapshot.subcategory,
          status: snapshot.status,
        },
      },
    ]);
  }

  public async remove(garmentId: GarmentId): Promise<void> {
    await this.vectorIndex.delete([garmentId]);
  }
}
