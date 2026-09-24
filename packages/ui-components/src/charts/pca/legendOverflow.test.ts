// @vitest-environment jsdom
//
// Wiring tests for the many-level legend handling of #999.
//
// The pure helpers are covered in ../utils/legendLabels.test.ts. What is checked
// here is the part unit tests on those helpers cannot see: whether each plot
// actually reaches for them, and whether the layout it returns survives the
// shallow merge in mergeLayouts. Two defects found during #999 lived exactly
// there and were invisible to the helper tests --
//
//   * `legend: undefined` returned when there is no note. mergeLayouts spreads
//     the override before its `if (override.legend)` guard runs, so the key is
//     present-but-undefined and wipes the theme's legend styling.
//   * the note computed for a continuous coloring, where `colorScheme` is a
//     sequential colorscale whose stop count has nothing to do with repeated
//     swatches, and where the legend has no swatches at all.
//
// jsdom is required only because plotly.js touches browser globals on import.
import { describe, it, expect } from 'vitest';
import { PlotlyScoresPlot } from './PlotlyScoresPlot';
import { Plotly3DScoresPlot } from './Plotly3DScoresPlot';
import { Plotly3DBiplot } from './Plotly3DBiplot';
import { PlotlyBiplot } from './PlotlyBiplot';
import { PlotlyDiagnosticPlot } from './PlotlyDiagnosticPlot';
import { getPlotlyTheme, mergeLayouts } from '../utils/plotlyTheme';
import { LEGEND_LABEL_MAX_LENGTH } from '../utils/legendLabels';
import type { Data, Layout } from 'plotly.js';

/**
 * PlotlyScoresPlot declares getLayout/getTraces protected, the others public.
 * These reach the methods uniformly without widening anything to `any`.
 */
type Layouts = { getLayout(): Partial<Layout> };
type Traces = { getTraces(): Data[] };
const layoutOf = (plot: object) => (plot as unknown as Layouts).getLayout();
const tracesOf = (plot: object) => (plot as unknown as Traces).getTraces();

/** The legend fields this suite reads; plotly.js types them loosely. */
type LegendUnderTest = { bgcolor?: string; title?: { text?: string } };
const legendOf = (layout: Partial<Layout>) =>
    layout.legend as LegendUnderTest | undefined;

/** A palette small enough that a handful of groups overruns it. */
const TINY_PALETTE = ['#111111', '#222222', '#333333'];

const scoresFor = (n: number) =>
    Array.from({ length: n }, (_, i) => [i, -i, i / 2]);

const groupsCycling = (n: number, levels: number) =>
    Array.from({ length: n }, (_, i) => `group ${i % levels}`);

const loadings = [[0.6, 0.8], [0.8, -0.6], [0.1, 0.2]];
const variableNames = ['v1', 'v2'];
const explainedVariance = [50, 30, 10];

// The layout object each plot hands to mergeLayouts, keyed by plot name, for
// both a palette that suffices and one that does not.
const layouts = (colorScheme: string[], levels: number, groupType?: 'categorical' | 'continuous') => {
    const n = 12;
    const scores = scoresFor(n);
    const groups = groupsCycling(n, levels);
    const groupValues = groups.map((_, i) => i);
    return {
        'PlotlyScoresPlot': layoutOf(new PlotlyScoresPlot(
            { scores, groups, groupValues, groupType, explainedVariance },
            { colorScheme }
        )),
        'Plotly3DScoresPlot': layoutOf(new Plotly3DScoresPlot(
            { scores, groups, groupValues, groupType, explainedVariance },
            { colorScheme }
        )),
        'Plotly3DBiplot': layoutOf(new Plotly3DBiplot(
            { scores, loadings, variableNames, groups, groupValues, groupType, explainedVariance },
            { colorScheme }
        )),
        'PlotlyBiplot': layoutOf(new PlotlyBiplot(
            { scores, loadings, variableNames, groups, groupValues, groupType, explainedVariance },
            { colorScheme }
        )),
        'PlotlyDiagnosticPlot': layoutOf(new PlotlyDiagnosticPlot(
            {
                mahalanobisDistances: scores.map((_, i) => i),
                residualSumOfSquares: scores.map((_, i) => i / 2),
                groups,
                groupValues,
                groupType
            },
            { colorScheme }
        ))
    } as Record<string, Partial<Layout>>;
};

const PLOT_NAMES = Object.keys(layouts(TINY_PALETTE, 2));

