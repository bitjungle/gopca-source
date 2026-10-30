// GoPCA Suite
//
// Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
//
// This file is part of GoPCA Suite.
//
// GoPCA Suite is source-available software with free binary redistribution.
// Official compiled binary releases may be used and redistributed free of charge
// under the GoPCA Suite Source-Available Freeware License.
//
// The source code is provided for viewing, review, education, security analysis,
// research, interoperability analysis, and evaluation only.
//
// Modification, redistribution, publication, sublicensing, reuse, incorporation
// into another project, or creation of derivative works based on the source code
// is not permitted without prior written permission from the copyright holder.
//
// Usage Restriction: GoPCA Suite may not be used, directly or indirectly, for
// military, warfare, weapons, intelligence, surveillance, targeting, or
// law-enforcement surveillance applications.
//
// See LICENSE for the full license terms.

// Helpers for describing and parsing column ranges.
//
// Wide datasets are almost always an ordered axis — wavelengths, retention
// times, m/z values, genomic positions — so exclusions are naturally contiguous
// regions rather than scattered individual columns. These helpers turn a set of
// indices into the regions a user recognises, and back again.

/** A contiguous, inclusive run of column indices. */
export interface ColumnRun {
    start: number;
    end: number;
}

/**
 * Collapse column indices into contiguous runs, so 57 excluded channels can be
 * shown as two regions rather than 57 chips.
 */
export function toRuns(indices: number[]): ColumnRun[] {
    if (indices.length === 0) return [];
    const sorted = [...new Set(indices)].sort((a, b) => a - b);
    const runs: ColumnRun[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === prev + 1) {
            prev = sorted[i];
            continue;
        }
        runs.push({ start, end: prev });
        start = sorted[i];
        prev = sorted[i];
    }
    runs.push({ start, end: prev });
    return runs;
}

/** Label a run by its column names: "1400–1450", or just "1400" for one column. */
export function describeRun(run: ColumnRun, headers: string[]): string {
    const a = headers[run.start] ?? String(run.start + 1);
    const b = headers[run.end] ?? String(run.end + 1);
    return run.start === run.end ? a : `${a}–${b}`;
}

/** Expand a run to the individual indices it covers. */
export function runToIndices(run: ColumnRun): number[] {
    const out: number[] = [];
    for (let i = run.start; i <= run.end; i++) out.push(i);
    return out;
}

export interface ParsedSpec {
    indices: number[];
    errors: string[];
}

/**
 * Parse a comma-separated exclusion spec into column indices.
 *
 * Deliberately mirrors the `--exclude-columns` flag of the pca CLI, including
 * its resolution order: a token is matched against column names first, then as
 * a range, then as a 1-based index. Name-first matters for spectra, where a
 * column called "1400" is a wavelength rather than the 1400th column.
 *
 * A range whose endpoints are both column names — "1400-1450" on a wavelength
 * axis — is resolved by name, which is what someone typing it means. Unresolved
 * tokens are returned rather than dropped, so a typo is visible instead of
 * silently narrowing the selection.
 */
export function parseRangeSpec(spec: string, headers: string[]): ParsedSpec {
    const indices = new Set<number>();
    const errors: string[] = [];
    const nameIndex = new Map<string, number>();
    headers.forEach((h, i) => {
        if (!nameIndex.has(h)) nameIndex.set(h, i);
    });

    for (const raw of spec.split(',')) {
        const token = raw.trim();
        if (token === '') continue;

        // 1. Whole token as a column name (handles names containing a hyphen).
        const byName = nameIndex.get(token);
        if (byName !== undefined) {
            indices.add(byName);
            continue;
        }

        // 2. A range "a-b", by column name at both ends or by 1-based index.
        const dash = token.indexOf('-', 1);
        if (dash > 0) {
            const lhs = token.slice(0, dash).trim();
            const rhs = token.slice(dash + 1).trim();
            const lhsName = nameIndex.get(lhs);
            const rhsName = nameIndex.get(rhs);
            if (lhsName !== undefined && rhsName !== undefined) {
                const lo = Math.min(lhsName, rhsName);
                const hi = Math.max(lhsName, rhsName);
                for (let i = lo; i <= hi; i++) indices.add(i);
                continue;
            }
            const lhsNum = Number(lhs);
            const rhsNum = Number(rhs);
            if (Number.isInteger(lhsNum) && Number.isInteger(rhsNum)) {
                if (lhsNum < 1 || rhsNum > headers.length || lhsNum > rhsNum) {
                    errors.push(`${token} (outside 1–${headers.length})`);
                    continue;
                }
                for (let i = lhsNum; i <= rhsNum; i++) indices.add(i - 1);
                continue;
            }
            errors.push(`${token} (not a range of column names or indices)`);
            continue;
        }

        // 3. A single 1-based index.
        const num = Number(token);
        if (Number.isInteger(num)) {
            if (num < 1 || num > headers.length) {
                errors.push(`${token} (outside 1–${headers.length})`);
            } else {
                indices.add(num - 1);
            }
            continue;
        }

        errors.push(`${token} (no column with this name)`);
    }

    return { indices: [...indices].sort((a, b) => a - b), errors };
}

