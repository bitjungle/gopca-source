import { describe, it, expect } from 'vitest';
import { summarizeTransformOutcome, transformOutcomeHeading } from './transformOutcome';

describe('summarizeTransformOutcome', () => {
    it('reports a complete transformation', () => {
        const outcome = summarizeTransformOutcome(['a', 'b'], ['a', 'b']);
        expect(outcome.kind).toBe('all');
        expect(outcome.skipped).toEqual([]);
    });

    it('reports a refusal as nothing transformed, not as a result', () => {
        // Box-Cox on a column holding zeros: the engine returns no error, one
        // message, and an empty transformedColumns (#1002).
        const outcome = summarizeTransformOutcome(['Zn'], []);
        expect(outcome.kind).toBe('none');
        expect(outcome.skipped).toEqual(['Zn']);
    });

    it('treats an absent transformedColumns as none', () => {
        // Go marshals a nil slice as null, so "no columns" arrives as [] or null.
        expect(summarizeTransformOutcome(['Zn'], null).kind).toBe('none');
        expect(summarizeTransformOutcome(['Zn'], undefined).kind).toBe('none');
    });

    it('reports a partial outcome as partial, never as complete', () => {
        // The case that must not read as success: two columns asked for, one
        // declined, and the grid changed for only half of them.
        const outcome = summarizeTransformOutcome(['Zn', 'Cu'], ['Cu']);
        expect(outcome.kind).toBe('partial');
        expect(outcome.skipped).toEqual(['Zn']);
        expect(outcome.transformed).toEqual(['Cu']);
    });

    it('does not let an unrequested column disguise an untouched run', () => {
        // A transform reporting something outside the selection would otherwise
        // cancel out the skipped count and read as 'all'.
        const outcome = summarizeTransformOutcome(['Zn'], ['somethingElse']);
        expect(outcome.kind).toBe('partial');
        expect(outcome.skipped).toEqual(['Zn']);
    });

    it('counts what was requested, not what came back', () => {
        expect(summarizeTransformOutcome(['a', 'b', 'c'], ['a']).requestedCount).toBe(3);
    });

    it('handles an empty selection without claiming success', () => {
        expect(summarizeTransformOutcome([], []).kind).toBe('none');
    });
});

describe('transformOutcomeHeading', () => {
    const heading = (requested: string[], transformed: string[]) =>
        transformOutcomeHeading(summarizeTransformOutcome(requested, transformed));

    it('says plainly that nothing changed', () => {
        expect(heading(['Zn'], [])).toBe('No column was transformed. Your data is unchanged.');
        expect(heading(['Zn', 'Cu'], [])).toBe('No columns were transformed. Your data is unchanged.');
    });

    it('states both counts for a partial outcome', () => {
        // Both numbers, so a partial outcome cannot be read as a complete one.
        expect(heading(['Zn', 'Cu', 'Fe'], ['Cu', 'Fe']))
            .toBe('2 of 3 columns transformed, 1 left unchanged:');
    });

    it('keeps the existing heading when everything was transformed', () => {
        expect(heading(['a', 'b'], ['a', 'b'])).toBe('Transformation Results:');
    });
});
