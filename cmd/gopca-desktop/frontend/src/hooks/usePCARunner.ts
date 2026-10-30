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

import { useState, useCallback, useRef } from 'react';
import { asPercentages } from '../utils/variancePercent';
import { RunPCA, fromWire } from '../api/backend';
import { FileData, PCARequest, PCAResponse } from '../types';
import { PCAConfigState } from './usePCAConfig';

export interface PCARunnerResult {
    pcaResponse: PCAResponse | null;
    pcaError: string | null;
    loading: boolean;
    pcaHasExclusions: boolean;
    pcaResultsRef: React.RefObject<HTMLDivElement>;
    pcaErrorRef: React.RefObject<HTMLDivElement>;
    runPCA: () => Promise<void>;
    clearPcaError: () => void;
    clearPcaResponse: () => void;
}

/**
 * Manages the PCA execution lifecycle: building the request, calling the
 * backend, storing the result or error, and smooth-scrolling to the outcome.
 *
 * Plot auto-switching after a kernel PCA run is handled in AppContent via a
 * useEffect that watches pcaResponse, keeping this hook free of UI concerns.
 */
export function usePCARunner(
    fileData: FileData | null,
    config: PCAConfigState,
    excludedRows: number[],
    excludedColumns: number[],
    selectedGroupColumn: string | null
): PCARunnerResult {
    const [pcaResponse, setPcaResponse] = useState<PCAResponse | null>(null);
    const [pcaError, setPcaError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [pcaHasExclusions, setPcaHasExclusions] = useState(false);

    const pcaResultsRef = useRef<HTMLDivElement>(null);
    const pcaErrorRef = useRef<HTMLDivElement>(null);

    const runPCA = useCallback(async () => {
        if (!fileData) return;

        setLoading(true);
        setPcaError(null);

        try {
            const request: PCARequest = {
                data: fileData.data,
                missingMask: fileData.missingMask,
                headers: fileData.headers,
                rowNames: fileData.rowNames,
                ...config,
                excludedRows,
                excludedColumns,
                ...(selectedGroupColumn && fileData.categoricalColumns && {
                    groupColumn: selectedGroupColumn,
                    groupLabels: fileData.categoricalColumns[selectedGroupColumn]
                }),
                metadataNumeric: fileData.numericTargetColumns || {},
                metadataCategorical: fileData.categoricalColumns || {},
                calculateEigencorrelations:
                    (fileData.numericTargetColumns && Object.keys(fileData.numericTargetColumns).length > 0) ||
                    (fileData.categoricalColumns && Object.keys(fileData.categoricalColumns).length > 0)
            };

            const result = fromWire<PCAResponse>(await RunPCA(request));

            if (result.success) {
                // Fractions on the wire, percentages in the UI; see
                // utils/variancePercent for why this happens exactly once.
                setPcaResponse(asPercentages(result));
                setPcaError(null);
                setPcaHasExclusions(excludedRows.length > 0);
                setTimeout(() => {
                    pcaResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            } else {
                setPcaError(result.error || 'PCA analysis failed');
                setPcaResponse(null);
                setTimeout(() => {
                    pcaErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        } catch (err) {
            setPcaError(`Failed to run PCA: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLoading(false);
        }
    }, [fileData, config, excludedRows, excludedColumns, selectedGroupColumn]);

    const clearPcaError = useCallback(() => setPcaError(null), []);
    const clearPcaResponse = useCallback(() => setPcaResponse(null), []);

    return {
        pcaResponse,
        pcaError,
        loading,
        pcaHasExclusions,
        pcaResultsRef,
        pcaErrorRef,
        runPCA,
        clearPcaError,
        clearPcaResponse
    };
}
