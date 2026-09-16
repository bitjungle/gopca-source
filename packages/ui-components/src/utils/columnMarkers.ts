/**
 * The column markers a header can carry, and what they mean.
 *
 * A marker is written into the column name itself so that it survives export to
 * CSV and is read back the same way by every part of the suite. The rules here
 * mirror `pkg/types/csv_mixed.go`, which is where the file is actually parsed;
 * both spellings are accepted because both appear in files people write by hand.
 *
 * Keeping the rule in one place matters more than it looks. GoCSV's grid used to
 * decide a column's type by reading its values, which meant a column marked
 * `#category` -- whose entire claim is that its numbers are labels rather than
 * quantities -- was still formatted to four decimal places, so a row identifier
 * appeared as `1.0000` (#945).
 */

/** Does this header mark the column as categorical? */
export function isCategoryColumn(header: string): boolean {
    const lower = header.toLowerCase().trimEnd();
    return lower.endsWith('#category') || lower.endsWith('# category');
}

/**
 * Does this header mark the column as a target?
 *
 * A target is a measurement held out of the analysis, not a label, so it is
 * still displayed and formatted as a number.
 */
export function isTargetColumn(header: string): boolean {
    const lower = header.toLowerCase().trimEnd();
    return lower.endsWith('#target') || lower.endsWith('# target');
}

/**
 * Is this column a label column rather than a measurement?
 *
 * Two independent signals say so, and both have to be honoured or the grid
 * contradicts itself. The `#category` marker is written into the header by hand;
 * `categoricalColumns` is the parser's own verdict, reached by reading the
 * values. A column can carry either signal without the other.
 *
 * Asking only the marker was #945, where a marked column was still formatted to
 * four decimal places. Asking only the values was #950: aluminium alloy
 * designations such as "6101" parse as numbers, so a column of material names
 * was painted as a mixed measurement while its own tooltip called it
 * categorical.
 *
 * `categoricalColumns` arrives as parsed JSON, so membership is tested with
 * hasOwnProperty rather than `in`: `'toString' in {}` is true, and a column may
 * legitimately be named `toString`.
 */
export function isLabelColumn(
    header: string,
    categoricalColumns?: Record<string, unknown> | null
): boolean {
    if (isCategoryColumn(header)) {
        return true;
    }
    return Boolean(categoricalColumns) &&
        Object.prototype.hasOwnProperty.call(categoricalColumns, header);
}
