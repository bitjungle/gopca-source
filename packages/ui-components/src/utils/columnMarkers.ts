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
