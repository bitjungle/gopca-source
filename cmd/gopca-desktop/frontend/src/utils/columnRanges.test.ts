// GoPCA Suite
//
// Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
//
// This file is part of GoPCA Suite.
//
// GoPCA Suite is source-available software with free binary redistribution.
// Official compiled binary releases may be used and redistributed free of charge
// under the GoPCA Suite Source-Available Freeware License.
//
// The source code is provided for viewing, review, education, security analysis,
// research, interoperability analysis, and evaluation only.
//
// Modification, redistribution, publication, sublicensing, reuse, incorporation
// into another project, or creation of derivative works based on the source code
// is not permitted without prior written permission from the copyright holder.
//
// Usage Restriction: GoPCA Suite may not be used, directly or indirectly, for
// military, warfare, weapons, intelligence, surveillance, targeting, or
// law-enforcement surveillance applications.
//
// See LICENSE for the full license terms.

import { describe, it, expect } from 'vitest';
import {
    toRuns, describeRun, runToIndices, parseRangeSpec, columnMeans, namesFormOrderedAxis,
    columnExtents, profileFractions, sharedScaleIsReadable, columnBoxStats, boxFractions, BoxStats
} from './columnRanges';

// A 700-channel NIR axis, 1100–2498 nm at 2 nm steps, as in the Corn dataset.
const NIR = Array.from({ length: 700 }, (_, i) => String(1100 + i * 2));
const idx = (nm: number) => (nm - 1100) / 2;

describe('toRuns', () => {
    it('returns nothing for an empty selection', () => {
        expect(toRuns([])).toEqual([]);
    });

    it('collapses a contiguous block into one run', () => {
        expect(toRuns([3, 4, 5, 6])).toEqual([{ start: 3, end: 6 }]);
    });

    it('separates disjoint blocks', () => {
        expect(toRuns([1, 2, 7, 8, 9])).toEqual([{ start: 1, end: 2 }, { start: 7, end: 9 }]);
    });

    it('sorts and de-duplicates its input', () => {
        expect(toRuns([5, 3, 4, 3])).toEqual([{ start: 3, end: 5 }]);
    });

    it('turns the two Corn water bands into two runs, not 57 entries', () => {
        const water = [
            ...Array.from({ length: 26 }, (_, i) => idx(1400) + i),
            ...Array.from({ length: 31 }, (_, i) => idx(1900) + i)
        ];
        expect(water).toHaveLength(57);
        const runs = toRuns(water);
        expect(runs).toHaveLength(2);
        expect(describeRun(runs[0], NIR)).toBe('1400–1450');
        expect(describeRun(runs[1], NIR)).toBe('1900–1960');
    });
});

describe('describeRun', () => {
    it('names a single column without a dash', () => {
        expect(describeRun({ start: 0, end: 0 }, NIR)).toBe('1100');
    });
    it('falls back to a 1-based position when a name is missing', () => {
        expect(describeRun({ start: 1, end: 2 }, [])).toBe('2–3');
    });
});

describe('runToIndices', () => {
    it('expands inclusive bounds', () => {
        expect(runToIndices({ start: 2, end: 5 })).toEqual([2, 3, 4, 5]);
    });
});

