/**
 * Issue #1017: calculateSmartLabels took the N points furthest from the origin
 * without looking at whether two of them shared a coordinate. Datasets with
 * repeated rows -- al_alloy has 894 of 1057 rows sharing a score position with
 * another row -- had their label budget spent on stacks, several labels on one
 * pixel, and the rest of the plot unlabelled.
 *
 * The assertions here count distinct *positions*, as the issue asks. Counting
 * returned indices passes with the bug present.
 */

import { describe, it, expect } from 'vitest';
import { calculateSmartLabels, selectSmartLabels } from './plotlyMath';
import type { Point2D } from './plotlyMath';

const positionsOf = (points: Point2D[], indices: number[]) =>
    new Set(indices.map(i => `${points[i].x},${points[i].y}`));

describe('calculateSmartLabels spends the budget on distinct positions (#1017)', () => {
    it('labels one row per coordinate when the furthest points are a stack', () => {
        // Six rows at the same far position, then six distinct nearer ones.
        const stack: Point2D[] = Array.from({ length: 6 }, () => ({ x: 10, y: 10 }));
        const distinct: Point2D[] = Array.from({ length: 6 }, (_, i) => ({ x: i, y: -i }));
        const points = [...stack, ...distinct];

        const selected = calculateSmartLabels(points, 5);

        expect(selected).toHaveLength(5);
        expect(positionsOf(points, selected).size).toBe(5);
        // The stack still gets its one label, and it is the furthest point.
        expect(selected[0]).toBeLessThan(6);
    });

    it('still prefers the furthest points, in order', () => {
        const points: Point2D[] = [
            { x: 1, y: 0 },
            { x: 5, y: 0 },
            { x: 3, y: 0 },
            { x: 5, y: 0 }, // a duplicate of the furthest
            { x: 4, y: 0 }
        ];
        expect(calculateSmartLabels(points, 3)).toEqual([1, 4, 2]);
    });

    it('returns fewer labels than asked when there are fewer positions', () => {
        const points: Point2D[] = [
            { x: 1, y: 1 },
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 2, y: 2 }
        ];
        const selected = calculateSmartLabels(points, 10);
        expect(selected).toHaveLength(2);
        expect(positionsOf(points, selected).size).toBe(2);
    });

    it('keys on exact equality, not proximity', () => {
        // Two points a rounding error apart are two positions. Thinning near
        // neighbours would be a different feature.
        const points: Point2D[] = [
            { x: 1, y: 1 },
            { x: 1 + 1e-12, y: 1 }
        ];
        expect(calculateSmartLabels(points, 10)).toHaveLength(2);
    });

    it('is unchanged on data with no repeated positions', () => {
        const points: Point2D[] = Array.from({ length: 20 }, (_, i) => ({ x: i, y: i * i }));
        const selected = calculateSmartLabels(points, 10);
        expect(selected).toHaveLength(10);
        expect(selected).toEqual([19, 18, 17, 16, 15, 14, 13, 12, 11, 10]);
    });

    it('selectSmartLabels is the same function', () => {
        expect(selectSmartLabels).toBe(calculateSmartLabels);
    });
});
