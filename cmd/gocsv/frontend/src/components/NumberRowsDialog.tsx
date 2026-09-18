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

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogFooter } from '@gopca/ui-components';

interface NumberRowsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (start: number, increment: number) => void;
    rowCount: number;
}

// parseCount reads one of the two number fields. It returns null for anything
// that is not a whole number, including the empty string, so a half-typed value
// disables the button rather than silently being read as 0.
function parseCount(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === '' || !/^-?\d+$/.test(trimmed)) {
        return null;
    }
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

// preview shows what the identifiers will actually be.
//
// The numbers in the '#' gutter beside the grid are a view artifact and the row
// names are data, but nothing on screen says which is which -- a tester who
// already had 1, 2, 3 in the gutter read this command as doing nothing (#949).
// Showing the values it is about to write answers that directly, and it is the
// only way to see what a start and increment produce before committing to them.
function preview(start: number, increment: number, rowCount: number): string {
    if (rowCount <= 0) {
        return '';
    }
    const at = (index: number) => String(start + index * increment);
    if (rowCount <= 4) {
        return Array.from({ length: rowCount }, (_, i) => at(i)).join(', ');
    }
    return `${at(0)}, ${at(1)}, ${at(2)}, … ${at(rowCount - 1)}`;
}

export const NumberRowsDialog: React.FC<NumberRowsDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    rowCount
}) => {
    const [start, setStart] = useState('1');
    const [increment, setIncrement] = useState('1');
    const startRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Back to the defaults each time it opens, so the plain sequence is
            // always one Enter away and a previous run does not carry over.
            setStart('1');
            setIncrement('1');
            setTimeout(() => {
                startRef.current?.focus();
                startRef.current?.select();
            }, 100);
        }
    }, [isOpen]);

    const startValue = parseCount(start);
    const incrementValue = parseCount(increment);
    const incompleteFields = startValue === null || incrementValue === null;
    // Zero would give every row the same name, and row names exist to tell rows
    // apart. The backend refuses it too; this only says so before the click.
    const zeroIncrement = incrementValue === 0;
    const canSubmit = !incompleteFields && !zeroIncrement;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (startValue !== null && incrementValue !== null && !zeroIncrement) {
            onConfirm(startValue, incrementValue);
            onClose();
        }
    };

    const fieldClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md '
        + 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 '
        + 'focus:outline-none focus:ring-2 focus:ring-blue-500';

    // No early return: Dialog owns the isOpen check, and unmounting it here
    // would skip the focus-restore cleanup that runs when it closes.
    return (
        <Dialog isOpen={isOpen} onClose={onClose} title="Number the Rows" width="w-96">
            <form onSubmit={handleSubmit}>
                {/* These are row names, not a column, and saying otherwise would
                    undo the thing the design is for: the table keeps its shape, so
                    the identifiers cannot be dragged into the analysis by accident.
                    An earlier menu label made the same slip in the other direction
                    and had to be reworded (#949). */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Gives each row an identifier. The table keeps its shape — these are
                    row names, not a new column. On export they are written as the first
                    column, named Sample_ID, which is where GoPCA reads the labels for a
                    scores plot.
                </p>

                <div className="flex gap-3">
                    <label className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                        Start at
                        <input
                            ref={startRef}
                            type="number"
                            value={start}
                            onChange={(e) => setStart(e.target.value)}
                            className={`${fieldClass} mt-1`}
                        />
                    </label>
                    <label className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                        Count by
                        <input
                            type="number"
                            value={increment}
                            onChange={(e) => setIncrement(e.target.value)}
                            className={`${fieldClass} mt-1`}
                        />
                    </label>
                </div>

                <div className="mt-3 text-sm min-h-[2.5rem]">
                    {zeroIncrement ? (
                        <span className="text-red-600 dark:text-red-400">
                            Counting by 0 would give every row the same identifier.
                        </span>
                    ) : canSubmit ? (
                        <span className="text-gray-600 dark:text-gray-400">
                            Sample_ID: {preview(startValue, incrementValue, rowCount)}
                        </span>
                    ) : null}
                </div>

                <DialogFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Number the Rows
                    </button>
                </DialogFooter>
            </form>
        </Dialog>
    );
};
