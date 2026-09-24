/**
 * Keeping a categorical legend readable when the column has many levels.
 *
 * A legend entry is drawn at full length and a qualitative palette holds a fixed
 * number of colors, so a column with more levels than the palette produces two
 * separate problems at once. Coloring a scores plot by a provenance field of 124
 * values made both visible: the legend took roughly half the plot width, and
 * every color stood for about five different groups (#999).
 *
 * The two need different answers, because only one of them is a layout problem.
 *
 * Truncation fixes the width. The full value stays reachable: every plot that
 * builds per-group traces also writes the group into its hover text, so nothing
 * is lost by shortening what the legend prints.
 *
 * Repetition cannot be fixed by layout at all. Once there are more groups than
 * colors, one color no longer identifies one group, and no amount of space
 * rescues that -- the legend is then asserting a mapping it does not have. The
 * honest response is to say so where the reader is looking, which is what
 * paletteOverflowNote is for.
 */

/**
 * Longest legend label printed in full.
 *
 * Measured against the 772 distinct categorical values in testdata: 73% are 12
 * characters or fewer and 79% are 28 or fewer, after which the distribution is a
 * long flat tail of literature titles reaching 137 characters. Raising the limit
 * to 32 would spare a further 1.3% of values, which is not worth the width.
 */
export const LEGEND_LABEL_MAX_LENGTH = 28;

/**
 * Shorten a legend label for display, leaving the full value to hover text.
 *
 * A single-character ellipsis rather than three dots, because the point is to
 * reclaim width.
 */
export function truncateLegendLabel(
    label: string,
    maxLength: number = LEGEND_LABEL_MAX_LENGTH
): string {
    if (maxLength < 1 || label.length <= maxLength) {
        return label;
    }
    return `${label.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Describe a palette that has run out, or null when it has not.
 *
 * Rendered as the legend's title, so it sits directly above the swatches whose
 * meaning it is qualifying rather than in a corner of the plot. The second line
 * names the thing that still works: hover reports the group for one point, and
 * is unaffected by how many groups there are.
 */
export function paletteOverflowNote(
    groupCount: number,
    paletteSize: number
): string | null {
    if (paletteSize <= 0 || groupCount <= paletteSize) {
        return null;
    }
    return `${groupCount} groups, ${paletteSize} colors<br>colors repeat — hover to identify`;
}
