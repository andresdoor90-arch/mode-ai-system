import { BaseAIProvider, type BaseProviderConfig } from '../BaseAIProvider';

/**
 * Adapter scaffold for OpenAI's API.
 *
 * Contract and configuration only — request signing, the `chat/completions`
 * and `embeddings` endpoints and streaming are wired up in a later phase.
 */
export class OpenAIProvider extends BaseAIProvider {
  public constructor(config: Partial<BaseProviderConfig> & { apiKey: string }) {
    super({
      id: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      defaultTextModel: 'gpt-4o-mini',
      defaultEmbeddingModel: 'text-embedding-3-small',
      embeddingDimension: 1536,
      ...config,
    });
  }
}
