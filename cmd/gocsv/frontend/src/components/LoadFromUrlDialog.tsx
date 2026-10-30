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

import { Dialog } from '@gopca/ui-components';
import React, { useState, useRef, useCallback } from 'react';
import {
    PeekRemoteURL,
    LoadCSV,
    DownloadAndInspectZip,
    LoadZipEntry,
    CancelZipImport
} from '../api/backend';
import { main, required } from '../api/backend';

type FileData = main.FileData;
type URLPeekResult = main.URLPeekResult;
type ZipEntry = main.ZipEntry;

interface LoadFromUrlDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onDataLoaded: (data: FileData) => void;
}

function formatFileSize(bytes: number): string {
    if (bytes < 0) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10 MB

export const LoadFromUrlDialog: React.FC<LoadFromUrlDialogProps> = ({
    isOpen,
    onClose,
    onDataLoaded
}) => {
    const [url, setUrl] = useState('');
    const [peekResult, setPeekResult] = useState<URLPeekResult | null>(null);
    const [isPeeking, setIsPeeking] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    // ZIP-specific state
    const [zipEntries, setZipEntries] = useState<ZipEntry[] | null>(null);
    const [selectedZipEntry, setSelectedZipEntry] = useState<ZipEntry | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    // Tracks the in-flight peek so handleClose can cancel it.
    const cancelPeekRef = useRef<(() => void) | null>(null);

    const resetState = () => {
        setUrl('');
        setPeekResult(null);
        setZipEntries(null);
        setSelectedZipEntry(null);
    };

    const handleClose = () => {
        if (isDownloading || isImporting) return;
        // Cancel any in-flight peek so its result doesn't repopulate state
        // after the dialog is hidden.
        if (cancelPeekRef.current) { cancelPeekRef.current(); cancelPeekRef.current = null; }
        // If a ZIP was inspected but not imported, tell the backend to clean up.
        if (zipEntries) CancelZipImport();
        resetState();
        onClose();
    };

    const handleCheck = useCallback(async () => {
        const trimmed = url.trim();
        if (!trimmed) return;
        // Cancel any previous in-flight peek.
        if (cancelPeekRef.current) cancelPeekRef.current();
        let cancelled = false;
        cancelPeekRef.current = () => { cancelled = true; };
        setIsPeeking(true);
        setPeekResult(null);
        setZipEntries(null);
        setSelectedZipEntry(null);
        try {
            const result = await PeekRemoteURL(trimmed);
            if (!cancelled) setPeekResult(result);
        } catch (e) {
            if (!cancelled) {
setPeekResult({
                url: trimmed,
                fileFormat: '',
                fileSizeBytes: -1,
                accessible: false,
                error: `Unexpected error: ${e}`
            });
}
        } finally {
            if (!cancelled) setIsPeeking(false);
            cancelPeekRef.current = null;
        }
    }, [url]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isPeeking && !isDownloading && !isImporting) {
            handleCheck();
        }
    };

    // Import a specific entry from an already-inspected ZIP.
    const doLoadZipEntry = async (entryName: string) => {
        setIsImporting(true);
        try {
            const data = required(await LoadZipEntry(entryName), 'LoadZipEntry');
            setZipEntries(null);
            setSelectedZipEntry(null);
            onDataLoaded(data);
            resetState();
            onClose();
        } catch (e) {
            setPeekResult(prev => prev ? {
                ...prev, accessible: false, error: `Import failed: ${e}`
            } : null);
            setZipEntries(null);
        } finally {
            setIsImporting(false);
        }
    };

    const handleDownload = async () => {
        if (!peekResult?.accessible || !peekResult.url) return;

        if (peekResult.fileFormat === 'zip') {
            // ZIP path: download + inspect, then auto-import or show picker.
            setIsDownloading(true);
            try {
                const result = required(await DownloadAndInspectZip(peekResult.url), 'DownloadAndInspectZip');
                if (result.error) {
                    setPeekResult(prev => prev ? {
                        ...prev, accessible: false, error: result.error
                    } : null);
                    return;
                }
                if (result.entries.length === 1) {
                    // Single data file — import immediately.
                    await doLoadZipEntry(result.entries[0].name);
                } else {
                    // Multiple files — show picker.
                    setZipEntries(result.entries);
                    setSelectedZipEntry(result.entries[0]);
                }
            } catch (e) {
                setPeekResult(prev => prev ? {
                    ...prev, accessible: false, error: `Download failed: ${e}`
                } : null);
            } finally {
                setIsDownloading(false);
            }
        } else {
            // Direct file path (CSV, Parquet, Excel, etc.)
            setIsDownloading(true);
            try {
                const data = required(await LoadCSV(peekResult.url), 'LoadCSV');
                onDataLoaded(data);
                resetState();
                onClose();
            } catch (e) {
                setPeekResult(prev => prev ? {
                    ...prev, accessible: false, error: `Download failed: ${e}`
                } : null);
            } finally {
                setIsDownloading(false);
            }
        }
    };

    const canDownload = peekResult?.accessible === true &&
        !!peekResult.fileFormat &&
        !isPeeking && !isDownloading && !isImporting && !zipEntries;

    const isLargeFile = (peekResult?.fileSizeBytes ?? -1) > LARGE_FILE_THRESHOLD;
    const isBusy = isDownloading || isImporting;

    if (!isOpen) return null;

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            width="w-full max-w-lg mx-4"
            padded={false}
            ariaLabelledBy="load-url-title"
        >

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2
                        id="load-url-title"
                        className="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        Load from URL
                    </h2>
                    <button
                        onClick={handleClose}
                        disabled={isBusy}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">

                    {/* URL input + Check button */}
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="url"
                            value={url}
                            onChange={e => { setUrl(e.target.value); setPeekResult(null); setZipEntries(null); }}
                            onKeyDown={handleKeyDown}
                            placeholder="https://example.com/data.csv"
                            disabled={isBusy || isPeeking}
                            autoFocus
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                        />
                        <button
                            onClick={handleCheck}
                            disabled={!url.trim() || isPeeking || isBusy}
                            className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                            {isPeeking ? 'Checking…' : 'Check URL'}
                        </button>
                    </div>

                    {/* Peek result */}
                    {peekResult && !zipEntries && (
                        <div className={`rounded-lg px-4 py-3 text-sm ${
                            peekResult.accessible
                                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        }`}>
                            {peekResult.accessible ? (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 font-medium text-green-800 dark:text-green-200">
                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="uppercase tracking-wide">{peekResult.fileFormat}</span>
                                        {peekResult.fileSizeBytes > 0 && (
                                            <span className="font-normal text-green-700 dark:text-green-300">
                                                · {formatFileSize(peekResult.fileSizeBytes)}
                                            </span>
                                        )}
                                    </div>
                                    {isLargeFile && (
                                        <p className="text-yellow-700 dark:text-yellow-300 text-xs">
                                            ⚠ Large file — download may take a moment.
                                        </p>
                                    )}
                                    {peekResult.url !== url.trim() && (
                                        <p className="text-green-600 dark:text-green-400 text-xs">
                                            GitHub link rewritten to raw URL automatically.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-start gap-2 text-red-700 dark:text-red-300">
                                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    <span>{peekResult.error}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ZIP file picker */}
                    {zipEntries && (
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    ZIP archive — select a file to import:
                                </p>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {zipEntries.map(entry => (
                                    <label
                                        key={entry.name}
                                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                            selectedZipEntry?.name === entry.name
                                                ? 'bg-violet-50 dark:bg-violet-900/20'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="zip-entry"
                                            value={entry.name}
                                            checked={selectedZipEntry?.name === entry.name}
                                            onChange={() => setSelectedZipEntry(entry)}
                                            className="text-violet-600 focus:ring-violet-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate block">
                                                {entry.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {entry.uncompressedSize > 0 && (
                                                <span className="text-xs text-gray-400">
                                                    {formatFileSize(entry.uncompressedSize)}
                                                </span>
                                            )}
                                            <span className="text-xs uppercase font-medium text-violet-600 dark:text-violet-400">
                                                {entry.format}
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Download/import progress bar */}
                    {isBusy && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-violet-700 dark:text-violet-300">
                                    {isImporting ? 'Importing…' : 'Downloading…'}
                                </span>
                                {!isImporting && (peekResult?.fileSizeBytes ?? -1) > 0 && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatFileSize(peekResult!.fileSizeBytes)}
                                    </span>
                                )}
                            </div>
                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                                <div className="h-full bg-violet-500 rounded-full animate-progress-indeterminate" />
                            </div>
                        </div>
                    )}

                    {/* Help text */}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Enter a direct file download URL (CSV, TSV, Excel, Parquet, ZIP).
                        GitHub links are rewritten to raw content URLs automatically.
                    </p>

                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={handleClose}
                        disabled={isBusy}
                        className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 transition-colors"
                    >
                        Cancel
                    </button>
                    {zipEntries ? (
                        <button
                            onClick={() => selectedZipEntry && doLoadZipEntry(selectedZipEntry.name)}
                            disabled={!selectedZipEntry || isImporting}
                            className="px-4 py-2 text-sm text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isImporting ? 'Importing…' : 'Import Selected File'}
                        </button>
                    ) : (
                        <button
                            onClick={handleDownload}
                            disabled={!canDownload}
                            className="px-4 py-2 text-sm text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isDownloading ? 'Downloading…' : 'Download and Import'}
                        </button>
                    )}
                </div>

        </Dialog>
    );
};
