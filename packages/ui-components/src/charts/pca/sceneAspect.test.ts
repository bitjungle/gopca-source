// @vitest-environment jsdom
//
// jsdom is required only because plotly.js touches browser globals on import.

/**
 * Issue #1018: the 3D scores plot set `aspectmode: 'cube'`, which stretches
 * every axis to equal visual length. A component with a tenth of the score
 * spread was drawn as wide as the first, so distances on screen were not score
 * distances and the plot contradicted its own axis labels.
 *
 * What a headless test can hold: with `aspectmode: 'data'` Plotly sizes the
 * box in proportion to the axis ranges, and nothing else in the layout may
 * override that -- no explicit `aspectratio`, no fixed axis `range`. The
 * fixture has PC3 spread a tenth of PC1's, so if either override crept back in,
 * the plotted box would stop following the data and this test names the field
 * that did it. The biplot's `cube` is asserted too, because the issue measured
 * it undistorted (its autorange is set by unit-norm loading arrows) and nobody
 * should change it by analogy.
 */

import { describe, it, expect } from 'vitest';
import { Plotly3DScoresPlot } from './Plotly3DScoresPlot';
import { Plotly3DBiplot } from './Plotly3DBiplot';
import type { Layout } from 'plotly.js';

type Layouts = { getLayout(): Partial<Layout> };
const layoutOf = (plot: object) => (plot as unknown as Layouts).getLayout();

type Scene = {
    aspectmode?: string;
    aspectratio?: unknown;
    xaxis?: { range?: unknown };
    yaxis?: { range?: unknown };
    zaxis?: { range?: unknown };
};
const sceneOf = (layout: Partial<Layout>) => layout.scene as Scene | undefined;

// PC1 spread 10, PC2 spread 5, PC3 spread 1.
const scores = Array.from({ length: 12 }, (_, i) => [i - 5.5, (i - 5.5) / 2, (i - 5.5) / 10]);
const explainedVariance = [59.4, 22.1, 10.3];
const groups = scores.map((_, i) => (i % 2 ? 'a' : 'b'));

describe('3D scores plot geometry is the score geometry (#1018)', () => {
    const scene = sceneOf(layoutOf(new Plotly3DScoresPlot({ scores, groups, explainedVariance })));

    it('lets the axis ranges set the box', () => {
        expect(scene?.aspectmode).toBe('data');
    });

    it('sets nothing that would override the data aspect', () => {
        expect(scene?.aspectratio).toBeUndefined();
        expect(scene?.xaxis?.range).toBeUndefined();
        expect(scene?.yaxis?.range).toBeUndefined();
        expect(scene?.zaxis?.range).toBeUndefined();
    });
});

describe('the 3D biplot keeps its cube on purpose (#1018)', () => {
    it('is unchanged: its axes are already comparable', () => {
        const loadings = [[0.6, 0.8, 0.1], [0.8, -0.6, 0.2], [0.1, 0.2, 0.9]];
        const plot = new Plotly3DBiplot({ scores, loadings, variableNames: ['v1', 'v2', 'v3'], groups, explainedVariance });
        expect(sceneOf(layoutOf(plot))?.aspectmode).toBe('cube');
    });
});
