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

import { Dialog } from '@gopca/ui-components';
import React from 'react';
import { dataquality } from '../api/backend';

interface MissingValueSummaryProps {
    stats: dataquality.MissingValueStats | null;
    isOpen: boolean;
    onClose: () => void;
}

export const MissingValueSummary: React.FC<MissingValueSummaryProps> = ({ stats, isOpen, onClose }) => {
    if (!isOpen || !stats) {
        return null;
    }

    const sortedColumns = Object.entries(stats.columnStats || {})
        .sort(([, a], [, b]) => (b?.missingPercent || 0) - (a?.missingPercent || 0));

    const sortedRows = Object.entries(stats.rowStats || {})
        .sort(([, a], [, b]) => (b?.missingPercent || 0) - (a?.missingPercent || 0))
        .slice(0, 10); // Show top 10 rows with missing values

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            width="max-w-4xl w-full"
            padded={false}
            ariaLabelledBy="missing-summary-title"
            className="max-h-[90vh] overflow-hidden"
        >
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2
                        id="missing-summary-title"
                        className="text-xl font-semibold text-gray-800 dark:text-gray-200"
                    >
                        Missing Value Analysis
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                    {/* Overall Statistics */}
                    <div className="mb-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-3 text-gray-700 dark:text-gray-300">
                            Overall Statistics
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Total Cells</p>
                                <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                                    {stats.totalCells?.toLocaleString() || 0}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Missing Cells</p>
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                    {stats.missingCells?.toLocaleString() || 0}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Missing Percentage</p>
                                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                    {stats.missingPercent?.toFixed(2) || 0}%
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Column Analysis */}
                    <div className="mb-6">
                        <h3 className="text-lg font-medium mb-3 text-gray-700 dark:text-gray-300">
                            Missing Values by Column
                        </h3>
                        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Column
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Missing
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Percentage
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Pattern
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {sortedColumns.map(([name, colStats]) => (
                                        <tr key={name} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-200">
                                                {colStats?.name || name}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                                {colStats?.missingValues || 0} / {colStats?.totalValues || 0}
                                            </td>
                                            <td className="px-4 py-2 text-sm">
                                                <div className="flex items-center">
                                                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                                                        <div
                                                            className="bg-red-500 h-2 rounded-full"
                                                            style={{ width: `${Math.min(colStats?.missingPercent || 0, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-gray-600 dark:text-gray-400">
                                                        {colStats?.missingPercent?.toFixed(1) || 0}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                                    colStats?.pattern === 'systematic' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                    colStats?.pattern === 'top' || colStats?.pattern === 'bottom' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                                }`}>
                                                    {colStats?.pattern || 'unknown'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Row Analysis (Top 10) */}
                    {sortedRows.length > 0 && (
                        <div>
                            <h3 className="text-lg font-medium mb-3 text-gray-700 dark:text-gray-300">
                                Top Rows with Missing Values
                            </h3>
                            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Row
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Missing
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Percentage
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {sortedRows.map(([index, rowStats]) => (
                                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-200">
                                                    Row {(rowStats?.index || 0) + 1}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                                    {rowStats?.missingValues || 0} / {rowStats?.totalValues || 0}
                                                </td>
                                                <td className="px-4 py-2 text-sm">
                                                    <div className="flex items-center">
                                                        <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                                                            <div
                                                                className="bg-red-500 h-2 rounded-full"
                                                                style={{ width: `${Math.min(rowStats?.missingPercent || 0, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-gray-600 dark:text-gray-400">
                                                            {rowStats?.missingPercent?.toFixed(1) || 0}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
        </Dialog>
    );
};