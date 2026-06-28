/**
 * A complete, first-party-style SAMPLE plugin used to exercise the host
 * end-to-end offline. "Color Palette Studio" demonstrates every controlled
 * access path WITHOUT containing a single business rule:
 *
 *  - reads the wardrobe through the gated host API (`wardrobe:read`),
 *  - persists a preference via plugin-scoped storage (`storage:plugin`),
 *  - writes to the audit log (`log:write`),
 *  - contributes an ANALYZER (palette frequency), a DECLARATIVE recommendation
 *    rule (a colour-affinity bias the CORE evaluates), an IMPORTER and a UI
 *    panel.
 *
 * Nothing here decides an outfit; it only declares preferences/data the core
 * consumes — the architecture's hard rule that no business logic lives in a
 * plugin.
 */
import {
  ExtensionPointId,
  type AnalyzerContribution,
  type GarmentView,
  type ImporterContribution,
  type PluginManifest,
  type PluginModule,
  type RawGarmentRecord,
  type RecommendationRuleContribution,
  type UiPanelContribution,
} from '../index';

/** The sample plugin's manifest (compatible with host >=0.7.0). */
export const SAMPLE_PLUGIN_MANIFEST: PluginManifest = {
  id: 'studio.colorpalette',
  name: 'Color Palette Studio',
  version: '1.2.0',
  manifestSchemaVersion: 1,
  engines: { mas: '>=0.7.0 <1.0.0', sdk: '^0.7.0' },
  permissions: [
    'wardrobe:read',
    'storage:plugin',
    'log:write',
    'analyzer:provide',
    'recommendation:contribute',
    'import:provide',
    'ui:contribute',
  ],
  contributes: [
    ExtensionPointId.Analyzer,
    ExtensionPointId.RecommendationRule,
    ExtensionPointId.Importer,
    ExtensionPointId.UiPanel,
  ],
  description: 'Generates colour palettes and a colour-affinity recommendation bias.',
  author: 'M-A-S Samples',
};

/** Result shape produced by the contributed analyzer. */
export interface PaletteResult {
  readonly counts: Readonly<Record<string, number>>;
  readonly dominant: string | null;
}

/** A flag the test can observe to confirm `activate` actually ran. */
export interface SamplePluginProbe {
  activated: boolean;
  deactivated: boolean;
  garmentCountSeen: number;
}

/** Build the sample plugin module + a probe the test can inspect. */
export const createSampleColorPalettePlugin = (): {
  module: PluginModule;
  probe: SamplePluginProbe;
} => {
  const probe: SamplePluginProbe = { activated: false, deactivated: false, garmentCountSeen: 0 };

  const module: PluginModule = {
    async activate(context): Promise<void> {
      const { host } = context;

      // Read the wardrobe through the controlled API.
      const garments = await host.wardrobe.listGarments();
      probe.garmentCountSeen = garments.length;

      // Persist a preference in plugin-scoped storage.
      await host.storage.set('lastRun', new Date(0).toISOString());

      host.log.info('Color Palette Studio activated', { garments: garments.length });

      // Contribute an analyzer (pure aggregation; no domain decision).
      const analyzer: AnalyzerContribution<PaletteResult> = {
        point: ExtensionPointId.Analyzer,
        analyzerId: 'color-palette',
        title: 'Colour palette',
        analyze: (views: readonly GarmentView[]): PaletteResult => {
          const counts: Record<string, number> = {};
          for (const view of views) {
            counts[view.colorName] = (counts[view.colorName] ?? 0) + 1;
          }
          let dominant: string | null = null;
          let max = 0;
          for (const [name, n] of Object.entries(counts)) {
            if (n > max) {
              max = n;
              dominant = name;
            }
          }
          return { counts, dominant };
        },
      };
      host.register(analyzer);

      // Contribute a DECLARATIVE recommendation bias (the core evaluates it).
      const rule: RecommendationRuleContribution = {
        point: ExtensionPointId.RecommendationRule,
        ruleId: 'prefer-navy',
        description: 'Nudge ranking toward navy garments and tailored tags.',
        weights: {
          colors: { navy: 0.6 },
          tags: { tailored: 0.3, classic: 0.2 },
        },
      };
      host.register(rule);

      // Contribute an importer for a trivial CSV-ish format.
      const importer: ImporterContribution = {
        point: ExtensionPointId.Importer,
        formatId: 'palette-csv',
        label: 'Palette CSV',
        extensions: ['.csv'],
        canImport: (fileName: string): boolean => fileName.endsWith('.csv'),
        import: (bytes: Uint8Array): Promise<readonly RawGarmentRecord[]> => {
          const text = new TextDecoder().decode(bytes).trim();
          const records: RawGarmentRecord[] = text
            .split('\n')
            .filter((line) => line.trim().length > 0)
            .map((line) => {
              const [name, category, colorName] = line.split(',').map((s) => s.trim());
              return {
                name: name ?? 'Unnamed',
                category: category ?? 'tops',
                ...(colorName !== undefined ? { colorName } : {}),
              };
            });
          return Promise.resolve(records);
        },
      };
      host.register(importer);

      // Contribute a UI panel (metadata only; surfaced by the renderer).
      const panel: UiPanelContribution = {
        point: ExtensionPointId.UiPanel,
        panelId: 'color-palette-panel',
        title: 'Paleta de color',
        route: '/plugins/color-palette',
        icon: 'Palette',
        group: 'library',
      };
      host.register(panel);

      probe.activated = true;
    },
    deactivate(): void {
      probe.deactivated = true;
    },
  };

  return { module, probe };
};
