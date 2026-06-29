import { BaseAIProvider, type BaseProviderConfig } from '../BaseAIProvider';

/**
 * Adapter scaffold for a local Ollama instance.
 *
 * Only the contract/configuration is provided here; the actual HTTP calls to
 * the Ollama REST API (`/api/chat`, `/api/embeddings`) are implemented in the
 * AI-engine phase. This keeps infrastructure free of prompts and model logic.
 */
export class OllamaProvider extends BaseAIProvider {
  public constructor(config: Partial<BaseProviderConfig> & { baseUrl: string }) {
    super({
      id: 'ollama',
      apiKey: null,
      defaultTextModel: 'llama3.1',
      defaultEmbeddingModel: 'nomic-embed-text',
      embeddingDimension: 768,
      ...config,
    });
  }
}
