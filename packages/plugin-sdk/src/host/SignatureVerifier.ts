/**
 * Plugin signing & verification (security — Part E).
 *
 * Uses Node's built-in `crypto` (Ed25519) to verify a detached signature over
 * the plugin's CANONICAL package bytes (manifest + code) against a trust store
 * of known public keys. No third-party dependency, fully offline-testable.
 *
 * Behaviour is policy-driven and explicit:
 *  - a valid signature from a trusted key → `Verified` (accepted)
 *  - no signature                         → `Unsigned`  (accepted only if policy allows)
 *  - a signature that does not verify      → `Invalid`   (always rejected)
 *  - a signature from an unknown key       → `Untrusted` (accepted only if policy allows)
 *
 * Tampering with either the manifest or the code changes the canonical bytes,
 * so a previously-valid signature becomes `Invalid`.
 */
import { createPublicKey, sign as cryptoSign, verify as cryptoVerify, type KeyObject } from 'node:crypto';

import { type PluginManifest } from '../contracts/manifest';
import { type ResolvedPlugin } from '../contracts/plugin';

/** The outcome category of verifying a package. */
export enum SignatureStatus {
  Verified = 'verified',
  Unsigned = 'unsigned',
  Invalid = 'invalid',
  Untrusted = 'untrusted',
}

/** Whether unsigned / untrusted plugins may load. */
export interface SignaturePolicy {
  readonly allowUnsigned: boolean;
  readonly allowUntrusted: boolean;
}

/** Strict policy: only trusted, validly-signed plugins load. */
export const STRICT_SIGNATURE_POLICY: SignaturePolicy = {
  allowUnsigned: false,
  allowUntrusted: false,
};

/** Permissive policy (developer mode): unsigned plugins load with a warning. */
export const PERMISSIVE_SIGNATURE_POLICY: SignaturePolicy = {
  allowUnsigned: true,
  allowUntrusted: true,
};

/** The result of verifying one package. */
export interface VerificationResult {
  readonly status: SignatureStatus;
  /** Whether the active policy accepts this status. */
  readonly accepted: boolean;
  readonly reason: string;
}

/**
 * Build the canonical, deterministic bytes a signature is computed over. The
 * manifest is serialised with sorted keys so trivial reordering cannot change
 * the digest; the code is appended verbatim.
 */
export const canonicalPackageBytes = (manifest: PluginManifest, code: string): Uint8Array => {
  const canonicalManifest = stableStringify(manifest);
  return new TextEncoder().encode(`${canonicalManifest}\u0000${code}`);
};

/** Deterministic JSON: object keys sorted recursively. */
const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
};

/** Sign canonical package bytes with an Ed25519 private key (tooling/tests). */
export const signPackage = (packageBytes: Uint8Array, privateKey: KeyObject): Uint8Array =>
  new Uint8Array(cryptoSign(null, Buffer.from(packageBytes), privateKey));

/** Verifies plugin packages against a trust store under a signature policy. */
export class SignatureVerifier {
  private readonly trustedKeys: Map<string, KeyObject>;

  public constructor(
    trustedKeys: Iterable<readonly [string, KeyObject | string]> = [],
    private readonly policy: SignaturePolicy = STRICT_SIGNATURE_POLICY,
  ) {
    this.trustedKeys = new Map();
    for (const [keyId, key] of trustedKeys) {
      this.trustedKeys.set(keyId, typeof key === 'string' ? createPublicKey(key) : key);
    }
  }

  /** Register/replace a trusted public key. */
  public trust(keyId: string, key: KeyObject | string): void {
    this.trustedKeys.set(keyId, typeof key === 'string' ? createPublicKey(key) : key);
  }

  /** Verify a resolved plugin's signature under the active policy. */
  public verify(resolved: ResolvedPlugin): VerificationResult {
    const { signature, keyId } = resolved;

    if (signature === undefined || keyId === undefined) {
      return {
        status: SignatureStatus.Unsigned,
        accepted: this.policy.allowUnsigned,
        reason: this.policy.allowUnsigned
          ? 'Plugin is unsigned; accepted under the active policy.'
          : 'Plugin is unsigned and the active policy forbids unsigned plugins.',
      };
    }

    const publicKey = this.trustedKeys.get(keyId);
    if (publicKey === undefined) {
      return {
        status: SignatureStatus.Untrusted,
        accepted: this.policy.allowUntrusted,
        reason: `Signed by unknown key "${keyId}"; ${
          this.policy.allowUntrusted ? 'accepted under policy.' : 'not in the trust store.'
        }`,
      };
    }

    let valid = false;
    try {
      valid = cryptoVerify(
        null,
        Buffer.from(resolved.packageBytes),
        publicKey,
        Buffer.from(signature),
      );
    } catch {
      valid = false;
    }

    if (!valid) {
      return {
        status: SignatureStatus.Invalid,
        accepted: false,
        reason: 'Signature does not match the package (tampered or wrong key).',
      };
    }

    return {
      status: SignatureStatus.Verified,
      accepted: true,
      reason: `Verified against trusted key "${keyId}".`,
    };
  }
}
