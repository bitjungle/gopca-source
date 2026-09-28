/**
 * The single Plotly build this suite uses.
 *
 * Before #898 every application bundled Plotly **twice**: `react-plotly.js`
 * requires `plotly.js/dist/plotly` internally, while four chart components
 * imported `plotly.js-dist-min` directly. Both copies reached the shipped
 * artifact — two `plotly-logomark` strings in a 10 MB chunk was the giveaway —
 * and both carried `maplibre-gl` v4.7.1, which is inside the vulnerable range of
 * GHSA-jrc7-96c5-q579.
 *
 * No npm `overrides` entry can reach that maplibre: it is compiled into a
 * prebuilt dist inside the plotly package, not resolved from node_modules. The
 * override closed the Dependabot alert without changing what ships, which is
 * exactly the gap #898 was opened to record.
 *
 * Registering only the traces the suite draws removes the map code rather than
 * patching it, and collapses the two copies into one. The registered list is
 * asserted against the traces the source actually asks for by
 * plotly-bundle.test.ts, so adding a plot type that is not registered fails a
 * test instead of rendering an empty chart.
 */
import Plotly from 'plotly.js/lib/core';

import bar from 'plotly.js/lib/bar';
import contour from 'plotly.js/lib/contour';
import heatmap from 'plotly.js/lib/heatmap';
import scatter from 'plotly.js/lib/scatter';
import scatter3d from 'plotly.js/lib/scatter3d';
import scattergl from 'plotly.js/lib/scattergl';

import { REGISTERED_TRACES, type RegisteredTrace } from './plotly-traces';

// Typed by the name list, so a trace named there without a module here — or a
// module here that nothing declares — fails to compile rather than failing when
// a user opens the plot.
// `satisfies` rather than a type annotation: it checks that the keys are exactly
// the declared trace names — none missing, none extra — while leaving the module
// values their own types for the register call below.
const TRACE_MODULES = {
    bar,
    contour,
    heatmap,
    scatter,
    scatter3d,
    scattergl
} satisfies Record<RegisteredTrace, unknown>;

Plotly.register(Object.values(TRACE_MODULES));

export { REGISTERED_TRACES };

export default Plotly;
export type { Data, Layout, Config, PlotlyHTMLElement } from 'plotly.js';
