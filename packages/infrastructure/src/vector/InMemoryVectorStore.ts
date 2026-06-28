import { VectorStoreError } from '../errors/InfrastructureError';
import {
  type IVectorStore,
  type VectorQueryOptions,
  type VectorQueryResult,
  type VectorRecord,
  cosineSimilarity,
} from './VectorStore';

/**
 * Brute-force, in-memory {@link IVectorStore}. Useful for tests, small data
 * sets and environments where the embedded ChromaDB native dependency is not
 * available. Scores are cosine similarity normalised into [0, 1].
 */
export class InMemoryVectorStore implements IVectorStore {
  private readonly records = new Map<string, VectorRecord>();
  private readonly dimension: number | null;

  /**
   * @param expectedDimension If set, upserts whose vector length differs are
   * rejected, mirroring a fixed-dimension collection.
   */
  public constructor(expectedDimension: number | null = null) {
    this.dimension = expectedDimension;
  }

  public async upsert(records: readonly VectorRecord[]): Promise<void> {
    for (const record of records) {
      if (this.dimension !== null && record.vector.length !== this.dimension) {
        throw new VectorStoreError(
          `Vector for "${record.id}" has dimension ${record.vector.length}, expected ${this.dimension}.`,
        );
      }
      this.records.set(record.id, {
        id: record.id,
        vector: [...record.vector],
        ...(record.metadata !== undefined ? { metadata: { ...record.metadata } } : {}),
      });
    }
  }

  public async query(
    vector: readonly number[],
    options: VectorQueryOptions = {},
  ): Promise<readonly VectorQueryResult[]> {
    const topK = options.topK ?? 10;
    const filter = options.filter;
    const hits: VectorQueryResult[] = [];
    for (const record of this.records.values()) {
      if (filter !== undefined && !matchesFilter(record, filter)) {
        continue;
      }
      const similarity = cosineSimilarity(vector, record.vector);
      hits.push({
        id: record.id,
        // Map cosine [-1, 1] onto [0, 1].
        score: (similarity + 1) / 2,
        ...(record.metadata !== undefined ? { metadata: record.metadata } : {}),
      });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, topK);
  }

  public async delete(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      this.records.delete(id);
    }
  }

  public async count(): Promise<number> {
    return this.records.size;
  }
}

const matchesFilter = (
  record: VectorRecord,
  filter: Readonly<Record<string, string | number | boolean>>,
): boolean => {
  const metadata = record.metadata ?? {};
  return Object.entries(filter).every(([key, value]) => metadata[key] === value);
};
