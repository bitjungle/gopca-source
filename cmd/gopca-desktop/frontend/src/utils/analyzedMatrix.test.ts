import { describe, it, expect } from 'vitest';
import { analyzedMatrix } from './analyzedMatrix';

const data = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
];

describe('analyzedMatrix', () => {
    it('returns the data unchanged when nothing is excluded', () => {
        expect(analyzedMatrix(data, [], [])).toBe(data);
    });

    it('drops excluded columns', () => {
        expect(analyzedMatrix(data, [], [1])).toEqual([[1, 3], [4, 6], [7, 9]]);
    });

    it('drops excluded rows', () => {
        expect(analyzedMatrix(data, [1], [])).toEqual([[1, 2, 3], [7, 8, 9]]);
    });

    it('drops both together', () => {
        expect(analyzedMatrix(data, [0], [2])).toEqual([[4, 5], [7, 8]]);
    });

    it('leaves the width matching the surviving labels', () => {
        // The point of the helper: width must equal the number of columns the
        // PCA kept, because that is what variable_labels describes (#1014).
        const labels = ['a', 'b', 'c'].filter((_, j) => j !== 1);
        expect(analyzedMatrix(data, [], [1])[0]).toHaveLength(labels.length);
    });

    it('handles missing data without throwing', () => {
        expect(analyzedMatrix(undefined, [], [])).toEqual([]);
        expect(analyzedMatrix([], [0], [0])).toEqual([]);
    });
});