/**
 * Do the column names describe an ordered axis, or are they just labels?
 *
 * This decides how the variable profile may honestly be drawn. A connected line
 * asserts that neighbouring columns are neighbouring points on a continuum — true
 * of a spectrum sampled at 1100, 1102, 1104 nm, and false of forty unrelated assay
 * variables, where a line would invent a continuity the data does not have.
 *
 * The test is deliberately strict: every name must parse as a finite number *and*
 * the sequence must be monotonic. Numeric names alone are not enough, since
 * columns named "1", "5", "3" are numeric yet carry no order.
 */
export function namesFormOrderedAxis(headers: string[]): boolean {
    if (headers.length < 2) return false;
    if (headers.some(h => h.trim() === '')) return false; // Number('') is 0
    const values = headers.map(h => Number(h));
    if (!values.every(v => Number.isFinite(v))) return false;
    let increasing = true;
    let decreasing = true;
    for (let i = 1; i < values.length; i++) {
        if (values[i] <= values[i - 1]) increasing = false;
        if (values[i] >= values[i - 1]) decreasing = false;
    }
    return increasing || decreasing;
}

/** Mean of each column, for the overview profile. Ignores non-finite values. */
export function columnMeans(data: number[][], columnCount: number): number[] {
    const sums = new Array(columnCount).fill(0);
    const counts = new Array(columnCount).fill(0);
    for (const row of data) {
        for (let c = 0; c < columnCount; c++) {
            const v = row[c];
            if (Number.isFinite(v)) {
                sums[c] += v;
                counts[c] += 1;
            }
        }
    }
    return sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
}

/**
 * Smallest and largest finite value in each column.
 *
 * The overview profile needs this to scale a column against its own spread
 * rather than against the whole dataset. A column with no finite values at all
 * gets an empty extent, which callers treat as "nothing to draw".
 */
export function columnExtents(
    data: number[][],
    columnCount: number
): Array<{ min: number; max: number; empty: boolean }> {
    const mins = new Array(columnCount).fill(Infinity);
    const maxs = new Array(columnCount).fill(-Infinity);
    for (const row of data) {
        for (let c = 0; c < columnCount; c++) {
            const v = row[c];
            if (Number.isFinite(v)) {
                if (v < mins[c]) mins[c] = v;
                if (v > maxs[c]) maxs[c] = v;
            }
        }
    }
    return mins.map((min, i) => {
        const max = maxs[i];
        const empty = !Number.isFinite(min) || !Number.isFinite(max);
        return { min: empty ? 0 : min, max: empty ? 0 : max, empty };
    });
}

/**
 * How the overview profile turns column values into bar heights.
 *
 * `shared` puts every column on one y-axis, so bar heights are comparable
 * between columns. That is the right reading for a spectrum, where each column
 * is the same measurement at a different wavelength.
 *
 * `independent` scales each column against its own min..max, so the bar shows
 * where the mean sits inside that column's own spread. Heights are no longer
 * comparable between columns, but no column can be flattened by another one's
 * units — which is what happens to a mixed-unit dataset under `shared`.
 */
export type ScaleMode = 'shared' | 'independent';

/**
 * What the panel draws.
 *
 * The first two are mean profiles differing only in normalisation. `distribution`
 * is a different reading altogether: a five-number summary per column, which
 * answers "what shape is this variable" rather than "how big is it". It needs
 * roughly ten pixels of width per column to be legible, so it suits the narrow
 * datasets the panel now also covers rather than a 700-channel spectrum.
 */
export type ProfileMode = ScaleMode | 'distribution';

