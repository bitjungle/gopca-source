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
import { CheckGoCSVStatus, OpenInGoCSV, LaunchGoCSV, DownloadGoCSV, required } from '../api/backend';
import { FileData } from '../types';
import { logger } from '../utils/logger';

export interface GoCSVStatus {
    installed: boolean;
    path?: string;
    error?: string;
}

export interface GoCSVIntegrationResult {
    goCSVStatus: GoCSVStatus | null;
    isCheckingGoCSV: boolean;
    showGoCSVDownloadDialog: boolean;
    setShowGoCSVDownloadDialog: (show: boolean) => void;
    handleGoCSVAction: (fileData: FileData | null) => Promise<void>;
    handleGoCSVDownload: () => Promise<void>;
}

/**
 * Manages the GoCSV companion app integration: status checks, launching,
 * opening files in GoCSV, and the download confirmation dialog.
 */
export function useGoCSVIntegration(): GoCSVIntegrationResult {
    const [goCSVStatus, setGoCSVStatus] = useState<GoCSVStatus | null>(null);
    const [isCheckingGoCSV, setIsCheckingGoCSV] = useState(false);
    const [showGoCSVDownloadDialog, setShowGoCSVDownloadDialog] = useState(false);

    const handleGoCSVAction = useCallback(async (fileData: FileData | null) => {
        setIsCheckingGoCSV(true);

        try {
            const status = required(await CheckGoCSVStatus(), 'CheckGoCSVStatus');
            setGoCSVStatus(status);

            if (status.installed) {
                if (fileData) {
                    await OpenInGoCSV(fileData);
                } else {
                    await LaunchGoCSV();
                }
            } else {
                setShowGoCSVDownloadDialog(true);
            }
        } catch (err) {
            logger.error('GoCSV action failed:', err);
            alert(`Failed to perform GoCSV action: ${err}`);
        } finally {
            setIsCheckingGoCSV(false);
        }
    }, []);

    const handleGoCSVDownload = useCallback(async () => {
        setShowGoCSVDownloadDialog(false);
        try {
            await DownloadGoCSV();
        } catch (error) {
            logger.error('Error downloading GoCSV:', error);
            alert('Failed to open download page: ' + error);
        }
    }, []);

    return {
        goCSVStatus,
        isCheckingGoCSV,
        showGoCSVDownloadDialog,
        setShowGoCSVDownloadDialog,
        handleGoCSVAction,
        handleGoCSVDownload
    };
}
