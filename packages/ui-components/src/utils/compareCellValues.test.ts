import { describe, expect, it } from 'vitest';
import { compareCellValues } from './compareCellValues';

const sorted = (values: string[]) => [...values].sort(compareCellValues);

describe('compareCellValues', () => {
    it('orders scientific notation against decimals by value', () => {
        // The reported failure: sorting Zn descending put 7e-05 above 0.12,
        // because '7' > '0' (#963).
        expect(compareCellValues('7e-05', '0.12')).toBeLessThan(0);
        expect(sorted(['0.12', '7e-05', '6e-06', '0.1'])).toEqual(['6e-06', '7e-05', '0.1', '0.12']);
    });

    it('orders row identifiers by value, not by digit', () => {
        expect(sorted(['1', '10', '100', '2', '21', '3'])).toEqual(['1', '2', '3', '10', '21', '100']);
    });

    it('still orders text as text', () => {
        expect(sorted(['AA7075', 'AA7055', 'AA6061'])).toEqual(['AA6061', 'AA7055', 'AA7075']);
        expect(sorted(['PAPR0050', 'PAPR0008'])).toEqual(['PAPR0008', 'PAPR0050']);
    });

    it('does not read a blank cell as zero', () => {
        // Number('') is 0. Treating blanks as numeric would file every empty
        // cell among the measurements, between the negatives and the positives.
        expect(sorted(['', '5', '-3'])).toEqual(['-3', '5', '']);
        expect(sorted(['   ', '0'])).toEqual(['0', '   ']);
    });

    it('keeps measurements together when a column mixes numbers and markers', () => {
        expect(sorted(['n/a', '2', 'NA', '10'])).toEqual(['2', '10', 'NA', 'n/a']);
    });

    it('treats non-finite spellings as text', () => {
        expect(compareCellValues('Infinity', '5')).toBeGreaterThan(0);
        expect(compareCellValues('NaN', '5')).toBeGreaterThan(0);
    });

    it('handles negatives and zero', () => {
        expect(sorted(['0', '-0.5', '-10', '0.5'])).toEqual(['-10', '-0.5', '0', '0.5']);
    });

    it('survives null and undefined', () => {
        expect(compareCellValues(null, '5')).toBeGreaterThan(0);
        expect(compareCellValues(undefined, undefined)).toBe(0);
    });

    it('reports equal values as equal, however small', () => {
        // Subtracting two tiny values can round to zero; two huge ones can
        // overflow. Neither must be mistaken for equality or inequality.
        expect(compareCellValues('1e-320', '2e-320')).toBeLessThan(0);
        expect(compareCellValues('1e308', '2e308')).toBeLessThan(0);
        expect(compareCellValues('0.30', '0.3')).toBe(0);
    });
});
