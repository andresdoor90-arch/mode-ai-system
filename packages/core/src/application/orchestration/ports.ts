/**
 * Orchestration ports — the abstract seams the AI engine depends on.
 *
 * CORE ARCHITECTURAL MANDATE: all intelligence belongs to M-A-S; AI models are
 * merely interchangeable providers. The orchestrator and its cognitive
 * components live in `@mas/core` and must depend only on the domain plus these
 * abstract ports. They never import an AI SDK, a vector database, Electron,
 * Node or any concrete technology.
 *
 * These interfaces are intentionally *structurally* compatible with the
 * provider contracts declared in `@mas/infrastructure`
 * (`IAITextProvider`, `IEmbeddingProvider`, `IVectorStore`) so the existing
 * adapters satisfy them without any wrapper. Declaring them here — rather than
 * importing from infrastructure — keeps the dependency arrow pointing the right
 * way (infrastructure depends on core, never the reverse) and lets a provider
 * be swapped, added or removed without touching the orchestrator or the domain.
 */

/** A single chat message exchanged with a text provider. */
export interface OrchestratorChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/** Options for a text/chat completion request. */
export interface TextGenerationOptions {
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly stop?: readonly string[];
}

/** Result of a text/chat completion. */
export interface TextGenerationResult {
  readonly text: string;
  readonly model: string;
  readonly tokensUsed: number | null;
}

/**
 * Provider-agnostic text generation port. Used ONLY to phrase reasoning the
 * domain has already decided (explanations) or to disambiguate free-text input
 * — never to make a styling decision. Any concrete `IAITextProvider` from the
 * infrastructure layer is assignable to this port.
 */
export interface ITextProvider {
  readonly id: string;
  complete(
    messages: readonly OrchestratorChatMessage[],
    options?: TextGenerationOptions,
  ): Promise<TextGenerationResult>;
  /** Whether the provider is reachable/configured right now. */
  isAvailable(): Promise<boolean>;
}

/** Result of an embedding request: one vector per input. */
export interface EmbeddingVectorResult {
  readonly vectors: readonly (readonly number[])[];
  readonly model: string;
  readonly dimension: number;
}

/**
 * Provider-agnostic embedding port. Any concrete `IEmbeddingProvider` (incl.
 * the deterministic `HashingEmbeddingProvider`) is assignable to this port.
 */
export interface IEmbedder {
  readonly id: string;
  readonly dimension: number;
  embed(
    inputs: readonly string[],
    options?: { readonly model?: string },
  ): Promise<EmbeddingVectorResult>;
}

/** A stored vector with arbitrary metadata. */
export interface IndexedVector {
  readonly id: string;
  readonly vector: readonly number[];
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

/** A single similarity-search hit. */
export interface VectorHit {
  readonly id: string;
  /** Similarity score in [0, 1]; higher is more similar. */
  readonly score: number;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

/** Options for a similarity query. */
export interface VectorSearchOptions {
  readonly topK?: number;
  readonly filter?: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Provider-agnostic vector index port. Any concrete `IVectorStore`
 * (ChromaDB-backed or in-memory) is assignable to this port.
 */
export interface IVectorIndex {
  upsert(records: readonly IndexedVector[]): Promise<void>;
  query(vector: readonly number[], options?: VectorSearchOptions): Promise<readonly VectorHit[]>;
  delete(ids: readonly string[]): Promise<void>;
  count(): Promise<number>;
}

/**
 * Persistent preference-memory port. The Memory Engine's logic is pure; this
 * port is the ONLY way it reaches durable storage (a JSON file, the config
 * store, a repository...). When absent, the engine still works in-process but
 * its learning does not survive a restart.
 */
export interface IPreferenceMemoryStore {
  /** Load the persisted snapshot, or `null` on first run. */
  load(): Promise<PreferenceMemorySnapshot | null>;
  /** Persist the latest snapshot. */
  save(snapshot: PreferenceMemorySnapshot): Promise<void>;
}

/**
 * Durable, serialisable shape of everything the Memory Engine has learned.
 * Plain data only (no behaviour) so it round-trips cleanly through JSON.
 */
export interface PreferenceMemorySnapshot {
  readonly version: number;
  /** Learned affinity per colour name, roughly in [-1, 1]; positive = liked. */
  readonly colorAffinity: Readonly<Record<string, number>>;
  /** Learned affinity per garment subcategory, roughly in [-1, 1]. */
  readonly subcategoryAffinity: Readonly<Record<string, number>>;
  /** How many recommendations the user has accepted. */
  readonly acceptCount: number;
  /** How many recommendations the user has rejected. */
  readonly rejectCount: number;
  /** ISO timestamp of the last update, or `null` if never updated. */
  readonly updatedAt: string | null;
}

/** The empty starting point for preference memory. */
export const EMPTY_PREFERENCE_MEMORY: PreferenceMemorySnapshot = {
  version: 1,
  colorAffinity: {},
  subcategoryAffinity: {},
  acceptCount: 0,
  rejectCount: 0,
  updatedAt: null,
};
