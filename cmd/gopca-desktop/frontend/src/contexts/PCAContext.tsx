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

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { ExportPCAModel, main } from '../api/backend';
import { asFractions } from '../utils/variancePercent';
import { usePCAConfig, PCAConfigState } from '../hooks/usePCAConfig';
import { useVariableAxis, VariableAxis } from '../hooks/useVariableAxis';
import { usePCARunner } from '../hooks/usePCARunner';
import { useFileDataContext } from './FileDataContext';
import { usePalette } from './PaletteContext';
import { FileData, PCAResponse } from '../types';
import { generateCLICommand as generateCLICommandUtil, RegressionCLIConfig } from '../utils/cliCommandGenerator';
import { logger } from '../utils/logger';

export interface PCAContextType {
    // ── Config & exclusions ───────────────────────────────────────────────────
    config: PCAConfigState;
    setConfig: React.Dispatch<React.SetStateAction<PCAConfigState>>;
    /** Whether the variables form an axis a derivative can be taken along; null while unknown. */
    variableAxis: VariableAxis | null;
    excludedRows: number[];
    excludedColumns: number[];
    setExcludedRows: React.Dispatch<React.SetStateAction<number[]>>;
    setExcludedColumns: React.Dispatch<React.SetStateAction<number[]>>;
    updateGammaForData: (data: FileData) => void;
    resetExclusions: () => void;

    // ── Group column (lifted to break circular dep with useVisualization) ─────
    selectedGroupColumn: string | null;
    setSelectedGroupColumn: (col: string | null) => void;

    // ── Runner results ────────────────────────────────────────────────────────
    pcaResponse: PCAResponse | null;
    pcaError: string | null;
    pcaLoading: boolean;
    /** Combined file-load + PCA loading. */
    loading: boolean;
    pcaHasExclusions: boolean;
    pcaResultsRef: React.RefObject<HTMLDivElement>;
    pcaErrorRef: React.RefObject<HTMLDivElement>;
    /** Raw runPCA — call handleRunPCA in AppContent to also reset PC selectors. */
    runPCA: () => Promise<void>;
    clearPcaError: () => void;
    clearPcaResponse: () => void;

    // ── Composite handlers (cross file + PCA domains) ─────────────────────────
    handleLoadDataset: (filename: string, defaultGroupColumn?: string) => Promise<void>;
    handleNativeFileSelectWithReset: () => Promise<void>;
    handleExportModel: () => Promise<void>;
    /** Builds the command-line preview. Pass a regression block to get `pca regress`. */
    generateCLICommand: (regression?: RegressionCLIConfig) => string;
    handleRowSelectionChange: (selectedRows: number[]) => void;
    handleColumnSelectionChange: (selectedColumns: number[]) => void;
    /** Called when the app opens with a file path argument (startup event). */
    handleStartupFile: (data: FileData) => void;
}

const PCAContext = createContext<PCAContextType | undefined>(undefined);

/**
 * Consume PCAContext. Throws if called outside <PCAProvider>.
 */
export function usePCAContext(): PCAContextType {
    const ctx = useContext(PCAContext);
    if (!ctx) {
        throw new Error('usePCAContext must be used within PCAProvider');
    }
    return ctx;
}

/**
 * PCAProvider owns PCA configuration, exclusions, runner state, group column,
 * and the composite handlers that coordinate across file-data and PCA domains.
 *
 * Must be nested inside <FileDataProvider> and <PaletteProvider>.
 */
