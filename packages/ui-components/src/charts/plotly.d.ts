// GoPCA Suite
//
// Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
//
// This file is part of GoPCA Suite.
//
// GoPCA Suite is source-available software with free binary redistribution.
// Official compiled binary releases may be used and redistributed free of charge
// under the GoPCA Suite Source-Available Freeware License.
//
// The source code is provided for viewing, review, education, security analysis,
// research, interoperability analysis, and evaluation only.
//
// Modification, redistribution, publication, sublicensing, reuse, incorporation
// into another project, or creation of derivative works based on the source code
// is not permitted without prior written permission from the copyright holder.
//
// Usage Restriction: GoPCA Suite may not be used, directly or indirectly, for
// military, warfare, weapons, intelligence, surveillance, targeting, or
// law-enforcement surveillance applications.
//
// See LICENSE for the full license terms.

// Type declarations for the custom plotly bundle's entry points (#898).
//
// plotly.js ships types for its package root but not for the lib/ modules a
// custom bundle is assembled from, so each is declared here. The trace modules
// are opaque on purpose: they are only ever handed to Plotly.register, and
// describing their internals would be inventing detail we do not rely on.
declare module 'plotly.js/lib/core' {
  import Plotly from 'plotly.js';
  export default Plotly;
}

declare module 'plotly.js/lib/bar';
declare module 'plotly.js/lib/contour';
declare module 'plotly.js/lib/heatmap';
declare module 'plotly.js/lib/scatter';
declare module 'plotly.js/lib/scatter3d';
declare module 'plotly.js/lib/scattergl';

declare module 'react-plotly.js/factory' {
  import * as React from 'react';
  import type { PlotParams } from 'react-plotly.js';
  export default function createPlotlyComponent(
    plotly: unknown
  ): React.ComponentType<PlotParams>;
}