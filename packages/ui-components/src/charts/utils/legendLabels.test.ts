import { describe, expect, it } from 'vitest';
import {
    LEGEND_LABEL_MAX_LENGTH,
    paletteOverflowNote,
    truncateLegendLabel
} from './legendLabels';

describe('truncateLegendLabel', () => {
    it('leaves a short label alone', () => {
        expect(truncateLegendLabel('T6')).toBe('T6');
    });

    it('leaves a label of exactly the limit alone', () => {
        const exact = 'x'.repeat(LEGEND_LABEL_MAX_LENGTH);
        expect(truncateLegendLabel(exact)).toBe(exact);
    });

    it('shortens the first label over the limit', () => {
        const over = 'x'.repeat(LEGEND_LABEL_MAX_LENGTH + 1);
        const got = truncateLegendLabel(over);
        expect(got).toHaveLength(LEGEND_LABEL_MAX_LENGTH);
        expect(got.endsWith('…')).toBe(true);
    });

    it('shortens a real literature title, which is what this exists for', () => {
        // The value that prompted #999, from testdata/al_alloy Source.
        const title =
            'Establishing relationships between mechanical properties of ' +
            'aluminium alloys and optimised friction stir welding process parameters';
        const got = truncateLegendLabel(title);
        expect(got).toBe('Establishing relationships…');
        expect(got.length).toBeLessThanOrEqual(LEGEND_LABEL_MAX_LENGTH);
    });

    it('does not leave a space stranded before the ellipsis', () => {
        // Cutting mid-gap would render as "word …", which reads as a missing word
        // rather than a shortened one.
        expect(truncateLegendLabel('abcdefghij klmnopqrstuvwxyz zz', 12)).toBe('abcdefghij…');
    });

    it('returns the label unchanged when asked for a nonsensical width', () => {
        expect(truncateLegendLabel('anything', 0)).toBe('anything');
        expect(truncateLegendLabel('anything', -5)).toBe('anything');
    });

    it('honours an explicit width', () => {
        expect(truncateLegendLabel('abcdefghij', 5)).toBe('abcd…');
    });
});

describe('paletteOverflowNote', () => {
    it('says nothing when every group has its own color', () => {
        expect(paletteOverflowNote(10, 25)).toBeNull();
        expect(paletteOverflowNote(25, 25)).toBeNull();
    });

    it('speaks as soon as one group has to share', () => {
        expect(paletteOverflowNote(26, 25)).not.toBeNull();
    });

    it('names both counts, so the reader can see how far it has gone', () => {
        // The case from #999: Source has 124 levels against a 25-color palette.
        const note = paletteOverflowNote(124, 25);
        expect(note).toContain('124 groups');
        expect(note).toContain('25 colors');
        expect(note).toContain('hover');
    });

    it('says nothing when the palette size is unknown', () => {
        // Better silent than asserting a repetition that may not exist.
        expect(paletteOverflowNote(124, 0)).toBeNull();
        expect(paletteOverflowNote(124, -1)).toBeNull();
    });
});