export const PCAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
        fileData, fileName, filePath, loading: fileLoading,
        loadDataset, handleNativeFileSelect, setFileDataDirect
    } = useFileDataContext();
    const { setMode } = usePalette();

    const {
        config, setConfig,
        excludedRows, excludedColumns,
        setExcludedRows, setExcludedColumns,
        updateGammaForData, resetExclusions
    } = usePCAConfig();

    const [selectedGroupColumn, setSelectedGroupColumn] = useState<string | null>(null);

    const {
        pcaResponse, pcaError, loading: pcaLoading,
        pcaHasExclusions, pcaResultsRef, pcaErrorRef,
        runPCA, clearPcaError, clearPcaResponse
    } = usePCARunner(fileData, config, excludedRows, excludedColumns, selectedGroupColumn);

    // Whether the variables form a continuum, recomputed when the exclusions
    // change because that is what the answer depends on.
    const variableAxis = useVariableAxis(fileData, excludedRows, excludedColumns);

    const loading = fileLoading || pcaLoading;

    // ── Helpers shared with useAppInit's onStartupFile ────────────────────────

    /** Reset all state that depends on the loaded data. */
    const resetOnNewFile = useCallback((data: FileData, groupCol?: string | null) => {
        resetExclusions();
        clearPcaResponse();

        if (groupCol && data) {
            const isCategorical = data.categoricalColumns && groupCol in data.categoricalColumns;
            const isContinuous = data.numericTargetColumns && groupCol in data.numericTargetColumns;
            if (isCategorical || isContinuous) {
                setSelectedGroupColumn(groupCol);
                setMode(isCategorical ? 'categorical' : 'continuous');
            } else {
                setSelectedGroupColumn(null);
                setMode('none');
            }
        } else {
            setSelectedGroupColumn(null);
            setMode('none');
        }

        updateGammaForData(data);
    }, [resetExclusions, clearPcaResponse, setSelectedGroupColumn, setMode, updateGammaForData]);

    // ── Composite handlers ────────────────────────────────────────────────────

    const handleLoadDataset = useCallback(async (filename: string, defaultGroupColumn?: string) => {
        const result = await loadDataset(filename, defaultGroupColumn);
        if (!result) return;
        resetOnNewFile(result.data, result.defaultGroupColumn ?? null);
    }, [loadDataset, resetOnNewFile]);

    const handleNativeFileSelectWithReset = useCallback(async () => {
        const data = await handleNativeFileSelect();
        if (!data) return;
        resetOnNewFile(data, null);
    }, [handleNativeFileSelect, resetOnNewFile]);

    const handleExportModel = useCallback(async () => {
        if (!pcaResponse?.success || !pcaResponse.result || !fileData) return;

        try {
            const { ExportPCAModelRequest } = main;
            const request = new ExportPCAModelRequest({
                data: fileData.data,
                headers: fileData.headers,
                rowNames: fileData.rowNames,
                // Back to fractions on the way out: the model file is written by
                // the same Go code the CLI uses, and must mean the same thing.
                pcaResult: asFractions(pcaResponse.result),
                config,
                excludedRows,
                excludedColumns,
                filename: fileName
            });
            await ExportPCAModel(request);
        } catch (err) {
            logger.error('Failed to export model:', err);
            alert(`Failed to export model: ${err}`);
        }
    }, [pcaResponse, fileData, config, excludedRows, excludedColumns, fileName]);

    const generateCLICommand = useCallback((regression?: RegressionCLIConfig): string => {
        return generateCLICommandUtil({
            regression,
            fileName, filePath,
            components: config.components,
            method: config.method,
            kernelType: config.kernelType,
            kernelGamma: config.kernelGamma,
            kernelDegree: config.kernelDegree,
            kernelCoef0: config.kernelCoef0,
            temporalLags: config.temporalLags,
            varianceExplained: config.varianceExplained,
            snv: config.snv,
            vectorNorm: config.vectorNorm,
            savgolWindow: config.savgolWindow,
            savgolPolyOrder: config.savgolPolyOrder,
            savgolDeriv: config.savgolDeriv,
            standardScale: config.standardScale,
            robustScale: config.robustScale,
            meanCenter: config.meanCenter,
            scaleOnly: config.scaleOnly,
            missingStrategy: config.missingStrategy,
            excludedColumns,
            excludedRows
        });
    }, [fileName, filePath, config, excludedColumns, excludedRows]);

    const handleRowSelectionChange = useCallback((selectedRows: number[]) => {
        if (!fileData) return;
        const allIndices = Array.from({ length: fileData.data.length }, (_, i) => i);
        setExcludedRows(allIndices.filter(i => !selectedRows.includes(i)));
    }, [fileData, setExcludedRows]);

    const handleColumnSelectionChange = useCallback((selectedColumns: number[]) => {
        if (!fileData) return;
        const allIndices = Array.from({ length: fileData.headers.length }, (_, i) => i);
        setExcludedColumns(allIndices.filter(i => !selectedColumns.includes(i)));
    }, [fileData, setExcludedColumns]);

    // ── Expose onStartupFile helper so AppContent can wire useAppInit ─────────

    /** Called by AppContent's onStartupFile when the app opens with a file path. */
    const handleStartupFile = useCallback((data: FileData) => {
        setFileDataDirect(data, 'Startup File', '');
        resetOnNewFile(data, null);
    }, [setFileDataDirect, resetOnNewFile]);

    // Memoize the context value to avoid creating a new object reference on
    // every provider render (e.g. parent re-renders). This prevents all context
    // consumers from re-rendering when none of these deps have changed.
    // Note: any change to a dep still re-renders ALL consumers — React context
    // does not support per-field subscriptions without context splitting.
    const value = useMemo<PCAContextType>(() => ({
        config, setConfig,
        variableAxis,
        excludedRows, excludedColumns,
        setExcludedRows, setExcludedColumns,
        updateGammaForData, resetExclusions,
        selectedGroupColumn, setSelectedGroupColumn,
        pcaResponse, pcaError, pcaLoading, loading,
        pcaHasExclusions, pcaResultsRef, pcaErrorRef,
        runPCA, clearPcaError, clearPcaResponse,
        handleLoadDataset, handleNativeFileSelectWithReset,
        handleExportModel, generateCLICommand,
        handleRowSelectionChange, handleColumnSelectionChange,
        handleStartupFile
    }), [
        config, setConfig, variableAxis,
        excludedRows, excludedColumns,
        setExcludedRows, setExcludedColumns,
        updateGammaForData, resetExclusions,
        selectedGroupColumn, setSelectedGroupColumn,
        pcaResponse, pcaError, pcaLoading, loading,
        pcaHasExclusions, pcaResultsRef, pcaErrorRef,
        runPCA, clearPcaError, clearPcaResponse,
        handleLoadDataset, handleNativeFileSelectWithReset,
        handleExportModel, generateCLICommand,
        handleRowSelectionChange, handleColumnSelectionChange,
        handleStartupFile
    ]);

    return (
        <PCAContext.Provider value={value}>
            {children}
        </PCAContext.Provider>
    );
};

