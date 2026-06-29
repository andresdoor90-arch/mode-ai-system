/**
 * Screenshot Manager.
 *
 * Builds well-formed {@link ScreenshotRequest}s (sane dimensions, descriptive
 * timestamped filenames per view) and delegates the actual pixel capture to an
 * injected {@link IScreenshotSink} — which in production is the live
 * {@link IRenderEngine}, and in tests is a fake. This keeps screenshot plumbing
 * (filename/format/quality/dimension policy and the request→result flow) fully
 * unit-testable offline, while the real WebGL read-back stays in the adapter.
 */
import { clamp } from '../abstraction/math';
import { type IScreenshotSink } from '../abstraction/engine';
import {
  type ImageFormat,
  type ScreenshotRequest,
  type ScreenshotResult,
  type ViewPreset,
} from '../abstraction/types';

export interface ScreenshotOptions {
  readonly width?: number;
  readonly height?: number;
  readonly format?: ImageFormat;
  readonly quality?: number;
  readonly view?: ViewPreset;
  /** Optional fixed clock for deterministic filenames in tests. */
  readonly now?: () => Date;
}

const MIN_DIMENSION = 16;
const MAX_DIMENSION = 8192;
const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 1024;

/** Slugify a label into a filesystem-safe token. */
const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'mas';

export class ScreenshotManager {
  private readonly sink: IScreenshotSink;
  private readonly now: () => Date;

  public constructor(sink: IScreenshotSink, now: () => Date = () => new Date()) {
    this.sink = sink;
    this.now = now;
  }

  /** Compose a request for the given outfit/view (no capture yet). */
  public buildRequest(outfitLabel: string, options: ScreenshotOptions = {}): ScreenshotRequest {
    const view: ViewPreset = options.view ?? 'front';
    const format: ImageFormat = options.format ?? 'image/png';
    const stamp = (options.now ?? this.now)().toISOString().replace(/[:.]/g, '-');
    const ext = format === 'image/png' ? 'png' : 'jpg';
    return {
      width: clamp(Math.round(options.width ?? DEFAULT_WIDTH), MIN_DIMENSION, MAX_DIMENSION),
      height: clamp(Math.round(options.height ?? DEFAULT_HEIGHT), MIN_DIMENSION, MAX_DIMENSION),
      format,
      ...(format === 'image/jpeg' ? { quality: clamp(options.quality ?? 0.92, 0, 1) } : {}),
      view,
      fileName: `mas-tryon_${slug(outfitLabel)}_${view}_${stamp}.${ext}`,
    };
  }

  /** Build a request and capture it through the sink. */
  public async capture(outfitLabel: string, options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const request = this.buildRequest(outfitLabel, options);
    return this.sink.captureScreenshot(request);
  }
}
