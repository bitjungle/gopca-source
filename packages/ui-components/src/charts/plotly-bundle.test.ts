import { describe, it, expect } from 'vitest';
import { REGISTERED_TRACES } from './plotly-traces';

// The suite ships a custom Plotly build that registers only the traces it draws,
// which is what keeps maplibre and the rest of the map machinery out of the
// artifact (#898). The cost of that choice is a failure mode with no compile-time
// signal: an unregistered trace type does not throw, it renders an empty plot,
// and it is only visible to someone who opens that particular chart.
//
// This closes most of that gap. Every trace type the source asks for is compared
// against the registered list, so adding a plot type without registering it fails
// here instead of shipping a blank chart.
//
// What it cannot see: a trace type assembled at runtime from parts. The one
// dynamic case today is optimizeTraceType, which returns 'scatter' or
// 'scattergl'; both are asserted explicitly below.
const SOURCES = import.meta.glob('./**/*.{ts,tsx}', {
    query: '?raw',
    eager: true,
    import: 'default'
}) as Record<string, string>;

/**
 * Trace names Plotly ships. Only values that appear in this set are treated as
 * trace types, so unrelated `type:` fields in the source — 'log', 'onehot',
 * 'categorical', the layout shapes' 'line' — are not mistaken for one.
 */
const PLOTLY_TRACE_NAMES = new Set([
    'bar', 'barpolar', 'box', 'candlestick', 'carpet', 'choropleth',
    'choroplethmap', 'choroplethmapbox', 'cone', 'contour', 'contourcarpet',
    'densitymap', 'densitymapbox', 'funnel', 'funnelarea', 'heatmap',
    'heatmapgl', 'histogram', 'histogram2d', 'histogram2dcontour', 'icicle',
    'image', 'indicator', 'isosurface', 'mesh3d', 'ohlc', 'parcats', 'parcoords',
    'pie', 'pointcloud', 'sankey', 'scatter', 'scatter3d', 'scattercarpet',
    'scattergeo', 'scattergl', 'scattermap', 'scattermapbox', 'scatterpolar',
    'scatterpolargl', 'scattersmith', 'scatterternary', 'splom', 'streamtube',
    'sunburst', 'surface', 'table', 'treemap', 'violin', 'volume', 'waterfall'
]);

const tracesUsedInSource = (): Map<string, string[]> => {
    const found = new Map<string, string[]>();
    for (const [path, text] of Object.entries(SOURCES)) {
        if (path.includes('.test.')) {
            continue;
        }
        for (const match of text.matchAll(/type:\s*['"]([a-z0-9]+)['"]/g)) {
            const name = match[1];
            if (!PLOTLY_TRACE_NAMES.has(name)) {
                continue;
            }
            found.set(name, [...(found.get(name) ?? []), path]);
        }
    }
    return found;
};

describe('the custom Plotly bundle registers every trace the suite draws (#898)', () => {
    it('finds trace types in the source at all', () => {
        // Guards the guard: a regex that matched nothing would make every
        // assertion below pass without checking anything.
        expect(tracesUsedInSource().size).toBeGreaterThan(2);
    });

    it('registers every trace type the source asks for', () => {
        const registered = new Set<string>(REGISTERED_TRACES);
        const unregistered = [...tracesUsedInSource().entries()]
            .filter(([name]) => !registered.has(name))
            .map(([name, paths]) => `${name} (used in ${paths.join(', ')})`);

        expect(
            unregistered,
            'these render as empty plots because the bundle does not register them'
        ).toEqual([]);
    });

    it('registers both trace types optimizeTraceType can return', () => {
        // Chosen by data size at runtime, so it never appears as a literal
        // `type:` on the scattergl side and the scan above cannot see it.
        expect(REGISTERED_TRACES).toContain('scatter');
        expect(REGISTERED_TRACES).toContain('scattergl');
    });

    it('does not register map traces, which is the point of the custom bundle', () => {
        // Named rather than pattern-matched: /map/ also matches "heatmap", which
        // the suite does draw. These are the traces that pull in maplibre.
        const MAP_TRACES = [
            'choropleth', 'choroplethmap', 'choroplethmapbox',
            'densitymap', 'densitymapbox',
            'scattergeo', 'scattermap', 'scattermapbox'
        ];
        const registered = new Set<string>(REGISTERED_TRACES);
        expect(MAP_TRACES.filter(name => registered.has(name))).toEqual([]);
    });
});