describe('parseRangeSpec', () => {
    it('resolves a range written as wavelengths', () => {
        const { indices, errors } = parseRangeSpec('1400-1450', NIR);
        expect(errors).toEqual([]);
        expect(indices).toHaveLength(26);
        expect(NIR[indices[0]]).toBe('1400');
        expect(NIR[indices[25]]).toBe('1450');
    });

    it('handles the full Corn water-band expression', () => {
        const { indices, errors } = parseRangeSpec('1400-1450, 1900-1960', NIR);
        expect(errors).toEqual([]);
        expect(indices).toHaveLength(57);
    });

    it('prefers a column name over an index, matching the CLI', () => {
        // Columns named 5..12: "5" must mean the column called 5, not the fifth.
        const headers = ['5', '6', '7', '8', '9', '10', '11', '12'];
        expect(parseRangeSpec('5', headers).indices).toEqual([0]);
    });

    it('falls back to a 1-based index when no column carries that name', () => {
        expect(parseRangeSpec('3', ['a', 'b', 'c', 'd']).indices).toEqual([2]);
    });

    it('treats a hyphenated column name as a name, not a range', () => {
        expect(parseRangeSpec('col-1', ['col-1', 'col-2', 'x']).indices).toEqual([0]);
    });

    it('reports unresolvable tokens instead of dropping them', () => {
        const { indices, errors } = parseRangeSpec('1400, nope, 99999', NIR);
        expect(indices).toEqual([idx(1400)]);
        expect(errors).toHaveLength(2);
    });

    it('rejects an inverted or out-of-bounds index range', () => {
        expect(parseRangeSpec('9-2', ['a', 'b', 'c']).errors).toHaveLength(1);
        expect(parseRangeSpec('1-99', ['a', 'b', 'c']).errors).toHaveLength(1);
    });

    it('ignores empty tokens and surrounding whitespace', () => {
        expect(parseRangeSpec(' 1400 , , 1402 ', NIR).indices)
            .toEqual([idx(1400), idx(1402)]);
    });

    it('de-duplicates overlapping ranges', () => {
        const { indices } = parseRangeSpec('1100-1110, 1106-1120', NIR);
        expect(indices).toEqual([...new Set(indices)]);
        expect(indices).toHaveLength(11);
    });
});

describe('columnMeans', () => {
    it('averages each column', () => {
        expect(columnMeans([[1, 10], [3, 20]], 2)).toEqual([2, 15]);
    });
    it('skips non-finite values rather than poisoning the mean', () => {
        expect(columnMeans([[1, NaN], [3, 20]], 2)).toEqual([2, 20]);
    });
    it('returns zero for a column with no finite values', () => {
        expect(columnMeans([[NaN], [NaN]], 1)).toEqual([0]);
    });
});

describe('namesFormOrderedAxis', () => {
    it('accepts a spectrum sampled at regular intervals', () => {
        expect(namesFormOrderedAxis(NIR)).toBe(true);
    });

    it('accepts a descending axis', () => {
        expect(namesFormOrderedAxis(['2498', '2496', '2494'])).toBe(true);
    });

    it('accepts an unevenly sampled axis, which is still an axis', () => {
        expect(namesFormOrderedAxis(['400', '410', '480', '1200'])).toBe(true);
    });

    it('rejects named variables — a line through them would invent continuity', () => {
        expect(namesFormOrderedAxis(['alcohol', 'malic_acid', 'ash'])).toBe(false);
    });

    it('rejects numeric names that carry no order', () => {
        expect(namesFormOrderedAxis(['1', '5', '3'])).toBe(false);
    });

    it('rejects a mix of numbers and names', () => {
        expect(namesFormOrderedAxis(['1100', '1102', 'Moisture'])).toBe(false);
    });

    it('rejects repeated values, which are not a strict ordering', () => {
        expect(namesFormOrderedAxis(['1100', '1100', '1102'])).toBe(false);
    });

    it('rejects blank names, since Number("") is 0', () => {
        expect(namesFormOrderedAxis(['', '1', '2'])).toBe(false);
    });

    it('rejects fewer than two columns, where the question is meaningless', () => {
        expect(namesFormOrderedAxis(['1100'])).toBe(false);
        expect(namesFormOrderedAxis([])).toBe(false);
    });
});

describe('columnExtents', () => {
    it('reports the smallest and largest value per column', () => {
        const data = [[1, 40], [3, 10], [2, 20]];
        expect(columnExtents(data, 2)).toEqual([
            { min: 1, max: 3, empty: false },
            { min: 10, max: 40, empty: false }
        ]);
    });

    it('ignores non-finite values rather than letting them win the comparison', () => {
        const data = [[NaN, 5], [2, Infinity], [8, 7]];
        expect(columnExtents(data, 2)).toEqual([
            { min: 2, max: 8, empty: false },
            { min: 5, max: 7, empty: false }
        ]);
    });

    it('marks a column with no finite values as empty', () => {
        expect(columnExtents([[NaN], [NaN]], 1)).toEqual([{ min: 0, max: 0, empty: true }]);
    });
});

