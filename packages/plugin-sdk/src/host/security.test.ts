import { generateKeyPairSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { PermissionDeniedError, ResourceLimitExceededError } from '../contracts/errors';
import { type PluginManifest } from '../contracts/manifest';
import { type ResolvedPlugin } from '../contracts/plugin';
import { type ResourceLimits } from '../contracts/sandbox';
import { PermissionGuard } from './PermissionGuard';
import { ResourceMeter, runWithTimeout } from './ResourceMeter';
import {
  PERMISSIVE_SIGNATURE_POLICY,
  SignatureStatus,
  SignatureVerifier,
  STRICT_SIGNATURE_POLICY,
  canonicalPackageBytes,
  signPackage,
} from './SignatureVerifier';

const manifest: PluginManifest = {
  id: 'acme.tool',
  name: 'Acme Tool',
  version: '1.0.0',
  manifestSchemaVersion: 1,
  engines: { mas: '^0.7.0' },
  permissions: ['wardrobe:read'],
  contributes: [],
};

const keypair = (): {
  publicKey: import('node:crypto').KeyObject;
  privateKey: import('node:crypto').KeyObject;
} => generateKeyPairSync('ed25519');

describe('SignatureVerifier', () => {
  it('verifies a valid signature from a trusted key', () => {
    const { publicKey, privateKey } = keypair();
    const bytes = canonicalPackageBytes(manifest, 'export const x = 1;');
    const resolved: ResolvedPlugin = {
      manifest,
      packageBytes: bytes,
      signature: signPackage(bytes, privateKey),
      keyId: 'trusted-1',
    };
    const verifier = new SignatureVerifier([['trusted-1', publicKey]], STRICT_SIGNATURE_POLICY);
    const result = verifier.verify(resolved);
    expect(result.status).toBe(SignatureStatus.Verified);
    expect(result.accepted).toBe(true);
  });

  it('rejects a tampered package (signature no longer matches)', () => {
    const { publicKey, privateKey } = keypair();
    const bytes = canonicalPackageBytes(manifest, 'export const x = 1;');
    const signature = signPackage(bytes, privateKey);
    const tampered = canonicalPackageBytes(manifest, 'export const x = 2; // changed');
    const resolved: ResolvedPlugin = {
      manifest,
      packageBytes: tampered,
      signature,
      keyId: 'trusted-1',
    };
    const verifier = new SignatureVerifier([['trusted-1', publicKey]], STRICT_SIGNATURE_POLICY);
    const result = verifier.verify(resolved);
    expect(result.status).toBe(SignatureStatus.Invalid);
    expect(result.accepted).toBe(false);
  });

  it('treats an unknown signing key as untrusted', () => {
    const { privateKey } = keypair();
    const bytes = canonicalPackageBytes(manifest, 'code');
    const resolved: ResolvedPlugin = {
      manifest,
      packageBytes: bytes,
      signature: signPackage(bytes, privateKey),
      keyId: 'stranger',
    };
    const verifier = new SignatureVerifier([], STRICT_SIGNATURE_POLICY);
    expect(verifier.verify(resolved).status).toBe(SignatureStatus.Untrusted);
    expect(verifier.verify(resolved).accepted).toBe(false);
  });

  it('honours the policy for unsigned plugins', () => {
    const resolved: ResolvedPlugin = {
      manifest,
      packageBytes: canonicalPackageBytes(manifest, ''),
    };
    expect(new SignatureVerifier([], STRICT_SIGNATURE_POLICY).verify(resolved).accepted).toBe(
      false,
    );
    const permissive = new SignatureVerifier([], PERMISSIVE_SIGNATURE_POLICY).verify(resolved);
    expect(permissive.status).toBe(SignatureStatus.Unsigned);
    expect(permissive.accepted).toBe(true);
  });
});

describe('PermissionGuard', () => {
  it('allows granted capabilities and denies the rest', () => {
    const guard = new PermissionGuard('acme.tool', ['wardrobe:read']);
    expect(guard.has('wardrobe:read')).toBe(true);
    expect(guard.require('wardrobe:read')).toBe('wardrobe:read');
    expect(() => guard.require('wardrobe:write')).toThrow(PermissionDeniedError);
  });
});

describe('ResourceMeter', () => {
  const limits: ResourceLimits = { maxCallMs: 50, maxInvocations: 3, maxMemoryMb: 64 };

  it('aborts a call that exceeds the time limit', async () => {
    await expect(
      runWithTimeout(() => new Promise((resolve) => setTimeout(resolve, 200)), 20, 'acme.tool'),
    ).rejects.toBeInstanceOf(ResourceLimitExceededError);
  });

  it('resolves a fast call within the limit', async () => {
    await expect(runWithTimeout(() => 42, 50)).resolves.toBe(42);
  });

  it('enforces the invocation quota and throttles', () => {
    const meter = new ResourceMeter('acme.tool', limits);
    meter.account(1);
    meter.account(1);
    meter.account(1);
    expect(() => meter.account(1)).toThrow(ResourceLimitExceededError);
    expect(meter.throttled).toBe(true);
    expect(() => meter.ensureNotThrottled()).toThrow(ResourceLimitExceededError);
  });

  it('enforces the memory ceiling', () => {
    const meter = new ResourceMeter('acme.tool', limits);
    expect(() => meter.account(1, 128)).toThrow(ResourceLimitExceededError);
  });
});
