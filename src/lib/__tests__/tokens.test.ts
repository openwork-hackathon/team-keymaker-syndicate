import { describe, it, expect } from 'vitest';
import { calculateAuraLevel } from '../tokens';

describe('calculateAuraLevel', () => {
  const oneToken = 10n ** 18n;

  it('should return 0 for zero balance', () => {
    expect(calculateAuraLevel(0n)).toBe(0);
  });

  it('should return 1 for balance >= 1 OWT', () => {
    expect(calculateAuraLevel(oneToken)).toBe(1);
    expect(calculateAuraLevel(50n * oneToken)).toBe(1);
  });

  it('should return 2 for balance >= 100 OWT', () => {
    expect(calculateAuraLevel(100n * oneToken)).toBe(2);
    expect(calculateAuraLevel(500n * oneToken)).toBe(2);
  });

  it('should return 3 for balance >= 1000 OWT', () => {
    expect(calculateAuraLevel(1000n * oneToken)).toBe(3);
    expect(calculateAuraLevel(10000n * oneToken)).toBe(3);
  });
});
