import { AIProviderError } from '../errors/InfrastructureError';

/**
 * Minimal HTTP client for a local Ollama server (default http://localhost:11434).
 *
 * It speaks only the few endpoints MAS needs — `/api/tags` (discovery),
 * `/api/chat` (text + vision via inline base64 images) and `/api/embeddings`.
 * The `fetch` implementation is injectable so the client is fully unit-testable
 * offline without a running server. Discovery calls (`listModels`,
 * `isReachable`) never throw — they degrade to "not available" — while explicit
 * `chat`/`embed` calls throw {@link AIProviderError} on transport/HTTP errors so
 * callers can fall back to the offline engine.
 *
 * No prompts and no business logic live here: this is pure transport.
 */

/** The subset of a `fetch` Response this client relies on. */
export interface OllamaHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/** Injectable fetch-like function. */
export type OllamaFetch = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<OllamaHttpResponse>;

export interface OllamaClientConfig {
  /** Base URL of the Ollama server, e.g. `http://localhost:11434`. */
  readonly baseUrl: string;
  /** Per-request timeout in milliseconds (default 60s — vision can be slow). */
  readonly timeoutMs?: number;
  /** Injectable fetch (defaults to the global `fetch`). */
  readonly fetchImpl?: OllamaFetch;
}

/** A chat message; `images` carries base64-encoded image bytes (vision). */
export interface OllamaChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
  readonly images?: readonly string[];
}

export interface OllamaChatRequest {
  readonly model: string;
  readonly messages: readonly OllamaChatMessage[];
  /** Ask Ollama to constrain output to JSON when set to `'json'`. */
  readonly format?: 'json';
  readonly temperature?: number;
}

export interface OllamaChatResult {
  readonly content: string;
  readonly model: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;

const defaultFetch: OllamaFetch = (url, init) =>
  fetch(url, init) as unknown as Promise<OllamaHttpResponse>;

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: OllamaFetch;

  public constructor(config: OllamaClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? defaultFetch;
  }

  /** List installed model names. Returns `[]` if the server is unreachable. */
  public async listModels(): Promise<readonly string[]> {
    try {
      const res = await this.request('GET', '/api/tags');
      if (!res.ok) {
        return [];
      }
      const body = (await res.json()) as { models?: { name?: string }[] };
      return (body.models ?? [])
        .map((m) => m.name)
        .filter((name): name is string => typeof name === 'string');
    } catch {
      return [];
    }
  }

  /** Whether the server responds at all. Never throws. */
  public async isReachable(): Promise<boolean> {
    try {
      const res = await this.request('GET', '/api/tags');
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Run a (single-shot, non-streaming) chat completion. */
  public async chat(req: OllamaChatRequest): Promise<OllamaChatResult> {
    const res = await this.request('POST', '/api/chat', {
      model: req.model,
      messages: req.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.images !== undefined ? { images: m.images } : {}),
      })),
      stream: false,
      ...(req.format !== undefined ? { format: req.format } : {}),
      options: { temperature: req.temperature ?? 0.2 },
    });
    if (!res.ok) {
      throw new AIProviderError(`Ollama chat failed with HTTP ${res.status}.`);
    }
    const body = (await res.json()) as { message?: { content?: string }; model?: string };
    return { content: body.message?.content ?? '', model: body.model ?? req.model };
  }

  /** Produce one embedding vector per input via `/api/embeddings`. */
  public async embed(model: string, inputs: readonly string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const input of inputs) {
      const res = await this.request('POST', '/api/embeddings', { model, prompt: input });
      if (!res.ok) {
        throw new AIProviderError(`Ollama embeddings failed with HTTP ${res.status}.`);
      }
      const body = (await res.json()) as { embedding?: number[] };
      vectors.push(body.embedding ?? []);
    }
    return vectors;
  }

  private async request(method: string, path: string, body?: unknown): Promise<OllamaHttpResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
