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

/**
 * Custom hook for file operations
 * Consolidates file loading, validation, and data management
 */

import { useState, useCallback } from 'react';
import { main } from '../api/backend';
import { LoadCSV, ClearHistory } from '../api/backend';
import { handleAsync, useLoadingState } from '@gopca/ui-components';

type FileData = main.FileData;

export function useFileOperations() {
  const [fileLoaded, setFileLoaded] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const { isLoading, withLoading } = useLoadingState();

  const resetFileState = useCallback(() => {
    setFileLoaded(false);
    setFileName(null);
    setFileData(null);
  }, []);

  const loadFile = useCallback(async (filePath: string) => {
    return withLoading(async () => {
      const result = await handleAsync(
        () => LoadCSV(filePath),
        {
          errorPrefix: 'Error loading file',
          showUserError: true
        }
      );

      if (result && result.data && result.data.length > 0) {
        setFileData(result);
        setFileLoaded(true);
        // Clear history when loading new file
        await ClearHistory();
        return result;
      } else {
        throw new Error('Failed to load file or file is empty');
      }
    });
  }, [withLoading]);

  const updateData = useCallback((
    updater: (data: FileData) => FileData
  ) => {
    if (fileData) {
      setFileData(updater(fileData));
    }
  }, [fileData]);

  return {
    fileLoaded,
    fileName,
    fileData,
    isLoading,
    loadFile,
    resetFileState,
    updateData,
    setFileName
  };
}