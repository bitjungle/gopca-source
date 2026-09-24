/**
 * Deciding what a finished transformation should say it did.
 *
 * `pkg/transform` can decline to touch a column and still return without error.
 * Box-Cox on a column holding zeros is the case that exposed this: the engine
 * refuses the whole column rather than transforming the positive values and
 * leaving the rest, because a column carrying some transformed and some raw
 * values holds two scales in one variable and nothing downstream can detect it
 * (the rule established in #861). It says so in a message that names the offending
 * rows and points at Yeo-Johnson, sets `success: true`, and returns
 * `transformedColumns: []`.
 *
 * The dialog used to render that message in the same blue "Transformation
 * Results" panel as messages from columns that really were transformed, and never
 * read `transformedColumns` at all — so the one field separating "I changed three
 * columns" from "I changed nothing" was discarded, and the user was left with an
 * unchanged grid and no way to tell whether that was the answer or the failure
 * (#1002).
 *
 * A refusal to act is the outcome of the operation, not an aside about it. It
 * belongs alongside success and failure, which is what this decides.
 */

export type TransformOutcomeKind =
    /** Every column the user asked for was transformed. */
    | 'all'
    /** Some were transformed and some were declined. */
    | 'partial'
    /** Nothing was transformed; the data is unchanged. */
    | 'none';

export interface TransformOutcome {
    kind: TransformOutcomeKind;
    /** Columns the engine reports it changed, whether or not they were asked for. */
    transformed: string[];
    /**
     * The asked-for columns that were changed. Counted separately from
     * `transformed` because the two can differ: a transform reporting a column
     * outside the selection would otherwise let the heading say "1 of 1 columns
     * transformed, 1 left unchanged", which cannot both be true. This and
     * `skipped` always partition the selection.
     */
    transformedFromSelection: string[];
    /** Columns that were asked for and are not among them. */
    skipped: string[];
    requestedCount: number;
}

/**
 * Compares what was asked for against what the engine reports it changed.
 *
 * `transformedColumns` is treated as empty when absent: Go marshals a nil slice
 * as `null`, so "no columns" can arrive as either `[]` or `null` and both mean
 * the same thing. Every transform in `pkg/transform` appends to it on success,
 * an invariant `TestTransformedColumnsReportWhatChanged` holds in place, because
 * a transform that changed data without reporting it would make this say
 * "nothing happened" to a user whose data had in fact moved.
 */
export function summarizeTransformOutcome(
    requestedColumns: readonly string[],
    transformedColumns: readonly string[] | null | undefined
): TransformOutcome {
    const transformed = [...(transformedColumns ?? [])];
    const changed = new Set(transformed);
    const transformedFromSelection = requestedColumns.filter(column => changed.has(column));
    const skipped = requestedColumns.filter(column => !changed.has(column));

    // Keyed off what actually changed rather than off the skipped count, so a
    // transform reporting a column the user did not select cannot make an
    // untouched run look like a complete one.
    const kind: TransformOutcomeKind =
        transformed.length === 0 ? 'none' : skipped.length === 0 ? 'all' : 'partial';

    return {
        kind,
        transformed,
        transformedFromSelection,
        skipped,
        requestedCount: requestedColumns.length
    };
}

/**
 * The heading the dialog shows above the engine's messages. The messages
 * themselves are already specific and actionable; only their framing was wrong.
 */
export function transformOutcomeHeading(outcome: TransformOutcome): string {
    switch (outcome.kind) {
        case 'none':
            return outcome.requestedCount === 1
                ? 'No column was transformed. Your data is unchanged.'
                : 'No columns were transformed. Your data is unchanged.';
        case 'partial': {
            // Counted from the selection, so the two numbers always add up to the
            // total: anything the engine changed outside it is not claimed here.
            const total = outcome.requestedCount;
            return `${outcome.transformedFromSelection.length} of ${total} `
                + `column${total === 1 ? '' : 's'} transformed, `
                + `${outcome.skipped.length} left unchanged:`;
        }
        case 'all':
            return 'Transformation Results:';
    }
}
