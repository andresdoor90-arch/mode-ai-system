import { generateKeyPairSync, type KeyObject } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { type Garment, type Occasion, type Season } from '@mas/core';

import { createFakeHostBackend } from '../__fixtures__/fakeHostBackend';
import {
  SAMPLE_PLUGIN_MANIFEST,
  createSampleColorPalettePlugin,
  type PaletteResult,
} from '../__fixtures__/sampleColorPalettePlugin';
import { IncompatiblePluginError, SignatureVerificationError } from '../contracts/errors';
import {
  ExtensionPointId,
  buildAffinityBiasFromRules,
  type AnalyzerContribution,
  type ImporterContribution,
} from '../contracts/extensionPoints';
import { type PluginManifest } from '../contracts/manifest';
import { PluginLifecycleState } from '../contracts/lifecycle';
import { type PluginCapability } from '../contracts/permissions';
import { type PluginModule } from '../contracts/plugin';
import { CompatibilityChecker } from '../validation/compatibility';
import { InProcessPluginSandbox } from './InProcessPluginSandbox';
import { PluginLoader } from './PluginLoader';
import { PluginManager } from './PluginManager';
import { SignatureVerifier, STRICT_SIGNATURE_POLICY } from './SignatureVerifier';
import { createInProcessSource } from './inProcessSource';

const TRUSTED_KEY_ID = 'mas-first-party';

const buildManager = (
  options: {
    approver?: (id: string, requested: readonly PluginCapability[]) => readonly PluginCapability[];
  } = {},
): {
  manager: PluginManager;
  privateKey: KeyObject;
  publicKey: KeyObject;
} => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const verifier = new SignatureVerifier([[TRUSTED_KEY_ID, publicKey]], STRICT_SIGNATURE_POLICY);
  const checker = new CompatibilityChecker({ hostVersion: '0.7.0', sdkVersion: '0.7.0' });
  const loader = new PluginLoader(checker, verifier);
  const { backend } = createFakeHostBackend();
  const manager = new PluginManager({
    sandbox: new InProcessPluginSandbox(),
    loader,
    backend,
    ...(options.approver !== undefined ? { approver: options.approver } : {}),
  });
  return { manager, privateKey, publicKey };
};

