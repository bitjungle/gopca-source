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

import React from 'react';

interface RowNameColumnNoticeProps {
    /** Name of the column the row names were taken from; empty for the blank-header convention. */
    rowNamesHeader?: string;
    /** Whether a first column was taken as row names at all. */
    hasRowNames: boolean;
    /** How many columns are entering the analysis. */
    variableCount: number;
    /** Only a file loaded from disk can be re-read, so only it can be switched. */
    canSwitch: boolean;
    /** Re-read the file, saying whether the first column is data. */
    onSwitch: (firstColumnIsData: boolean) => void;
    /** Disables the control while a re-read is in flight. */
    busy: boolean;
}

/**
 * Says which column became row names, and lets the user say it should not have.
 *
 * The first column of a CSV is taken as row names whatever it contains, and no
 * property of the contents distinguishes an identifier from a measurement: a
 * measurement column can be unique, and Sample_ID is 1, 2, 3. So a file with no
 * identifier column was analysed one variable short, silently — the loadings
 * simply did not mention it, and nothing on screen said why (#969).
 *
 * The answer is not a better guess. It is to state what was done and let it be
 * corrected, which is what the CLI's --no-index has always allowed and GoPCA
 * Desktop had no equivalent of. The wording of the control is taken from that
 * flag's help text on purpose, so the two describe the same thing the same way.
 */
export const RowNameColumnNotice: React.FC<RowNameColumnNoticeProps> = ({
    rowNamesHeader,
    hasRowNames,
    variableCount,
    canSwitch,
    onSwitch,
    busy
}) => {
    const columnName = rowNamesHeader?.trim()
        ? <span className="font-medium">{rowNamesHeader}</span>
        : <span className="italic">unnamed</span>;

    return (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
            <span>
                {hasRowNames ? (
                    <>Row names taken from the first column: {columnName}. {variableCount} variables in the analysis.</>
                ) : (
                    <>No row names — all {variableCount} columns are variables, and points are labelled by position.</>
                )}
            </span>
            {canSwitch && (
                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={!hasRowNames}
                        disabled={busy}
                        onChange={(e) => onSwitch(e.target.checked)}
                        className="cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span>First column contains data, not row names</span>
                </label>
            )}
        </div>
    );
};
