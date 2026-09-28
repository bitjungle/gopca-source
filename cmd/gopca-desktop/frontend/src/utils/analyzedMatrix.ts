/**
 * The rows and columns that actually entered the model.
 *
 * `fileData.data` is everything the file offered; the PCA runs on it minus the
 * rows and columns excluded in the Loaded Data panel, and `variable_labels`
 * comes back describing only the columns that survived.
 *
 * Anything reasoning about the analysed variables therefore has to apply the
 * same exclusions, or it describes a different set of columns from the names it
 * has. The model-metrics call did not, so the scale ratio could be driven by a
 * column that was not in the model, and naming the columns behind it would have
 * named the wrong ones (#1014).
 */
export function analyzedMatrix(
    data: number[][] | undefined,
    excludedRows: readonly number[],
    excludedColumns: readonly number[]
): number[][] {
    if (!data || data.length === 0) {
        return [];
    }
    const dropRow = new Set(excludedRows);
    const dropCol = new Set(excludedColumns);
    if (dropRow.size === 0 && dropCol.size === 0) {
        return data;
    }

    const out: number[][] = [];
    for (let i = 0; i < data.length; i++) {
        if (dropRow.has(i)) {
            continue;
        }
        const row = data[i];
        out.push(dropCol.size === 0 ? row : row.filter((_, j) => !dropCol.has(j)));
    }
    return out;
}
