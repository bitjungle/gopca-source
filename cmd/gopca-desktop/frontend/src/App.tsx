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

import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import { ThemeProvider, ConfirmDialog, ErrorBoundary, HelpProvider, useHelp } from '@gopca/ui-components';
import { DocumentationViewer, AboutDialog, TutorialViewer } from './components';
import { PaletteProvider } from './contexts/PaletteContext';
import helpContent from './help/help-content.json';
import { FileDataProvider } from './contexts/FileDataContext';
import { PCAProvider, usePCAContext } from './contexts/PCAContext';
import { VisualizationProvider, useVisualizationContext } from './contexts/VisualizationContext';
import { UIProvider, useUIContext } from './contexts/UIContext';
import { GoCSVProvider, useGoCSVContext } from './contexts/GoCSVContext';
import { HelpDisplay, HelpWrapper, ThemeToggle } from '@gopca/ui-components';
import logo from './assets/images/GoPCA-logo-1024-transp.png';
import { useAppInit } from './hooks/useAppInit';
import { DataLoadSection } from './components/sections/DataLoadSection';
import { PCAConfigSection } from './components/sections/PCAConfigSection';
import { ResultsSection } from './components/sections/ResultsSection';
import { RegressionConfigSection } from './components/sections/RegressionConfigSection';
import { RegressionResultsSection } from './components/sections/RegressionResultsSection';
import { AnalysisModeToggle } from './components/AnalysisModeToggle';
import { PCRProvider, usePCRContext, AnalysisMode } from './contexts/PCRContext';
import { logger } from './utils/logger';
import { FileData } from './types';
import { GetAppMode } from './api/backend';

/**
 * AppContent is the layout shell. It:
 * - Orchestrates the startup file handler (needs cross-context access)
 * - Creates the handleRunPCA callback (crosses PCAContext + VisualizationContext)
 * - Renders the app chrome (header, main, dialogs)
 *
 * All domain state lives in the context providers above it.
 */
