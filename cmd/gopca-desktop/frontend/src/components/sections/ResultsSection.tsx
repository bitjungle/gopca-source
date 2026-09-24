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

import React, { lazy, Suspense, useMemo } from 'react';
import { ErrorBoundary, ErrorAlert, CustomSelect } from '@gopca/ui-components';
import { HelpWrapper, ModelOverview } from '../index';
import { FontSizeControl } from '../FontSizeControl';
import { PaletteSelector } from '../PaletteSelector';
import { usePCAContext } from '../../contexts/PCAContext';
import { useFileDataContext } from '../../contexts/FileDataContext';
import { useVisualizationContext } from '../../contexts/VisualizationContext';
import { usePalette } from '../../contexts/PaletteContext';
import { getQualitativePalette } from '../../utils/colorPalettes';
import { paletteOverflow } from '../../utils/paletteOverflow';
import { PlotType } from '../../hooks/useVisualization';
import { config as wailsConfig } from '../../../wailsjs/go/models';
import { logger } from '../../utils/logger';

// Lazy-loaded plot components
const ScoresPlot = lazy(() => import('../visualizations/ScoresPlot').then(m => ({ default: m.ScoresPlot })));
const Scores3DPlot = lazy(() => import('../visualizations/Scores3DPlot').then(m => ({ default: m.Scores3DPlot })));
const ScreePlot = lazy(() => import('../visualizations/ScreePlot').then(m => ({ default: m.ScreePlot })));
const LoadingsPlot = lazy(() => import('../visualizations/LoadingsPlot').then(m => ({ default: m.LoadingsPlot })));
const Biplot = lazy(() => import('../visualizations/Biplot').then(m => ({ default: m.Biplot })));
const Biplot3D = lazy(() => import('../visualizations/Biplot3D').then(m => ({ default: m.Biplot3D })));
const CircleOfCorrelations = lazy(() => import('../visualizations/CircleOfCorrelations').then(m => ({ default: m.CircleOfCorrelations })));
const DiagnosticScatterPlot = lazy(() => import('../visualizations/DiagnosticScatterPlot').then(m => ({ default: m.DiagnosticScatterPlot })));
const EigencorrelationPlot = lazy(() => import('../visualizations/EigencorrelationPlot').then(m => ({ default: m.EigencorrelationPlot })));
const TemporalLoadingsPlot = lazy(() => import('../visualizations/TemporalLoadingsPlot').then(m => ({ default: m.TemporalLoadingsPlot })));
const TemporalVariableImportancePlot = lazy(() => import('../visualizations/TemporalVariableImportancePlot').then(m => ({ default: m.TemporalVariableImportancePlot })));
const KernelMatrixHeatmap = lazy(() => import('../visualizations/KernelMatrixHeatmap').then(m => ({ default: m.KernelMatrixHeatmap })));
const SampleContributionPlot = lazy(() => import('../visualizations/SampleContributionPlot').then(m => ({ default: m.SampleContributionPlot })));

interface ResultsSectionProps {
    /** GUI config from backend (thresholds for variable counts, biplot limits). */
    guiConfig: wailsConfig.GUIConfig | null;
}

/**
 * PCA error alert + Step 3: Interpret PCA Model — variance table, model
 * overview, visualization controls, plot area, and export button.
 *
 * All state comes from PCAContext, FileDataContext, and VisualizationContext.
 * `guiConfig` is the only prop, passed from AppContent (it comes from
 * useAppInit which needs multi-context access and lives in AppContent).
 */
