/**
 * Issue #1013: a level's colour depended on where it first occurred in the
 * file, because the legend was built in first-appearance order and the colour
 * taken from that index. The rule applied here is the one GoCSV already uses
 * for one-hot column order (#996), and the first describe block is the Go test
 * table from pkg/transform/category_sort_test.go verbatim, so the two
 * implementations are checked against the same inputs and cannot drift apart
 * without one of the suites going red.
 */

import { describe, it, expect } from 'vitest';
import { parseCategoryNumber, sortCategoryLevels, uniqueCategoryLevels } from './categoryOrder';

describe('sortCategoryLevels agrees with Go sortCategoryValues', () => {
    const table: [string, string[], string[]][] = [
        ['numeric codes sort as numbers', ['10', '2', '1', '11', '9'], ['1', '2', '9', '10', '11']],
        [
            'the al_alloy processing codes',
            ['1', '10', '11', '2', '3', '4', '5', '7', '8', '9'],
            ['1', '2', '3', '4', '5', '7', '8', '9', '10', '11']
        ],
        ['decimals and negatives', ['2.5', '-1', '10', '0'], ['-1', '0', '2.5', '10']],
        ['one non-numeric value sends the whole set back to text order', ['10', '2', 'unknown'], ['10', '2', 'unknown']],
        ['text categories are untouched', ['paris', 'tokyo', 'amsterdam'], ['amsterdam', 'paris', 'tokyo']],
        ['equal numbers keep a deterministic order', ['1.0', '1', '0'], ['0', '1', '1.0']],
        ['padded codes', ['03', '1', '20'], ['1', '03', '20']],
        ['NaN is not treated as a number, because it cannot be ordered', ['10', '2', 'NaN', '1', '3'], ['1', '10', '2', '3', 'NaN']],
        ['nor in any other spelling', ['10', '2', 'nan'], ['10', '2', 'nan']],
        ['infinities do order, and are kept numeric', ['10', '-Inf', '2', 'Inf'], ['-Inf', '2', '10', 'Inf']],
        ['empty', [], []]
    ];

    it.each(table)('%s', (_name, input, want) => {
        expect(sortCategoryLevels(input)).toEqual(want);
    });

    it('does not modify its input', () => {
        const input = ['10', '2', '1'];
        sortCategoryLevels(input);
        expect(input).toEqual(['10', '2', '1']);
    });
});

describe('parseCategoryNumber', () => {
    it('reads what Number() reads, except the empty cases', () => {
        expect(parseCategoryNumber('1e3')).toBe(1000);
        expect(parseCategoryNumber(' 7 ')).toBe(7);
        expect(parseCategoryNumber('')).toBeUndefined();
        expect(parseCategoryNumber('   ')).toBeUndefined();
    });

    it('knows the Inf spellings Go writes and Number() does not', () => {
        expect(parseCategoryNumber('Inf')).toBe(Infinity);
        expect(parseCategoryNumber('-inf')).toBe(-Infinity);
        expect(parseCategoryNumber('+Infinity')).toBe(Infinity);
        expect(parseCategoryNumber('NaN')).toBeUndefined();
    });
});

describe('uniqueCategoryLevels', () => {
    // The measurement in #1013: level 10 was first in the full al_alloy file and
    // eighth in a Source-filtered subset, so its colour index was 0 in one plot
    // and 7 in the other.
    const fullFile = ['10', '11', '1', '9', '2', '3', '4', '7', '5', '8', '10', '2'];
    const filtered = ['1', '9', '2', '3', '4', '7', '5', '10', '11', '8'];

    it('gives a level the same index whatever the row order', () => {
        expect(uniqueCategoryLevels(fullFile).indexOf('10')).toBe(uniqueCategoryLevels(filtered).indexOf('10'));
    });

    it('is the sorted set, not the first-appearance set', () => {
        expect(uniqueCategoryLevels(fullFile)).toEqual(['1', '2', '3', '4', '5', '7', '8', '9', '10', '11']);
    });
});
