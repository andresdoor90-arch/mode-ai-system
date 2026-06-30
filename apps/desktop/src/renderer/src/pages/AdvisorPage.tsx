/**
 * AI Outfit Advisor — a chat that dresses the mannequin for you.
 *
 * The user describes their context in plain language ("hoy voy a la iglesia a
 * las 7 PM, va a llover, quiero algo elegante"). That text is sent to the
 * existing recommendation engine (renderer → IPC `ai:recommend` → orchestrator),
 * which reasons over the user's REAL wardrobe (SQLite) and returns up to three
 * explained outfits built only from owned garments. The advisor shows the
 * reasoning, dresses the 2D mannequin live with the chosen outfit, and can open
 * the full Probador already dressed — no manual assembly.
 *
 * No mocks, no sample data: with an empty wardrobe the engine returns nothing
 * and the screen says so.
 */
import { Bot, ExternalLink, Loader2, RefreshCw, Send, Shirt, Sparkles, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '../components/common/EmptyState';
import { GarmentImage } from '../components/common/GarmentImage';
import { PageHeader } from '../components/common/PageHeader';
import { TryOnMannequin } from '../components/common/TryOnMannequin';
import { Badge, Button, Card, CardContent, Textarea } from '../components/ui';
import { cn } from '../lib/cn';
import { thumbnailKeyOf } from '../lib/garmentImages';
import { buildOutfitLayers, selectionFromGarments } from '../lib/outfitModel';
import { useRecommendationStore } from '../store/recommendationStore';
import { useWardrobeStore } from '../store/wardrobeStore';

interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

/** A few example prompts that simply pre-fill the input to guide the user. */
const EXAMPLE_PROMPTS: readonly string[] = [
  'Hoy voy a la iglesia a las 7 PM y va a llover. Quiero verme elegante pero cómodo.',
  'Tengo una reunión de trabajo importante esta mañana.',
  'Voy a una boda por la tarde, necesito algo formal.',
  'Plan casual para salir con amigos el fin de semana.',
];

let messageCounter = 0;
const nextId = (): string => {
  messageCounter += 1;
  return `m${messageCounter}`;
};

export function AdvisorPage(): JSX.Element {
  const navigate = useNavigate();

  const wardrobeLoaded = useWardrobeStore((s) => s.loaded);
  const loadWardrobe = useWardrobeStore((s) => s.load);
  const garmentCount = useWardrobeStore((s) => s.garments.length);

  const recommend = useRecommendationStore((s) => s.recommend);
  const select = useRecommendationStore((s) => s.select);
  const requestTryOn = useRecommendationStore((s) => s.requestTryOn);
  const loading = useRecommendationStore((s) => s.loading);
  const set = useRecommendationStore((s) => s.set);
  const selectedKind = useRecommendationStore((s) => s.selectedKind);

  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [lastMessage, setLastMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!wardrobeLoaded) {
      void loadWardrobe();
    }
  }, [wardrobeLoaded, loadWardrobe]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const current = useMemo(() => {
    if (set === null) {
      return null;
    }
    return (
      set.recommendations.find((r) => r.kind === selectedKind) ?? set.recommendations[0] ?? null
    );
  }, [set, selectedKind]);

  const layers = useMemo(
    () => (current === null ? [] : buildOutfitLayers(selectionFromGarments(current.garments))),
    [current],
  );

  const append = (role: ChatMessage['role'], text: string): void =>
    setMessages((prev) => [...prev, { id: nextId(), role, text }]);

  const runAdvice = async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || loading) {
      return;
    }
    append('user', trimmed);
    setLastMessage(trimmed);
    setInput('');
    await recommend({ message: trimmed });

    const state = useRecommendationStore.getState();
    if (state.error !== null) {
      append('assistant', `No pude generar el outfit: ${state.error}`);
      return;
    }
    const picked = state.current();
    if (picked === null || (state.set?.recommendations.length ?? 0) === 0) {
      append(
        'assistant',
        'Todavía no tienes prendas suficientes en tu guardarropa para armar un outfit. ' +
          'Agrega prendas con fotografía y vuelve a pedirme una recomendación.',
      );
      return;
    }
    const offline =
      state.set?.degraded === true ? ' (modo sin conexión: usé reglas de estilo locales)' : '';
    append(
      'assistant',
      `Te propongo "${picked.label}"${offline}. ${picked.explanation} ` +
        'Lo verás puesto en el maniquí; si te gusta, ábrelo en el Probador.',
    );
  };

  const openInTryOn = (): void => {
    requestTryOn();
    navigate('/try-on');
  };

  const hasConversation = messages.length > 0;

  return (
    <div>
      <PageHeader
        title="Asesor de imagen"
        description="Cuéntame tu plan y armo el mejor outfit con tu propio guardarropa."
      />

      {wardrobeLoaded && garmentCount === 0 && (
        <div className="mb-5 rounded-lg border border-dashed border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          Tu guardarropa está vacío. Agrega prendas con fotografía para que pueda recomendarte
          conjuntos reales.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(360px,420px)]">
        {/* --------------------------------- chat -------------------------------- */}
        <Card className="flex h-[600px] flex-col">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {!hasConversation && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Sparkles className="h-6 w-6" />
                </span>
                <h3 className="text-base font-semibold text-foreground">¿A dónde vas hoy?</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Describe la ocasión, la hora, el clima y cómo quieres verte. Yo elijo las prendas.
                </p>
                <div className="mt-5 flex max-w-md flex-wrap justify-center gap-2">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInput(prompt)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-2.5',
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    message.role === 'user'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-primary/15 text-primary',
                  )}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </span>
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                  )}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analizando tu guardarropa…
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void runAdvice(input);
                  }
                }}
                placeholder="Hoy es martes, voy a predicar a las 7 PM, va a llover…"
                className="min-h-[44px] flex-1 resize-none"
                rows={1}
              />
              <Button
                type="button"
                onClick={() => void runAdvice(input)}
                disabled={loading || input.trim().length === 0}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar
              </Button>
            </div>
          </div>
        </Card>

        {/* ------------------------------- outfit -------------------------------- */}
        <div className="space-y-4">
          <Card className="bg-gradient-to-b from-zinc-900 to-zinc-950">
            <CardContent className="flex items-center justify-center p-4">
              <TryOnMannequin layers={layers} className="h-[360px] w-auto" />
            </CardContent>
          </Card>

          {current === null ? (
            <EmptyState
              icon={Shirt}
              title="Aquí verás tu outfit"
              description="Cuando me cuentes tu plan, vestiré el maniquí con las prendas elegidas."
            />
          ) : (
            <div className="space-y-3">
              {(set?.recommendations.length ?? 0) > 1 && (
                <div className="flex flex-wrap gap-2">
                  {set?.recommendations.map((rec) => (
                    <button
                      key={rec.kind}
                      type="button"
                      onClick={() => select(rec.kind)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        rec.kind === current.kind
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      {rec.label}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-sm text-muted-foreground">{current.explanation}</p>

              <div className="flex flex-wrap gap-2">
                {current.garments.map((garment) => (
                  <div
                    key={garment.id}
                    className="flex w-20 flex-col overflow-hidden rounded-lg border border-border"
                    title={garment.name}
                  >
                    <GarmentImage
                      storageKey={thumbnailKeyOf(garment)}
                      alt={garment.name}
                      className="aspect-square w-full"
                    />
                    <span className="truncate px-1 py-0.5 text-[10px] text-foreground">
                      {garment.name}
                    </span>
                  </div>
                ))}
              </div>

              {set?.degraded === true && (
                <Badge variant="secondary">Modo sin conexión · reglas de estilo</Badge>
              )}

              <div className="flex gap-2">
                <Button type="button" onClick={openInTryOn} className="flex-1">
                  <ExternalLink className="h-4 w-4" />
                  Abrir en el Probador
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void runAdvice(lastMessage)}
                  disabled={loading || lastMessage.length === 0}
                  title="Generar otra propuesta"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
