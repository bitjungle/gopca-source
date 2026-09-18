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

import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { CSVGrid, ValidationResults, MissingValueSummary, MissingValueDialog, DataQualityDashboard, UndoRedoControls, ImportWizard, DataTransformDialog, FilterRowsDialog, AggregateRowsDialog, DocumentationViewer, AboutDialog, LoadFromUrlDialog } from './components';
import { ConfirmDialog, ErrorBoundary, ErrorAlert, ThemeProvider, ThemeToggle, HelpProvider, HelpDisplay, HelpWrapper, useHelp } from '@gopca/ui-components';
import logo from './assets/images/GoCSV-logo-1024-transp.png';
import helpContent from './help/help-content.json';
import { LoadCSV, SuggestImportForFailedLoad, SaveCSV, SaveExcel, ValidateForGoPCA, AnalyzeMissingValues, FillMissingValues, AnalyzeDataQuality, CheckGoPCAStatus, OpenInGoPCA, DownloadGoPCA, ExecuteCellEdit, ExecuteHeaderEdit, ExecuteTranspose, TransposeWarnings, ClearHistory, GetVersion } from '../wailsjs/go/main/App';
import { EventsOn, OnFileDrop, OnFileDropOff } from '../wailsjs/runtime/runtime';
import { main, dataquality } from '../wailsjs/go/models';

type FileData = main.FileData;

// rowIdentifierNotice turns an export's report into something worth reading, or
// null when the export invented nothing and there is nothing to say.
//
// Row names label the points in a GoPCA scores plot. A file that carries no
// column able to tell its rows apart gets one at export time (#966), and the
// user should hear about a column being added to their file rather than
// discover it later in a spreadsheet.
function rowIdentifierNotice(header: string | undefined): string | null {
    if (!header) {
        return null;
    }
    return `This file had no column that could tell its rows apart, so '${header}' `
        + 'was written as the first column, numbering the rows from 1. '
        + 'Without identifiers the points in a scores plot have no labels.';
}

