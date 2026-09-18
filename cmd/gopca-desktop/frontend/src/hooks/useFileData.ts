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

import { useState, useCallback } from 'react';
import { LoadDatasetFile, SelectCSVFile, ReloadCSVFile } from '../../wailsjs/go/main/App';
import { FileData } from '../types';
import { logger } from '../utils/logger';
import { describeError } from '../utils/describeError';

export interface FileDataResult {
    fileData: FileData | null;
    fileName: string;
    filePath: string;
    fileError: string | null;
    datasetId: number;
    loading: boolean;
    setFileError: (error: string | null) => void;
    loadDataset: (filename: string, defaultGroupColumn?: string) => Promise<{ data: FileData; defaultGroupColumn?: string } | null>;
    handleNativeFileSelect: () => Promise<FileData | null>;
    setFileDataDirect: (data: FileData, name: string, path: string) => void;
    reloadWithFirstColumnAsData: (firstColumnIsData: boolean) => Promise<FileData | null>;
    clearFileError: () => void;
}

/**
 * Manages CSV file loading from disk (native picker), built-in sample datasets,
 * and programmatic setting (e.g. from the startup event).
 *
 * Returns the loaded data plus helpers to trigger loads.  Callers are
 * responsible for resetting dependent state (exclusions, PCA results, etc.)
 * via the return values — load functions return the new FileData so callers
 * can react.
 */
export function useFileData(): FileDataResult {
    const [fileData, setFileData] = useState<FileData | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [filePath, setFilePath] = useState<string>('');
    const [fileError, setFileError] = useState<string | null>(null);
    const [datasetId, setDatasetId] = useState(0);
    const [loading, setLoading] = useState(false);

    const bumpDatasetId = () => setDatasetId((prev) => prev + 1);

    /** Load a built-in sample dataset by filename. */
    const loadDataset = useCallback(async (
        filename: string,
        defaultGroupColumn?: string
    ): Promise<{ data: FileData; defaultGroupColumn?: string } | null> => {
        setLoading(true);
        setFileError(null);

        try {
            const result = await LoadDatasetFile(filename);
            setFileData(result);
            setFileName(filename);
            setFilePath('');
            bumpDatasetId();
            return { data: result, defaultGroupColumn };
        } catch (err) {
            setFileError(`Failed to load ${filename}: ${describeError(err)}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    /** Open the native OS file picker and load the selected CSV. */
    const handleNativeFileSelect = useCallback(async (): Promise<FileData | null> => {
        setLoading(true);
        setFileError(null);

        try {
            const result = await SelectCSVFile();

            if (!result) {
                // User cancelled
                return null;
            }

            const { data, filePath: selectedFilePath } = result;

            if (!data) {
                throw new Error('No data returned from file selection');
            }

            setFileName('Selected File');
            setFilePath(selectedFilePath);
            setFileData(data);
            bumpDatasetId();
            return data;
        } catch (err) {
            logger.error('File selection failed:', err);
            setFileError(`Failed to load file: ${describeError(err)}`);
            setFileData(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    /** Set file data directly (used by the startup file-load event). */
    const setFileDataDirect = useCallback((data: FileData, name: string, path: string) => {
        setFileData(data);
        setFileName(name);
        setFilePath(path);
        setFileError(null);
        bumpDatasetId();
    }, []);

    /**
     * Re-read the current file, saying whether its first column is data rather
     * than row names — GoPCA Desktop's equivalent of the CLI's --no-index.
     *
     * Only available for a file loaded from disk, since it re-reads by path.
     * The built-in sample datasets all ship with an identifier column, so there
     * is nothing for the switch to correct there (#969).
     */
    const reloadWithFirstColumnAsData = useCallback(
        async (firstColumnIsData: boolean): Promise<FileData | null> => {
            if (!filePath) {
                return null;
            }
            setLoading(true);
            setFileError(null);
            try {
                const data = await ReloadCSVFile(filePath, firstColumnIsData);
                if (!data) {
                    throw new Error('No data returned when re-reading the file');
                }
                setFileData(data);
                bumpDatasetId();
                return data;
            } catch (err) {
                logger.error('Re-reading the file failed:', err);
                setFileError(`Failed to re-read file: ${describeError(err)}`);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [filePath]
    );

    const clearFileError = useCallback(() => setFileError(null), []);

    return {
        fileData,
        fileName,
        filePath,
        fileError,
        datasetId,
        loading,
        setFileError,
        loadDataset,
        handleNativeFileSelect,
        setFileDataDirect,
        reloadWithFirstColumnAsData,
        clearFileError
    };
}