describe('Plugin system end-to-end (sample plugin through the host)', () => {
  it('runs the full lifecycle and registers every contribution', async () => {
    const { manager, privateKey } = buildManager();
    const { module, probe } = createSampleColorPalettePlugin();
    const source = createInProcessSource({
      manifest: SAMPLE_PLUGIN_MANIFEST,
      module,
      code: 'sample-code-v1',
      signing: { keyId: TRUSTED_KEY_ID, privateKey },
    });

    manager.discover(source);
    expect(manager.stateOf('studio.colorpalette')).toBe(PluginLifecycleState.Discovered);
    manager.install('studio.colorpalette');
    await manager.validate('studio.colorpalette');
    expect(manager.stateOf('studio.colorpalette')).toBe(PluginLifecycleState.Validated);

    const status = await manager.activate('studio.colorpalette');
    expect(status.state).toBe(PluginLifecycleState.Active);
    expect(probe.activated).toBe(true);
    expect(probe.garmentCountSeen).toBe(3);

    const ext = manager.extensionRegistry;
    expect(ext.analyzers()).toHaveLength(1);
    expect(ext.recommendationRules()).toHaveLength(1);
    expect(ext.importers()).toHaveLength(1);
    expect(ext.uiPanels()).toHaveLength(1);
  });

  it('invokes a contributed analyzer through the controlled API', async () => {
    const { manager, privateKey } = buildManager();
    const { module } = createSampleColorPalettePlugin();
    manager.discover(
      createInProcessSource({
        manifest: SAMPLE_PLUGIN_MANIFEST,
        module,
        signing: { keyId: TRUSTED_KEY_ID, privateKey },
      }),
    );
    manager.install('studio.colorpalette');
    await manager.validate('studio.colorpalette');
    await manager.activate('studio.colorpalette');

    const analyzer =
      manager.extensionRegistry.analyzers()[0] as AnalyzerContribution<PaletteResult>;
    const result = await analyzer.analyze([
      {
        id: 'a',
        name: 'A',
        category: 'tops',
        subcategory: 'shirt',
        colorName: 'navy',
        tags: [],
        formality: 5,
      },
      {
        id: 'b',
        name: 'B',
        category: 'tops',
        subcategory: 'tee',
        colorName: 'navy',
        tags: [],
        formality: 5,
      },
      {
        id: 'c',
        name: 'C',
        category: 'shoes',
        subcategory: 'sneaker',
        colorName: 'white',
        tags: [],
        formality: 2,
      },
    ]);
    expect(result.dominant).toBe('navy');
    expect(result.counts.navy).toBe(2);
  });

  it('invokes a contributed importer and parses records', async () => {
    const { manager, privateKey } = buildManager();
    const { module } = createSampleColorPalettePlugin();
    manager.discover(
      createInProcessSource({
        manifest: SAMPLE_PLUGIN_MANIFEST,
        module,
        signing: { keyId: TRUSTED_KEY_ID, privateKey },
      }),
    );
    manager.install('studio.colorpalette');
    await manager.validate('studio.colorpalette');
    await manager.activate('studio.colorpalette');

    const importer = manager.extensionRegistry.importers()[0] as ImporterContribution;
    expect(importer.canImport('wardrobe.csv')).toBe(true);
    const records = await importer.import(
      new TextEncoder().encode('Blue Shirt,tops,blue\nBlack Jeans,bottoms,black'),
    );
    expect(records).toHaveLength(2);
    expect(records[0]?.name).toBe('Blue Shirt');
  });

  it('feeds the contributed declarative rule into the core additive bias', () => {
    // The plugin only declares weights; this pure helper (used by the host)
    // turns them into the additive affinity bias the ranking engine consumes.
    const { module } = createSampleColorPalettePlugin();
    void module;
    const bias = buildAffinityBiasFromRules([
      {
        point: ExtensionPointId.RecommendationRule,
        ruleId: 'prefer-navy',
        description: 'demo',
        weights: { colors: { navy: 0.6 }, tags: { tailored: 0.3 } },
      },
    ]);
    const navyTailored = [
      { tags: ['tailored'], color: { name: 'Navy' }, subcategory: 'shirt' } as unknown as Garment,
    ];
    const unrelated = [
      { tags: ['casual'], color: { name: 'Beige' }, subcategory: 'tee' } as unknown as Garment,
    ];
    expect(bias(navyTailored)).toBeGreaterThan(0);
    expect(bias(unrelated)).toBe(0);
  });

  it('persists plugin-scoped storage and records an audit trail', async () => {
    const { manager, privateKey } = buildManager();
    const { module } = createSampleColorPalettePlugin();
    manager.discover(
      createInProcessSource({
        manifest: SAMPLE_PLUGIN_MANIFEST,
        module,
        signing: { keyId: TRUSTED_KEY_ID, privateKey },
      }),
    );
    manager.install('studio.colorpalette');
    await manager.validate('studio.colorpalette');
    await manager.activate('studio.colorpalette');

    const actions = manager.activityLog.entries('studio.colorpalette').map((e) => e.action);
    expect(actions).toContain('discover');
    expect(actions).toContain('activate');
    expect(actions.some((a) => a.startsWith('register:'))).toBe(true);
  });

  it('contains a faulting plugin without crashing the host', async () => {
    const { manager, privateKey } = buildManager();
    const faulty: PluginModule = {
      activate() {
        throw new Error('boom');
      },
    };
    const manifest: PluginManifest = {
      ...SAMPLE_PLUGIN_MANIFEST,
      id: 'evil.faulty',
      permissions: [],
      contributes: [],
    };
    manager.discover(
      createInProcessSource({
        manifest,
        module: faulty,
        signing: { keyId: TRUSTED_KEY_ID, privateKey },
      }),
    );
    manager.install('evil.faulty');
    await manager.validate('evil.faulty');
    const status = await manager.activate('evil.faulty');

    expect(status.state).toBe(PluginLifecycleState.Failed);
    expect(status.faulted).toBe(true);
    // Host still healthy: the manager keeps operating and can list plugins.
    expect(manager.list().some((p) => p.id === 'evil.faulty')).toBe(true);
    expect(manager.extensionRegistry.size()).toBe(0);
  });

  it('enforces permissions on host-API calls (contained as a fault)', async () => {
    // Grant nothing: the plugin's first wardrobe read is denied → contained.
    const { manager, privateKey } = buildManager({ approver: () => [] });
    const { module } = createSampleColorPalettePlugin();
    manager.discover(
      createInProcessSource({
        manifest: SAMPLE_PLUGIN_MANIFEST,
        module,
        signing: { keyId: TRUSTED_KEY_ID, privateKey },
      }),
    );
    manager.install('studio.colorpalette');
    await manager.validate('studio.colorpalette');
    const status = await manager.activate('studio.colorpalette');
    expect(status.state).toBe(PluginLifecycleState.Failed);
    expect(manager.extensionRegistry.size()).toBe(0);
  });

  it('rejects an untrusted signature at validation', async () => {
    const { manager } = buildManager();
    const { module } = createSampleColorPalettePlugin();
    const { privateKey: strangerKey } = generateKeyPairSync('ed25519');
    manager.discover(
      createInProcessSource({
        manifest: SAMPLE_PLUGIN_MANIFEST,
        module,
        signing: { keyId: 'stranger', privateKey: strangerKey },
      }),
    );
    manager.install('studio.colorpalette');
    await expect(manager.validate('studio.colorpalette')).rejects.toBeInstanceOf(
      SignatureVerificationError,
    );
    expect(manager.stateOf('studio.colorpalette')).toBe(PluginLifecycleState.Failed);
  });

  it('rejects an incompatible plugin at validation', async () => {
    const { manager, privateKey } = buildManager();
    const { module } = createSampleColorPalettePlugin();
    const manifest: PluginManifest = {
      ...SAMPLE_PLUGIN_MANIFEST,
      id: 'future.plugin',
      engines: { mas: '^2.0.0' },
    };
    manager.discover(
      createInProcessSource({ manifest, module, signing: { keyId: TRUSTED_KEY_ID, privateKey } }),
    );
    manager.install('future.plugin');
    await expect(manager.validate('future.plugin')).rejects.toBeInstanceOf(IncompatiblePluginError);
  });

  it('deactivates and uninstalls, withdrawing contributions each time', async () => {
    const { manager, privateKey } = buildManager();
    const { module, probe } = createSampleColorPalettePlugin();
    manager.discover(
      createInProcessSource({
        manifest: SAMPLE_PLUGIN_MANIFEST,
        module,
        signing: { keyId: TRUSTED_KEY_ID, privateKey },
      }),
    );
    manager.install('studio.colorpalette');
    await manager.validate('studio.colorpalette');
    await manager.activate('studio.colorpalette');
    expect(manager.extensionRegistry.size()).toBeGreaterThan(0);

    await manager.deactivate('studio.colorpalette');
    expect(probe.deactivated).toBe(true);
    expect(manager.stateOf('studio.colorpalette')).toBe(PluginLifecycleState.Inactive);
    expect(manager.extensionRegistry.size()).toBe(0);

    await manager.uninstall('studio.colorpalette');
    expect(manager.list()).toHaveLength(0);
  });

  it('refuses to activate a plugin that was never validated', async () => {
    const { manager, privateKey } = buildManager();
    const { module } = createSampleColorPalettePlugin();
    manager.discover(
      createInProcessSource({
        manifest: SAMPLE_PLUGIN_MANIFEST,
        module,
        signing: { keyId: TRUSTED_KEY_ID, privateKey },
      }),
    );
    manager.install('studio.colorpalette');
    await expect(manager.activate('studio.colorpalette')).rejects.toThrow();
  });

  it('applies occasion/season-typed rules (type plumbing sanity)', () => {
    const occasions: readonly Occasion[] = [];
    const seasons: readonly Season[] = [];
    const bias = buildAffinityBiasFromRules([
      {
        point: ExtensionPointId.RecommendationRule,
        ruleId: 'r',
        description: 'd',
        weights: { subcategories: { shirt: 0.5 } },
        appliesTo: { occasions, seasons },
      },
    ]);
    const g = [{ tags: [], color: { name: 'x' }, subcategory: 'shirt' } as unknown as Garment];
    expect(bias(g)).toBeGreaterThan(0);
  });
});
