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

/**
 * A single garment, flattened to the plain attributes an LLM needs to reason
 * about an outfit. Built by the orchestrator from the eligible inventory and
 * handed to an {@link IOutfitPlanner}; it carries the garment `id` so the
 * planner's choices can be validated back against the real wardrobe.
 */
export interface PlannerGarment {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly subcategory: string;
  /** Human colour name when known (e.g. "azul marino"). */
  readonly colorName: string;
  readonly colorHex: string;
  /** Formality on the 0–10 domain scale. */
  readonly formality: number;
  /** Structural body zone (LayerSlot value). */
  readonly layerSlot: string;
  readonly seasons: readonly string[];
  /**
   * Base64 of the garment's thumbnail, when available. Lets a multimodal planner
   * actually SEE the garment (colour, pattern, cut) instead of relying on text
   * alone. Absent ⇒ the planner reasons from the textual attributes only.
   */
  readonly imageBase64?: string;
}

/**
 * Loads the bytes of a stored image as base64, by its opaque storage key.
 * Supplied by infrastructure (it owns file storage); the orchestrator uses it to
 * attach garment thumbnails to the planner catalog. Returns `null` when the
 * image is missing/unreadable so planning degrades to text-only gracefully.
 */
export type GarmentImageLoader = (storageKey: string) => Promise<string | null>;

/**
 * The interpreted context handed to an {@link IOutfitPlanner}. Mirrors the
 * fields M-A-S already derives from the user's message so the model reasons
 * with the same understanding the rules use.
 */
export interface PlannerContext {
  /** The user's original free-text message. */
  readonly message: string;
  readonly occasion: string;
  readonly season: string;
  /** Target formality 0–10 implied by the occasion. */
  readonly targetFormality: number;
  /** Short weather hint when known (e.g. "caluroso", "frío"). */
  readonly weather?: string;
  readonly timeOfDay?: string;
  readonly activity?: string;
}

/**
 * One outfit the planner proposes: the chosen garment ids (which the
 * orchestrator validates against the wardrobe) plus a natural-language
 * explanation. `kind` is a free label the orchestrator maps to a recommendation
 * role; unknown/missing kinds are assigned by order.
 */
export interface PlannedOutfit {
  readonly kind: string;
  readonly garmentIds: readonly string[];
  readonly explanation: string;
}

/**
 * Provider-agnostic OUTFIT PLANNING port — the seam that lets a real LLM make
 * the styling DECISION (which garments to wear) and explain it, instead of the
 * domain rules. The orchestrator uses it ONLY when available and ALWAYS
 * validates the returned ids against the real wardrobe and re-scores the chosen
 * outfit with the domain scorer; when the planner is unavailable or returns
 * nothing usable, the orchestrator falls back to its rule-based selection. This
 * keeps the LLM in charge of taste while the domain stays in charge of truth.
 */
export interface IOutfitPlanner {
  readonly id: string;
  /** Whether the planner (model) is reachable/installed right now. */
  isAvailable(): Promise<boolean>;
  /** Propose up to three outfits for the context, choosing from the catalog. */
  plan(
    context: PlannerContext,
    catalog: readonly PlannerGarment[],
  ): Promise<readonly PlannedOutfit[]>;
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
