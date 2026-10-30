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
import { CustomSelect, Dialog } from '@gopca/ui-components';
import { ExecuteAggregateRows, PreviewAggregate } from '../api/backend';
import { main, required } from '../api/backend';

type FileData = main.FileData;

interface AggregateRowsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    fileData: FileData;
    onAggregateComplete: (data: FileData) => void;
}

// Mirrors the AggregateFunc constants in cmd/gocsv/aggregate.go.
const functions = [
    { value: 'mean', label: 'Mean' },
    { value: 'median', label: 'Median' },
    { value: 'sum', label: 'Sum' },
    { value: 'first', label: 'First value' }
];

export const AggregateRowsDialog: React.FC<AggregateRowsDialogProps> = ({
    isOpen,
    onClose,
    fileData,
    onAggregateComplete
}) => {
    const [groupBy, setGroupBy] = useState('');
    const [func, setFunc] = useState('mean');
    const [preview, setPreview] = useState<main.AggregatePreview | null>(null);
    const [isApplying, setIsApplying] = useState(false);

    const headers: string[] = fileData?.headers || [];

    useEffect(() => {
        if (isOpen) {
            setGroupBy(headers[0] || '');
            setFunc('mean');
            setPreview(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Ask the backend what the aggregation would produce, on every change.
    //
    // The group count is the number worth seeing first: if it equals the row
    // count then every group has one member and nothing would change, which is
    // what a mistyped grouping column looks like.
    useEffect(() => {
        if (!isOpen || !fileData || !groupBy) {
            return;
        }
        let cancelled = false;
        const run = async () => {
            try {
                const result = await PreviewAggregate(fileData, { groupBy, func } as main.AggregateOptions);
                if (!cancelled) {
                    setPreview(result);
                }
            } catch (err) {
                console.error('Error previewing aggregation:', err);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [isOpen, fileData, groupBy, func]);

    const canApply = preview !== null && !preview.error && !isApplying;

    const handleApply = async () => {
        setIsApplying(true);
        try {
            const updated = required(await ExecuteAggregateRows(fileData, { groupBy, func } as main.AggregateOptions), 'ExecuteAggregateRows');
            onAggregateComplete(updated);
            onClose();
        } catch (err) {
            console.error('Error aggregating rows:', err);
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            width="w-[32rem]"
            padded={false}
            ariaLabelledBy="aggregate-rows-title"
        >
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2
                        id="aggregate-rows-title"
                        className="text-lg font-semibold text-gray-800 dark:text-gray-200"
                    >
                        Average Replicates
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Group rows by
                        </label>
                        <CustomSelect
                            value={groupBy}
                            onChange={setGroupBy}
                            options={headers.map((h) => ({ value: h, label: h }))}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Combine numbers with
                        </label>
                        <CustomSelect value={func} onChange={setFunc} options={functions} />
                    </div>

                    <div
                        role="status"
                        aria-live="polite"
                        className="text-sm rounded-md p-3 bg-gray-50 dark:bg-gray-700/50"
                    >
                        {preview?.error ? (
                            <span className="text-red-600 dark:text-red-400">{preview.error}</span>
                        ) : preview ? (
                            <>
                                <span className="text-gray-700 dark:text-gray-300">
                                    {preview.rows} rows become <strong>{preview.groups}</strong>, with{' '}
                                    {preview.smallestSize === preview.largestSize
                                        ? `${preview.smallestSize} per group`
                                        : `between ${preview.smallestSize} and ${preview.largestSize} per group`}
                                    .
                                </span>
                                {preview.groups === preview.rows && (
                                    <span className="block mt-1 text-amber-600 dark:text-amber-400">
                                        Every group has one row, so this would change nothing. Is that
                                        the right column to group by?
                                    </span>
                                )}
                                {preview.textConflicts > 0 && (
                                    <span className="block mt-1 text-amber-600 dark:text-amber-400">
                                        {preview.textConflicts} text cell(s) will be cleared, where the
                                        rows in a group disagree. Choosing one of the competing values
                                        would assert something no row said.
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="text-gray-500 dark:text-gray-400">Checking…</span>
                        )}
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        The grouping column becomes the row names, since the rows they named no
                        longer exist. Missing numbers are skipped rather than counted as zero.
                    </div>
                </div>

                <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!canApply}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isApplying ? 'Aggregating…' : 'Average Replicates'}
                    </button>
                </div>
        </Dialog>
    );
};
