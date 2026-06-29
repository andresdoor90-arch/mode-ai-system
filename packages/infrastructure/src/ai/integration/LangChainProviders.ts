/**
 * LangChain-backed provider adapters (CI / online only).
 *
 * These adapters connect the abstract `IAITextProvider` / `IEmbeddingProvider`
 * ports to real models via LangChain.js. Every concrete SDK is imported
 * **lazily** through a dynamic `import()` inside a factory, so:
 *
 *   - nothing in this file is evaluated unless a real provider is actually
 *     requested at runtime, and
 *   - the rest of the engine remains fully type-checkable and runnable OFFLINE
 *     (the sandbox runs in `INTEGRATIONS_ONLY` mode where these packages cannot
 *     be installed from the registry).
 *
 * The packages below are pinned in `package.json`; their installation, type
 * resolution and any real model call are CI-deferred. NO business rule lives
 * here — these are pure transport adapters behind the existing ports.
 *
 * Pinned versions (see package.json):
 *   @langchain/core      ^0.3.18
 *   @langchain/openai    ^0.3.14
 *   @langchain/anthropic ^0.3.7
 *   @langchain/ollama    ^0.1.2
 */
import { AIProviderError } from '../../errors/InfrastructureError';
import { AIProviderKind } from '../../config/AppConfig';
import {
  type ChatMessage,
  type EmbeddingOptions,
  type EmbeddingResult,
  type IAITextProvider,
  type IEmbeddingProvider,
  type TextCompletionOptions,
  type TextCompletionResult,
} from '../AIProvider';

/**
 * Minimal structural shapes of the LangChain surfaces we use. Declaring them
 * locally means this module needs no `@types` from the (uninstallable-offline)
 * LangChain packages while still being precise about the calls we make.
 */
interface LcChatModel {
  invoke(messages: ReadonlyArray<readonly [string, string]>): Promise<{ content: unknown }>;
}
interface LcEmbeddings {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}
type LcChatCtor = new (config: Record<string, unknown>) => LcChatModel;
type LcEmbeddingsCtor = new (config: Record<string, unknown>) => LcEmbeddings;

/** Configuration accepted by the LangChain text provider factory. */
export interface LangChainTextConfig {
  readonly kind: AIProviderKind;
  readonly model: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
}

/** Configuration accepted by the LangChain embedding provider factory. */
export interface LangChainEmbeddingConfig {
  readonly kind: AIProviderKind;
  readonly model: string;
  readonly dimension: number;
  readonly apiKey?: string;
  readonly baseUrl?: string;
}

/** Map our role union onto LangChain's `[role, content]` message tuples. */
const toLcMessages = (messages: readonly ChatMessage[]): ReadonlyArray<readonly [string, string]> =>
  messages.map((m) => [m.role === 'assistant' ? 'ai' : m.role, m.content] as const);

const contentToString = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'string'
          ? part
          : typeof (part as { text?: unknown }).text === 'string'
            ? (part as { text: string }).text
            : '',
      )
      .join('');
  }
  return String(content ?? '');
};

/**
 * Lazily construct a chat model for the given provider kind. The dynamic
 * imports are the ONLY place a LangChain package is referenced; they resolve
 * only in an environment where the packages are installed (CI / production).
 */
const loadChatModel = async (config: LangChainTextConfig): Promise<LcChatModel> => {
  switch (config.kind) {
    case AIProviderKind.OpenAI: {
      const mod = (await import('@langchain/openai')) as unknown as { ChatOpenAI: LcChatCtor };
      return new mod.ChatOpenAI({
        model: config.model,
        apiKey: config.apiKey,
        ...(config.baseUrl !== undefined ? { configuration: { baseURL: config.baseUrl } } : {}),
      });
    }
    case AIProviderKind.Anthropic: {
      const mod = (await import('@langchain/anthropic')) as unknown as {
        ChatAnthropic: LcChatCtor;
      };
      return new mod.ChatAnthropic({ model: config.model, apiKey: config.apiKey });
    }
    case AIProviderKind.Ollama: {
      const mod = (await import('@langchain/ollama')) as unknown as { ChatOllama: LcChatCtor };
      return new mod.ChatOllama({
        model: config.model,
        ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}),
      });
    }
    default:
      throw new AIProviderError(`No LangChain chat model for provider "${config.kind}".`);
  }
};

const loadEmbeddings = async (config: LangChainEmbeddingConfig): Promise<LcEmbeddings> => {
  switch (config.kind) {
    case AIProviderKind.OpenAI: {
      const mod = (await import('@langchain/openai')) as unknown as {
        OpenAIEmbeddings: LcEmbeddingsCtor;
      };
      return new mod.OpenAIEmbeddings({ model: config.model, apiKey: config.apiKey });
    }
    case AIProviderKind.Ollama: {
      const mod = (await import('@langchain/ollama')) as unknown as {
        OllamaEmbeddings: LcEmbeddingsCtor;
      };
      return new mod.OllamaEmbeddings({
        model: config.model,
        ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}),
      });
    }
    default:
      throw new AIProviderError(`No LangChain embeddings for provider "${config.kind}".`);
  }
};

/**
 * Text provider that talks to a real model through LangChain. The model is
 * created lazily on first use and cached, so constructing the adapter is cheap
 * and import-free.
 */
export class LangChainTextProvider implements IAITextProvider {
  public readonly id: string;
  private model: LcChatModel | null = null;

  public constructor(private readonly config: LangChainTextConfig) {
    this.id = `langchain:${config.kind}`;
  }

  public async isAvailable(): Promise<boolean> {
    // Cloud providers need a key; a self-hosted base URL is enough for Ollama.
    if (this.config.kind === AIProviderKind.Ollama) {
      return this.config.baseUrl !== undefined;
    }
    return this.config.apiKey !== undefined && this.config.apiKey.length > 0;
  }

  public async complete(
    messages: readonly ChatMessage[],
    _options?: TextCompletionOptions,
  ): Promise<TextCompletionResult> {
    try {
      this.model ??= await loadChatModel(this.config);
      const response = await this.model.invoke(toLcMessages(messages));
      return {
        text: contentToString(response.content),
        model: this.config.model,
        tokensUsed: null,
      };
    } catch (cause) {
      throw new AIProviderError(`LangChain completion failed for "${this.id}".`, cause);
    }
  }
}

/** Embedding provider that talks to a real model through LangChain. */
export class LangChainEmbeddingProvider implements IEmbeddingProvider {
  public readonly id: string;
  public readonly dimension: number;
  private embeddings: LcEmbeddings | null = null;

  public constructor(private readonly config: LangChainEmbeddingConfig) {
    this.id = `langchain:${config.kind}:embed`;
    this.dimension = config.dimension;
  }

  public async embed(
    inputs: readonly string[],
    _options?: EmbeddingOptions,
  ): Promise<EmbeddingResult> {
    try {
      this.embeddings ??= await loadEmbeddings(this.config);
      const vectors = await this.embeddings.embedDocuments([...inputs]);
      return { vectors, model: this.config.model, dimension: this.dimension };
    } catch (cause) {
      throw new AIProviderError(`LangChain embedding failed for "${this.id}".`, cause);
    }
  }
}

/**
 * Factory selecting a concrete text provider for a provider kind. Returns
 * `null` for {@link AIProviderKind.None}, signalling the orchestrator's offline
 * (rules-only) path — never an error, so a misconfigured app degrades
 * gracefully instead of failing.
 */
export const createTextProvider = (config: LangChainTextConfig): IAITextProvider | null => {
  if (config.kind === AIProviderKind.None) {
    return null;
  }
  return new LangChainTextProvider(config);
};
