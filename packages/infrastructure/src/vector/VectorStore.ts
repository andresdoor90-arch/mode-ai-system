/**
 * Provider-agnostic vector store port.
 *
 * This is storage/search plumbing only — upsert vectors, query by similarity,
 * delete by id. It contains **no** recommendation logic: deciding what to embed
 * or how to interpret results is the job of higher layers (a later phase). The
 * port lets ChromaDB be swapped for any other vector database (or the bundled
 * in-memory implementation) without touching callers.
 */

/** A stored vector record with arbitrary metadata. */
export interface VectorRecord {
  readonly id: string;
  readonly vector: readonly number[];
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

/** A single similarity-search hit. */
export interface VectorQueryResult {
  readonly id: string;
  /** Similarity score in [0, 1]; higher is more similar (cosine-based). */
  readonly score: number;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

/** Options for a similarity query. */
export interface VectorQueryOptions {
  /** Maximum number of hits to return. */
  readonly topK?: number;
  /** Exact-match metadata filter; only records matching all entries are eligible. */
  readonly filter?: Readonly<Record<string, string | number | boolean>>;
}

/** The vector store contract. */
export interface IVectorStore {
  /** Insert or replace one or more records. */
  upsert(records: readonly VectorRecord[]): Promise<void>;
  /** Find the records most similar to a query vector. */
  query(vector: readonly number[], options?: VectorQueryOptions): Promise<readonly VectorQueryResult[]>;
  /** Delete records by id. */
  delete(ids: readonly string[]): Promise<void>;
  /** Number of stored records. */
  count(): Promise<number>;
}

/** Cosine similarity of two equal-length vectors, in [-1, 1]. */
export const cosineSimilarity = (a: readonly number[], b: readonly number[]): number => {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    magA += x * x;
    magB += y * y;
  }
  if (magA === 0 || magB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};
