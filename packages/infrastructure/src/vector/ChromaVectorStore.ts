import { VectorStoreError, wrapAsync } from '../errors/InfrastructureError';
import {
  type IVectorStore,
  type VectorQueryOptions,
  type VectorQueryResult,
  type VectorRecord,
} from './VectorStore';

/**
 * Structural shape of a ChromaDB collection. Declared here so the adapter
 * type-checks without the `chromadb` package installed; the real client is
 * wired in by {@link createChromaVectorStore} (which dynamically imports the
 * package at runtime / in CI).
 */
export interface ChromaCollectionLike {
  add(args: {
    ids: string[];
    embeddings: number[][];
    metadatas?: Array<Record<string, string | number | boolean>>;
  }): Promise<unknown>;
  upsert?(args: {
    ids: string[];
    embeddings: number[][];
    metadatas?: Array<Record<string, string | number | boolean>>;
  }): Promise<unknown>;
  query(args: {
    queryEmbeddings: number[][];
    nResults?: number;
    where?: Record<string, string | number | boolean>;
  }): Promise<{
    ids: string[][];
    distances?: Array<Array<number>> | null;
    metadatas?: Array<Array<Record<string, string | number | boolean> | null>> | null;
  }>;
  delete(args: { ids: string[] }): Promise<unknown>;
  count(): Promise<number>;
}

/**
 * ChromaDB-backed {@link IVectorStore} adapter.
 *
 * Wraps an injected Chroma collection handle and translates between the
 * provider-agnostic port and Chroma's API. Distances are converted to a [0, 1]
 * similarity score (assuming a cosine collection). No recommendation logic
 * lives here — it is pure storage/search plumbing.
 */
export class ChromaVectorStore implements IVectorStore {
  public constructor(private readonly collection: ChromaCollectionLike) {}

  public async upsert(records: readonly VectorRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }
    const ids = records.map((r) => r.id);
    const embeddings = records.map((r) => [...r.vector]);
    const metadatas = records.map((r) => ({ ...(r.metadata ?? {}) }));
    await wrapAsync(
      async () => {
        const args = { ids, embeddings, metadatas };
        if (typeof this.collection.upsert === 'function') {
          await this.collection.upsert(args);
        } else {
          await this.collection.add(args);
        }
      },
      (cause) => new VectorStoreError('ChromaDB upsert failed.', cause),
    );
  }

  public async query(
    vector: readonly number[],
    options: VectorQueryOptions = {},
  ): Promise<readonly VectorQueryResult[]> {
    return wrapAsync(
      async () => {
        const response = await this.collection.query({
          queryEmbeddings: [[...vector]],
          nResults: options.topK ?? 10,
          ...(options.filter !== undefined ? { where: { ...options.filter } } : {}),
        });
        const ids = response.ids[0] ?? [];
        const distances = response.distances?.[0] ?? [];
        const metadatas = response.metadatas?.[0] ?? [];
        return ids.map((id, i): VectorQueryResult => {
          const distance = distances[i] ?? 1;
          const metadata = metadatas[i] ?? undefined;
          return {
            id,
            // Cosine distance in [0, 2] → similarity in [0, 1].
            score: Math.max(0, 1 - distance / 2),
            ...(metadata ? { metadata } : {}),
          };
        });
      },
      (cause) => new VectorStoreError('ChromaDB query failed.', cause),
    );
  }

  public async delete(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await wrapAsync(
      async () => {
        await this.collection.delete({ ids: [...ids] });
      },
      (cause) => new VectorStoreError('ChromaDB delete failed.', cause),
    );
  }

  public async count(): Promise<number> {
    return wrapAsync(
      async () => this.collection.count(),
      (cause) => new VectorStoreError('ChromaDB count failed.', cause),
    );
  }
}

/** Options for connecting to an embedded/local ChromaDB instance. */
export interface ChromaConnectionOptions {
  readonly path?: string;
  readonly collectionName: string;
  readonly metric?: string;
}

/**
 * Create a {@link ChromaVectorStore} backed by a real ChromaDB client. The
 * `chromadb` package is imported lazily via a computed specifier so this module
 * has no static dependency on it and builds offline.
 */
export const createChromaVectorStore = async (
  options: ChromaConnectionOptions,
): Promise<ChromaVectorStore> => {
  return wrapAsync(
    async () => {
      const specifier = 'chromadb';
      const mod = (await import(specifier)) as {
        ChromaClient: new (config?: { path?: string }) => {
          getOrCreateCollection(args: {
            name: string;
            metadata?: Record<string, unknown>;
          }): Promise<ChromaCollectionLike>;
        };
      };
      const client = new mod.ChromaClient(options.path !== undefined ? { path: options.path } : {});
      const collection = await client.getOrCreateCollection({
        name: options.collectionName,
        metadata: { 'hnsw:space': options.metric ?? 'cosine' },
      });
      return new ChromaVectorStore(collection);
    },
    (cause) => new VectorStoreError('Failed to initialise ChromaDB vector store.', cause),
  );
};
