import { AIProviderError } from '../errors/InfrastructureError';
import {
  type ChatMessage,
  type EmbeddingOptions,
  type EmbeddingResult,
  type IAITextProvider,
  type IEmbeddingProvider,
  type TextCompletionOptions,
  type TextCompletionResult,
} from './AIProvider';

/** Shared configuration for HTTP-style AI providers. */
export interface BaseProviderConfig {
  readonly id: string;
  readonly baseUrl: string | null;
  readonly apiKey: string | null;
  readonly defaultTextModel: string;
  readonly defaultEmbeddingModel: string;
  readonly embeddingDimension: number;
}

/**
 * Base adapter scaffolding for AI providers.
 *
 * It holds common configuration and provides default implementations that throw
 * a clear {@link AIProviderError} ("not implemented") for the actual model
 * calls. Concrete providers (OpenAI/Anthropic/Ollama) extend this and override
 * `complete`/`embed` in a later phase — keeping this phase free of any real
 * model interaction or business logic.
 */
export abstract class BaseAIProvider implements IAITextProvider, IEmbeddingProvider {
  protected constructor(protected readonly config: BaseProviderConfig) {}

  public get id(): string {
    return this.config.id;
  }

  public get dimension(): number {
    return this.config.embeddingDimension;
  }

  public async complete(
    _messages: readonly ChatMessage[],
    _options?: TextCompletionOptions,
  ): Promise<TextCompletionResult> {
    throw new AIProviderError(
      `Provider "${this.config.id}" does not implement text completion yet.`,
    );
  }

  public async embed(
    _inputs: readonly string[],
    _options?: EmbeddingOptions,
  ): Promise<EmbeddingResult> {
    throw new AIProviderError(`Provider "${this.config.id}" does not implement embeddings yet.`);
  }

  public async isAvailable(): Promise<boolean> {
    return this.config.baseUrl !== null || this.config.apiKey !== null;
  }
}

/**
 * A deterministic, dependency-free embedding provider used for tests and for
 * environments without a real model. It hashes input text into a fixed-size
 * vector so the surrounding vector-store plumbing can be exercised end-to-end.
 * It carries no semantic meaning and no business logic.
 */
export class HashingEmbeddingProvider implements IEmbeddingProvider {
  public readonly id = 'hashing-stub';

  public constructor(public readonly dimension = 768) {}

  public async embed(
    inputs: readonly string[],
    _options?: EmbeddingOptions,
  ): Promise<EmbeddingResult> {
    const vectors = inputs.map((text) => this.hashToVector(text));
    return { vectors, model: this.id, dimension: this.dimension };
  }

  private hashToVector(text: string): number[] {
    const vector = new Array<number>(this.dimension).fill(0);
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      const slot = (code * 31 + i) % this.dimension;
      vector[slot] = (vector[slot] ?? 0) + ((code % 13) - 6) / 6;
    }
    // L2-normalise so cosine similarity is well-behaved.
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return magnitude === 0 ? vector : vector.map((v) => v / magnitude);
  }
}
