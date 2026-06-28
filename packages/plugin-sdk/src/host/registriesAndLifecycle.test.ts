import { describe, expect, it } from 'vitest';

import { DuplicatePluginError, IllegalLifecycleTransitionError, PluginNotFoundError } from '../contracts/errors';
import { ExtensionPointId } from '../contracts/extensionPoints';
import { PluginLifecycleEvent, PluginLifecycleState } from '../contracts/lifecycle';
import { ExtensionRegistry } from './ExtensionRegistry';
import { PluginLifecycleMachine } from './PluginLifecycleMachine';
import { PluginRegistry } from './PluginRegistry';

describe('PluginLifecycleMachine', () => {
  it('walks the happy path discovered → … → active → inactive → uninstalled', () => {
    const m = new PluginLifecycleMachine('p');
    expect(m.state).toBe(PluginLifecycleState.Discovered);
    m.apply(PluginLifecycleEvent.Install);
    m.apply(PluginLifecycleEvent.Validate);
    m.apply(PluginLifecycleEvent.Activate);
    expect(m.state).toBe(PluginLifecycleState.Active);
    m.apply(PluginLifecycleEvent.Deactivate);
    expect(m.state).toBe(PluginLifecycleState.Inactive);
    m.apply(PluginLifecycleEvent.Uninstall);
    expect(m.state).toBe(PluginLifecycleState.Uninstalled);
    expect(m.history).toHaveLength(5);
  });

  it('rejects illegal transitions', () => {
    const m = new PluginLifecycleMachine('p');
    // Cannot activate straight from discovered.
    expect(() => m.apply(PluginLifecycleEvent.Activate)).toThrow(IllegalLifecycleTransitionError);
    expect(m.can(PluginLifecycleEvent.Activate)).toBe(false);
  });

  it('can fail and recover via reset', () => {
    const m = new PluginLifecycleMachine('p');
    m.apply(PluginLifecycleEvent.Install);
    m.apply(PluginLifecycleEvent.Fail);
    expect(m.state).toBe(PluginLifecycleState.Failed);
    m.apply(PluginLifecycleEvent.Reset);
    expect(m.state).toBe(PluginLifecycleState.Installed);
  });

  it('treats uninstalled as terminal', () => {
    const m = new PluginLifecycleMachine('p', PluginLifecycleState.Uninstalled);
    expect(m.can(PluginLifecycleEvent.Install)).toBe(false);
  });
});

describe('PluginRegistry', () => {
  const make = (id: string) => ({
    id,
    source: { id, resolve: () => Promise.reject(new Error('unused')) },
    lifecycle: new PluginLifecycleMachine(id),
  });

  it('stores, finds and removes records', () => {
    const reg = new PluginRegistry();
    reg.add(make('a'));
    expect(reg.has('a')).toBe(true);
    expect(reg.get('a').id).toBe('a');
    reg.remove('a');
    expect(reg.has('a')).toBe(false);
  });

  it('rejects duplicate ids and unknown lookups', () => {
    const reg = new PluginRegistry();
    reg.add(make('a'));
    expect(() => reg.add(make('a'))).toThrow(DuplicatePluginError);
    expect(() => reg.get('missing')).toThrow(PluginNotFoundError);
  });
});

describe('ExtensionRegistry', () => {
  it('registers, looks up by point and withdraws by plugin', () => {
    const reg = new ExtensionRegistry();
    reg.add('p1', {
      point: ExtensionPointId.UiPanel,
      panelId: 'x',
      title: 'X',
      route: '/x',
    });
    reg.add('p2', {
      point: ExtensionPointId.UiPanel,
      panelId: 'y',
      title: 'Y',
      route: '/y',
    });
    expect(reg.uiPanels()).toHaveLength(2);
    expect(reg.size()).toBe(2);
    reg.removePlugin('p1');
    expect(reg.uiPanels()).toHaveLength(1);
    expect(reg.uiPanels()[0]?.panelId).toBe('y');
  });
});
