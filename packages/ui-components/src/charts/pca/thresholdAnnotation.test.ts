// @vitest-environment jsdom
//
// The threshold label on the loadings and scree plots (#1000).
//
// Both plots put the label at x: 1 with xref: 'paper' and xanchor: 'left', which
// anchors it at the right edge of the plot area and grows it *outward*, into a
// margin nothing reserves. Measured in a browser against the al_alloy case, the
// loadings label was 171px wide with 30px of margin to live in: 142px of it fell
// off the figure and the user saw "Thres". The scree label is short enough not to
// be clipped, but it landed on top of the secondary axis tick labels instead.
//
// The label text was a second defect in the same four lines: the loadings
// threshold is 1/sqrt(p), so it printed as ±0.20412414523193154.
//
// These assertions are on the layout the plots hand to Plotly. What they cannot
// see is whether the text physically fits, so the fix was also checked by
// rendering both plots in a browser and measuring the rendered boxes.
import { describe, it, expect } from 'vitest';
import { PlotlyLoadingsPlot } from './PlotlyLoadingsPlot';
import { PlotlyScreePlot } from './PlotlyScreePlot';
import type { Layout } from 'plotly.js';

type Layouts = { getLayout(): Partial<Layout> };
const layoutOf = (plot: object) => (plot as unknown as Layouts).getLayout();

/** The 24 element columns of the al_alloy dataset, which is where this was found. */
const P = 24;
const variableNames = Array.from({ length: P }, (_, i) => `v${i}`);

const loadingsLayout = (thresholdValue: number) => layoutOf(new PlotlyLoadingsPlot(
    {
        loadings: [variableNames.map((_, i) => Math.cos(i / 2) * 0.45)],
        variableNames
    },
    { mode: 'bar', showThreshold: true, thresholdValue }
));

const ev = [42, 21, 9, 7, 5, 4, 3, 3, 2, 2, 1, 1];
const screeLayout = (thresholdValue: number) => layoutOf(new PlotlyScreePlot(
    {
        explainedVariance: ev,
        cumulativeVariance: ev.map((_, i) => ev.slice(0, i + 1).reduce((a, b) => a + b, 0))
    },
    { showCumulativeLine: true, showThresholdLine: true, thresholdValue }
));

const annotationOf = (layout: Partial<Layout>) =>
    (layout.annotations ?? [])[0] as unknown as
        { text: string; x: number; xref: string; xanchor: string } | undefined;

const PLOTS: [string, (v: number) => Partial<Layout>, number][] = [
    ['PlotlyLoadingsPlot', loadingsLayout, 1 / Math.sqrt(P)],
    ['PlotlyScreePlot', screeLayout, 80]
];

describe('the threshold label is anchored inside the plot area (#1000)', () => {
    it.each(PLOTS)('%s grows inward from the edge it is pinned to', (_name, layout, value) => {
        const annotation = annotationOf(layout(value));
        expect(annotation).toBeDefined();
        expect(annotation!.xref).toBe('paper');

        // The rule, rather than the literal values: pinned to an edge in paper
        // coordinates, the text must extend back across the plot, never outward
        // past the edge into the margin.
        const growsInward =
            (annotation!.x === 1 && annotation!.xanchor === 'right') ||
            (annotation!.x === 0 && annotation!.xanchor === 'left');
        expect(
            growsInward,
            `x: ${annotation!.x} with xanchor: '${annotation!.xanchor}' points out of the plot`
        ).toBe(true);
    });
});

describe('the threshold label is written at a readable precision (#1000)', () => {
    it('shortens the derived loadings threshold', () => {
        // 1/sqrt(24) = 0.20412414523193154, which used to be printed in full.
        expect(annotationOf(loadingsLayout(1 / Math.sqrt(P)))!.text).toBe('Threshold: ±0.204');
    });

    it('leaves a threshold that is already round alone', () => {
        expect(annotationOf(screeLayout(80))!.text).toBe('80%');
    });

    it('shortens a scree threshold that is not round either', () => {
        // The component takes elbowThreshold as a prop, so a caller can pass one.
        expect(annotationOf(screeLayout(100 / 3))!.text).toBe('33.333%');
    });
});
