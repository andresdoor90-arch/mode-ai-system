/**
 * Embedding Manager — semantic similarity over garments.
 *
 * Manages embeddings through the abstract {@link IEmbedder} and
 * {@link IVectorIndex} ports: it indexes garments as vectors and, given a
 * free-text query (the user's request), scores how semantically close each
 * garment is. Those scores feed an OPTIONAL, additive ranking boost.
 *
 * Everything is optional and degrades gracefully: with no embedder/index the
 * manager reports itself unavailable and contributes nothing, so the engine
 * still ranks purely on domain rules. With the deterministic
 * `HashingEmbeddingProvider` + in-memory index it runs fully offline.
 *
 * It contains NO business rules — a semantic boost can only re-order outfits
 * that already passed every hard domain rule; it can never resurrect a
 * disqualified outfit nor change a score's hard-rule outcome.
 */
import { type Garment } from '../../domain/entities/Garment';
import { type IEmbedder, type IVectorIndex } from './ports';

/** Build the text we embed for a garment (name + descriptive attributes). */
export const garmentEmbeddingText = (garment: Garment): string => {
  const parts = [
    garment.name,
    garment.category,
    garment.subcategory,
    garment.color.name ?? '',
    garment.color.category,
    ...garment.tags,
  ];
  return parts.filter((p) => p.length > 0).join(' ');
};

export class EmbeddingManager {
  public constructor(
    private readonly embedder?: IEmbedder,
    private readonly index?: IVectorIndex,
  ) {}

  /** Whether semantic ranking is wired (both an embedder and an index). */
  public get available(): boolean {
    return this.embedder !== undefined && this.index !== undefined;
  }

  /** Index (upsert) the given garments so they can be searched semantically. */
  public async indexGarments(garments: readonly Garment[]): Promise<void> {
    if (this.embedder === undefined || this.index === undefined || garments.length === 0) {
      return;
    }
    const texts = garments.map(garmentEmbeddingText);
    const { vectors } = await this.embedder.embed(texts);
    const records = garments.map((garment, i) => ({
      id: garment.id,
      vector: vectors[i] ?? [],
      metadata: {
        category: garment.category,
        subcategory: garment.subcategory,
        colorCategory: garment.color.category,
        status: garment.status,
      },
    }));
    await this.index.upsert(records);
  }

  /**
   * Return a garment-id → similarity-score map (in [0, 1]) for the query text.
   * Empty when the manager is unavailable, so callers can blend it
   * unconditionally without branching.
   */
  public async scoreByQuery(query: string, topK: number): Promise<ReadonlyMap<string, number>> {
    const scores = new Map<string, number>();
    if (this.embedder === undefined || this.index === undefined || query.trim().length === 0) {
      return scores;
    }
    const { vectors } = await this.embedder.embed([query]);
    const queryVector = vectors[0] ?? [];
    const hits = await this.index.query(queryVector, { topK: Math.max(1, topK) });
    for (const hit of hits) {
      scores.set(hit.id, hit.score);
    }
    return scores;
  }
}
