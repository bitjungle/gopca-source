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
import { ErrorBoundary, ErrorAlert } from '@gopca/ui-components';
import { DataTable, SelectionTable, MatrixIllustration, HelpWrapper, RowNameColumnNotice } from '../index';
import { ColumnRangeSelector } from '../ColumnRangeSelector';
import { useFileDataContext } from '../../contexts/FileDataContext';
import { usePCAContext } from '../../contexts/PCAContext';
import { useGoCSVContext } from '../../contexts/GoCSVContext';
import { logger } from '../../utils/logger';
import { OpenTutorial } from '../../../wailsjs/go/main/App';

/**
 * Step 1: Load Data — file picker, GoCSV button, matrix illustration, sample
 * datasets — plus the loaded data table and file error alert.
 *
 * All state comes from FileDataContext, PCAContext, and GoCSVContext.
 * No props needed.
 */
// Above this many columns the per-column checkbox strip stops being usable — 700
// spectral channels is a strip tens of thousands of pixels across — so the axis
// view is offered instead, where a whole region is one drag. Below it the strip
// fits on screen and is the more precise tool, because every column name is visible.
// The overview panel used to be reserved for datasets too wide to select with
// checkboxes. It doubles as a preview of the loaded data though, which is worth
// having at any width, and appearing only past a threshold made it look like it
// came and went at random. Two columns is simply the point below which a profile
// has no shape to show.
const MIN_PROFILE_COLUMNS = 2;

