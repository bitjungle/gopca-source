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

import React from 'react';
import { createRoot } from 'react-dom/client';
// Side-effect import: initialises the Wails runtime bridge before anything
// that talks to Go runs.
import '@wailsio/runtime';
import './style.css';
import '@gopca/ui-components/dist/ui-components.css';
import App from './App';

const container = document.getElementById('root');

const root = createRoot(container!);

root.render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
);
