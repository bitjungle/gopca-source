import { describe, it, expect } from 'vitest';
import { formatThresholdValue } from './thresholdLabel';

describe('formatThresholdValue', () => {
    it('shortens the derived loadings threshold', () => {
        // 1/sqrt(24), the al_alloy case that motivated this (#1000).
        expect(formatThresholdValue(1 / Math.sqrt(24))).toBe('0.204');
    });

    it('leaves a round value round', () => {
        expect(formatThresholdValue(80)).toBe('80');
        expect(formatThresholdValue(0.3)).toBe('0.3');
    });

    it('keeps a decimal that carries information', () => {
        expect(formatThresholdValue(82.5)).toBe('82.5');
    });

    it('does not report a small threshold as zero', () => {
        // Rounding to three decimals alone would print "0", which is a different
        // number, not a shorter spelling of the same one.
        expect(formatThresholdValue(0.00012345)).toBe('0.000123');
        expect(formatThresholdValue(0)).toBe('0');
    });

    it('drops trailing zeros in the small-value fallback too', () => {
        // Three significant digits is what the value is rounded *to*, not how
        // many are necessarily shown: 0.000100 and 0.0001 are the same number.
        expect(formatThresholdValue(0.000100)).toBe('0.0001');
    });

    it('honours a caller that wants different precision', () => {
        expect(formatThresholdValue(1 / Math.sqrt(24), 1)).toBe('0.2');
    });

    it('passes non-finite values through rather than inventing a number', () => {
        expect(formatThresholdValue(NaN)).toBe('NaN');
        expect(formatThresholdValue(Infinity)).toBe('Infinity');
    });
});
