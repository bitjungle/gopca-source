// @vitest-environment jsdom
//
// jsdom is required only because plotly.js touches browser globals on import.

/**
 * Issue #1004: Plotly renders hover labels and on-plot text through a small
 * HTML subset, so a value from the user's file is parsed, not printed. #1003
 * escaped the five categorical hover sites; this sweep covers the rest -- the
 * continuous-colouring paths, the ungrouped paths, on-plot sample labels, and
 * every chart that puts a variable name into hover or label text.
 *
 * The assertion is deliberately blunt: build each plot with names a chemist
 * would actually type (`<LOD`, `R&D`), collect every string any trace hands to
 * Plotly's text parser, and require that the raw form never appears and the
 * escaped form does. A new trace that forgets to escape fails here without
 * anyone having to know which site it is.
 */

import { describe, it, expect } from 'vitest';
import { PlotlyScoresPlot } from './PlotlyScoresPlot';
import { Plotly3DScoresPlot } from './Plotly3DScoresPlot';
import { Plotly3DBiplot } from './Plotly3DBiplot';
import { PlotlyBiplot } from './PlotlyBiplot';
import { PlotlyDiagnosticPlot } from './PlotlyDiagnosticPlot';
import { PlotlyCircleOfCorrelations } from './PlotlyCircleOfCorrelations';
import { PlotlyLoadingsPlot } from './PlotlyLoadingsPlot';
import type { Data } from 'plotly.js';

type Traces = { getTraces(): Data[] };
const tracesOf = (plot: object) => (plot as unknown as Traces).getTraces();

/** Every string a trace hands to Plotly's pseudo-HTML parser. */
function parserInputs(traces: Data[]): string[] {
    const out: string[] = [];
    for (const trace of traces) {
        const t = trace as { text?: unknown; hovertext?: unknown; hovertemplate?: unknown };
        for (const field of [t.text, t.hovertext, t.hovertemplate]) {
            if (typeof field === 'string') {
                out.push(field);
            } else if (Array.isArray(field)) {
                for (const item of field) {
                    if (typeof item === 'string') {
                        out.push(item);
                    }
                }
            }
        }
    }
    return out;
}

const RAW = ['<LOD', 'R&D', '>99.9'];
const ESCAPED = ['&lt;LOD', 'R&amp;D', '&gt;99.9'];

function expectEscaped(traces: Data[]) {
    const inputs = parserInputs(traces);
    expect(inputs.length).toBeGreaterThan(0);
    for (const raw of RAW) {
        const leaked = inputs.filter(s => s.includes(raw));
        expect(leaked, `raw ${raw} reached the parser in: ${leaked.join(' | ')}`).toEqual([]);
    }
    // At least one of the hostile names must have made it through in escaped
    // form, or the sweep proved nothing.
    expect(inputs.some(s => ESCAPED.some(e => s.includes(e)))).toBe(true);
}

const n = 6;
const scores = Array.from({ length: n }, (_, i) => [i, -i, i / 2]);
const sampleNames = ['<LOD', 'R&D', '>99.9', 'S4', 'S5', 'S6'];
const groups = ['<LOD', 'R&D', '<LOD', 'R&D', '<LOD', 'R&D'];
const groupValues = [1, 2, 3, 4, 5, 6];
const explainedVariance = [50, 30, 10];
const loadings = [[0.6, 0.8, 0.1], [0.8, -0.6, 0.2], [0.1, 0.2, 0.9]];
const variableNames = ['<LOD', 'R&D', '>99.9'];

type Coloring = { groups?: string[]; groupValues?: number[]; groupType?: 'categorical' | 'continuous' };
const categorical: Coloring = { groups, groupValues, groupType: 'categorical' };
const continuous: Coloring = { groups, groupValues, groupType: 'continuous' };
/** The scores plots require a groups array; an empty one is their ungrouped path. */
const colorings: [string, Coloring][] = [
    ['categorical', categorical],
    ['continuous', continuous],
    ['ungrouped', {}]
];
const scoresColorings: [string, Coloring & { groups: string[] }][] = [
    ['categorical', { ...categorical, groups }],
    ['continuous', { ...continuous, groups }],
    ['ungrouped', { groups: [] }]
];

describe('sample names never reach the hover parser unescaped (#1004)', () => {
    it.each(scoresColorings)('PlotlyScoresPlot, %s, with labels', (_name, coloring) => {
        const plot = new PlotlyScoresPlot(
            { scores, sampleNames, explainedVariance, ...coloring },
            { showSmartLabels: true, maxLabels: 10 }
        );
        expectEscaped(tracesOf(plot));
    });

    // No ungrouped case: Plotly3DScoresPlot draws one trace per level and so
    // draws nothing for an empty groups array. The desktop always passes one.
    it.each(scoresColorings.slice(0, 2))('Plotly3DScoresPlot, %s, with labels', (_name, coloring) => {
        const plot = new Plotly3DScoresPlot(
            { scores, sampleNames, explainedVariance, ...coloring },
            { showLabels: true, maxLabels: 10 }
        );
        expectEscaped(tracesOf(plot));
    });

    it.each(colorings)('PlotlyBiplot, %s, with labels', (_name, coloring) => {
        const plot = new PlotlyBiplot(
            { scores, loadings, variableNames, sampleNames, explainedVariance, ...coloring },
            { showLabels: true, labelThreshold: 10 }
        );
        expectEscaped(tracesOf(plot));
    });

    it.each(colorings)('Plotly3DBiplot, %s, with labels', (_name, coloring) => {
        const plot = new Plotly3DBiplot(
            { scores, loadings, variableNames, sampleNames, explainedVariance, ...coloring },
            { showLabels: true, maxLabels: 10 }
        );
        expectEscaped(tracesOf(plot));
    });

    it.each(colorings)('PlotlyDiagnosticPlot, %s, with labels', (_name, coloring) => {
        const plot = new PlotlyDiagnosticPlot(
            {
                mahalanobisDistances: scores.map((_, i) => i + 1),
                residualSumOfSquares: scores.map((_, i) => (i + 1) / 2),
                sampleNames,
                ...coloring
            },
            { showLabels: true, labelThreshold: 10 }
        );
        expectEscaped(tracesOf(plot));
    });
});

describe('variable names never reach the hover parser unescaped (#1004)', () => {
    it('PlotlyCircleOfCorrelations', () => {
        const plot = new PlotlyCircleOfCorrelations({
            correlations: [[0.6, -0.5, 0.1], [0.3, 0.7, -0.2]],
            variableNames,
            explainedVariance
        });
        expectEscaped(tracesOf(plot));
    });

    it('PlotlyLoadingsPlot in line mode, where the name is hover-only', () => {
        const plot = new PlotlyLoadingsPlot({ loadings, variableNames }, { mode: 'line' });
        expectEscaped(tracesOf(plot));
    });

    it('PlotlyBiplot and Plotly3DBiplot vector labels', () => {
        for (const plot of [
            new PlotlyBiplot({ scores, loadings, variableNames, explainedVariance }),
            new Plotly3DBiplot({ scores, loadings, variableNames, explainedVariance })
        ]) {
            const vectorInputs = parserInputs(tracesOf(plot)).filter(s => s.includes('LOD'));
            expect(vectorInputs.length).toBeGreaterThan(0);
            expect(vectorInputs.filter(s => !s.includes('&lt;LOD'))).toEqual([]);
        }
    });
});