describe('palette-overflow note in the legend (#999)', () => {
    it.each(PLOT_NAMES)('%s names the counts when the palette runs out', name => {
        const legend = legendOf(layouts(TINY_PALETTE, 7)[name]);
        expect(legend?.title?.text).toContain('7 groups');
        expect(legend?.title?.text).toContain('3 colors');
    });

    it.each(PLOT_NAMES)('%s says nothing when the palette suffices', name => {
        expect(legendOf(layouts(TINY_PALETTE, 3)[name])?.title).toBeUndefined();
    });

    it.each(PLOT_NAMES)('%s says nothing for a continuous coloring', name => {
        // colorScheme is then a sequential colorscale, and the legend has no
        // swatches to repeat.
        const legend = legendOf(layouts(TINY_PALETTE, 7, 'continuous')[name]);
        expect(legend?.title).toBeUndefined();
    });
});

describe('the theme legend survives mergeLayouts (#999)', () => {
    // The regression this guards: a `legend: undefined` key in the override is
    // spread over the theme before mergeLayouts' `if (override.legend)` guard can
    // re-merge it, so the theme's legend styling is lost.
    const theme = getPlotlyTheme('dark').layout;

    it.each(PLOT_NAMES)('%s keeps the themed legend colors with no note', name => {
        const merged = mergeLayouts(theme, layouts(TINY_PALETTE, 3)[name]);
        expect(legendOf(theme)?.bgcolor).toBeDefined();
        expect(legendOf(merged)?.bgcolor).toBe(legendOf(theme)?.bgcolor);
    });

    it.each(PLOT_NAMES)('%s keeps them alongside the note', name => {
        const merged = mergeLayouts(theme, layouts(TINY_PALETTE, 7)[name]);
        expect(legendOf(merged)?.bgcolor).toBe(legendOf(theme)?.bgcolor);
        expect(legendOf(merged)?.title?.text).toContain('7 groups');
    });
});

describe('legend labels are shortened but never lost (#999)', () => {
    const longLevel = 'Chemical composition measured by optical emission spectrometry';
    const n = 6;

    /** Every string a plot puts in front of the user on hover, concatenated. */
    const hoverTextOf = (traces: Data[]) =>
        traces
            .map(trace => trace as { hovertext?: string[]; text?: string[]; hovertemplate?: string })
            .map(trace => [
                ...(trace.hovertext ?? []),
                ...(trace.text ?? []),
                trace.hovertemplate ?? ''
            ].join('\n'))
            .join('\n');

    const groupedTraces = (level: string = longLevel) => {
        const scores = scoresFor(n);
        const groups = Array.from({ length: n }, (_, i) => (i % 2 ? level : 'short'));
        return {
            'PlotlyScoresPlot': tracesOf(new PlotlyScoresPlot(
                { scores, groups, explainedVariance },
                { colorScheme: TINY_PALETTE }
            )),
            'Plotly3DScoresPlot': tracesOf(new Plotly3DScoresPlot(
                { scores, groups, explainedVariance },
                { colorScheme: TINY_PALETTE }
            )),
            'Plotly3DBiplot': tracesOf(new Plotly3DBiplot(
                { scores, loadings, variableNames, groups, explainedVariance },
                { colorScheme: TINY_PALETTE }
            )),
            'PlotlyBiplot': tracesOf(new PlotlyBiplot(
                { scores, loadings, variableNames, groups, explainedVariance },
                { colorScheme: TINY_PALETTE }
            )),
            'PlotlyDiagnosticPlot': tracesOf(new PlotlyDiagnosticPlot(
                {
                    mahalanobisDistances: scores.map((_, i) => i),
                    residualSumOfSquares: scores.map((_, i) => i / 2),
                    groups
                },
                { colorScheme: TINY_PALETTE }
            ))
        } as Record<string, Data[]>;
    };

    it.each(PLOT_NAMES)('%s shortens the legend entry', name => {
        const named = groupedTraces()[name]
            .map(trace => (trace as { name?: string }).name)
            .filter((label): label is string => !!label?.includes('…'));
        expect(named.length).toBeGreaterThan(0);
        // PlotlyDiagnosticPlot appends an outlier-category suffix after the
        // shortened group, so only the group part is bounded.
        for (const label of named) {
            expect(label.split('…')[0].length).toBeLessThan(LEGEND_LABEL_MAX_LENGTH);
        }
    });

    it.each(PLOT_NAMES)('%s escapes markup in the level rather than letting Plotly parse it', name => {
        // `<LOD` (below the limit of detection) is an ordinary value in the
        // sciences this tool serves, and Plotly reads hover text as markup, so an
        // unescaped one is swallowed as the start of a tag. Since hover is what
        // makes shortening the legend acceptable, it has to survive intact.
        const hover = hoverTextOf(groupedTraces('<LOD & >99')[name]);
        expect(hover).toContain('&lt;LOD &amp; &gt;99');
        expect(hover).not.toContain('<LOD');
    });

    it.each(PLOT_NAMES)('%s still names the level in full on hover', name => {
        // Shortening the legend is only acceptable because the hover text is
        // where the value is actually read. If a plot stops carrying it, the
        // information is gone and this must fail.
        expect(hoverTextOf(groupedTraces()[name])).toContain(longLevel);
    });
});
