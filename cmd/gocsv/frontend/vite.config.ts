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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    // Pre-bundle the custom Plotly build's entry points. Vite otherwise
    // discovers them when the first plot mounts, re-optimizes mid-session and
    // forces a reload, which cancels the requests the Wails dev server is
    // proxying — the terminal then fills with Go's
    // "suppressing panic for copyResponse error" from net/http/httputil.
    //
    // This list must name every module plotly-bundle.ts imports; scripts/ci/
    // check-frontend-invariants.mjs enforces that, because a stale entry here
    // reads as a mitigation while mitigating nothing (#898).
    include: [
      'react-plotly.js/factory',
      'plotly.js/lib/core',
      'plotly.js/lib/bar',
      'plotly.js/lib/contour',
      'plotly.js/lib/heatmap',
      'plotly.js/lib/scatter',
      'plotly.js/lib/scatter3d',
      'plotly.js/lib/scattergl',
    ],
  },
  plugins: [react()]
});
