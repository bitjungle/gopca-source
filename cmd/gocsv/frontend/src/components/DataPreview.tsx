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

import React, { useState } from 'react';
import { main } from '../api/backend';

type FilePreview = main.FilePreview;
type ImportOptions = main.ImportOptions;

interface DataPreviewProps {
    preview: FilePreview;
    options: ImportOptions;
    onChange: (options: ImportOptions) => void;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ preview, options, onChange }) => {
    const [selectedColumns, setSelectedColumns] = useState<Set<number>>(
        new Set(options.selectedColumns || Array.from({ length: preview.headers.length }, (_, i) => i))
    );

    const toggleColumn = (index: number) => {
        const newSelected = new Set(selectedColumns);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedColumns(newSelected);
        onChange({ ...options, selectedColumns: Array.from(newSelected).sort((a, b) => a - b) });
    };

    const selectAllColumns = () => {
        const all = Array.from({ length: preview.headers.length }, (_, i) => i);
        setSelectedColumns(new Set(all));
        onChange({ ...options, selectedColumns: all });
    };

    const deselectAllColumns = () => {
        setSelectedColumns(new Set());
        onChange({ ...options, selectedColumns: [] });
    };

    const getColumnTypeIcon = (type: string) => {
        switch (type) {
            case 'numeric':
                return (
                    <span className="text-blue-600 dark:text-blue-400" title="Numeric">
                        #
                    </span>
                );
            case 'categorical':
                return (
                    <span className="text-green-600 dark:text-green-400" title="Categorical">
                        A
                    </span>
                );
            case 'text':
                return (
                    <span className="text-gray-600 dark:text-gray-400" title="Text">
                        T
                    </span>
                );
            default:
                return (
                    <span className="text-gray-400 dark:text-gray-500" title="Unknown">
                        ?
                    </span>
                );
        }
    };

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Data Summary
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-gray-600 dark:text-gray-400">Total Rows:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                            {preview.totalRows.toLocaleString()}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-600 dark:text-gray-400">Total Columns:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                            {preview.totalCols}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-600 dark:text-gray-400">Selected Columns:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                            {selectedColumns.size}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-600 dark:text-gray-400">Delimiter:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                            {preview.delimiter === '\t' ? 'Tab' : preview.delimiter}
                        </span>
                    </div>
                </div>
            </div>

            {/* Issues */}
            {preview.issues && preview.issues.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                        Issues Found
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                        {preview.issues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Column selection */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Column Selection
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={selectAllColumns}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                            Select All
                        </button>
                        <span className="text-gray-400">|</span>
                        <button
                            onClick={deselectAllColumns}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                            Deselect All
                        </button>
                    </div>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-1 max-h-48 overflow-y-auto">
                        {preview.headers.map((header, index) => (
                            <label
                                key={index}
                                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedColumns.has(index)}
                                    onChange={() => toggleColumn(index)}
                                    className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                                    {header}
                                </span>
                                <span className="text-sm font-mono">
                                    {getColumnTypeIcon(preview.columnTypes[index])}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Data preview */}
            <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Data Preview (First {Math.min(preview.data.length, 100)} rows)
                </h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    {preview.headers.map((header, index) => (
                                        selectedColumns.has(index) && (
                                            <th
                                                key={index}
                                                className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                                            >
                                                <div className="flex items-center gap-1">
                                                    {header}
                                                    <span className="font-mono normal-case">
                                                        {getColumnTypeIcon(preview.columnTypes[index])}
                                                    </span>
                                                </div>
                                            </th>
                                        )
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {preview.data.slice(0, 10).map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                        {row.map((cell, colIndex) => (
                                            selectedColumns.has(colIndex) && (
                                                <td
                                                    key={colIndex}
                                                    className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap"
                                                >
                                                    {cell || <span className="text-gray-400 italic">empty</span>}
                                                </td>
                                            )
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {preview.data.length > 10 && (
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-center text-xs text-gray-500 dark:text-gray-400">
                            ... and {preview.data.length - 10} more rows
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};