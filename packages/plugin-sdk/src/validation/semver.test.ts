import { describe, expect, it } from 'vitest';

import { compareSemVer, isValidSemVer, parseSemVer, satisfies } from './semver';

describe('semver parsing', () => {
  it('parses core + pre-release and ignores build metadata', () => {
    expect(parseSemVer('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] });
    expect(parseSemVer('0.7.0-rc.1+build.5')).toEqual({
      major: 0,
      minor: 7,
      patch: 0,
      prerelease: ['rc', '1'],
    });
  });

  it('rejects malformed versions', () => {
    expect(parseSemVer('1.2')).toBeNull();
    expect(parseSemVer('v1.2.3')).toBeNull();
    expect(isValidSemVer('not-a-version')).toBe(false);
    expect(isValidSemVer('1.0.0')).toBe(true);
  });
});

describe('semver comparison', () => {
  it('orders by major/minor/patch', () => {
    expect(compareSemVer(parseSemVer('1.0.0')!, parseSemVer('1.0.1')!)).toBe(-1);
    expect(compareSemVer(parseSemVer('2.0.0')!, parseSemVer('1.9.9')!)).toBe(1);
    expect(compareSemVer(parseSemVer('1.2.3')!, parseSemVer('1.2.3')!)).toBe(0);
  });

  it('orders a pre-release below its release', () => {
    expect(compareSemVer(parseSemVer('1.0.0-rc.1')!, parseSemVer('1.0.0')!)).toBe(-1);
    expect(compareSemVer(parseSemVer('1.0.0-rc.2')!, parseSemVer('1.0.0-rc.1')!)).toBe(1);
  });
});

describe('semver range satisfaction', () => {
  it('handles caret ranges', () => {
    expect(satisfies('0.7.5', '^0.7.0')).toBe(true);
    expect(satisfies('0.8.0', '^0.7.0')).toBe(false); // 0.x caret pins the minor
    expect(satisfies('1.4.0', '^1.2.0')).toBe(true);
    expect(satisfies('2.0.0', '^1.2.0')).toBe(false);
  });

  it('handles tilde and comparator AND ranges', () => {
    expect(satisfies('1.2.9', '~1.2.0')).toBe(true);
    expect(satisfies('1.3.0', '~1.2.0')).toBe(false);
    expect(satisfies('0.7.0', '>=0.7.0 <1.0.0')).toBe(true);
    expect(satisfies('1.0.0', '>=0.7.0 <1.0.0')).toBe(false);
  });

  it('handles OR alternatives and wildcards', () => {
    expect(satisfies('2.1.0', '^1.0.0 || ^2.0.0')).toBe(true);
    expect(satisfies('3.0.0', '*')).toBe(true);
  });

  it('never throws on malformed input', () => {
    expect(satisfies('not-a-version', '^1.0.0')).toBe(false);
    expect(satisfies('1.0.0', 'garbage///')).toBe(false);
  });
});
