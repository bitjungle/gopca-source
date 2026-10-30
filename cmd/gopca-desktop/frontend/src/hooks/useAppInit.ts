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

import { useState, useEffect, useRef } from 'react';
import { GetVersion, GetGUIConfig, SaveFile, CheckGoCSVStatus, LoadCSVFile, required, fromWire } from '../api/backend';
import { Events, events } from '../api/backend';
import { setupPlotlyWailsIntegration } from '@gopca/ui-components';
import { config } from '../api/backend';
import { FileData } from '../types';
import { logger } from '../utils/logger';

export interface AppInitResult {
    version: string;
    guiConfig: config.GUIConfig | null;
}

/**
 * Handles one-time app initialisation: fetches version and GUI config from the
 * backend, wires up the Plotly–Wails export integration, and registers the
 * startup file-load event.
 *
 * @param onStartupFile - called when the app is launched with a file path argument
 */
export function useAppInit(
    onStartupFile: (data: FileData) => void
): AppInitResult {
    const [version, setVersion] = useState<string>('');
    const [guiConfig, setGuiConfig] = useState<config.GUIConfig | null>(null);

    // Keep a ref to the latest callback so the one-time event listener always
    // calls the current version even if the parent re-renders with a new function.
    const onStartupFileRef = useRef(onStartupFile);
    useEffect(() => { onStartupFileRef.current = onStartupFile; });

    useEffect(() => {
        // Make SaveFile available globally for Plotly export integration
        if (typeof SaveFile !== 'undefined') {
            (window as any).SaveFile = SaveFile;
        }

        setupPlotlyWailsIntegration();

        GetVersion()
            .then(setVersion)
            .catch((err) => logger.error('Failed to get version:', err));

        GetGUIConfig()
            .then(setGuiConfig)
            .catch((err) => logger.error('Failed to get GUI config:', err));

        // Check GoCSV on startup so the button label is correct immediately
        CheckGoCSVStatus().catch((err) =>
            logger.error('Failed to check GoCSV status on startup:', err)
        );

        // A file path may be passed when the app is opened via file association
        const unsubscribe = Events.On(events.LoadFileOnStartup, async (e) => {
            try {
                const result = fromWire<FileData>(required(await LoadCSVFile(e.data), 'LoadCSVFile'));
                onStartupFileRef.current(result);
            } catch (err) {
                logger.error('Failed to load startup file:', err);
            }
        });

        return () => { unsubscribe(); };
    }, []);

    return { version, guiConfig };
}