function AppContent() {
    const { currentHelp, currentHelpKey } = useHelp();
    const [fileLoaded, setFileLoaded] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [fileData, setFileData] = useState<FileData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [validationResult, setValidationResult] = useState<{ isValid: boolean; messages: string[] } | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [missingValueStats, setMissingValueStats] = useState<dataquality.MissingValueStats | null>(null);
    const [showMissingValueSummary, setShowMissingValueSummary] = useState(false);
    const [showMissingValueDialog, setShowMissingValueDialog] = useState(false);
    const [dataQualityReport, setDataQualityReport] = useState<dataquality.DataQualityReport | null>(null);
    const [showDataQualityReport, setShowDataQualityReport] = useState(false);
    const [isAnalyzingQuality, setIsAnalyzingQuality] = useState(false);
    const [gopcaStatus, setGopcaStatus] = useState<main.GoPCAStatus | null>(null);
    const [isCheckingGoPCA, setIsCheckingGoPCA] = useState(false);
    const [showImportWizard, setShowImportWizard] = useState(false);
    // Set when a failed load can be rescued by the wizard, so it opens on that
    // file with the rows-to-skip the backend worked out (#799).
    const [wizardInitialFile, setWizardInitialFile] = useState<string | null>(null);
    const [wizardInitialSkipRows, setWizardInitialSkipRows] = useState<number | undefined>(undefined);
    const [showTransformDialog, setShowTransformDialog] = useState(false);
    const [showFilterDialog, setShowFilterDialog] = useState(false);
    const [showAggregateDialog, setShowAggregateDialog] = useState(false);
    const [showDocumentation, setShowDocumentation] = useState(false);
    const [showAboutDialog, setShowAboutDialog] = useState(false);
    // Transposition rewrites the whole dataset, so it asks first and shows what
    // the change will cost -- lost #target markings, suffixed duplicate names,
    // the new shape.
    const [transposeConfirm, setTransposeConfirm] = useState<string[] | null>(null);
    const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
    const [showLoadFromUrl, setShowLoadFromUrl] = useState(false);
    const [version, setVersion] = useState<string>('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    // Set when an export had to invent a row-identifier column because the file
    // carried none (#966). Adding a column to someone's file is not something to
    // do quietly, so the export reports what it added and we say so here.
    const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

    // Ref for scrolling to Step 2
    const step2Ref = useRef<HTMLDivElement>(null);
    // Ref for the CSV grid component
    const gridRef = useRef<any>(null);

    // Listen for file-loaded events from backend
    useEffect(() => {
        const unsubscribe = EventsOn('file-loaded', (filename: string) => {
            setFileName(filename);
        });
        const unsubscribeUnsaved = EventsOn('unsaved-state-changed', (dirty: boolean) => {
            setHasUnsavedChanges(dirty);
        });

        // Check GoPCA status on startup
        checkGoPCAInstallation();

        // Fetch version on startup
        GetVersion().then((v) => {
            setVersion(v);
        }).catch((err) => {
            console.error('Failed to get version:', err);
        });

        // Set up drag and drop listener
        OnFileDrop(async (x: number, y: number, paths: string[]) => {
            if (paths.length > 0) {
                const filePath = paths[0];
                // Only accept supported file types
                // Parquet belongs here too: the file dialog accepts it, Load
                // from URL accepts it, loadParquet exists and is tested, and
                // the documentation says it is supported. Only the most
                // natural gesture for opening a file refused it (#879).
                if (filePath.match(/\.(csv|tsv|xlsx|xls|parquet)$/i)) {
                    await handleDroppedFile(filePath);
                } else {
                    setErrorMessage('Unsupported file type. Please drop a CSV, TSV, Excel, or Parquet file.');
                }
            }
        }, false);

        return () => {
            unsubscribe();
            unsubscribeUnsaved();
            OnFileDropOff();
        };
    }, []);

    // Auto-scroll to Step 2 when file is loaded
    useEffect(() => {
        if (fileLoaded && fileData && step2Ref.current) {
            // Small delay to ensure DOM is updated
            setTimeout(() => {
                step2Ref.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 100);
        }
    }, [fileLoaded, fileData]);

    // Handle logo click - show About dialog
    const handleLogoClick = () => {
        setShowAboutDialog(true);
    };

    // Check GoPCA installation status
    const checkGoPCAInstallation = async () => {
        setIsCheckingGoPCA(true);
        try {
            const status = await CheckGoPCAStatus();
            setGopcaStatus(status);
        } catch (error) {
            console.error('Error checking GoPCA status:', error);
            setGopcaStatus({
                installed: false,
                path: '',
                version: '',
                error: 'Failed to check GoPCA status'
            });
        } finally {
            setIsCheckingGoPCA(false);
        }
    };

    // A load can fail because the sheet has a title block above the table: the
    // plain path cannot read that, but the wizard can be told where the table
    // starts. Offer the handoff, and otherwise report the error (#799).
    const handleLoadFailure = async (errorMsg: string) => {
        try {
            const suggestion = await SuggestImportForFailedLoad();
            if (suggestion?.needsWizard && suggestion.filePath) {
                setWizardInitialFile(suggestion.filePath);
                setWizardInitialSkipRows(suggestion.skipRows);
                setShowImportWizard(true);
                setErrorMessage(null);
                setFileLoaded(false);
                setFileName(null);
                return;
            }
        } catch (suggestErr) {
            console.error('Import suggestion failed:', suggestErr);
        }
        setErrorMessage('Could not load file — ' + errorMsg);
        setFileLoaded(false);
        setFileName(null);
    };

    // Handle file selection
    // Handle files dropped via Wails drag and drop
    const handleDroppedFile = async (filePath: string) => {
        setIsLoading(true);
        try {
            const result = await LoadCSV(filePath);
            if (result && result.data && result.data.length > 0) {
                setFileData(result);
                setFileLoaded(true);
                // Clear history when loading new file
                await ClearHistory();
                // Clear any previous analysis
                setMissingValueStats(null);
                setDataQualityReport(null);
                setValidationResult(null);
            } else {
                setErrorMessage('Could not load file — the file appears to be empty or invalid. Is it a valid CSV, TSV, Excel, or Parquet file?');
            }
        } catch (error: any) {
            console.error('Error loading dropped file:', error);
            await handleLoadFailure(error?.message || error?.toString() || 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    // Load file from dialog
    const handleLoadFromDialog = async () => {
        setIsLoading(true);
        try {
            const result = await LoadCSV('');
            if (result && result.data && result.data.length > 0) {
                setFileData(result);
                setFileLoaded(true);
                // Filename will be set by the event from backend
                // Clear history when loading new file
                await ClearHistory();
            } else {
                console.error('Invalid file data received:', result);
                throw new Error('No data found in file');
            }
        } catch (error: any) {
            console.error('Error loading file:', error);
            await handleLoadFailure(error?.message || error?.toString() || 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle data changes
    const handleDataChange = async (rowIndex: number, colIndex: number, newValue: string) => {
        if (fileData && fileData.data[rowIndex][colIndex] !== newValue) {
            try {
                const oldValue = fileData.data[rowIndex][colIndex];
                const updatedData = await ExecuteCellEdit(fileData, rowIndex, colIndex, oldValue, newValue);
                setFileData(updatedData);
                setValidationResult(null);
            } catch (error) {
                console.error('Error updating cell:', error);
                // Optionally show an error message to the user
            }
        }
    };

    // Handle header changes
    const handleHeaderChange = async (colIndex: number, newHeader: string) => {
        if (fileData && fileData.headers[colIndex] !== newHeader) {
            try {
                const oldHeader = fileData.headers[colIndex];
                const updatedData = await ExecuteHeaderEdit(fileData, colIndex, oldHeader, newHeader);
                setFileData(updatedData);
                setValidationResult(null);
            } catch (error) {
                console.error('Error updating header:', error);
            }
        }
    };

    // Handle validation
    const handleValidate = async () => {
        if (!fileData) {
return;
}

        setIsValidating(true);
        try {
            const result = await ValidateForGoPCA(fileData);
            if (result) {
                setValidationResult({
                    isValid: result.isValid,
                    messages: result.messages || []
                });
            }
        } catch (error) {
            console.error('Validation error:', error);
            setValidationResult({
                isValid: false,
                messages: ['ERROR: Failed to validate data - ' + error]
            });
        } finally {
            setIsValidating(false);
        }
    };

    // Handle missing value analysis
    const handleAnalyzeMissingValues = async () => {
        if (!fileData) {
return;
}

        try {
            const stats = await AnalyzeMissingValues(fileData);
            setMissingValueStats(stats);
            setShowMissingValueSummary(true);
        } catch (error) {
            console.error('Error analyzing missing values:', error);
            setErrorMessage('Could not analyze missing values — ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    // Handle missing value fill
    const handleFillMissingValues = async (strategy: string, column: string, value?: string) => {
        if (!fileData) {
return;
}

        try {
            const request = {
                strategy,
                column,
                value: value || ''
            };
            const result = await FillMissingValues(fileData, request);
            if (result) {
                setFileData(result);
                setValidationResult(null);
                // Re-analyze missing values
                const stats = await AnalyzeMissingValues(result);
                setMissingValueStats(stats);
            }
        } catch (error) {
            console.error('Error filling missing values:', error);
            setErrorMessage('Could not fill missing values — ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    // Handle import completion from wizard
    const handleImportComplete = (data: FileData) => {
        setFileData(data);
        setFileLoaded(true);
        setShowImportWizard(false);
        setValidationResult(null);
        setMissingValueStats(null);
        // Filename will be set by the event from backend
    };

    // Handle Load from URL completion
    const handleLoadFromUrlComplete = (data: FileData) => {
        setFileData(data);
        setFileLoaded(true);
        setShowLoadFromUrl(false);
        setValidationResult(null);
        setMissingValueStats(null);
    };

    // Handle transform completion
    const handleTransformComplete = (data: FileData) => {
        setFileData(data);
        setValidationResult(null);
        setShowTransformDialog(false);
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200">
            {/* Header - matching GoPCA Desktop exactly */}
            <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-lg backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95">
                <div className="flex items-center justify-between max-w-7xl mx-auto px-4 py-3 h-20">
                    <HelpWrapper helpKey="gocsv-logo-about" className="flex items-center gap-4">
                        <img
                            src={logo}
                            alt="GoCSV - GoPCA CSV Editor"
                            className="h-12 cursor-pointer hover:opacity-90 transition-opacity flex-shrink-0"
                            onClick={handleLogoClick}
                        />
                        <div className="flex items-center gap-3">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Data Editor for GoPCA</p>
                            {hasUnsavedChanges && (
                                <span
                                    title="Unsaved changes"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Unsaved
                                </span>
                            )}
                        </div>
                    </HelpWrapper>
                    <div className="flex-1 px-6">
                        <HelpDisplay
                            helpKey={currentHelpKey}
                            title={currentHelp?.title ?? ''}
                            text={currentHelp?.text ?? ''}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <HelpWrapper helpKey="gocsv-documentation">
                            <button
                                onClick={() => setShowDocumentation(true)}
                                className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                                aria-label="Open documentation"
                            >
                                {/* Book icon */}
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-5 h-5 text-gray-700 dark:text-gray-300"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25"
                                    />
                                </svg>
                            </button>
                        </HelpWrapper>
                        <HelpWrapper helpKey="theme-toggle">
                            <ThemeToggle />
                        </HelpWrapper>
                    </div>
                </div>
            </header>

            {/* Main content area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 max-w-7xl mx-auto w-full">
                <div className="space-y-6">
                    {/* Error display */}
                    {errorMessage && (
                        <ErrorAlert
                            title="Error"
                            message={errorMessage}
                            onDismiss={() => setErrorMessage(null)}
                        />
                    )}

                    {/* Notices that are not failures, such as a row-identifier
                        column added on export (#966). */}
                    {noticeMessage && (
                        <ErrorAlert
                            type="info"
                            title="Exported"
                            message={noticeMessage}
                            onDismiss={() => setNoticeMessage(null)}
                        />
                    )}

                    {/* Step 1: Load Data - matching GoPCA's card style */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 animate-fadeIn">
                        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                            Step 1: Load Data
                        </h2>

                        <div className="space-y-4">
                            <div
                                className="border-2 border-dashed rounded-lg p-8 text-center transition-colors border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                            >
                                <svg className="mx-auto h-12 w-12 text-gray-400 transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                        Drag and drop your file here
                                    </span>
                                    <br />
                                    <span className="text-xs">CSV, TSV, Excel, or Parquet files</span>
                                </p>
                            </div>

                            <div className="text-center">
                                <span className="text-gray-500 dark:text-gray-400 text-sm">or</span>
                            </div>

                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <HelpWrapper helpKey="browse-file">
                                        <button
                                            onClick={handleLoadFromDialog}
                                            disabled={isLoading}
                                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isLoading ? 'Loading...' : 'Choose File'}
                                        </button>
                                    </HelpWrapper>
                                    <HelpWrapper helpKey="import-wizard">
                                        <button
                                            onClick={() => setShowImportWizard(true)}
                                            disabled={isLoading}
                                            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Import with Wizard
                                        </button>
                                    </HelpWrapper>
                                    <HelpWrapper helpKey="load-from-url">
                                        <button
                                            onClick={() => setShowLoadFromUrl(true)}
                                            disabled={isLoading}
                                            className="w-full px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Load from URL
                                        </button>
                                    </HelpWrapper>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                    <p><span className="font-medium">Choose File:</span> Quick file picker for standard CSV/TSV files with automatic format detection</p>
                                    <p><span className="font-medium">Import with Wizard:</span> Advanced options for Excel sheets, custom delimiters, header rows, and column selection</p>
                                    <p><span className="font-medium">Load from URL:</span> Import directly from a public web URL — CSV, TSV, Excel, or Parquet. GitHub links rewritten automatically.</p>
                                </div>
                            </div>

                            {fileName && (
                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {fileName}
                                    </span>
                                    <button
                                        onClick={() => {
                                            setFileName(null);
                                            setFileLoaded(false);
                                            setFileData(null);
                                            setValidationResult(null);
                                        }}
                                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Step 2: Edit Data */}
                    {fileLoaded && fileData && (
                        <div ref={step2Ref} className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 animate-fadeIn">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 text-center flex-1">
                                    Step 2: Edit Data
                                </h2>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {fileData.rows} rows × {fileData.columns} columns
                                </div>
                            </div>

                            {/* Data Quality Toolbar */}
                            <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex items-center gap-4">
                                    <HelpWrapper helpKey="undo-redo-controls">
                                        <UndoRedoControls fileData={fileData} onDataUpdate={setFileData} />
                                    </HelpWrapper>
                                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
                                    <HelpWrapper helpKey="data-quality-report">
                                        <button
                                            onClick={async () => {
                                                if (!fileData) {
return;
}
                                                setIsAnalyzingQuality(true);
                                                try {
                                                    const report = await AnalyzeDataQuality(fileData);
                                                    setDataQualityReport(report);
                                                    setShowDataQualityReport(true);
                                                } catch (error) {
                                                    console.error('Error analyzing data quality:', error);
                                                    setErrorMessage('Could not analyze data quality — ' + (error instanceof Error ? error.message : String(error)));
                                                } finally {
                                                    setIsAnalyzingQuality(false);
                                                }
                                            }}
                                            disabled={isAnalyzingQuality}
                                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <span className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                {isAnalyzingQuality ? 'Analyzing...' : 'Data Quality Report'}
                                            </span>
                                        </button>
                                    </HelpWrapper>
                                    <HelpWrapper helpKey="analyze-missing">
                                        <button
                                            onClick={handleAnalyzeMissingValues}
                                            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors border border-gray-300 dark:border-gray-500"
                                        >
                                            <span className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                                Analyze Missing Values
                                            </span>
                                        </button>
                                    </HelpWrapper>
                                    <HelpWrapper helpKey="fill-missing">
                                        <button
                                            onClick={() => setShowMissingValueDialog(true)}
                                            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors border border-gray-300 dark:border-gray-500"
                                        >
                                            <span className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                </svg>
                                                Fill Missing Values
                                            </span>
                                        </button>
                                    </HelpWrapper>
                                    <HelpWrapper helpKey="filter-rows">
                                        <button
                                            onClick={() => setShowFilterDialog(true)}
                                            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors border border-gray-300 dark:border-gray-500"
                                        >
                                            <span className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                                </svg>
                                                Filter Rows
                                            </span>
                                        </button>
                                    </HelpWrapper>
                                    <HelpWrapper helpKey="average-replicates">
                                        <button
                                            onClick={() => setShowAggregateDialog(true)}
                                            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors border border-gray-300 dark:border-gray-500"
                                        >
                                            <span className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h10M4 18h6" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 16l3 3 3-5" />
                                                </svg>
                                                Average Replicates
                                            </span>
                                        </button>
                                    </HelpWrapper>
                                    <HelpWrapper helpKey="transpose">
                                        <button
                                            onClick={async () => {
                                                if (!fileData) {
                                                    return;
                                                }
                                                try {
                                                    setTransposeConfirm(await TransposeWarnings(fileData));
                                                } catch (error) {
                                                    console.error('Error preparing transpose:', error);
                                                }
                                            }}
                                            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors border border-gray-300 dark:border-gray-500"
                                        >
                                            <span className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h6v6H4V4zm0 10h6v6H4v-6zm10-10h6v6h-6V4z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 14l6 6m0-6l-6 6" />
                                                </svg>
                                                Transpose
                                            </span>
                                        </button>
                                    </HelpWrapper>
                                    <HelpWrapper helpKey="transform-data">
                                        <button
                                            onClick={() => setShowTransformDialog(true)}
                                            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                                        >
                                            <span className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                                </svg>
                                                Transform Data
                                            </span>
                                        </button>
                                    </HelpWrapper>
                                </div>
                                {missingValueStats && (
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Missing: {missingValueStats.missingCells} cells ({missingValueStats.missingPercent?.toFixed(1)}%)
                                    </div>
                                )}
                            </div>

                            <div className="h-[600px] w-full">
                                <ErrorBoundary
                                    onError={(error, errorInfo) => {
                                        console.error('CSVGrid Error:', error, errorInfo);
                                    }}
                                >
                                    <CSVGrid
                                        ref={gridRef}
                                        data={fileData.data}
                                        headers={fileData.headers}
                                        rowNames={fileData.rowNames}
                                        rowNamesHeader={fileData.rowNamesHeader}
                                        fileData={fileData}
                                        onDataChange={handleDataChange}
                                        onHeaderChange={handleHeaderChange}
                                        onRowNameChange={(rowIndex, newRowName) => {
                                        if (fileData && fileData.rowNames) {
                                            const newRowNames = [...fileData.rowNames];
                                            newRowNames[rowIndex] = newRowName;
                                            setFileData({ ...fileData, rowNames: newRowNames });
                                            setValidationResult(null);
                                        }
                                    }}
                                    onRefresh={async (updatedData?: any) => {
                                        if (updatedData) {
                                            // Use the updated data returned from backend
                                            setFileData(updatedData);
                                            setValidationResult(null);
                                        } else if (fileData) {
                                            // Fallback: Force React to re-render with updated data
                                            setFileData({
                                                ...fileData,
                                                headers: [...fileData.headers],
                                                data: fileData.data.map(row => [...row])
                                            });
                                            setValidationResult(null);
                                        }
                                    }}
                                    />
                                </ErrorBoundary>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Validate & Export */}
                    {fileLoaded && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 animate-fadeIn">
                            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                                Step 3: Validate & Export
                            </h2>

                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <HelpWrapper helpKey="validate-gopca" className="flex-1">
                                        <button
                                            onClick={handleValidate}
                                            disabled={isValidating}
                                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isValidating ? 'Validating...' : 'Validate for GoPCA'}
                                        </button>
                                    </HelpWrapper>
                                    <HelpWrapper helpKey="open-gopca" className="flex-1">
                                        <button
                                            onClick={async () => {
                                                if (!fileData) {
return;
}

                                                // Check if GoPCA is installed
                                                if (!gopcaStatus?.installed) {
                                                    setShowDownloadConfirm(true);
                                                    return;
                                                }

                                                try {
                                                    await OpenInGoPCA(fileData);
                                                } catch (error) {
                                                    console.error('Error opening in GoPCA:', error);
                                                    setErrorMessage('Could not open in GoPCA — ' + (error instanceof Error ? error.message : String(error)));
                                                }
                                            }}
                                            disabled={!gopcaStatus || isCheckingGoPCA}
                                            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isCheckingGoPCA ? 'Checking...' :
                                             !gopcaStatus?.installed ? 'Install GoPCA' :
                                             'Open in GoPCA'}
                                        </button>
                                    </HelpWrapper>
                                </div>

                                {validationResult && (
                                    <ValidationResults
                                        isValid={validationResult.isValid}
                                        messages={validationResult.messages}
                                        onClose={() => setValidationResult(null)}
                                    />
                                )}

                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Export Options
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        <HelpWrapper helpKey="export-csv">
                                            <button
                                                onClick={async () => {
                                                    if (fileData) {
                                                        try {
                                                            const result = await SaveCSV(fileData);
                                                            setNoticeMessage(rowIdentifierNotice(result?.syntheticRowIDHeader));
                                                        } catch (error) {
                                                            console.error('Error saving file:', error);
                                                            setErrorMessage('Could not save file — ' + (error instanceof Error ? error.message : String(error)));
                                                        }
                                                    }
                                                }}
                                                className="w-full px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                            >
                                                Export as CSV
                                            </button>
                                        </HelpWrapper>
                                        <HelpWrapper helpKey="export-excel">
                                            <button
                                                onClick={async () => {
                                                    if (fileData) {
                                                        try {
                                                            const result = await SaveExcel(fileData);
                                                            setNoticeMessage(rowIdentifierNotice(result?.syntheticRowIDHeader));
                                                        } catch (error) {
                                                            console.error('Error saving Excel file:', error);
                                                            setErrorMessage('Could not save Excel file — ' + (error instanceof Error ? error.message : String(error)));
                                                        }
                                                    }
                                                }}
                                                className="w-full px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                            >
                                                Export as Excel
                                            </button>
                                        </HelpWrapper>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Missing Value Summary Dialog */}
            <MissingValueSummary
                stats={missingValueStats}
                isOpen={showMissingValueSummary}
                onClose={() => setShowMissingValueSummary(false)}
            />

            {/* Missing Value Fill Dialog */}
            <MissingValueDialog
                isOpen={showMissingValueDialog}
                onClose={() => setShowMissingValueDialog(false)}
                onFill={handleFillMissingValues}
                columns={fileData?.headers || []}
                columnTypes={fileData?.columnTypes || {}}
            />

            {/* Data Quality Report Dashboard */}
            <DataQualityDashboard
                report={dataQualityReport}
                isOpen={showDataQualityReport}
                onClose={() => setShowDataQualityReport(false)}
                onShowRows={(rows) => {
                    // Close first: the report is a modal over the grid, so
                    // selecting rows behind it would scroll something the user
                    // cannot see (#931).
                    setShowDataQualityReport(false);
                    gridRef.current?.focusRows(rows);
                }}
            />

            {/* Import Wizard */}
            <ImportWizard
                isOpen={showImportWizard}
                onClose={() => {
                    setShowImportWizard(false);
                    setWizardInitialFile(null);
                    setWizardInitialSkipRows(undefined);
                }}
                onImportComplete={handleImportComplete}
                initialFilePath={wizardInitialFile}
                initialSkipRows={wizardInitialSkipRows}
            />

            {/* Load from URL */}
            <LoadFromUrlDialog
                isOpen={showLoadFromUrl}
                onClose={() => setShowLoadFromUrl(false)}
                onDataLoaded={handleLoadFromUrlComplete}
            />

            {/* Data Transform Dialog */}
            {fileData && (
                <DataTransformDialog
                    isOpen={showTransformDialog}
                    onClose={() => setShowTransformDialog(false)}
                    fileData={fileData}
                    onTransformComplete={handleTransformComplete}
                />
            )}

            {fileData && (
                <AggregateRowsDialog
                    isOpen={showAggregateDialog}
                    onClose={() => setShowAggregateDialog(false)}
                    fileData={fileData}
                    onAggregateComplete={(updated) => {
                        setFileData(updated);
                        setValidationResult(null);
                    }}
                />
            )}

            {fileData && (
                <FilterRowsDialog
                    isOpen={showFilterDialog}
                    onClose={() => setShowFilterDialog(false)}
                    fileData={fileData}
                    onFilterComplete={(updated) => {
                        setFileData(updated);
                        setValidationResult(null);
                    }}
                />
            )}

            {/* Documentation Viewer */}
            <DocumentationViewer
                isOpen={showDocumentation}
                onClose={() => setShowDocumentation(false)}
            />

            {/* About Dialog */}
            <AboutDialog
                isOpen={showAboutDialog}
                onClose={() => setShowAboutDialog(false)}
                version={version}
            />

            {/* Transpose confirmation, carrying what the change will cost */}
            <ConfirmDialog
                isOpen={transposeConfirm !== null}
                onClose={() => setTransposeConfirm(null)}
                onConfirm={async () => {
                    setTransposeConfirm(null);
                    if (!fileData) {
                        return;
                    }
                    try {
                        const updated = await ExecuteTranspose(fileData);
                        setFileData(updated);
                        setValidationResult(null);
                    } catch (error) {
                        console.error('Error transposing:', error);
                    }
                }}
                title="Transpose rows and columns"
                message={(transposeConfirm || []).join('\n\n')}
                confirmText="Transpose"
                cancelText="Cancel"
            />

            {/* Download GoPCA Confirmation */}
            <ConfirmDialog
                isOpen={showDownloadConfirm}
                onClose={() => setShowDownloadConfirm(false)}
                onConfirm={async () => {
                    setShowDownloadConfirm(false);
                    try {
                        await DownloadGoPCA();
                    } catch (error) {
                        console.error('Error downloading GoPCA:', error);
                    }
                }}
                title="GoPCA Not Installed"
                message="GoPCA Desktop is not installed. Would you like to download it?"
                confirmText="Download"
                cancelText="Cancel"
            />
        </div>
    );
}

function App() {
    return (
        <ThemeProvider>
            <ErrorBoundary
                onError={(error, errorInfo) => {
                    console.error('App Error Boundary:', error, errorInfo);
                }}
            >
                <HelpProvider content={helpContent}>
                    <AppContent />
                </HelpProvider>
            </ErrorBoundary>
        </ThemeProvider>
    );
}

export default App;