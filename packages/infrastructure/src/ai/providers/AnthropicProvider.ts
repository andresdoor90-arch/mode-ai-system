import { BaseAIProvider, type BaseProviderConfig } from '../BaseAIProvider';

/**
 * Adapter scaffold for Anthropic's API.
 *
 * Contract and configuration only. Anthropic has no first-party embeddings
 * endpoint, so the embedding model is left pointing at a placeholder and
 * embeddings are expected to be served by a different provider; the text
 * `messages` endpoint is implemented in a later phase.
 */
export class AnthropicProvider extends BaseAIProvider {
  public constructor(config: Partial<BaseProviderConfig> & { apiKey: string }) {
    super({
      id: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      defaultTextModel: 'claude-3-5-sonnet-latest',
      defaultEmbeddingModel: 'none',
      embeddingDimension: 0,
      ...config,
    });
  }
}