export function DataLoadSection() {
    const {
        fileData, fileError, datasetId, loading: fileLoading, clearFileError,
        filePath, reloadWithFirstColumnAsData
    } = useFileDataContext();
    const {
        loading, excludedRows, excludedColumns,
        handleLoadDataset, handleNativeFileSelectWithReset,
        handleRowSelectionChange, handleColumnSelectionChange
    } = usePCAContext();
    const { goCSVStatus, isCheckingGoCSV, handleGoCSVAction } = useGoCSVContext();

    // Load a sample dataset and open its tutorial in a separate window simultaneously.
    // OpenTutorial is fire-and-forget; tutorial window failure does not block the load.
    function loadDatasetWithTutorial(filename: string, groupColumn?: string, tutorialDataset?: string) {
        handleLoadDataset(filename, groupColumn);
        if (tutorialDataset) {
            OpenTutorial(tutorialDataset).catch((err: unknown) => {
                logger.error('Failed to open tutorial window:', err);
            });
        }
    }

    return (
        <>
            {/* Step 1: Load Data */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold mb-6">Step 1: Load Data</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_2fr_1fr] gap-6">
                    {/* Column 1: File Upload */}
                    <HelpWrapper helpKey="data-upload" className="flex flex-col justify-center">
                        <label className="block text-sm font-medium mb-3">
                            Upload Your CSV File
                        </label>
                        <HelpWrapper helpKey="choose-file">
                            <button
                                onClick={handleNativeFileSelectWithReset}
                                disabled={loading}
                                className="w-full px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {fileLoading ? 'Loading...' : 'Choose File'}
                            </button>
                        </HelpWrapper>

                        <div className="mt-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                Or Use the Data Editor
                            </p>
                            <HelpWrapper helpKey="gocsv-integration">
                                <button
                                    onClick={() => handleGoCSVAction(fileData)}
                                    disabled={isCheckingGoCSV}
                                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isCheckingGoCSV ? 'Checking...' :
                                     !goCSVStatus?.installed ? 'Install GoCSV' :
                                     'Open GoCSV'}
                                </button>
                            </HelpWrapper>
                        </div>
                    </HelpWrapper>

                    {/* Column 2: Matrix Illustration */}
                    <div className="flex items-center justify-center border-0 md:border-x lg:border-x border-gray-200 dark:border-gray-700 px-4 py-6 md:py-0">
                        <HelpWrapper helpKey="data-table-format">
                            <MatrixIllustration />
                        </HelpWrapper>
                    </div>

                    {/* Column 3: Sample Datasets */}
                    <div className="flex flex-col justify-center md:col-span-2 lg:col-span-1">
                        <label className="block text-sm font-medium mb-3">
                            Or Try Sample Datasets
                        </label>
                        <div className="space-y-2">
                            <HelpWrapper helpKey="sample-dataset-iris">
                                <button
                                    onClick={() => loadDatasetWithTutorial('iris.csv', 'species', 'iris')}
                                    className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                    disabled={loading}
                                >
                                    Iris
                                </button>
                            </HelpWrapper>
                            <HelpWrapper helpKey="sample-dataset-wine">
                                <button
                                    onClick={() => loadDatasetWithTutorial('wine.csv', 'target', 'wine')}
                                    className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                    disabled={loading}
                                >
                                    Wine
                                </button>
                            </HelpWrapper>
                            <HelpWrapper helpKey="sample-dataset-corn">
                                <button
                                    onClick={() => loadDatasetWithTutorial('corn.csv', undefined, 'corn')}
                                    className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                    disabled={loading}
                                >
                                    Corn (NIR)
                                </button>
                            </HelpWrapper>
                            <HelpWrapper helpKey="sample-dataset-swiss-roll">
                                <button
                                    onClick={() => loadDatasetWithTutorial('swiss_roll.csv', 'color #target', 'swiss_roll')}
                                    className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                    disabled={loading}
                                >
                                    Swiss Roll
                                </button>
                            </HelpWrapper>
                            <HelpWrapper helpKey="sample-dataset-cstr">
                                <button
                                    onClick={() => loadDatasetWithTutorial('cstr.csv', 'regime', 'cstr')}
                                    className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                    disabled={loading}
                                >
                                    CSTR (time series)
                                </button>
                            </HelpWrapper>
                            <HelpWrapper helpKey="sample-dataset-eeg-eye-state">
                                <button
                                    onClick={() => loadDatasetWithTutorial('eeg_eye_state.csv', undefined, 'eeg_eye_state')}
                                    className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                    disabled={loading}
                                >
                                    EEG Eye State
                                </button>
                            </HelpWrapper>
                            <HelpWrapper helpKey="sample-dataset-body-measures">
                                <button
                                    onClick={() => loadDatasetWithTutorial('body_measures.csv', undefined, 'body_measures')}
                                    className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                    disabled={loading}
                                >
                                    Body Measures
                                </button>
                            </HelpWrapper>
                        </div>
                    </div>
                </div>
            </div>

            {/* File Error */}
            {fileError && (
                <ErrorAlert
                    type="error"
                    title="File Error"
                    message={fileError}
                    onDismiss={clearFileError}
                />
            )}

            {/* Loaded Data Table */}
            {fileData && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold mb-4">Loaded Data</h2>
                    <RowNameColumnNotice
                        rowNamesHeader={fileData.rowNamesHeader}
                        hasRowNames={fileData.rowNames.length > 0}
                        variableCount={fileData.headers.length}
                        canSwitch={Boolean(filePath)}
                        busy={fileLoading}
                        onSwitch={(firstColumnIsData) => {
                            reloadWithFirstColumnAsData(firstColumnIsData).catch((err: unknown) => {
                                logger.error('Failed to re-read the file:', err);
                            });
                        }}
                    />
                    {fileData.headers.length >= MIN_PROFILE_COLUMNS && (
                        <div className="mb-4">
                            <ColumnRangeSelector
                                headers={fileData.headers}
                                data={fileData.data}
                                excludedColumns={excludedColumns}
                                onChange={(excluded) => {
                                    const keep = fileData.headers
                                        .map((_, i) => i)
                                        .filter(i => !excluded.includes(i));
                                    handleColumnSelectionChange(keep);
                                }}
                            />
                        </div>
                    )}
                    {fileData.data.length * fileData.headers.length > 10000 ? (
                        <SelectionTable
                            key={`dataset-${datasetId}`}
                            headers={fileData.headers}
                            rowNames={fileData.rowNames}
                            data={fileData.data}
                            onRowSelectionChange={handleRowSelectionChange}
                            onColumnSelectionChange={handleColumnSelectionChange}
                            externalSelectedRows={fileData.data.map((_, i) => i).filter(i => !excludedRows.includes(i))}
                            externalSelectedColumns={fileData.headers.map((_, i) => i).filter(i => !excludedColumns.includes(i))}
                            highlightExternalSelections={true}
                        />
                    ) : (
                        <ErrorBoundary
                            onError={(error, errorInfo) => {
                                logger.error('DataTable Error:', error, errorInfo);
                            }}
                        >
                            <HelpWrapper helpKey="data-table-format">
                                <DataTable
                                    key={`dataset-${datasetId}`}
                                    headers={fileData.headers}
                                    rowNames={fileData.rowNames}
                                    data={fileData.data}
                                    enableRowSelection={true}
                                    enableColumnSelection={true}
                                    onRowSelectionChange={handleRowSelectionChange}
                                    onColumnSelectionChange={handleColumnSelectionChange}
                                    externalSelectedRows={fileData.data.map((_, i) => i).filter(i => !excludedRows.includes(i))}
                                    externalSelectedColumns={fileData.headers.map((_, i) => i).filter(i => !excludedColumns.includes(i))}
                                    highlightExternalSelections={true}
                                />
                            </HelpWrapper>
                        </ErrorBoundary>
                    )}
                </div>
            )}
        </>
    );
}
