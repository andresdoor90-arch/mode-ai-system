/**
 * AI provider abstractions (ports).
 *
 * Provider-agnostic contracts for text/chat completion and embeddings, plus the
 * value types they exchange. These interfaces let OpenAI, Anthropic, Ollama or
 * any future provider be plugged in behind a stable surface. They contain **no**
 * prompts, no recommendation logic and no model calls — only the contract. The
 * concrete adapters in `./providers` are scaffolding/stubs that a later phase
 * fills in.
 */

/** A single chat message. */
export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/** Options accepted by a text/chat completion request. */
export interface TextCompletionOptions {
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  /** Stop sequences that end generation. */
  readonly stop?: readonly string[];
}

/** Result of a text/chat completion. */
export interface TextCompletionResult {
  readonly text: string;
  readonly model: string;
  readonly tokensUsed: number | null;
}

/** Provider-agnostic text/chat completion contract. */
export interface IAITextProvider {
  /** Stable provider identifier (e.g. `ollama`, `openai`). */
  readonly id: string;
  /** Generate a completion for a sequence of chat messages. */
  complete(
    messages: readonly ChatMessage[],
    options?: TextCompletionOptions,
  ): Promise<TextCompletionResult>;
  /** Whether the provider is reachable/configured. */
  isAvailable(): Promise<boolean>;
}

/** Options accepted by an embedding request. */
export interface EmbeddingOptions {
  readonly model?: string;
}

/** Result of an embedding request: one vector per input. */
export interface EmbeddingResult {
  readonly vectors: readonly (readonly number[])[];
  readonly model: string;
  readonly dimension: number;
}

/** Provider-agnostic embedding contract. */
export interface IEmbeddingProvider {
  readonly id: string;
  /** Produce embedding vectors for one or more input texts. */
  embed(inputs: readonly string[], options?: EmbeddingOptions): Promise<EmbeddingResult>;
  /** The dimensionality of vectors this provider emits. */
  readonly dimension: number;
}
