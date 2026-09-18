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

import React, { createContext, useContext, useMemo } from 'react';
import { useFileData, FileDataResult } from '../hooks/useFileData';

/**
 * FileDataContext exposes all file-loading state and operations to the
 * component tree, eliminating prop drilling for fileData and related helpers.
 *
 * Provider: wrap the subtree that needs file data with <FileDataProvider>.
 * Consumer: call useFileDataContext() in any descendant component.
 */
const FileDataContext = createContext<FileDataResult | undefined>(undefined);

/**
 * Consume FileDataContext. Throws if called outside <FileDataProvider>.
 */
export function useFileDataContext(): FileDataResult {
    const ctx = useContext(FileDataContext);
    if (!ctx) {
        throw new Error('useFileDataContext must be used within FileDataProvider');
    }
    return ctx;
}

export const FileDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
        fileData, fileName, filePath, fileError, datasetId, loading,
        setFileError, loadDataset, handleNativeFileSelect, setFileDataDirect,
        reloadWithFirstColumnAsData, clearFileError
    } = useFileData();

    // Memoize the context value to avoid creating a new object reference on
    // every provider render (e.g. parent re-renders). This prevents all context
    // consumers from re-rendering when none of these deps have changed.
    // Note: any change to a dep still re-renders ALL consumers — React context
    // does not support per-field subscriptions without context splitting.
    const value = useMemo<FileDataResult>(() => ({
        fileData, fileName, filePath, fileError, datasetId, loading,
        setFileError, loadDataset, handleNativeFileSelect, setFileDataDirect,
        reloadWithFirstColumnAsData, clearFileError
    }), [fileData, fileName, filePath, fileError, datasetId, loading,
        setFileError, loadDataset, handleNativeFileSelect, setFileDataDirect,
        reloadWithFirstColumnAsData, clearFileError]);

    return (
        <FileDataContext.Provider value={value}>
            {children}
        </FileDataContext.Provider>
    );
};