export function ResultsSection({ guiConfig }: ResultsSectionProps) {
    const {
        pcaResponse, pcaError, pcaResultsRef, pcaErrorRef,
        pcaHasExclusions, excludedRows, config,
        selectedGroupColumn, setSelectedGroupColumn,
        clearPcaError, handleExportModel
    } = usePCAContext();
    const { fileData } = useFileDataContext();
    const {
        selectedPlot, setSelectedPlot,
        selectedXComponent, setSelectedXComponent,
        selectedYComponent, setSelectedYComponent,
        selectedZComponent, setSelectedZComponent,
        selectedLoadingComponent, setSelectedLoadingComponent,
        showEllipses, setShowEllipses,
        confidenceLevel, setConfidenceLevel,
        showRowLabels, setShowRowLabels,
        maxLabelsToShow, setMaxLabelsToShow,
        loadingsPlotType, setLoadingsPlotType,
        plotFontScale, setPlotFontScale,
        getColumnData, handlePlotSelectionChange
    } = useVisualizationContext();
    const { setMode, qualitativePalette } = usePalette();

    // Memoize the available plot options — depends on PCA method and whether
    // preprocessing and eigencorrelations are present in the result.
    const plotOptions = useMemo(() => {
        if (!pcaResponse?.result) return [];
        const { method, preprocessing_applied, eigencorrelations, variable_correlations } = pcaResponse.result;
        // The Circle of Correlations needs the variable-component correlations, not
        // the loadings (#793). The engine cannot produce them without a preprocessed
        // matrix to correlate against — NIPALS with native missing values is the case
        // that reaches here — so gate the menu entry on them rather than offering a
        // plot that would fail to draw.
        const hasVariableCorrelations = !!variable_correlations && variable_correlations.length > 0;
        return [
            { value: 'scores', label: 'Scores Plot' },
            { value: 'scores3d', label: '3D Scores Plot' },
            { value: 'scree', label: 'Scree Plot' },
            ...(method !== 'kernel' && method !== 'temporal' ? [{ value: 'loadings', label: 'Loadings Plot' }] : []),
            ...(method === 'temporal' ? [{ value: 'temporal-loadings', label: 'Temporal Loadings' }] : []),
            ...(method === 'temporal' ? [{ value: 'temporal-variable-importance', label: 'Variable Importance' }] : []),
            ...(preprocessing_applied && method !== 'kernel' && method !== 'temporal' ? [{ value: 'biplot', label: 'Biplot' }] : []),
            ...(preprocessing_applied && method !== 'kernel' && method !== 'temporal' ? [{ value: 'biplot3d', label: '3D Biplot' }] : []),
            ...(hasVariableCorrelations && preprocessing_applied && method !== 'kernel' && method !== 'temporal' ? [{ value: 'correlations', label: 'Circle of Correlations' }] : []),
            ...(method !== 'kernel' && method !== 'temporal' ? [{ value: 'diagnostics', label: 'Diagnostic Plot' }] : []),
            ...(eigencorrelations && method !== 'kernel' ? [{ value: 'eigencorrelation', label: 'Eigencorrelation Plot' }] : []),
            ...(method === 'kernel' ? [
                { value: 'kernel-matrix', label: 'Kernel Matrix Heatmap' },
                { value: 'sample-contributions', label: 'Sample Contributions' }
            ] : [])
        ];
    }, [pcaResponse?.result]);

    // Beyond the palette's colors, color stops identifying a group: the plots take
    // it modulo the palette length, so groups share a swatch and the legend claims
    // a mapping it cannot support. Said here, where the column is chosen, as well
    // as in the legend's own title (#999).
    const overflow = useMemo(() => {
        const column = selectedGroupColumn ? getColumnData(selectedGroupColumn) : {};
        return paletteOverflow(
            column.type,
            column.values,
            getQualitativePalette(qualitativePalette).length
        );
    }, [selectedGroupColumn, getColumnData, qualitativePalette]);

    // Memoize the Color-by column options — depends on fileData column metadata.
    const groupColumnOptions = useMemo(() => [
        { value: '', label: 'None' },
        { value: 'Row Index', label: '📊 Row Index', group: 'Continuous' },
        ...(fileData?.categoricalColumns && Object.keys(fileData.categoricalColumns).length > 0
            ? Object.keys(fileData.categoricalColumns).map((colName) => ({
                value: colName,
                label: `🏷️ ${colName}`,
                group: 'Categorical'
            }))
            : []),
        ...(fileData?.numericTargetColumns && Object.keys(fileData.numericTargetColumns).length > 0
            ? Object.keys(fileData.numericTargetColumns).map((colName) => ({
                value: colName,
                label: `📊 ${colName}`,
                group: 'Continuous'
            }))
            : [])
    ], [fileData?.categoricalColumns, fileData?.numericTargetColumns]);

    return (
        <>
            {/* PCA Error */}
            {pcaError && fileData && (
                <div ref={pcaErrorRef}>
                    <ErrorAlert
                        type="error"
                        title="Analysis Error"
                        message={pcaError}
                        suggestion="Please check your data and parameters, then try again"
                        onDismiss={clearPcaError}
                    />
                </div>
            )}

            {/* Step 3: Results */}
            {pcaResponse?.success && pcaResponse.result && (
                <div ref={pcaResultsRef} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold mb-4">Step 3: Interpret PCA Model</h2>

                    {pcaResponse.info && (
                        <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-800 border border-blue-300 dark:border-blue-600 rounded-lg">
                            <p className="text-blue-700 dark:text-blue-200 text-sm">
                                <span className="font-semibold">Note:</span> {pcaResponse.info}
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                        <HelpWrapper helpKey="explained-variance" className="h-full">
                            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 h-full flex flex-col">
                                <div className="mb-2">
                                    <h3 className="text-lg font-semibold">Explained Variance</h3>
                                </div>
                                <div className="space-y-2 flex-grow">
                                    {pcaResponse.result.explained_variance_ratio.map((percentage, i) => (
                                        <div key={i} className="flex justify-between">
                                            <span>{pcaResponse.result?.component_labels?.[i] || `PC${i+1}`}:</span>
                                            <span>{percentage.toFixed(2)}%</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-gray-300 dark:border-gray-600 pt-2 font-semibold">
                                        <div className="flex justify-between">
                                            <span>Cumulative:</span>
                                            <span>
                                                {pcaResponse.result.cumulative_variance[pcaResponse.result.cumulative_variance.length - 1].toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </HelpWrapper>

                        <ModelOverview
                            pcaResult={pcaResponse.result}
                            selectedPC={selectedXComponent}
                            standardScale={config.standardScale}
                            robustScale={config.robustScale}
                            originalData={fileData?.data}
                        />
                    </div>

                    {/* Visualizations */}
                    <div className="mt-6">
                        {/* Tier 1: Primary Controls */}
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200 dark:border-gray-600">
                            <div className="flex items-center gap-4">
                                <h3 className="text-lg font-semibold">Visualizations</h3>
                                <HelpWrapper helpKey={`${selectedPlot}-plot`}>
                                    <CustomSelect
                                        value={selectedPlot}
                                        onChange={(value) => setSelectedPlot(value as PlotType)}
                                        options={plotOptions}
                                        className="min-w-[200px]"
                                    />
                                </HelpWrapper>
                            </div>
                            <div className="flex-shrink-0">
                                <HelpWrapper helpKey="font-size-control">
                                    <FontSizeControl value={plotFontScale} onChange={setPlotFontScale} />
                                </HelpWrapper>
                            </div>
                            <div className="flex-shrink-0">
                                <HelpWrapper helpKey="palette-selector">
                                    <PaletteSelector />
                                </HelpWrapper>
                            </div>
                        </div>

                        {/* Tier 2: Context-Sensitive Controls */}
                        <div className="mb-4">
                            <div className="flex flex-wrap items-center gap-4">
                                {(selectedPlot === 'scores' || selectedPlot === 'scores3d' || selectedPlot === 'biplot' || selectedPlot === 'biplot3d' || selectedPlot === 'diagnostics') && fileData && (
                                    <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <HelpWrapper helpKey="group-coloring" className="flex items-center gap-2">
                                            <label className="text-sm text-gray-600 dark:text-gray-400">Color by:</label>
                                            <CustomSelect
                                                value={selectedGroupColumn || ''}
                                                onChange={(value) => {
                                                    const selectedValue = value || null;
                                                    setSelectedGroupColumn(selectedValue);
                                                    if (!selectedValue) {
                                                        setMode('none');
                                                        setShowEllipses(false);
                                                    } else if (selectedValue === 'Row Index') {
                                                        setMode('continuous');
                                                        setShowEllipses(false);
                                                    } else if (fileData.numericTargetColumns && selectedValue in fileData.numericTargetColumns) {
                                                        setMode('continuous');
                                                        setShowEllipses(false);
                                                    } else if (fileData.categoricalColumns && selectedValue in fileData.categoricalColumns) {
                                                        setMode('categorical');
                                                    }
                                                }}
                                                options={groupColumnOptions}
                                                className="min-w-[150px]"
                                            />
                                        </HelpWrapper>
                                        {overflow && (
                                            <span
                                                role="status"
                                                className="text-xs text-amber-700 dark:text-amber-400 max-w-[22rem]"
                                            >
                                                {overflow.levels} categories but {overflow.colors} colors — colors repeat, so they no longer identify a group. Hover a point to read its value.
                                            </span>
                                        )}
                                    </div>
                                )}

                                {(selectedPlot === 'scores' || selectedPlot === 'scores3d' || selectedPlot === 'biplot' || selectedPlot === 'biplot3d' || selectedPlot === 'diagnostics') && (
                                    <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <HelpWrapper helpKey="row-labels" className="flex items-center gap-2">
                                            <label className="text-sm text-gray-600 dark:text-gray-400">
                                                <input
                                                    type="checkbox"
                                                    checked={showRowLabels}
                                                    onChange={(e) => setShowRowLabels(e.target.checked)}
                                                    className="mr-1"
                                                />
                                                Show labels
                                            </label>
                                        </HelpWrapper>
                                        {showRowLabels && (
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm text-gray-600 dark:text-gray-400">Max:</label>
                                                <input
                                                    type="number"
                                                    min="5"
                                                    max="50"
                                                    value={maxLabelsToShow}
                                                    onChange={(e) => setMaxLabelsToShow(parseInt(e.target.value) || 10)}
                                                    className="w-12 px-1 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                                                />
                                            </div>
                                        )}
                                        {selectedPlot === 'diagnostics' && (
                                            <div className="flex items-center gap-2 ml-3">
                                                <HelpWrapper helpKey="diagnostic-threshold">
                                                    <label className="text-sm text-gray-600 dark:text-gray-400">Threshold:</label>
                                                </HelpWrapper>
                                                <CustomSelect
                                                    value={confidenceLevel.toFixed(2)}
                                                    onChange={(value) => setConfidenceLevel(parseFloat(value) as 0.90 | 0.95 | 0.99)}
                                                    options={[
                                                        { value: '0.95', label: '95%' },
                                                        { value: '0.99', label: '99%' }
                                                    ]}
                                                    className="min-w-[80px]"
                                                />
                                            </div>
                                        )}
                                        {fileData?.categoricalColumns &&
                                         Object.keys(fileData.categoricalColumns).length > 0 &&
                                         selectedGroupColumn &&
                                         getColumnData(selectedGroupColumn).type === 'categorical' &&
                                         (selectedPlot === 'scores' || selectedPlot === 'biplot' || selectedPlot === 'biplot3d') && (
                                            <>
                                                <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
                                                <HelpWrapper helpKey="confidence-ellipses" className="flex items-center gap-2">
                                                    <label className="text-sm text-gray-600 dark:text-gray-400">
                                                        <input
                                                            type="checkbox"
                                                            checked={showEllipses}
                                                            onChange={(e) => setShowEllipses(e.target.checked)}
                                                            className="mr-1"
                                                        />
                                                        Ellipses
                                                    </label>
                                                </HelpWrapper>
                                                {showEllipses && (
                                                    <CustomSelect
                                                        value={confidenceLevel.toFixed(2)}
                                                        onChange={(value) => setConfidenceLevel(parseFloat(value) as 0.90 | 0.95 | 0.99)}
                                                        options={[
                                                            { value: '0.90', label: '90%' },
                                                            { value: '0.95', label: '95%' },
                                                            { value: '0.99', label: '99%' }
                                                        ]}
                                                        className="min-w-[80px]"
                                                    />
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {(selectedPlot === 'scores' || selectedPlot === 'scores3d' || selectedPlot === 'biplot' || selectedPlot === 'biplot3d' || selectedPlot === 'correlations') && pcaResponse.result.scores[0]?.length > 2 && (
                                    <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm text-gray-600 dark:text-gray-400">X:</label>
                                            <CustomSelect
                                                value={selectedXComponent.toString()}
                                                onChange={(value) => setSelectedXComponent(parseInt(value))}
                                                options={pcaResponse.result.component_labels?.map((label, i) => ({
                                                    value: i.toString(),
                                                    label: `${label} (${pcaResponse.result!.explained_variance_ratio[i].toFixed(1)}%)`
                                                })) || []}
                                                className="min-w-[150px]"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm text-gray-600 dark:text-gray-400">Y:</label>
                                            <CustomSelect
                                                value={selectedYComponent.toString()}
                                                onChange={(value) => setSelectedYComponent(parseInt(value))}
                                                options={pcaResponse.result.component_labels?.map((label, i) => ({
                                                    value: i.toString(),
                                                    label: `${label} (${pcaResponse.result!.explained_variance_ratio[i].toFixed(1)}%)`
                                                })) || []}
                                                className="min-w-[150px]"
                                            />
                                        </div>
                                        {(selectedPlot === 'scores3d' || selectedPlot === 'biplot3d') && pcaResponse.result.scores[0]?.length > 2 && (
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm text-gray-600 dark:text-gray-400">Z:</label>
                                                <CustomSelect
                                                    value={selectedZComponent.toString()}
                                                    onChange={(value) => setSelectedZComponent(parseInt(value))}
                                                    options={pcaResponse.result.component_labels?.map((label, i) => ({
                                                        value: i.toString(),
                                                        label: `${label} (${pcaResponse.result!.explained_variance_ratio[i].toFixed(1)}%)`
                                                    })) || []}
                                                    className="min-w-[150px]"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedPlot === 'loadings' && pcaResponse.result?.method !== 'kernel' && (
                                    <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <label className="text-sm text-gray-600 dark:text-gray-400">Component:</label>
                                        <CustomSelect
                                            value={selectedLoadingComponent.toString()}
                                            onChange={(value) => setSelectedLoadingComponent(parseInt(value))}
                                            options={pcaResponse.result?.component_labels?.map((label, i) => ({
                                                value: i.toString(),
                                                label: `${label} (${pcaResponse.result!.explained_variance_ratio[i].toFixed(1)}%)`
                                            })) || []}
                                            className="min-w-[150px]"
                                        />
                                        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
                                        <label className="text-sm text-gray-600 dark:text-gray-400">Plot type:</label>
                                        <CustomSelect
                                            value={loadingsPlotType || (pcaResponse.result?.loadings[0]?.length > (guiConfig?.visualization?.loadings_variable_threshold || 100) ? 'line' : 'bar')}
                                            onChange={(value) => setLoadingsPlotType(value as 'bar' | 'line')}
                                            options={[
                                                { value: 'bar', label: 'Bar Chart' },
                                                { value: 'line', label: 'Line Chart' }
                                            ]}
                                            className="min-w-[120px]"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Plot area */}
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg" style={{ height: '500px' }}>
                            <ErrorBoundary
                                onError={(error, errorInfo) => {
                                    logger.error('Visualization Error:', error, errorInfo);
                                }}
                            >
                                <Suspense fallback={
                                    <div className="w-full h-full flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                            <p className="text-gray-600 dark:text-gray-400">Loading visualization...</p>
                                        </div>
                                    </div>
                                }>
                                {selectedPlot === 'scores' && pcaResponse.result.scores.length > 0 && pcaResponse.result.scores[0].length >= 2 ? (
                                    <ScoresPlot
                                        key={`scores-${pcaResponse.result.scores.length}-${excludedRows.length}`}
                                        pcaResult={pcaResponse.result}
                                        rowNames={fileData?.rowNames || []}
                                        xComponent={selectedXComponent}
                                        yComponent={selectedYComponent}
                                        groupColumn={selectedGroupColumn}
                                        fontScale={plotFontScale}
                                        groupLabels={getColumnData(selectedGroupColumn).type === 'categorical' ? getColumnData(selectedGroupColumn).values as string[] : undefined}
                                        groupValues={getColumnData(selectedGroupColumn).type === 'continuous' ? getColumnData(selectedGroupColumn).values as number[] : undefined}
                                        groupType={getColumnData(selectedGroupColumn).type}
                                        groupEllipses={
                                            confidenceLevel === 0.90 ? pcaResponse.groupEllipses90 :
                                            confidenceLevel === 0.95 ? pcaResponse.groupEllipses95 :
                                            pcaResponse.groupEllipses99
                                        }
                                        showEllipses={showEllipses && !!selectedGroupColumn && getColumnData(selectedGroupColumn).type === 'categorical'}
                                        confidenceLevel={confidenceLevel}
                                        showRowLabels={showRowLabels}
                                        maxLabelsToShow={maxLabelsToShow}
                                        onSelectionChange={handlePlotSelectionChange}
                                        excludedRows={pcaHasExclusions ? [] : excludedRows}
                                    />
                                ) : selectedPlot === 'scores3d' && pcaResponse.result.scores.length > 0 && pcaResponse.result.scores[0].length >= 3 ? (
                                    <Scores3DPlot
                                        pcaResult={pcaResponse.result}
                                        rowNames={fileData?.rowNames || []}
                                        xComponent={selectedXComponent}
                                        yComponent={selectedYComponent}
                                        zComponent={selectedZComponent}
                                        fontScale={plotFontScale}
                                        groupColumn={selectedGroupColumn}
                                        groupLabels={getColumnData(selectedGroupColumn).type === 'categorical' ? getColumnData(selectedGroupColumn).values as string[] : undefined}
                                        groupValues={getColumnData(selectedGroupColumn).type === 'continuous' ? getColumnData(selectedGroupColumn).values as number[] : undefined}
                                        groupType={getColumnData(selectedGroupColumn).type}
                                        showRowLabels={showRowLabels}
                                        maxLabelsToShow={maxLabelsToShow}
                                    />
                                ) : selectedPlot === 'scree' ? (
                                    <ScreePlot
                                        pcaResult={pcaResponse.result}
                                        showCumulative={true}
                                        elbowThreshold={80}
                                        fontScale={plotFontScale}
                                    />
                                ) : selectedPlot === 'loadings' && pcaResponse.result.method !== 'kernel' ? (
                                    <LoadingsPlot
                                        pcaResult={pcaResponse.result}
                                        selectedComponent={selectedLoadingComponent}
                                        variableThreshold={guiConfig?.visualization?.loadings_variable_threshold || 100}
                                        plotType={loadingsPlotType || undefined}
                                        fontScale={plotFontScale}
                                    />
                                ) : selectedPlot === 'biplot' ? (
                                    <Biplot
                                        pcaResult={pcaResponse.result}
                                        rowNames={fileData?.rowNames || []}
                                        xComponent={selectedXComponent}
                                        yComponent={selectedYComponent}
                                        showRowLabels={showRowLabels}
                                        fontScale={plotFontScale}
                                        maxLabelsToShow={maxLabelsToShow}
                                        groupColumn={selectedGroupColumn}
                                        groupLabels={getColumnData(selectedGroupColumn).type === 'categorical' ? getColumnData(selectedGroupColumn).values as string[] : undefined}
                                        groupValues={getColumnData(selectedGroupColumn).type === 'continuous' ? getColumnData(selectedGroupColumn).values as number[] : undefined}
                                        groupType={getColumnData(selectedGroupColumn).type}
                                        maxVariables={guiConfig?.visualization?.biplot_max_variables || 100}
                                        groupEllipses={
                                            confidenceLevel === 0.90 ? pcaResponse.groupEllipses90 :
                                            confidenceLevel === 0.95 ? pcaResponse.groupEllipses95 :
                                            pcaResponse.groupEllipses99
                                        }
                                        showEllipses={showEllipses && !!selectedGroupColumn && getColumnData(selectedGroupColumn).type === 'categorical'}
                                        confidenceLevel={confidenceLevel}
                                        onSelectionChange={handlePlotSelectionChange}
                                        excludedRows={pcaHasExclusions ? [] : excludedRows}
                                    />
                                ) : selectedPlot === 'biplot3d' ? (
                                    <Biplot3D
                                        pcaResult={pcaResponse.result}
                                        rowNames={fileData?.rowNames || []}
                                        xComponent={selectedXComponent}
                                        yComponent={selectedYComponent}
                                        zComponent={selectedZComponent}
                                        fontScale={plotFontScale}
                                        showRowLabels={showRowLabels}
                                        maxLabelsToShow={maxLabelsToShow}
                                        groupColumn={selectedGroupColumn}
                                        groupLabels={getColumnData(selectedGroupColumn).type === 'categorical' ? getColumnData(selectedGroupColumn).values as string[] : undefined}
                                        groupValues={getColumnData(selectedGroupColumn).type === 'continuous' ? getColumnData(selectedGroupColumn).values as number[] : undefined}
                                        groupType={getColumnData(selectedGroupColumn).type}
                                        maxVariables={guiConfig?.visualization?.biplot_max_variables || 50}
                                        groupEllipses={
                                            confidenceLevel === 0.90 ? pcaResponse.groupEllipses90 :
                                            confidenceLevel === 0.95 ? pcaResponse.groupEllipses95 :
                                            pcaResponse.groupEllipses99
                                        }
                                        showEllipses={showEllipses && !!selectedGroupColumn && getColumnData(selectedGroupColumn).type === 'categorical'}
                                        confidenceLevel={confidenceLevel}
                                    />
                                ) : selectedPlot === 'correlations' ? (
                                    <CircleOfCorrelations
                                        pcaResult={pcaResponse.result}
                                        xComponent={selectedXComponent}
                                        yComponent={selectedYComponent}
                                        fontScale={plotFontScale}
                                    />
                                ) : selectedPlot === 'diagnostics' && pcaResponse.result.method !== 'kernel' && pcaResponse.result.method !== 'temporal' ? (
                                    <DiagnosticScatterPlot
                                        pcaResult={pcaResponse.result}
                                        rowNames={fileData?.rowNames || []}
                                        showRowLabels={showRowLabels}
                                        maxLabelsToShow={maxLabelsToShow}
                                        confidenceLevel={confidenceLevel === 0.90 ? 0.95 : confidenceLevel}
                                        fontScale={plotFontScale}
                                        groupColumn={selectedGroupColumn}
                                        groupLabels={getColumnData(selectedGroupColumn).type === 'categorical' ? getColumnData(selectedGroupColumn).values as string[] : undefined}
                                        groupValues={getColumnData(selectedGroupColumn).type === 'continuous' ? getColumnData(selectedGroupColumn).values as number[] : undefined}
                                        groupType={getColumnData(selectedGroupColumn).type as 'categorical' | 'continuous' | undefined}
                                        onSelectionChange={handlePlotSelectionChange}
                                        excludedRows={pcaHasExclusions ? [] : excludedRows}
                                    />
                                ) : selectedPlot === 'eigencorrelation' ? (
                                    <EigencorrelationPlot
                                        pcaResult={pcaResponse.result}
                                        fontScale={plotFontScale}
                                    />
                                ) : selectedPlot === 'temporal-loadings' ? (
                                    <TemporalLoadingsPlot
                                        pcaResult={pcaResponse.result}
                                        fontScale={plotFontScale}
                                    />
                                ) : selectedPlot === 'temporal-variable-importance' ? (
                                    <TemporalVariableImportancePlot
                                        pcaResult={pcaResponse.result}
                                        fontScale={plotFontScale}
                                    />
                                ) : selectedPlot === 'kernel-matrix' ? (
                                    <KernelMatrixHeatmap
                                        pcaResult={pcaResponse.result}
                                        rowNames={fileData?.rowNames || []}
                                        fontScale={plotFontScale}
                                    />
                                ) : selectedPlot === 'sample-contributions' ? (
                                    <SampleContributionPlot
                                        pcaResult={pcaResponse.result}
                                        rowNames={fileData?.rowNames || []}
                                        selectedComponent={selectedLoadingComponent}
                                        fontScale={plotFontScale}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                                        <p>Not enough components for scores plot (minimum 2 required)</p>
                                    </div>
                                )}
                                </Suspense>
                            </ErrorBoundary>
                        </div>

                        {/* Export Model */}
                        <div className="mt-6 flex justify-center">
                            <HelpWrapper helpKey="export-model">
                                <button
                                    onClick={handleExportModel}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white"
                                >
                                    Export Model
                                </button>
                            </HelpWrapper>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
