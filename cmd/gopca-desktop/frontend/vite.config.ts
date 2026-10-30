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

/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wails from '@wailsio/runtime/plugins/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // wails3 dev starts Vite itself and expects it on this port (build/config.yml);
  // strictPort makes a collision fail loudly instead of silently moving.
  server: {
    host: '127.0.0.1',
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
  },
  // The wails plugin reloads the typed event bindings when they regenerate.
  plugins: [react(), wails('./bindings')],
  // plotly.js/lib/* is CommonJS source, not a browserified dist: has-hover and
  // friends reference `global`, which exists in Node and in a browserify bundle
  // but not in a browser. Without this the app throws
  // "ReferenceError: global is not defined" while evaluating plotly's plot_api
  // and never mounts at all (#898).
  define: {
    global: 'globalThis',
  },
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
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    alias: [
      // Every component reaches Wails through src/api/backend (at whatever
      // relative depth); in the test environment that one module is the mock.
      { find: /^(\.\.\/)*\.?\/?api\/backend$/, replacement: path.resolve(__dirname, 'src/__mocks__/api/backend.ts') },
      { find: '@gopca/ui-components', replacement: path.resolve(__dirname, 'src/__mocks__/@gopca/ui-components.tsx') },
    ],
  },
});