function AppContent() {
    const { currentHelp, currentHelpKey } = useHelp();
    const { mode, setMode } = usePCRContext();
    const { pcaResponse, runPCA, handleStartupFile } = usePCAContext();
    const { selectedPlot, resetVisualizationSelections } = useVisualizationContext();
    const {
        showDocumentation, setShowDocumentation,
        showAboutDialog, setShowAboutDialog,
        mainScrollRef, handleLogoClick
    } = useUIContext();
    const {
        showGoCSVDownloadDialog, setShowGoCSVDownloadDialog, handleGoCSVDownload
    } = useGoCSVContext();

    // ── onStartupFile: orchestrate across FileData + PCA contexts ────────────
    // handleStartupFile is defined in PCAContext (has access to both).
    const onStartupFile = useCallback((data: FileData) => {
        handleStartupFile(data);
    }, [handleStartupFile]);

    const { version, guiConfig } = useAppInit(onStartupFile);

    // ── handleRunPCA: crosses PCAContext (runPCA) + VisualizationContext ─────
    const handleRunPCA = useCallback(async () => {
        await runPCA();
        resetVisualizationSelections();
    }, [runPCA, resetVisualizationSelections]);

    // ── Alert when Kernel PCA result arrives with an incompatible plot ───────
    // useVisualization already switches the plot; this adds the user alert.
    useEffect(() => {
        if (pcaResponse?.result?.method === 'kernel') {
            if (selectedPlot === 'correlations' || selectedPlot === 'biplot' || selectedPlot === 'biplot3d') {
                alert('The selected visualization is not supported for Kernel PCA. Switching to Scores Plot.');
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pcaResponse]);

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200">
            <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-lg backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95">
                <div className="flex items-center justify-between max-w-7xl mx-auto px-4 py-3 h-20">
                    <div className="flex items-center gap-4">
                        <HelpWrapper helpKey="logo-about">
                            <img
                                src={logo}
                                alt="GoPCA - Principal Component Analysis Tool"
                                className="h-12 cursor-pointer hover:opacity-90 transition-opacity flex-shrink-0"
                                onClick={handleLogoClick}
                            />
                        </HelpWrapper>
                        <AnalysisModeToggle mode={mode} onChange={setMode} />
                    </div>
                    <div className="flex-1 mx-8 overflow-hidden">
                        <HelpDisplay
                            helpKey={currentHelpKey}
                            title={currentHelp?.title || ''}
                            text={currentHelp?.text || ''}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <HelpWrapper helpKey="documentation-button">
                            <button
                                onClick={() => setShowDocumentation(true)}
                                className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                                aria-label="Open documentation"
                            >
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

            <main ref={mainScrollRef} className="flex-1 overflow-auto p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    <DataLoadSection />
                    <PCAConfigSection onRunPCA={handleRunPCA} />
                    {mode === 'explore' ? (
                        <ResultsSection guiConfig={guiConfig} />
                    ) : (
                        <>
                            <RegressionConfigSection />
                            <RegressionResultsSection />
                        </>
                    )}
                </div>
            </main>

            <DocumentationViewer
                isOpen={showDocumentation}
                onClose={() => setShowDocumentation(false)}
            />

            <AboutDialog
                isOpen={showAboutDialog}
                onClose={() => setShowAboutDialog(false)}
                version={version}
            />

            <ConfirmDialog
                isOpen={showGoCSVDownloadDialog}
                onClose={() => setShowGoCSVDownloadDialog(false)}
                onConfirm={handleGoCSVDownload}
                title="GoCSV Not Installed"
                message="GoCSV is not installed. Would you like to download it?"
                confirmText="Download"
                cancelText="Cancel"
            />
        </div>
    );
}

/**
 * App is the root component.
 *
 * On startup it calls GetAppMode() to determine whether this window is the
 * main application (mode "main") or a tutorial window (mode "tutorial").
 * The check is asynchronous; until it resolves we show only the background so
 * the tutorial window never flashes the full main UI.
 *
 * Provider order for the main app matters:
 *   FileDataProvider must be above PCAProvider (PCA reads file data).
 *   PCAProvider must be above VisualizationProvider (Viz reads pcaResponse).
 */
function App() {
    // null = not yet determined; "main" | "tutorial" once resolved
    const [mode, setMode] = useState<string | null>(null);
    const [tutorialDataset, setTutorialDataset] = useState<string>('');

    useEffect(() => {
        GetAppMode()
            .then((appMode: { mode: string; dataset: string }) => {
                setMode(appMode.mode);
                setTutorialDataset(appMode.dataset ?? '');
            })
            .catch((err: unknown) => {
                logger.error('GetAppMode failed, defaulting to main mode:', err);
                setMode('main');
            });
    }, []);

    // Render nothing (matching the Wails BackgroundColour from main.go: RGB 27,38,54)
    // until mode is determined.  Prevents a flash of the wrong UI in tutorial windows.
    if (mode === null) {
        return <div className="h-screen" style={{ backgroundColor: 'rgb(27,38,54)' }} />;
    }

    if (mode === 'tutorial') {
        return (
            <ThemeProvider>
                <TutorialViewer dataset={tutorialDataset} />
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider>
            <PaletteProvider>
                <HelpProvider content={helpContent}>
                    <FileDataProvider>
                        <PCAProvider>
                            <PCRModeProvider>
                            <VisualizationProvider>
                                <UIProvider>
                                    <GoCSVProvider>
                                        <ErrorBoundary
                                            onError={(error, errorInfo) => {
                                                logger.error('App Error Boundary:', error, errorInfo);
                                            }}
                                        >
                                            <AppContent />
                                        </ErrorBoundary>
                                    </GoCSVProvider>
                                </UIProvider>
                            </VisualizationProvider>
                            </PCRModeProvider>
                        </PCAProvider>
                    </FileDataProvider>
                </HelpProvider>
            </PaletteProvider>
        </ThemeProvider>
    );
}

/**
 * PCRModeProvider owns the analysis mode and supplies the regression context.
 *
 * The mode lives here rather than inside PCRProvider so that switching it does
 * not tear down and rebuild the regression state, which would discard a fitted
 * model every time the user glanced back at the decomposition.
 */
const PCRModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<AnalysisMode>('explore');
    return (
        <PCRProvider mode={mode} setMode={setMode}>
            {children}
        </PCRProvider>
    );
};

export default App;
