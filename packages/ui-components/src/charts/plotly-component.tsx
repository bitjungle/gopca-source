/**
 * The React wrapper, bound to this suite's single Plotly build.
 *
 * `react-plotly.js`'s default export requires `plotly.js/dist/plotly` itself,
 * which is how a second, full Plotly — map traces and all — was reaching the
 * shipped bundle. Its documented `factory` entry point takes the Plotly instance
 * to use, so binding it to the custom bundle keeps one copy in the artifact
 * (#898).
 */
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from './plotly-bundle';

export const Plot = createPlotlyComponent(Plotly);
export default Plot;
