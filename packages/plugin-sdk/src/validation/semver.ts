/**
 * Minimal, dependency-free semantic-version utilities.
 *
 * Supports the subset M-A-S needs to validate plugin compatibility: parsing
 * `major.minor.patch` (with an optional pre-release tag), comparison, and range
 * satisfaction for `^`, `~`, exact, and the comparators `>`, `>=`, `<`, `<=`,
 * `=`. A space-separated range is an AND of comparators (e.g. ">=0.7.0 <1.0.0");
 * `||` separates OR alternatives. Build metadata is ignored. Pre-release
 * versions are ordered below their release and only satisfy a range when that
 * range explicitly pins the same major.minor.patch.
 */

/** A parsed semantic version. */
export interface SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  /** Dot-separated pre-release identifiers, e.g. ["rc", "1"]; empty when none. */
  readonly prerelease: readonly string[];
}

const CORE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** Parse a version string into a {@link SemVer}, or `null` when invalid. */
export const parseSemVer = (version: string): SemVer | null => {
  const match = CORE.exec(version.trim());
  if (match === null) {
    return null;
  }
  const [, major, minor, patch, pre] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: pre === undefined || pre.length === 0 ? [] : pre.split('.'),
  };
};

/** True when the string is a valid semantic version. */
export const isValidSemVer = (version: string): boolean => parseSemVer(version) !== null;

const comparePre = (a: readonly string[], b: readonly string[]): number => {
  // No pre-release outranks any pre-release.
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const ai = a[i];
    const bi = b[i];
    if (ai === undefined) return -1;
    if (bi === undefined) return 1;
    const an = /^\d+$/.test(ai);
    const bn = /^\d+$/.test(bi);
    if (an && bn) {
      const diff = Number(ai) - Number(bi);
      if (diff !== 0) return diff < 0 ? -1 : 1;
    } else if (an !== bn) {
      return an ? -1 : 1; // numeric identifiers have lower precedence.
    } else if (ai !== bi) {
      return ai < bi ? -1 : 1;
    }
  }
  return 0;
};

/** Compare two versions: -1 (a<b), 0 (equal), 1 (a>b). */
export const compareSemVer = (a: SemVer, b: SemVer): number => {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return comparePre(a.prerelease, b.prerelease);
};

type Comparator = (v: SemVer) => boolean;

const eqCore = (v: SemVer, t: SemVer): boolean =>
  v.major === t.major && v.minor === t.minor && v.patch === t.patch;

/** Build the upper bound for a caret range (`^`). */
const caretUpper = (t: SemVer): SemVer => {
  if (t.major > 0) return { major: t.major + 1, minor: 0, patch: 0, prerelease: [] };
  if (t.minor > 0) return { major: 0, minor: t.minor + 1, patch: 0, prerelease: [] };
  return { major: 0, minor: 0, patch: t.patch + 1, prerelease: [] };
};

/** Build the upper bound for a tilde range (`~`): allows patch-level changes. */
const tildeUpper = (t: SemVer): SemVer => ({
  major: t.major,
  minor: t.minor + 1,
  patch: 0,
  prerelease: [],
});

const parseComparator = (token: string): Comparator | null => {
  const t = token.trim();
  if (t.length === 0 || t === '*' || t === 'x' || t === 'X') {
    return () => true;
  }
  const opMatch = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/.exec(t);
  if (opMatch === null) return null;
  const op = opMatch[1] ?? '=';
  const target = parseSemVer(opMatch[2] ?? '');
  if (target === null) return null;

  // A pre-release version only matches a comparator whose target pins the same
  // core version, mirroring node-semver's "no pre-release leaking" behaviour.
  const allowsPre = (v: SemVer): boolean => v.prerelease.length === 0 || eqCore(v, target);

  switch (op) {
    case '>':
      return (v) => allowsPre(v) && compareSemVer(v, target) > 0;
    case '>=':
      return (v) => allowsPre(v) && compareSemVer(v, target) >= 0;
    case '<':
      return (v) => allowsPre(v) && compareSemVer(v, target) < 0;
    case '<=':
      return (v) => allowsPre(v) && compareSemVer(v, target) <= 0;
    case '=':
      return (v) => compareSemVer(v, target) === 0;
    case '^': {
      const upper = caretUpper(target);
      return (v) => allowsPre(v) && compareSemVer(v, target) >= 0 && compareSemVer(v, upper) < 0;
    }
    case '~': {
      const upper = tildeUpper(target);
      return (v) => allowsPre(v) && compareSemVer(v, target) >= 0 && compareSemVer(v, upper) < 0;
    }
    default:
      return null;
  }
};

/**
 * True when `version` satisfies `range`. Returns `false` (never throws) when
 * either input is malformed, so a bad range can never crash compatibility
 * checks.
 */
export const satisfies = (version: string, range: string): boolean => {
  const v = parseSemVer(version);
  if (v === null) return false;
  const alternatives = range.split('||');
  for (const alt of alternatives) {
    const tokens = alt
      .trim()
      .split(/\s+/)
      .filter((s) => s.length > 0);
    if (tokens.length === 0) continue;
    const comparators = tokens.map(parseComparator);
    if (comparators.some((c) => c === null)) continue; // skip malformed alternative.
    if ((comparators as Comparator[]).every((c) => c(v))) {
      return true;
    }
  }
  return false;
};
