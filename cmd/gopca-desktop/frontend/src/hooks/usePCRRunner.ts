// GoPCA Suite
//
// Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
// SPDX-License-Identifier: See LICENSE file for details.

import { useCallback, useRef, useState } from 'react';
import { RunPCR } from '../api/backend';
import { main } from '../api/backend';
import { PCRConfigState } from './usePCRConfig';
import { FileData } from '../types';

export interface PCRRunnerResult {
    pcrResponse: main.PCRResponse | null;
    pcrError: string | null;
    loading: boolean;
    runPCR: () => Promise<void>;
    clearPCR: () => void;
    pcrResultsRef: React.RefObject<HTMLDivElement>;
}

/**
 * usePCRRunner fits a principal component regression from the current settings.
 *
 * The response values are sent alongside the column name rather than looked up
 * again in the backend, so there is one definition of which column was chosen and
 * no chance of the two ends disagreeing about it.
 */
export function usePCRRunner(
    fileData: FileData | null,
    pcaConfig: Record<string, unknown>,
    pcrConfig: PCRConfigState,
    excludedRows: number[],
    excludedColumns: number[]
): PCRRunnerResult {
    const [pcrResponse, setPcrResponse] = useState<main.PCRResponse | null>(null);
    const [pcrError, setPcrError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const pcrResultsRef = useRef<HTMLDivElement>(null);

    const clearPCR = useCallback(() => {
        setPcrResponse(null);
        setPcrError(null);
    }, []);

    const runPCR = useCallback(async () => {
        if (!fileData) {
            setPcrError('Load a dataset first.');
            return;
        }
        if (!pcrConfig.response) {
            setPcrError('Choose a response column to predict.');
            return;
        }

        const rawResponse = fileData.numericTargetColumns?.[pcrConfig.response];
        if (!rawResponse) {
            setPcrError(`The column "${pcrConfig.response}" is not available as a response.`);
            return;
        }

        // A response that was never measured arrives here as null, because NaN
        // cannot be represented in JSON and the backend marshals it that way.
        // Sending it straight back would deliver a genuine measurement of zero:
        // those rows would count as observed and the model would be fitted against
        // values nobody recorded. The mask travels alongside so the backend can put
        // the gaps back, which is how the predictor matrix already works.
        const responseMissing = rawResponse.map(
            value => value === null || value === undefined || !Number.isFinite(value)
        );
        const responseValues = rawResponse.map((value, i) => (responseMissing[i] ? 0 : value));

        if (responseMissing.every(Boolean)) {
            setPcrError(`No row has a measured value for "${pcrConfig.response}".`);
            return;
        }

        // The grouping column is sent as labels so the backend does not need the
        // whole categorical map to reproduce the design.
        const groupLabels = pcrConfig.cvGroupColumn
            ? fileData.categoricalColumns?.[pcrConfig.cvGroupColumn]
            : undefined;

        setLoading(true);
        setPcrError(null);
        try {
            const response = await RunPCR({
                pca: {
                    ...pcaConfig,
                    data: fileData.data,
                    missingMask: fileData.missingMask,
                    headers: fileData.headers,
                    rowNames: fileData.rowNames,
                    excludedRows,
                    excludedColumns
                },
                response: pcrConfig.response,
                responseValues,
                responseMissing,
                components: pcrConfig.components,
                maxComponents: pcrConfig.maxComponents,
                cvFolds: pcrConfig.cvFolds,
                cvScheme: pcrConfig.cvScheme,
                cvSeed: pcrConfig.cvSeed,
                cvGroupColumn: pcrConfig.cvGroupColumn,
                cvGroupLabels: groupLabels,
                selectRule: pcrConfig.selectRule,
                metric: pcrConfig.metric,
                tolerance: pcrConfig.tolerance,
                woldR: pcrConfig.woldR
            } as unknown as main.PCRRequest);

            if (response.success) {
                setPcrResponse(response);
                setPcrError(null);
            } else {
                setPcrResponse(null);
                setPcrError(response.error || 'The regression failed for an unknown reason.');
            }
        } catch (error) {
            setPcrResponse(null);
            setPcrError(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    }, [fileData, pcaConfig, pcrConfig, excludedRows, excludedColumns]);

    return { pcrResponse, pcrError, loading, runPCR, clearPCR, pcrResultsRef };
}