describe('profileFractions', () => {
    it('places the smallest and largest column mean at the ends of the shared axis', () => {
        // Column means are 1, 5 and 9, so the middle one lands exactly halfway.
        const data = [[1, 5, 9]];
        expect(profileFractions(data, 3, 'shared')).toEqual([0, 0.5, 1]);
    });

    it('is the regression this change exists for: a large column no longer flattens the rest', () => {
        // Four spectral channels next to one target column two orders of magnitude
        // above them — the shape of testdata/corn/corn.csv.
        const data = [
            [0.10, 0.20, 0.30, 0.40, 64],
            [0.12, 0.22, 0.34, 0.44, 66]
        ];
        const shared = profileFractions(data, 5, 'shared');
        // Under one axis the four channels are indistinguishable from the floor.
        expect(shared.slice(0, 4).every(f => f < 0.01)).toBe(true);

        // Scaled per column they separate again: each mean sits mid-range, because
        // each channel here has two evenly spread observations.
        const independent = profileFractions(data, 5, 'independent');
        expect(independent.slice(0, 4).every(f => f > 0.4 && f < 0.6)).toBe(true);
    });

    it('puts the mean where it falls inside a skewed column', () => {
        // min 0, max 10, mean 1 -> one tenth of the way up.
        const data = [[0], [0], [0], [0], [0], [0], [0], [0], [0], [10]];
        expect(profileFractions(data, 1, 'independent')[0]).toBeCloseTo(0.1, 10);
    });

    it('gives a constant column half height, having no spread to place the mean in', () => {
        expect(profileFractions([[7], [7], [7]], 1, 'independent')).toEqual([0.5]);
    });

    it('draws nothing for a column with no finite values', () => {
        expect(profileFractions([[NaN], [NaN]], 1, 'independent')).toEqual([0]);
    });

    it('survives an empty dataset', () => {
        expect(profileFractions([], 0, 'shared')).toEqual([]);
        expect(profileFractions([], 0, 'independent')).toEqual([]);
    });
});

describe('sharedScaleIsReadable', () => {
    it('accepts columns of comparable magnitude, as in a spectrum', () => {
        const data = [Array.from({ length: 20 }, (_, i) => 0.5 + i * 0.01)];
        expect(sharedScaleIsReadable(data, 20)).toBe(true);
    });

    it('rejects a dataset where one column dwarfs the others', () => {
        // Wine: proline near 750 alongside hue near 1.
        const data = [[746, 0.96, 1.59, 0.36, 2.03]];
        expect(sharedScaleIsReadable(data, 5)).toBe(false);
    });

    it('treats no columns as trivially readable', () => {
        expect(sharedScaleIsReadable([], 0)).toBe(true);
    });
});

describe('columnBoxStats', () => {
    it('matches the linear-interpolation quantiles numpy and R type 7 produce', () => {
        // percentile([1..9], [25,50,75]) = 3, 5, 7
        const data = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => [v]);
        expect(columnBoxStats(data, 1)[0]).toMatchObject({
            min: 1, q1: 3, median: 5, q3: 7, max: 9, empty: false
        });
    });

    it('interpolates between order statistics rather than picking a neighbour', () => {
        // percentile([1,2,3,4], 25) = 1.75, median 2.5, 75 = 3.25
        const s = columnBoxStats([[1], [2], [3], [4]], 1)[0];
        expect(s.q1).toBeCloseTo(1.75, 10);
        expect(s.median).toBeCloseTo(2.5, 10);
        expect(s.q3).toBeCloseTo(3.25, 10);
    });

    it('summarises each column separately', () => {
        const stats = columnBoxStats([[1, 100], [2, 200], [3, 300]], 2);
        expect(stats[0].median).toBe(2);
        expect(stats[1].median).toBe(200);
    });

    it('ignores non-finite values instead of sorting them into the middle', () => {
        const s = columnBoxStats([[1], [NaN], [3], [5]], 1)[0];
        expect(s).toMatchObject({ min: 1, median: 3, max: 5, empty: false });
    });

    it('marks a column with no finite values as empty', () => {
        expect(columnBoxStats([[NaN], [NaN]], 1)[0].empty).toBe(true);
    });

    it('samples above the row cap, staying close to the exact quartiles', () => {
        // A skewed column, so sampling error would show if the stride biased it.
        const data = Array.from({ length: 6000 }, (_, i) => [Math.pow(i / 6000, 3) * 100]);
        const exact = columnBoxStats(data, 1, Number.MAX_SAFE_INTEGER)[0];
        const sampled = columnBoxStats(data, 1, 500)[0];
        const range = exact.max - exact.min;
        for (const k of ['q1', 'median', 'q3'] as const) {
            expect(Math.abs(exact[k] - sampled[k]) / range).toBeLessThan(0.01);
        }
    });
});

