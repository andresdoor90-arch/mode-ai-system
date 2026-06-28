import {
  type ChatMessage,
  type IAITextProvider,
  type TextCompletionOptions,
  type TextCompletionResult,
} from './AIProvider';

/**
 * A deterministic, dependency-free text provider for offline use and tests.
 *
 * It performs NO network calls and contains NO business rules: it simply
 * reflects the prompt back as a lightly-formatted, natural-sounding sentence so
 * the orchestration's explanation step can be exercised end-to-end without a
 * real model. It is *always available*, which makes it a useful "local default"
 * the AI Provider Router can fall back to when no real model is configured.
 *
 * Because the orchestrator only ever asks a text provider to REPHRASE reasoning
 * the domain already decided, a static rephraser is a perfectly valid (if
 * unsophisticated) provider — proving the engine never depends on a model for
 * correctness.
 */
export class StaticTextProvider implements IAITextProvider {
  public readonly id: string;

  public constructor(id = 'static-local') {
    this.id = id;
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async complete(
    messages: readonly ChatMessage[],
    _options?: TextCompletionOptions,
  ): Promise<TextCompletionResult> {
    const userContent = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const condensed = userContent.replace(/\s+/g, ' ').trim();
    return {
      text: condensed.length > 0 ? `En resumen: ${condensed}` : 'Sin contenido para resumir.',
      model: `${this.id}/echo`,
      tokensUsed: condensed.length,
    };
  }
}
