// GoPCA Suite
//
// Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
//
// This file is part of GoPCA Suite.
//
// See LICENSE for the full license terms.

import { useEffect, useMemo, useState } from 'react';
import { PreprocessPreview } from '../api/backend';
import { FileData } from '../types';
import { PCAConfigState } from './usePCAConfig';
import { previewRowIndices, axisPositions } from '../utils/previewRows';
import { logger } from '../utils/logger';

/** Milliseconds of quiet before a preview is requested. */
const DEBOUNCE_MS = 250;

export interface PreprocessingPreview {
    /** The chosen samples as they are in the file. */
    raw: number[][];
    /** The same samples after the row stage. */
    processed: number[][];
    /** Column names read as numbers, or null to plot against variable index. */
    positions: number[] | null;
    /** How many samples the file holds, so the plot can say what fraction is drawn. */
    totalRows: number;
    loading: boolean;
    /** A configuration the engine refused; the caller may leave the old plot up. */
    error: string | null;
}

/**
 * Applies the row stage to a sample of the data, for display.
 *
 * Debounced, because the window and polynomial order are number inputs and every
 * keystroke would otherwise be a round trip — including the half-finished values
 * on the way to a real one, most of which the engine refuses.
 *
 * The raw rows come from the file directly rather than from a second call: the
 * frontend already chose them, so asking the backend to send them back would
 * double the traffic to say something the caller already knows.
 */
export function usePreprocessingPreview(
    fileData: FileData | null,
    config: PCAConfigState,
    excludedRows: number[],
    excludedColumns: number[],
    enabled: boolean
): PreprocessingPreview | null {
    const [processed, setProcessed] = useState<number[][] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // The rows and columns that will actually be analysed. Recomputed only when
    // the data or the exclusions change, not when a window is retyped.
    const sample = useMemo(() => {
        if (!fileData || fileData.data.length === 0) {
            return null;
        }
        const excludedRowSet = new Set(excludedRows);
        const excludedColumnSet = new Set(excludedColumns);

        const kept = fileData.data.filter((_, i) => !excludedRowSet.has(i));
        const headers = fileData.headers.filter((_, j) => !excludedColumnSet.has(j));
        if (kept.length === 0 || headers.length === 0) {
            return null;
        }

        const indices = previewRowIndices(kept.length);
        const raw = indices.map(i => kept[i].filter((_, j) => !excludedColumnSet.has(j)));
        return { raw, positions: axisPositions(headers), totalRows: kept.length };
    }, [fileData, excludedRows, excludedColumns]);

    useEffect(() => {
        if (!enabled || !sample) {
            setProcessed(null);
            setError(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        const timer = setTimeout(() => {
            PreprocessPreview({
                data: sample.raw,
                snv: config.snv,
                vectorNorm: config.vectorNorm,
                savgolWindow: config.savgolWindow,
                savgolPolyOrder: config.savgolPolyOrder,
                savgolDeriv: config.savgolDeriv
            })
                .then(response => {
                    if (cancelled) {
                        return;
                    }
                    if (response.success && response.data) {
                        setProcessed(response.data);
                        setError(null);
                    } else {
                        // Keep the previous curves on screen. The usual cause is a
                        // half-typed window, and blanking the plot on every
                        // intermediate value would make it flicker rather than
                        // inform.
                        setError(response.error || 'The preview could not be computed.');
                    }
                })
                .catch((err: unknown) => {
                    logger.error('Preprocessing preview failed:', err);
                    if (!cancelled) {
                        setError('The preview could not be computed.');
                    }
                })
                .finally(() => {
                    if (!cancelled) {
                        setLoading(false);
                    }
                });
        }, DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [
        enabled, sample,
        config.snv, config.vectorNorm,
        config.savgolWindow, config.savgolPolyOrder, config.savgolDeriv
    ]);

    if (!enabled || !sample) {
        return null;
    }
    return {
        raw: sample.raw,
        processed: processed ?? [],
        positions: sample.positions,
        totalRows: sample.totalRows,
        loading,
        error
    };
}
