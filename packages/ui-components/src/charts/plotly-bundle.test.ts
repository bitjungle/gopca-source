import { describe, it, expect } from 'vitest';
import { REGISTERED_TRACES } from './plotly-traces';

// Properties of the custom Plotly build itself (#898).
//
// The companion check -- that every trace the source actually draws is in this
// list -- lives in scripts/ci/check-frontend-invariants.mjs, not here. It was
// here first, and `import.meta.glob` is rooted at this package, so it could not
// see the app frontends where PreprocessingPreview, SampleContributionPlot and
// KernelMatrixHeatmap build traces of their own. A scan blind to the place a new
// plot is most likely to be added is worth less than no scan, because it reads
// as coverage. Two overlapping checks, one strictly weaker, would be worse
// still, so the scan is not duplicated here.

describe('the registered trace list (#898)', () => {
    it('registers both trace types optimizeTraceType can return', () => {
        // Chosen by data size at runtime, so scattergl never appears as a
        // literal `type:` anywhere and no source scan can see it.
        expect(REGISTERED_TRACES).toContain('scatter');
        expect(REGISTERED_TRACES).toContain('scattergl');
    });

    it('does not register map traces, which is the point of the custom bundle', () => {
        // Named rather than pattern-matched: /map/ also matches "heatmap",
        // which the suite does draw. These are the traces that pull in maplibre.
        const MAP_TRACES = [
            'choropleth', 'choroplethmap', 'choroplethmapbox',
            'densitymap', 'densitymapbox',
            'scattergeo', 'scattermap', 'scattermapbox'
        ];
        const registered = new Set<string>(REGISTERED_TRACES);
        expect(MAP_TRACES.filter(name => registered.has(name))).toEqual([]);
    });

    it('lists each trace once', () => {
        expect(new Set(REGISTERED_TRACES).size).toBe(REGISTERED_TRACES.length);
    });
});
