/**
 * @mas/rendering — engine-agnostic virtual try-on / avatar rendering layer.
 *
 * The pure, replaceable seam between M-A-S and a graphics engine. It turns the
 * REAL garments of a recommended outfit into a complete, declarative
 * {@link SceneDescription} — placing them on a fictional avatar using each
 * garment's domain attributes (category → body slot, colour → material, …) —
 * and exposes camera/view/screenshot/cache behaviour as plain, unit-testable
 * logic. NOTHING here imports Three.js, React, Electron, the DOM, the AI
 * orchestrator or any AI provider: a concrete engine (Three.js/R3F) implements
 * {@link IRenderEngine} in `apps/desktop` and can be swapped without touching
 * the domain, these managers or the UI.
 *
 * Modules:
 *  - abstraction — plain data + ports (math, colour, slots, scene types, engine)
 *  - managers    — Avatar, Clothing, Outfit, Camera, Lighting, Asset, Texture,
 *                  Scene, Screenshot managers + Render Cache
 *  - mappers     — structured-DTO → renderer-input adapters
 */

/** Package name, for diagnostics/logging. */
export const RENDERING_PACKAGE_NAME = '@mas/rendering' as const;

/** Semantic version of the rendering package. */
export const RENDERING_VERSION = '0.6.0' as const;

/* ------------------------------ abstraction ------------------------------- */
export * from './abstraction/math';
export * from './abstraction/color';
export * from './abstraction/slots';
export * from './abstraction/types';
export * from './abstraction/engine';

/* -------------------------------- managers -------------------------------- */
export * from './managers/AssetManager';
export * from './managers/TextureManager';
export * from './managers/AvatarManager';
export * from './managers/ClothingRenderer';
export * from './managers/OutfitRenderer';
export * from './managers/CameraController';
export * from './managers/LightingManager';
export * from './managers/RenderCache';
export * from './managers/ScreenshotManager';
export * from './managers/SceneManager';

/* --------------------------------- mappers -------------------------------- */
export * from './mappers/toRenderable';
