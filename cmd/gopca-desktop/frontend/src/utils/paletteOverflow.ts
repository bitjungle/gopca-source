/**
 * Whether a categorical coloring column has more levels than the palette can
 * distinguish.
 *
 * Every plot takes its group color as `palette[groupIndex % palette.length]`, so
 * past the end of the palette the colors start over and two unrelated groups share
 * a swatch. Nothing about the rendered plot says so: the legend goes on presenting
 * color as the thing that identifies a group. The al_alloy `Source` column made
 * this concrete with 124 levels against 25 colors, each color standing for about
 * five different sources (#999).
 *
 * The count is returned rather than a message so the caller decides the wording;
 * the charts state it in the legend title, the desktop UI beside the column
 * selector.
 */
export interface PaletteOverflow {
    /** Distinct levels in the chosen column. */
    levels: number;
    /** Colors the active palette provides. */
    colors: number;
}

/**
 * Returns the counts when the column overruns the palette, and null otherwise —
 * including for a continuous coloring, which uses a sequential colorscale and has
 * no swatches to repeat.
 */
export function paletteOverflow(
    columnType: 'categorical' | 'continuous' | undefined,
    values: readonly (string | number)[] | undefined,
    paletteSize: number
): PaletteOverflow | null {
    if (columnType !== 'categorical' || !values || paletteSize <= 0) {
        return null;
    }
    const levels = new Set(values).size;
    return levels > paletteSize ? { levels, colors: paletteSize } : null;
}
