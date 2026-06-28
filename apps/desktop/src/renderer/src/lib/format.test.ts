import { describe, it, expect } from 'vitest';

import {
  capitalize,
  clamp,
  formatDate,
  formatScore,
  initials,
  pluralize,
  titleCase,
} from './format';

describe('format helpers', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('navy')).toBe('Navy');
    expect(capitalize('')).toBe('');
  });

  it('builds title case from kebab/snake identifiers', () => {
    expect(titleCase('dress-shoes')).toBe('Dress Shoes');
    expect(titleCase('all-season')).toBe('All Season');
    expect(titleCase('t-shirt')).toBe('T Shirt');
    expect(titleCase('in_laundry')).toBe('In Laundry');
  });

  it('pluralizes based on count', () => {
    expect(pluralize(1, 'item')).toBe('1 item');
    expect(pluralize(3, 'item')).toBe('3 items');
    expect(pluralize(2, 'category', 'categories')).toBe('2 categories');
  });

  it('clamps numbers into range', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(42, 0, 100)).toBe(42);
  });

  it('formats scores as clamped rounded percentages', () => {
    expect(formatScore(87.4)).toBe('87%');
    expect(formatScore(87.6)).toBe('88%');
    expect(formatScore(120)).toBe('100%');
    expect(formatScore(-3)).toBe('0%');
  });

  it('formats ISO dates deterministically in UTC', () => {
    expect(formatDate('2026-06-30T10:00:00.000Z')).toBe('30 Jun 2026');
    expect(formatDate('2026-01-05')).toBe('05 Jan 2026');
  });

  it('returns the original string for unparseable dates', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('derives initials from names', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('Cher')).toBe('CH');
    expect(initials('  ')).toBe('?');
    expect(initials('mary jane watson')).toBe('MW');
  });
});