/** Height of each bar as a fraction of the panel, where 0 is the floor and 1 the top. */
export function profileFractions(
    data: number[][],
    columnCount: number,
    mode: ScaleMode
): number[] {
    const means = columnMeans(data, columnCount);

    if (mode === 'independent') {
        const extents = columnExtents(data, columnCount);
        return means.map((m, i) => {
            const { min, max, empty } = extents[i];
            if (empty) return 0;
            // A constant column has no spread to place the mean inside. Half
            // height says "no information here" without pretending the value is
            // extreme in either direction.
            if (max === min) return 0.5;
            return (m - min) / (max - min);
        });
    }

    // One pass rather than Math.min(...means): spreading a per-column array into
    // an argument list costs two throwaway argument lists, and stakes the panel
    // on staying under the engine's argument limit.
    let lo = Infinity;
    let hi = -Infinity;
    for (const m of means) {
        if (m < lo) lo = m;
        if (m > hi) hi = m;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        lo = 0;
        hi = 0;
    }
    const span = hi - lo || 1;
    return means.map(m => (m - lo) / span);
}

/**
 * Whether the columns are similar enough in magnitude to share one y-axis.
 *
 * Under a shared axis a column is only visible if its mean is a reasonable
 * fraction of the largest mean, so a dataset mixing proline (~750) with hue
 * (~1) renders as one bar and a row of flat stubs. This reports the fraction of
 * columns that would survive, which is what decides whether `shared` is a
 * usable default rather than any property of the column names.
 */
export function sharedScaleIsReadable(
    data: number[][],
    columnCount: number,
    minVisibleFraction = 0.5
): boolean {
    if (columnCount === 0) return true;
    const fractions = profileFractions(data, columnCount, 'shared');
    const visible = fractions.filter(f => f >= 0.05).length;
    return visible / columnCount >= minVisibleFraction;
}

/** Five-number summary of one column, in the column's own units. */
export interface BoxStats {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    /**
     * Tukey fences: the most extreme observations still within 1.5×IQR of the
     * box. Anything past them is an outlier.
     *
     * These are what the whiskers should be drawn to. Drawing whiskers to min
     * and max instead makes them span the full height of every column, because
     * the column is normalised by exactly those two numbers — a mark that
     * implies variation while being a constant by construction.
     */
    lowerFence: number;
    upperFence: number;
    /** Whether any observation lies outside the corresponding fence. */
    hasLowOutliers: boolean;
    hasHighOutliers: boolean;
    /** No finite values in the column, so nothing can be drawn for it. */
    empty: boolean;
}

/**
 * Rows are sampled at a stride above this many, because the panel is a preview
 * and quartiles do not need every row to be visually right. Measured on a
 * 15,000-row skewed column, sampling to 2,000 moved each quartile by at most
 * 0.21% of the column range — a quarter of a pixel in a 120-unit viewBox — while
 * cutting the work by roughly a factor of ten.
 */
export const BOX_SAMPLE_ROWS = 2000;

/**
 * Five-number summary of every column: the shape of the data rather than just
 * its centre.
 *
 * A mean says where a column sits; it cannot say whether the column is skewed,
 * has its mass at one end, or is spread evenly. For a narrow dataset — where the
 * panel now appears but the drag gesture is not needed — that shape is the more
 * useful preview, and it is what tells a user something before they run PCA.
 *
 * Quantiles use linear interpolation between order statistics, matching the
 * default of numpy.percentile and R's type 7.
 */
