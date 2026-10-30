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
import { main } from '../api/backend';
import { CustomSelect } from '@gopca/ui-components';

type ImportFileInfo = main.ImportFileInfo;
type ImportOptions = main.ImportOptions;

interface FormatOptionsProps {
    fileInfo: ImportFileInfo;
    options: ImportOptions;
    onChange: (options: ImportOptions) => void;
}

export const FormatOptions: React.FC<FormatOptionsProps> = ({ fileInfo, options, onChange }) => {
    const formatBytes = (bytes: number) => {
        if (bytes === 0) {
return '0 Bytes';
}
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-6">
            {/* File info */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    File Information
                </h3>
                <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">File Name:</dt>
                        <dd className="text-gray-900 dark:text-gray-100 font-medium">{fileInfo.fileName}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">File Size:</dt>
                        <dd className="text-gray-900 dark:text-gray-100">{formatBytes(fileInfo.fileSize)}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Format:</dt>
                        <dd className="text-gray-900 dark:text-gray-100">{fileInfo.fileFormat.toUpperCase()}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Encoding:</dt>
                        <dd className="text-gray-900 dark:text-gray-100">{fileInfo.encoding}</dd>
                    </div>
                </dl>
            </div>

            {/* Format-specific options */}
            {(options.format === 'csv' || options.format === 'tsv') && (
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        CSV/TSV Options
                    </h3>

                    {/* Delimiter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Delimiter
                        </label>
                        <CustomSelect
                            value={options.delimiter === '\t' ? '\\t' : (options.delimiter || ',')}
                            onChange={(value) => onChange({ ...options, delimiter: value === '\\t' ? '\t' : value })}
                            options={[
                                { value: ',', label: 'Comma (,)' },
                                { value: ';', label: 'Semicolon (;)' },
                                { value: '\\t', label: 'Tab (\\t)' },
                                { value: '|', label: 'Pipe (|)' }
                            ]}
                            className="w-full"
                        />
                    </div>
                </div>
            )}

            {options.format === 'excel' && fileInfo.sheets && fileInfo.sheets.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Excel Options
                    </h3>

                    {/* Sheet selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Sheet
                        </label>
                        <CustomSelect
                            value={options.sheet || fileInfo.sheets[0]}
                            onChange={(value) => onChange({ ...options, sheet: value })}
                            options={fileInfo.sheets.map((sheet) => ({
                                value: sheet,
                                label: sheet
                            }))}
                            className="w-full"
                        />
                    </div>
                </div>
            )}

            {/* Common options */}
            <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Data Options
                </h3>

                {/* Headers */}
                <div>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={options.hasHeaders}
                            onChange={(e) => onChange({ ...options, hasHeaders: e.target.checked })}
                            className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            First row contains headers
                        </span>
                    </label>
                </div>

                {/* Header row */}
                {options.hasHeaders && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Header Row (0-based)
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={options.headerRow}
                            onChange={(e) => onChange({ ...options, headerRow: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                    </div>
                )}

                {/* Skip rows */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Skip Rows from Top
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={options.skipRows}
                        onChange={(e) => onChange({ ...options, skipRows: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                </div>

                {/* Max rows */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Maximum Rows (0 for all)
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={options.maxRows}
                        onChange={(e) => onChange({ ...options, maxRows: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                </div>

                {/* Row names column */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Row Names Column (-1 for none, 0-based)
                    </label>
                    <input
                        type="number"
                        min="-1"
                        value={options.rowNameColumn}
                        onChange={(e) => onChange({ ...options, rowNameColumn: parseInt(e.target.value) || -1 })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                </div>
            </div>
        </div>
    );
};