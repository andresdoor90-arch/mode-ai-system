/**
 * Extension registry — the catalog of live plugin contributions.
 *
 * The host collects every contribution a plugin registers (keyed by plugin id
 * AND extension point) and exposes typed getters the rest of M-A-S consumes:
 * contributed `ITextProvider`s flow into the `AIProviderRouter`, declarative
 * recommendation rules become the ranking engine's additive bias, importers /
 * exporters / analyzers / image formats / UI panels / garment & category types
 * are surfaced through their respective seams. Deactivating/uninstalling a
 * plugin withdraws all of its contributions in one call.
 */
import {
  type AiProviderContribution,
  type AnalyzerContribution,
  type CategoryTypeContribution,
  type ContributionByPoint,
  type EmbedderContribution,
  type ExporterContribution,
  type ExtensionContribution,
  ExtensionPointId,
  type GarmentTypeContribution,
  type ImageFormatContribution,
  type ImporterContribution,
  type RecommendationRuleContribution,
  type RenderEngineContribution,
  type UiPanelContribution,
} from '../contracts/extensionPoints';

/** A contribution annotated with the plugin that supplied it. */
export interface OwnedContribution<T extends ExtensionContribution = ExtensionContribution> {
  readonly pluginId: string;
  readonly contribution: T;
}

export class ExtensionRegistry {
  /** point → (pluginId → contributions[]) */
  private readonly byPoint = new Map<ExtensionPointId, OwnedContribution[]>();

  /** Register a contribution owned by a plugin. */
  public add(pluginId: string, contribution: ExtensionContribution): void {
    const list = this.byPoint.get(contribution.point) ?? [];
    list.push({ pluginId, contribution });
    this.byPoint.set(contribution.point, list);
  }

  /** Withdraw every contribution owned by a plugin (deactivate/uninstall). */
  public removePlugin(pluginId: string): void {
    for (const [point, list] of this.byPoint) {
      this.byPoint.set(
        point,
        list.filter((owned) => owned.pluginId !== pluginId),
      );
    }
  }

  /** Raw owned contributions for a point. */
  public owned<P extends ExtensionPointId>(
    point: P,
  ): readonly OwnedContribution<ContributionByPoint[P]>[] {
    return (this.byPoint.get(point) ?? []) as unknown as readonly OwnedContribution<
      ContributionByPoint[P]
    >[];
  }

  /** Contributions (unwrapped) for a point. */
  public forPoint<P extends ExtensionPointId>(point: P): readonly ContributionByPoint[P][] {
    return this.owned(point).map((o) => o.contribution);
  }

  /* ----------------------------- typed getters ---------------------------- */

  public aiProviders(): readonly AiProviderContribution[] {
    return this.forPoint(ExtensionPointId.AiProvider);
  }
  public embedders(): readonly EmbedderContribution[] {
    return this.forPoint(ExtensionPointId.Embedder);
  }
  public renderEngines(): readonly RenderEngineContribution[] {
    return this.forPoint(ExtensionPointId.RenderEngine);
  }
  public analyzers(): readonly AnalyzerContribution[] {
    return this.forPoint(ExtensionPointId.Analyzer);
  }
  public importers(): readonly ImporterContribution[] {
    return this.forPoint(ExtensionPointId.Importer);
  }
  public exporters(): readonly ExporterContribution[] {
    return this.forPoint(ExtensionPointId.Exporter);
  }
  public imageFormats(): readonly ImageFormatContribution[] {
    return this.forPoint(ExtensionPointId.ImageFormat);
  }
  public recommendationRules(): readonly RecommendationRuleContribution[] {
    return this.forPoint(ExtensionPointId.RecommendationRule);
  }
  public uiPanels(): readonly UiPanelContribution[] {
    return this.forPoint(ExtensionPointId.UiPanel);
  }
  public garmentTypes(): readonly GarmentTypeContribution[] {
    return this.forPoint(ExtensionPointId.GarmentType);
  }
  public categoryTypes(): readonly CategoryTypeContribution[] {
    return this.forPoint(ExtensionPointId.CategoryType);
  }

  /** Total number of registered contributions across all points. */
  public size(): number {
    let total = 0;
    for (const list of this.byPoint.values()) {
      total += list.length;
    }
    return total;
  }
}
