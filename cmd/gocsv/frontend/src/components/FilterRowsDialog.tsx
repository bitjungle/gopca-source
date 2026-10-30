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
import { ExecuteFilterRows, PreviewFilter } from '../api/backend';
import { main, required } from '../api/backend';

type FileData = main.FileData;

interface FilterRowsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    fileData: FileData;
    onFilterComplete: (data: FileData) => void;
}

// Mirrors the FilterOperator constants in cmd/gocsv/filter.go.
const operators = [
    { value: 'equals', label: 'is', needsValue: true },
    { value: 'not_equals', label: 'is not', needsValue: true },
    { value: 'contains', label: 'contains', needsValue: true },
    { value: 'not_contains', label: 'does not contain', needsValue: true },
    { value: 'greater', label: 'is greater than', needsValue: true },
    { value: 'greater_equal', label: 'is at least', needsValue: true },
    { value: 'less', label: 'is less than', needsValue: true },
    { value: 'less_equal', label: 'is at most', needsValue: true },
    { value: 'is_empty', label: 'is empty', needsValue: false },
    { value: 'is_not_empty', label: 'is not empty', needsValue: false }
];

// Long enough to collapse a burst of keystrokes into one backend call, short
// enough that the match count still reads as live feedback.
const PREVIEW_DEBOUNCE_MS = 250;

export const FilterRowsDialog: React.FC<FilterRowsDialogProps> = ({
    isOpen,
    onClose,
    fileData,
    onFilterComplete
}) => {
    const [column, setColumn] = useState('');
    const [operator, setOperator] = useState('equals');
    const [value, setValue] = useState('');
    const [mode, setMode] = useState<'keep' | 'remove'>('keep');
    const [preview, setPreview] = useState<main.FilterPreview | null>(null);
    const [isApplying, setIsApplying] = useState(false);

    const headers: string[] = fileData?.headers || [];
    const needsValue = operators.find((o) => o.value === operator)?.needsValue ?? true;

    // Start on the first column each time the dialog opens, and clear anything
    // left from last time. The dialog is not unmounted when closed, so without
    // this the previous filter would still be sitting there.
    useEffect(() => {
        if (isOpen) {
            setColumn(headers[0] || '');
            setOperator('equals');
            setValue('');
            setMode('keep');
            setPreview(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Ask the backend what the filter would do, on every change.
    //
    // The count is what makes the operation safe to use: a filter that would
    // empty the table, or one that matches nothing, is worth seeing before it
    // is applied rather than after.
    //
    // Debounced, because every call ships the entire FileData across the Wails
    // boundary and typing a four-character value would otherwise send four
    // copies of a dataset that may be tens of megabytes. The delay is short
    // enough that the count still feels live.
    useEffect(() => {
        if (!isOpen || !fileData || !column) {
            return;
        }
        let cancelled = false;

        const timer = setTimeout(() => {
            const run = async () => {
                try {
                    const result = await PreviewFilter(fileData, {
                        column,
                        operator,
                        value: needsValue ? value : '',
                        mode
                    } as main.FilterCondition);
                    if (!cancelled) {
                        setPreview(result);
                    }
                } catch (err) {
                    console.error('Error previewing filter:', err);
                }
            };
            void run();
        }, PREVIEW_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [isOpen, fileData, column, operator, value, mode, needsValue]);

    // Dialog owns the isOpen check; unmounting from here would skip its
    // focus-restore cleanup.

    const canApply = preview !== null && !preview.error && !isApplying;

    const handleApply = async () => {
        setIsApplying(true);
        try {
            const updated = required(await ExecuteFilterRows(fileData, {
                column,
                operator,
                value: needsValue ? value : '',
                mode
            } as main.FilterCondition), 'ExecuteFilterRows');
            onFilterComplete(updated);
            onClose();
        } catch (err) {
            console.error('Error filtering rows:', err);
        } finally {
            setIsApplying(false);
        }
    };

    const columnOptions = headers.map((h) => ({ value: h, label: h }));
    const operatorOptions = operators.map((o) => ({ value: o.value, label: o.label }));

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            width="w-[32rem]"
            padded={false}
            ariaLabelledBy="filter-rows-title"
        >
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2
                        id="filter-rows-title"
                        className="text-lg font-semibold text-gray-800 dark:text-gray-200"
                    >
                        Filter Rows
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
                            Column
                        </label>
                        <CustomSelect value={column} onChange={setColumn} options={columnOptions} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Condition
                        </label>
                        <CustomSelect value={operator} onChange={setOperator} options={operatorOptions} />
                    </div>

                    {needsValue && (
                        <div>
                            <label
                                htmlFor="filter-value"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >
                                Value
                            </label>
                            <input
                                id="filter-value"
                                type="text"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                        </div>
                    )}

                    <fieldset>
                        <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Matching rows
                        </legend>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                <input
                                    type="radio"
                                    name="filter-mode"
                                    checked={mode === 'keep'}
                                    onChange={() => setMode('keep')}
                                />
                                Keep them
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                <input
                                    type="radio"
                                    name="filter-mode"
                                    checked={mode === 'remove'}
                                    onChange={() => setMode('remove')}
                                />
                                Remove them
                            </label>
                        </div>
                    </fieldset>

                    {/* What the filter would do, before it does it. Announced to
                        assistive technology, since the count changes as the user
                        types rather than in response to a discrete action. */}
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
                                    {preview.matched} of {preview.total} rows match.{' '}
                                    <strong>{preview.remaining}</strong> would remain.
                                </span>
                                {preview.remaining === 0 && (
                                    <span className="block mt-1 text-amber-600 dark:text-amber-400">
                                        This would leave no data. Undo is available, but check the
                                        condition first.
                                    </span>
                                )}
                                {preview.remaining === preview.total && (
                                    <span className="block mt-1 text-gray-500 dark:text-gray-400">
                                        This would change nothing.
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="text-gray-500 dark:text-gray-400">Checking…</span>
                        )}
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Blank cells match only “is empty”, so a negative condition will not
                        remove rows for having no value in that column. Text such as
                        “NA” is treated as the value it appears to be, matching what the
                        grid shows.
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
                        {isApplying ? 'Filtering…' : 'Apply Filter'}
                    </button>
                </div>
        </Dialog>
    );
};
