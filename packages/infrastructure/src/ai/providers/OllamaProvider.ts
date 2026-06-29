import {
  type ChatMessage,
  type EmbeddingOptions,
  type EmbeddingResult,
  type TextCompletionOptions,
  type TextCompletionResult,
} from '../AIProvider';
import { BaseAIProvider, type BaseProviderConfig } from '../BaseAIProvider';
import { OllamaClient, type OllamaFetch } from '../OllamaClient';

/**
 * Adapter for a local Ollama instance.
 *
 * Implements real text completion (`/api/chat`) and embeddings
 * (`/api/embeddings`) through the transport-only {@link OllamaClient}. It carries
 * no prompts or recommendation logic — the orchestrator supplies the messages.
 * `isAvailable()` probes the server so the engine degrades to its offline rules
 * when Ollama is not running.
 */
export class OllamaProvider extends BaseAIProvider {
  private readonly client: OllamaClient;

  public constructor(
    config: Partial<BaseProviderConfig> & {
      baseUrl: string;
      timeoutMs?: number;
      fetchImpl?: OllamaFetch;
    },
  ) {
    super({
      id: 'ollama',
      apiKey: null,
      defaultTextModel: 'llama3.1',
      defaultEmbeddingModel: 'nomic-embed-text',
      embeddingDimension: 768,
      ...config,
    });
    this.client = new OllamaClient({
      baseUrl: config.baseUrl,
      ...(config.timeoutMs !== undefined ? { timeoutMs: config.timeoutMs } : {}),
      ...(config.fetchImpl !== undefined ? { fetchImpl: config.fetchImpl } : {}),
    });
  }

  public override async complete(
    messages: readonly ChatMessage[],
    options?: TextCompletionOptions,
  ): Promise<TextCompletionResult> {
    const model = options?.model ?? this.config.defaultTextModel;
    const result = await this.client.chat({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
    });
    return { text: result.content, model: result.model, tokensUsed: null };
  }

  public override async embed(
    inputs: readonly string[],
    options?: EmbeddingOptions,
  ): Promise<EmbeddingResult> {
    const model = options?.model ?? this.config.defaultEmbeddingModel;
    const vectors = await this.client.embed(model, inputs);
    const dimension = vectors[0]?.length ?? this.config.embeddingDimension;
    return { vectors, model, dimension };
  }

  public override async isAvailable(): Promise<boolean> {
    return this.client.isReachable();
  }
}
