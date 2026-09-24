import { describe, it, expect } from 'vitest';
import { paletteOverflow } from './paletteOverflow';

const levels = (n: number) => Array.from({ length: n }, (_, i) => `level ${i}`);

describe('paletteOverflow', () => {
    it('reports the counts when the column has more levels than colors', () => {
        expect(paletteOverflow('categorical', levels(124), 25)).toEqual({ levels: 124, colors: 25 });
    });

    it('stays silent when the palette is exactly large enough', () => {
        // The boundary matters: at equality every group still gets its own color,
        // so warning here would be a false alarm on a legend that is correct.
        expect(paletteOverflow('categorical', levels(25), 25)).toBeNull();
    });

    it('reports one level over the boundary', () => {
        expect(paletteOverflow('categorical', levels(26), 25)).toEqual({ levels: 26, colors: 25 });
    });

    it('counts distinct levels, not rows', () => {
        const repeated = ['a', 'b', 'a', 'b', 'a', 'b'];
        expect(paletteOverflow('categorical', repeated, 1)).toEqual({ levels: 2, colors: 1 });
        expect(paletteOverflow('categorical', repeated, 2)).toBeNull();
    });

    it('stays silent for a continuous coloring', () => {
        // colorScheme is then a sequential colorscale, interpolated rather than
        // cycled, so its length says nothing about repeated colors.
        expect(paletteOverflow('continuous', [1, 2, 3, 4], 2)).toBeNull();
    });

    it('stays silent when no column is chosen', () => {
        expect(paletteOverflow(undefined, undefined, 25)).toBeNull();
        expect(paletteOverflow('categorical', undefined, 25)).toBeNull();
    });

    it('stays silent rather than dividing by an empty palette', () => {
        expect(paletteOverflow('categorical', levels(5), 0)).toBeNull();
    });
});