describe('boxFractions', () => {
    const stats = (o: Partial<BoxStats>): BoxStats => ({
        min: 0, q1: 0, median: 0, q3: 0, max: 0,
        lowerFence: 0, upperFence: 0,
        hasLowOutliers: false, hasHighOutliers: false,
        empty: false,
        ...o
    });

    it('puts the column min at the floor and its max at the top', () => {
        const f = boxFractions(stats({
            min: 0, q1: 25, median: 50, q3: 75, max: 100,
            lowerFence: 0, upperFence: 100
        }))!;
        expect(f).toMatchObject({ q1: 0.25, median: 0.5, q3: 0.75 });
    });

    it('shows a right-skewed column with its box low in the range', () => {
        const f = boxFractions(stats({
            min: 0, q1: 1, median: 2, q3: 4, max: 100,
            lowerFence: 0, upperFence: 8
        }))!;
        expect(f.median).toBeLessThan(0.1);
        expect(f.q3).toBeLessThan(0.1);
    });

    it('draws a constant column flat at mid height, as profileFractions does', () => {
        expect(boxFractions(stats({ min: 7, q1: 7, median: 7, q3: 7, max: 7 })))
            .toMatchObject({ q1: 0.5, median: 0.5, q3: 0.5 });
    });

    it('draws nothing for an empty column', () => {
        expect(boxFractions(stats({ empty: true }))).toBeNull();
    });

    // Issue #1016: a sparse column -- zero except in a few rows -- has IQR = 0,
    // so both fences sit on the point mass and every other value is an
    // outlier. Drawn as a tail that is the whole panel, which says "wide
    // spread" about a column that is one number almost everywhere.
    it('flags a collapsed box so the caller can draw its tails as marks', () => {
        const f = boxFractions(stats({
            min: 0, q1: 0, median: 0, q3: 0, max: 5,
            lowerFence: 0, upperFence: 0,
            hasHighOutliers: true
        }))!;
        expect(f.pointMass).toBe(true);
        expect(f.highTail).toBe(true);
        expect(f.lowTail).toBe(false);
    });

    it('does not flag a box with height, however small', () => {
        const f = boxFractions(stats({
            min: 0, q1: 1, median: 1, q3: 1.001, max: 100,
            lowerFence: 0, upperFence: 2, hasHighOutliers: true
        }))!;
        expect(f.pointMass).toBe(false);
    });

    it('does not flag a constant column, which has no tails to draw', () => {
        expect(boxFractions(stats({ min: 7, q1: 7, median: 7, q3: 7, max: 7 }))!.pointMass).toBe(false);
    });

    // The regression this change exists for: whiskers drawn to min and max are
    // pinned at 0 and 1 for every column, so they can never differ.
    it('places whiskers at the fences, not at the extremes', () => {
        const f = boxFractions(stats({
            min: 0, q1: 40, median: 50, q3: 60, max: 100,
            lowerFence: 20, upperFence: 80,
            hasLowOutliers: true, hasHighOutliers: true
        }))!;
        expect(f.lowerFence).toBeCloseTo(0.2, 10);
        expect(f.upperFence).toBeCloseTo(0.8, 10);
        expect(f.lowTail).toBe(true);
        expect(f.highTail).toBe(true);
    });

    it('reports no tail where the fence reaches the extreme', () => {
        const f = boxFractions(stats({
            min: 0, q1: 25, median: 50, q3: 75, max: 100,
            lowerFence: 0, upperFence: 100
        }))!;
        expect(f.lowTail).toBe(false);
        expect(f.highTail).toBe(false);
        expect(f.lowerFence).toBe(0);
        expect(f.upperFence).toBe(1);
    });
});

