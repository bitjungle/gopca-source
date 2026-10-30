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

import React, { useState, useEffect } from 'react';
import { SelectFileForImport, GetFileInfo, PreviewFile, ImportFile } from '../api/backend';
import { main, required } from '../api/backend';
import { FileSelector, ProgressIndicator, Dialog } from '@gopca/ui-components';
import { FormatOptions } from './FormatOptions';
import { DataPreview } from './DataPreview';

type ImportFileInfo = main.ImportFileInfo;
type ImportOptions = main.ImportOptions;
type FilePreview = main.FilePreview;
type FileData = main.FileData;

interface ImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: (data: FileData) => void;
    /**
     * Open straight onto this file instead of the file-selection step. Used when
     * a plain load failed and the wizard is the tool that can read the sheet.
     */
    initialFilePath?: string | null;
    /** Rows to skip, pre-filled from the backend's inspection of the sheet. */
    initialSkipRows?: number;
}

type WizardStep = 'file-selection' | 'format-options' | 'data-preview' | 'importing';

export const ImportWizard: React.FC<ImportWizardProps> = ({ isOpen, onClose, onImportComplete, initialFilePath, initialSkipRows }) => {
    const [currentStep, setCurrentStep] = useState<WizardStep>('file-selection');
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileInfo, setFileInfo] = useState<ImportFileInfo | null>(null);
    const [importOptions, setImportOptions] = useState<ImportOptions>({
        format: 'csv',
        delimiter: ',',
        hasHeaders: true,
        headerRow: 0,
        sheet: '',
        rowNameColumn: -1,
        skipRows: 0,
        maxRows: 0,
        selectedColumns: []
    });
    const [preview, setPreview] = useState<FilePreview | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importProgress, setImportProgress] = useState(0);

    // Reset when closed
    useEffect(() => {
        if (!isOpen) {
            setCurrentStep('file-selection');
            setSelectedFile(null);
            setFileInfo(null);
            setPreview(null);
            setError(null);
            setImportProgress(0);
        }
    }, [isOpen]);

    // When opened on a specific file, skip the file-selection step and go straight
    // to the options with the suggested rows-to-skip already filled in. The user
    // still confirms in the preview before anything is imported.
    useEffect(() => {
        if (isOpen && initialFilePath) {
            void handleFileSelect(initialFilePath, initialSkipRows);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialFilePath, initialSkipRows]);

    const handleFileSelect = async (filePath: string, presetSkipRows?: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const info = required(await GetFileInfo(filePath), 'GetFileInfo');
            setSelectedFile(filePath);
            setFileInfo(info);

            // Update format based on file info
            setImportOptions(prev => ({
                ...prev,
                format: info.fileFormat,
                delimiter: info.fileFormat === 'tsv' ? '\t' : ',',
                // Only override when a value was supplied, so a user who reopens
                // the wizard by hand keeps whatever they had set.
                ...(presetSkipRows !== undefined ? { skipRows: presetSkipRows } : {})
            }));

            setCurrentStep('format-options');
        } catch (err) {
            setError(`Failed to get file info: ${err}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOptionsNext = async () => {
        if (!selectedFile) {
return;
}

        setIsLoading(true);
        setError(null);
        try {
            const previewData = await PreviewFile(selectedFile, importOptions);
            setPreview(previewData);
            setCurrentStep('data-preview');
        } catch (err) {
            setError(`Failed to preview file: ${err}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        if (!selectedFile) {
return;
}

        setCurrentStep('importing');
        setError(null);
        setImportProgress(0);

        try {
            // Simulate progress updates
            const progressInterval = setInterval(() => {
                setImportProgress(prev => Math.min(prev + 10, 90));
            }, 200);

            const data = required(await ImportFile(selectedFile, importOptions), 'ImportFile');

            clearInterval(progressInterval);
            setImportProgress(100);

            // Small delay to show 100% progress
            setTimeout(() => {
                onImportComplete(data);
                onClose();
            }, 500);
        } catch (err) {
            setError(`Failed to import file: ${err}`);
            setCurrentStep('data-preview');
        }
    };

    const handleBack = () => {
        switch (currentStep) {
            case 'format-options':
                setCurrentStep('file-selection');
                break;
            case 'data-preview':
                setCurrentStep('format-options');
                break;
            case 'importing':
                // Can't go back while importing
                break;
        }
    };

    // Dialog owns the isOpen check; unmounting from here would skip its
    // focus-restore cleanup.

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            width="w-full max-w-4xl"
            padded={false}
            ariaLabelledBy="import-wizard-title"
            className="max-h-[90vh] overflow-y-auto text-left"
            // An import in flight must not be dismissed by a stray click or key.
            closeOnBackdropClick={currentStep !== 'importing'}
            closeOnEscape={currentStep !== 'importing'}
        >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <h2
                                id="import-wizard-title"
                                className="text-lg font-semibold text-gray-900 dark:text-white"
                            >
                                Import Data Wizard
                            </h2>
                            {currentStep !== 'importing' && (
                                <button
                                    onClick={onClose}
                                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Progress indicator */}
                        <div className="mt-4">
                            <div className="flex items-center justify-between">
                                <div className={`flex items-center ${currentStep === 'file-selection' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                        currentStep === 'file-selection'
                                            ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-400'
                                            : 'border-gray-300 dark:border-gray-600'
                                    }`}>
                                        1
                                    </div>
                                    <span className="ml-2 text-sm font-medium">Select File</span>
                                </div>

                                <div className="flex-1 h-0.5 mx-4 bg-gray-200 dark:bg-gray-700" />

                                <div className={`flex items-center ${
                                    currentStep === 'format-options' ? 'text-blue-600 dark:text-blue-400' :
                                    currentStep === 'data-preview' || currentStep === 'importing' ? 'text-gray-600 dark:text-gray-400' :
                                    'text-gray-400 dark:text-gray-500'
                                }`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                        currentStep === 'format-options'
                                            ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-400'
                                            : currentStep === 'data-preview' || currentStep === 'importing'
                                            ? 'border-gray-300 dark:border-gray-600'
                                            : 'border-gray-300 dark:border-gray-600'
                                    }`}>
                                        2
                                    </div>
                                    <span className="ml-2 text-sm font-medium">Configure Options</span>
                                </div>

                                <div className="flex-1 h-0.5 mx-4 bg-gray-200 dark:bg-gray-700" />

                                <div className={`flex items-center ${
                                    currentStep === 'data-preview' || currentStep === 'importing' ? 'text-blue-600 dark:text-blue-400' :
                                    'text-gray-400 dark:text-gray-500'
                                }`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                        currentStep === 'data-preview' || currentStep === 'importing'
                                            ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-400'
                                            : 'border-gray-300 dark:border-gray-600'
                                    }`}>
                                        3
                                    </div>
                                    <span className="ml-2 text-sm font-medium">Preview & Import</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-4" style={{ minHeight: '400px', maxHeight: '60vh', overflowY: 'auto' }}>
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
                                {error}
                            </div>
                        )}

                        {currentStep === 'file-selection' && (
                            <FileSelector
                                onFileSelect={handleFileSelect}
                                isLoading={isLoading}
                                onBrowseClick={async () => {
                                    try {
                                        const filePath = await SelectFileForImport();
                                        return filePath || null;
                                    } catch (err) {
                                        console.error('Error selecting file:', err);
                                        return null;
                                    }
                                }}
                            />
                        )}

                        {currentStep === 'format-options' && fileInfo && (
                            <FormatOptions
                                fileInfo={fileInfo}
                                options={importOptions}
                                onChange={setImportOptions}
                            />
                        )}

                        {currentStep === 'data-preview' && preview && (
                            <DataPreview
                                preview={preview}
                                options={importOptions}
                                onChange={setImportOptions}
                            />
                        )}

                        {currentStep === 'importing' && (
                            <ProgressIndicator
                                progress={importProgress}
                                title="Importing Data..."
                                subtitle="Please wait while we import your file"
                                showPercentage={true}
                                getStatusMessage={(progress) => {
                                    if (progress < 20) {
return 'Reading file...';
}
                                    if (progress < 40) {
return 'Parsing data...';
}
                                    if (progress < 60) {
return 'Validating columns...';
}
                                    if (progress < 80) {
return 'Processing rows...';
}
                                    if (progress < 100) {
return 'Finalizing import...';
}
                                    return 'Import complete!';
                                }}
                            />
                        )}
                    </div>

                    {/* Footer */}
                    {currentStep !== 'importing' && (
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between">
                                <button
                                    onClick={handleBack}
                                    disabled={currentStep === 'file-selection' || isLoading}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Back
                                </button>

                                <div className="flex gap-2">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                                    >
                                        Cancel
                                    </button>

                                    {currentStep === 'format-options' && (
                                        <button
                                            onClick={handleOptionsNext}
                                            disabled={isLoading}
                                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isLoading ? 'Loading...' : 'Next'}
                                        </button>
                                    )}

                                    {currentStep === 'data-preview' && (
                                        <button
                                            onClick={handleImport}
                                            disabled={isLoading}
                                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Import Data
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
        </Dialog>
    );
};