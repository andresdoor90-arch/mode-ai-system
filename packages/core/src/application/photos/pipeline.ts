/**
 * Photo processing pipeline — ARCHITECTURE ONLY (Module 3).
 *
 * The user asked us to *prepare the architecture* for future automatic image
 * work (background removal, garment segmentation, image enhancement) WITHOUT
 * implementing the algorithms yet. This file defines the extension points: a
 * chain of ordered, swappable stages operating on a plain context. Each concrete
 * algorithm will later implement one stage behind its port; today the bundled
 * stages are explicit no-ops that pass the image through unchanged.
 *
 * Nothing here decodes pixels or depends on a native library — that lives behind
 * the infrastructure adapters a later phase provides.
 */
import { type PhotoProcessingStage } from '../../domain/value-objects/Photograph';

/** What flows through the pipeline: a reference to the photo + its stage. */
export interface PhotoProcessingContext {
  readonly garmentId: string;
  readonly photoId: string;
  /** Storage key of the image to operate on. */
  readonly storageKey: string;
  /** Stage reached so far. */
  readonly stage: PhotoProcessingStage;
  /** Forward-compatible bag for stage outputs (mask keys, sizes, …). */
  readonly attributes: Readonly<Record<string, string>>;
}

/** Result of running a single stage. */
export interface PhotoStageResult {
  readonly context: PhotoProcessingContext;
  /** Whether this stage actually transformed the image (false for no-ops). */
  readonly applied: boolean;
}

/** A single, named, swappable processing stage. */
export interface IPhotoProcessingStage {
  readonly name: string;
  /** Whether the stage can run (e.g. its model/native dep is available). */
  isAvailable(): Promise<boolean>;
  process(context: PhotoProcessingContext): Promise<PhotoStageResult>;
}

/* --------------------------- future-work ports ---------------------------- */

/** Removes the background of a garment photo. DEFERRED — no algorithm yet. */
export interface IBackgroundRemover extends IPhotoProcessingStage {}
/** Segments the garment from the rest of the photo. DEFERRED. */
export interface IGarmentSegmenter extends IPhotoProcessingStage {}
/** Enhances exposure/colour/sharpness. DEFERRED. */
export interface IImageEnhancer extends IPhotoProcessingStage {}

/**
 * A no-op stage that advances the recorded stage marker without touching pixels.
 * Used as the default implementation for every deferred capability so the
 * pipeline is fully wired and testable today, and a real algorithm can drop in
 * later by replacing one stage.
 */
export class PassThroughStage implements IPhotoProcessingStage {
  public constructor(
    public readonly name: string,
    private readonly markStage?: PhotoProcessingStage,
  ) {}

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async process(context: PhotoProcessingContext): Promise<PhotoStageResult> {
    const next: PhotoProcessingContext =
      this.markStage !== undefined ? { ...context, stage: this.markStage } : context;
    return { context: next, applied: false };
  }
}

/**
 * Runs photo stages in registration order, skipping any that are unavailable.
 * Pure orchestration — it knows nothing about how a stage works.
 */
export class PhotoProcessingPipeline {
  private readonly stages: IPhotoProcessingStage[];

  public constructor(stages: readonly IPhotoProcessingStage[] = []) {
    this.stages = [...stages];
  }

  public get stageNames(): readonly string[] {
    return this.stages.map((s) => s.name);
  }

  public register(stage: IPhotoProcessingStage): void {
    this.stages.push(stage);
  }

  /** Run every available stage sequentially, threading the context through. */
  public async run(initial: PhotoProcessingContext): Promise<PhotoProcessingContext> {
    let context = initial;
    for (const stage of this.stages) {
      if (await stage.isAvailable()) {
        const result = await stage.process(context);
        context = result.context;
      }
    }
    return context;
  }

  /**
   * The default, fully-deferred pipeline: background removal → segmentation →
   * enhancement, all as pass-through no-ops. Replace any stage with a real
   * adapter later without changing callers.
   */
  public static deferredDefault(): PhotoProcessingPipeline {
    return new PhotoProcessingPipeline([
      new PassThroughStage('background-removal', 'background-removed'),
      new PassThroughStage('garment-segmentation', 'segmented'),
      new PassThroughStage('image-enhancement', 'enhanced'),
    ]);
  }
}