describe('Tukey fences', () => {
    it('reaches the extremes when nothing lies beyond 1.5 IQR', () => {
        // 1..9: IQR = 4, so the cutoffs are -3 and 13 and no value is outside.
        const s = columnBoxStats([1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => [v]), 1)[0];
        expect(s.lowerFence).toBe(1);
        expect(s.upperFence).toBe(9);
        expect(s.hasLowOutliers).toBe(false);
        expect(s.hasHighOutliers).toBe(false);
    });

    it('stops short of a high outlier and flags it', () => {
        // 1..9 as above, plus a far outlier at 100.
        const s = columnBoxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 100].map(v => [v]), 1)[0];
        expect(s.max).toBe(100);
        expect(s.upperFence).toBeLessThan(100);
        expect(s.hasHighOutliers).toBe(true);
        expect(s.hasLowOutliers).toBe(false);
    });

    it('stops short of a low outlier and flags it', () => {
        const s = columnBoxStats([-100, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => [v]), 1)[0];
        expect(s.min).toBe(-100);
        expect(s.lowerFence).toBeGreaterThan(-100);
        expect(s.hasLowOutliers).toBe(true);
        expect(s.hasHighOutliers).toBe(false);
    });

    it('ends the whisker on real data rather than at the cutoff itself', () => {
        const s = columnBoxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 100].map(v => [v]), 1)[0];
        // Whatever the fence is, it must be an observed value.
        expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 100]).toContain(s.upperFence);
        expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 100]).toContain(s.lowerFence);
    });

    it('handles a constant column without inventing outliers', () => {
        const s = columnBoxStats([[5], [5], [5]], 1)[0];
        expect(s.lowerFence).toBe(5);
        expect(s.upperFence).toBe(5);
        expect(s.hasLowOutliers).toBe(false);
        expect(s.hasHighOutliers).toBe(false);
    });
});

describe('sampling does not hide outliers', () => {
    // Quartiles survive a stride sample; extremes do not, because an outlier is
    // rare by definition. Measured before this was fixed: 52% of columns with
    // genuine outliers drew no tail, and 87% normalised against a sampled max
    // rather than the real one.
    const withOutlierOffSample = () => {
        const col: number[][] = [];
        for (let i = 0; i < 1000; i++) col.push([i % 10]);
        // Index 501 is not a multiple of the stride this test forces (100),
        // so a sampling implementation cannot see it.
        col[501] = [9999];
        return col;
    };

    it('finds an extreme that no sampled row contains', () => {
        const s = columnBoxStats(withOutlierOffSample(), 1, 10)[0];
        expect(s.max).toBe(9999);
        expect(s.hasHighOutliers).toBe(true);
    });

    it('reports the same extremes whether or not sampling is active', () => {
        const col = withOutlierOffSample();
        const sampled = columnBoxStats(col, 1, 10)[0];
        const full = columnBoxStats(col, 1, Number.MAX_SAFE_INTEGER)[0];
        expect(sampled.min).toBe(full.min);
        expect(sampled.max).toBe(full.max);
        expect(sampled.hasHighOutliers).toBe(full.hasHighOutliers);
    });

    it('still samples a column whose every sampled row is blank', () => {
        // Non-finite in all the rows a row-index stride would land on.
        const col: number[][] = [];
        for (let i = 0; i < 100; i++) col.push([i % 10 === 0 ? NaN : i]);
        const s = columnBoxStats(col, 1, 10)[0];
        expect(s.empty).toBe(false);
        expect(Number.isFinite(s.median)).toBe(true);
    });
});