export function columnBoxStats(
    data: number[][],
    columnCount: number,
    sampleRows: number = BOX_SAMPLE_ROWS
): BoxStats[] {
    const stride = Math.max(1, Math.ceil(data.length / sampleRows));
    const stats: BoxStats[] = [];

    for (let c = 0; c < columnCount; c++) {
        // Quartiles are stable under sampling; extremes and outliers are not.
        // An outlier is rare by definition, so a stride that keeps one row in
        // eight keeps an outlier one time in eight — which would silently drop
        // the tail that exists to report it, and would put the 0..1 reference
        // itself at a sampled extreme rather than the real one. So the sample
        // decides the quartiles only, and every row is read for the rest.
        const sample: number[] = [];
        let min = Infinity;
        let max = -Infinity;
        let finiteSeen = 0;
        for (let r = 0; r < data.length; r++) {
            const v = data[r][c];
            if (!Number.isFinite(v)) continue;
            if (v < min) min = v;
            if (v > max) max = v;
            // Counted over finite values rather than rows, so a column whose
            // sampled rows all happen to be blank still yields a sample.
            if (finiteSeen % stride === 0) sample.push(v);
            finiteSeen++;
        }
        if (finiteSeen === 0) {
            stats.push({
                min: 0, q1: 0, median: 0, q3: 0, max: 0,
                lowerFence: 0, upperFence: 0,
                hasLowOutliers: false, hasHighOutliers: false,
                empty: true
            });
            continue;
        }
        sample.sort((a, b) => a - b);
        const quantile = (p: number) => {
            const pos = (sample.length - 1) * p;
            const lo = Math.floor(pos);
            const hi = Math.ceil(pos);
            return lo === hi ? sample[lo] : sample[lo] + (sample[hi] - sample[lo]) * (pos - lo);
        };
        const q1 = quantile(0.25);
        const q3 = quantile(0.75);
        // Tukey's rule. The fence is pulled back to the most extreme observation
        // still inside 1.5×IQR rather than sitting at the cutoff itself, so the
        // whisker always ends on real data.
        const reach = 1.5 * (q3 - q1);
        const lowCut = q1 - reach;
        const highCut = q3 + reach;
        let lowerFence = Infinity;
        let upperFence = -Infinity;
        for (let r = 0; r < data.length; r++) {
            const v = data[r][c];
            if (!Number.isFinite(v)) continue;
            if (v >= lowCut && v < lowerFence) lowerFence = v;
            if (v <= highCut && v > upperFence) upperFence = v;
        }
        // Every value outside the cutoffs would leave a fence unset. That cannot
        // happen for a fence derived from the same column's quartiles, but the
        // quartiles here come from a sample, so it is guarded rather than assumed.
        if (!Number.isFinite(lowerFence)) lowerFence = min;
        if (!Number.isFinite(upperFence)) upperFence = max;
        stats.push({
            min,
            q1,
            median: quantile(0.5),
            q3,
            max,
            lowerFence,
            upperFence,
            hasLowOutliers: lowerFence > min,
            hasHighOutliers: upperFence < max,
            empty: false
        });
    }
    return stats;
}

/**
 * A box summary rescaled so the column's own min sits at 0 and its max at 1.
 *
 * The reader is not comparing magnitudes between columns, they are comparing
 * shapes: where the box sits is the skew, how tall it is is how tightly the
 * middle half is packed, and how far the whisker falls short of the frame is how
 * far the outliers reach beyond the bulk of the data.
 */
export interface BoxDrawing {
    q1: number;
    median: number;
    q3: number;
    /** Whisker ends, at the Tukey fences. */
    lowerFence: number;
    upperFence: number;
    /** Outlier tails, present only where observations lie past a fence. */
    lowTail: boolean;
    highTail: boolean;
    /**
     * The box has no height: the quartiles coincide, so the middle half of the
     * column is one value. Common in sparse data, where a variable is zero
     * except in a few rows.
     *
     * The tails cannot be read the usual way here. With IQR = 0 both fences sit
     * on the point mass, every other value is an outlier by Tukey's rule, and
     * a tail drawn to the extreme spans the whole panel -- a mark that reads as
     * "this variable varies enormously" for a column that is almost entirely
     * one number (#1016). Callers draw such a column's tails as edge marks
     * meaning "values exist beyond this box", not as a line.
     */
    pointMass: boolean;
}

export function boxFractions(stats: BoxStats): BoxDrawing | null {
    if (stats.empty) return null;
    const span = stats.max - stats.min;
    // A constant column is a single value, not a distribution. Drawn as a flat
    // line at mid height, matching how profileFractions treats the same case.
    if (span === 0) {
        return {
            q1: 0.5, median: 0.5, q3: 0.5,
            lowerFence: 0.5, upperFence: 0.5,
            lowTail: false, highTail: false,
            pointMass: false
        };
    }
    const at = (v: number) => (v - stats.min) / span;
    return {
        q1: at(stats.q1),
        median: at(stats.median),
        q3: at(stats.q3),
        lowerFence: at(stats.lowerFence),
        upperFence: at(stats.upperFence),
        lowTail: stats.hasLowOutliers,
        highTail: stats.hasHighOutliers,
        pointMass: stats.q3 === stats.q1
    };
}
