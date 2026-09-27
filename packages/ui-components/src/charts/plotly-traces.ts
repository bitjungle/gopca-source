/**
 * The Plotly trace types this suite draws.
 *
 * Kept apart from plotly-bundle.ts so it can be read without importing Plotly:
 * the guard in plotly-bundle.test.ts compares this list against the traces the
 * source actually asks for, and that comparison should not need a browser
 * environment or a multi-megabyte import to run (#898).
 */
export const REGISTERED_TRACES = [
    'bar',
    'contour',
    'heatmap',
    'scatter',
    'scatter3d',
    // Reached by data size rather than by an explicit `type:` in the source:
    // optimizeTraceType swaps scatter for scattergl above the WebGL threshold.
    'scattergl'
] as const;

export type RegisteredTrace = typeof REGISTERED_TRACES[number];
