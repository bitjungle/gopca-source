// GoPCA Suite
//
// Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
//
// This file is part of GoPCA Suite.
//
// See LICENSE for the full license terms.

import { useEffect, useState } from 'react';
import { AnalyzeVariableAxis } from '../api/backend';
import { FileData } from '../types';
import { logger } from '../utils/logger';

/**
 * Whether the variables form an axis a derivative can be taken along.
 *
 * Mirrors core.AxisReport. The statistic is computed in Go so there is one
 * implementation rather than one per language; see App.AnalyzeVariableAxis.
 */
export interface VariableAxis {
    variables: number;
    continuity: number;
    smoothnessFactor: number;
    /** False when nothing could be measured — not the same as "not a continuum". */
    measurable: boolean;
    isContinuous: boolean;
    namesNumeric: boolean;
    spacingUniform: boolean;
    distinctSteps: number;
}

/**
 * Analyses the matrix that will actually be decomposed.
 *
 * Recomputed when the exclusions change, not only when the file loads. That is
 * not a refinement: removing a band from the middle of a spectrum is exactly the
 * case the spacing half of the report exists to catch, and a report computed
 * before the exclusion describes a matrix that no longer exists.
 *
 * Returns null while unknown — before a file is loaded, or if the call fails.
 * Callers must treat null as "no opinion" rather than as a negative verdict:
 * withholding a control because a backend call failed would be indistinguishable,
 * to the user, from the feature not existing.
 */
export function useVariableAxis(
    fileData: FileData | null,
    excludedRows: number[],
    excludedColumns: number[]
): VariableAxis | null {
    const [axis, setAxis] = useState<VariableAxis | null>(null);

    useEffect(() => {
        if (!fileData || fileData.data.length === 0) {
            setAxis(null);
            return;
        }

        let cancelled = false;
        const excludedRowSet = new Set(excludedRows);
        const excludedColumnSet = new Set(excludedColumns);

        const data = fileData.data
            .filter((_, i) => !excludedRowSet.has(i))
            .map(row => row.filter((_, j) => !excludedColumnSet.has(j)));
        const headers = fileData.headers.filter((_, j) => !excludedColumnSet.has(j));

        if (data.length === 0 || headers.length === 0) {
            setAxis(null);
            return;
        }

        AnalyzeVariableAxis({ data, headers })
            .then(result => {
                if (!cancelled) {
                    setAxis(result as VariableAxis);
                }
            })
            .catch((err: unknown) => {
                logger.error('Failed to analyse the variable axis:', err);
                if (!cancelled) {
                    setAxis(null);
                }
            });

        return () => { cancelled = true; };
    }, [fileData, excludedRows, excludedColumns]);

    return axis;
}
