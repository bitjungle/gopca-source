/**
 * Writing a threshold value into a plot annotation at a precision a reader can use.
 *
 * The loadings threshold is derived, not typed: it is 1/sqrt(p) for p variables,
 * so on the 24-element al_alloy dataset the raw value is 0.20412414523193154 and
 * the label read `Threshold: ±0.20412414523193154` — 31 characters of which 17 are
 * noise. A guide line drawn at a rule-of-thumb cutoff does not become more precise
 * by being reported to the seventeenth digit; it only becomes unreadable, and it
 * pushes the label across a third of the plot (#1000).
 */

/** Digits kept by default: enough to distinguish thresholds, few enough to read. */
export const THRESHOLD_LABEL_DECIMALS = 3;

/**
 * Formats a threshold for display, dropping trailing zeros so a value that is
 * already round stays round: 80 prints as "80", not "80.000".
 *
 * A value too small to survive the rounding falls back to three significant
 * digits rather than printing "0", which would be a different number.
 */
export function formatThresholdValue(
    value: number,
    decimals: number = THRESHOLD_LABEL_DECIMALS
): string {
    if (!Number.isFinite(value)) {
        return String(value);
    }

    const rounded = Number(value.toFixed(decimals));
    if (rounded === 0 && value !== 0) {
        return String(Number(value.toPrecision(3)));
    }
    return String(rounded);
}
