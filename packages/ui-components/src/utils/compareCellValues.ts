/**
 * Ordering for grid cells, which are always strings.
 *
 * Every value in GoCSV's grid arrives as text, because a CSV has no types. Left
 * to a string comparison, sorting Zn descending to find the alloys with the most
 * zinc put 7e-05 at the top while the true maximum, 0.12, sat 1,714x higher and
 * nowhere near it -- "7e-05" beats "0.12" because '7' beats '0' (#963). Row
 * identifiers failed the same way, running 1, 10, 100, 1000 instead of 1, 2, 3.
 *
 * Numbers therefore compare as numbers when both sides are numbers, and as text
 * otherwise. The text path has to stay: row names are often not numeric at all
 * (`PAPR0050`, `AA7055`), and a column may hold missing-value markers among its
 * measurements.
 *
 * Where a column mixes the two, numbers sort before text. That is a choice
 * rather than a law, but it keeps the measurements contiguous instead of
 * interleaving them with whatever "n/a" happens to sort next to.
 */

/** The value as a finite number, or null if it is not one. */
function numericValue(value: string | null | undefined): number | null {
    if (value === null || value === undefined) {
        return null;
    }
    const trimmed = value.trim();
    // Number('') and Number('   ') are both 0, so blanks must be excluded before
    // asking, or every empty cell would sort as a zero measurement.
    if (trimmed === '') {
        return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

/** Compare two grid cells for sorting. Negative if a sorts first. */
export function compareCellValues(
    a: string | null | undefined,
    b: string | null | undefined
): number {
    const numA = numericValue(a);
    const numB = numericValue(b);

    if (numA !== null && numB !== null) {
        // Compared rather than subtracted: subtraction of two very large or very
        // small values can round to zero and report them as equal.
        if (numA < numB) {
            return -1;
        }
        return numA > numB ? 1 : 0;
    }
    if (numA !== null) {
        return -1;
    }
    if (numB !== null) {
        return 1;
    }

    const textA = a ?? '';
    const textB = b ?? '';
    if (textA < textB) {
        return -1;
    }
    return textA > textB ? 1 : 0;
}
