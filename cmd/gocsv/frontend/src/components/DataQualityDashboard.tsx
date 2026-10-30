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
import React, { useState, useEffect } from 'react';
import { dataquality } from '../api/backend';
import { PlotlyDistributionChart } from './PlotlyDistributionChart';
// import { CorrelationMatrix } from './CorrelationMatrix'; // Removed: unused import
import { QualityScoreCard } from './QualityScoreCard';

interface DataQualityDashboardProps {
    report: dataquality.DataQualityReport | null;
    isOpen: boolean;
    onClose: () => void;
    // Called with the rows a finding names, numbered from 1. Without it a
    // row-scoped finding is a sentence the user cannot act on: the report says
    // "row 41" and nothing on screen says which row that is (#931).
    onShowRows?: (rows: number[]) => void;
}

export const DataQualityDashboard: React.FC<DataQualityDashboardProps> = ({ report, isOpen, onClose, onShowRows }) => {
    const [selectedTab, setSelectedTab] = useState<'overview' | 'columns' | 'issues' | 'recommendations'>('overview');
    const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

    if (!isOpen || !report) {
        return null;
    }

    const renderOverviewTab = () => (
        <div className="space-y-6">
            {/* Quality Score Card */}
            <QualityScoreCard score={report.qualityScore} />

            {/* Data Profile Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Data Profile</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Rows</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                            {report.dataProfile.rows.toLocaleString()}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Columns</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                            {report.dataProfile.columns}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Numeric</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {report.dataProfile.numericColumns}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Categorical</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {report.dataProfile.categoricalColumns}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Missing Data</p>
                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {report.dataProfile.missingPercent.toFixed(1)}%
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Duplicate Rows</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {report.dataProfile.duplicateRows}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Memory Size</p>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {report.dataProfile.memorySize}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Target Columns</p>
                        <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                            {report.dataProfile.targetColumns}
                        </p>
                    </div>
                </div>
            </div>

            {/* Key Issues Summary */}
            {report.issues.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Key Issues</h3>
                    <div className="space-y-2">
                        {report.issues.slice(0, 5).map((issue, idx) => (
                            <div key={idx} className="flex items-start gap-3">
                                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                    issue.severity === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                    issue.severity === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                }`}>
                                    {issue.severity}
                                </span>
                                <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                                    {issue.description}
                                </p>
                            </div>
                        ))}
                        {report.issues.length > 5 && (
                            <button
                                onClick={() => setSelectedTab('issues')}
                                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                                View all {report.issues.length} issues →
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    const renderColumnsTab = () => (
        <div className="space-y-6">
            {/* Column List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Column
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Type
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Missing
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Unique
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Quality
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {report.columnAnalysis.map((col) => (
                            <tr key={col.name} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-200">
                                    {col.name}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                        col.type === 'numeric' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                        col.type === 'categorical' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                        'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                    }`}>
                                        {col.type}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                    {col.stats.missingPercent.toFixed(1)}%
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                    {col.stats.unique}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    <div className="flex items-center">
                                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                                            <div
                                                className={`h-2 rounded-full ${
                                                    col.qualityScore >= 80 ? 'bg-green-500' :
                                                    col.qualityScore >= 60 ? 'bg-yellow-500' :
                                                    'bg-red-500'
                                                }`}
                                                style={{ width: `${col.qualityScore}%` }}
                                            />
                                        </div>
                                        <span className="text-gray-600 dark:text-gray-400">
                                            {col.qualityScore.toFixed(0)}%
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    <button
                                        onClick={() => setSelectedColumn(col.name)}
                                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                    >
                                        Details
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Column Details Modal */}
            {selectedColumn && (
                <ColumnDetailsModal
                    column={report.columnAnalysis.find(c => c.name === selectedColumn)!}
                    onClose={() => setSelectedColumn(null)}
                />
            )}
        </div>
    );

    const renderIssuesTab = () => (
        <div className="space-y-4">
            {report.issues.map((issue, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                            <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                issue.severity === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                issue.severity === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}>
                                {issue.severity}
                            </span>
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                                    {issue.description}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {issue.impact}
                                </p>
                                {issue.affected && issue.affected.length > 0 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                        Affected: {issue.affected.join(', ')}
                                    </p>
                                )}
                                {onShowRows && issue.rows && issue.rows.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => onShowRows(issue.rows ?? [])}
                                        className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                                    >
                                        {issue.rows.length === 1
                                            ? `Show row ${issue.rows[0]}`
                                            : `Show ${issue.rows.length} rows in the table`}
                                    </button>
                                )}
                            </div>
                        </div>
                        <span className={`inline-flex px-2 py-1 text-xs rounded ${
                            issue.category === 'missing' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' :
                            issue.category === 'outlier' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200' :
                            issue.category === 'duplicate' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' :
                            issue.category === 'correlation' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                            {issue.category}
                        </span>
                    </div>
                </div>
            ))}
            {report.issues.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No data quality issues detected!
                </div>
            )}
        </div>
    );

    const renderRecommendationsTab = () => (
        <div className="space-y-4">
            {report.recommendations.map((rec, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                            <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                rec.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}>
                                {rec.priority}
                            </span>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                                    {rec.action}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {rec.description}
                                </p>
                                {rec.columns && rec.columns.length > 0 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                        Columns: {rec.columns.join(', ')}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
            {report.recommendations.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No specific recommendations. Your data quality looks good!
                </div>
            )}
        </div>
    );

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            width="w-full max-w-6xl"
            padded={false}
            ariaLabelledBy="data-quality-title"
            className="max-h-[90vh] overflow-hidden"
        >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2
                        id="data-quality-title"
                        className="text-2xl font-semibold text-gray-800 dark:text-gray-200"
                    >
                        Data Quality Report
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

                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="flex -mb-px">
                        {(['overview', 'columns', 'issues', 'recommendations'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setSelectedTab(tab)}
                                className={`px-6 py-3 text-sm font-medium capitalize ${
                                    selectedTab === tab
                                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                }`}
                            >
                                {tab}
                                {tab === 'issues' && report.issues.length > 0 && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                        {report.issues.length}
                                    </span>
                                )}
                                {tab === 'recommendations' && report.recommendations.length > 0 && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                        {report.recommendations.length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {selectedTab === 'overview' && renderOverviewTab()}
                    {selectedTab === 'columns' && renderColumnsTab()}
                    {selectedTab === 'issues' && renderIssuesTab()}
                    {selectedTab === 'recommendations' && renderRecommendationsTab()}
                </div>
        </Dialog>
    );
};

// Column Details Modal Component
interface ColumnDetailsModalProps {
    column: dataquality.ColumnAnalysis;
    onClose: () => void;
}

// Deliberately not migrated to the shared Dialog (#874).
//
// This modal opens on top of the dashboard, which is itself a Dialog, and the
// shared component cannot stack: its wrapper is fixed at z-50 with no way to
// raise it, and trapFocus would fight itself. The outer trap collects its
// focusable elements from the whole panel subtree, which contains this modal,
// so tabbing to the outer dialog's last control would pull focus out of this
// one. Stacking support belongs in Dialog before this can move.
//
// It still gets the parts that do not depend on stacking: the ARIA attributes
// that make a screen reader announce it as modal, and Escape to close.
const ColumnDetailsModal: React.FC<ColumnDetailsModalProps> = ({ column, onClose }) => {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60"
            role="dialog"
            aria-modal="true"
            aria-labelledby="column-details-title"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3
                        id="column-details-title"
                        className="text-lg font-semibold text-gray-800 dark:text-gray-200"
                    >
                        Column Details: {column.name}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                    {/* Statistics */}
                    <div className="mb-6">
                        <h4 className="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">Statistics</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Count</p>
                                <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
                                    {column.stats.count}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Missing</p>
                                <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
                                    {column.stats.missing} ({column.stats.missingPercent.toFixed(1)}%)
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Unique</p>
                                <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
                                    {column.stats.unique}
                                </p>
                            </div>
                            {column.type === 'numeric' && (
                                <>
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Mean</p>
                                        <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
                                            {column.stats.mean?.toFixed(3) || 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Std Dev</p>
                                        <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
                                            {column.stats.stdDev?.toFixed(3) || 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Min / Max</p>
                                        <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
                                            {column.stats.min?.toFixed(3)} / {column.stats.max?.toFixed(3)}
                                        </p>
                                    </div>
                                </>
                            )}
                            {column.type === 'categorical' && column.stats.mode && (
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Mode</p>
                                    <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
                                        {column.stats.mode}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Distribution */}
                    {column.type === 'numeric' && column.distribution && (
                        <div className="mb-6">
                            <h4 className="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">Distribution</h4>
                            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                <PlotlyDistributionChart distribution={column.distribution} columnName={column.name} />
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                    Type: {column.distribution.distType}
                                    {column.distribution.isNormal && ' (Normal)'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Categories */}
                    {column.type === 'categorical' && column.stats.categories && (
                        <div className="mb-6">
                            <h4 className="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">Categories</h4>
                            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <th className="text-left py-2 text-gray-600 dark:text-gray-400">Value</th>
                                            <th className="text-right py-2 text-gray-600 dark:text-gray-400">Count</th>
                                            <th className="text-right py-2 text-gray-600 dark:text-gray-400">Percentage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(column.stats.categories ?? {})
                                            .sort(([,a], [,b]) => (b ?? 0) - (a ?? 0))
                                            .map(([value, count]) => (
                                                <tr key={value} className="border-b border-gray-100 dark:border-gray-800">
                                                    <td className="py-1 text-gray-700 dark:text-gray-300">{value}</td>
                                                    <td className="py-1 text-right text-gray-700 dark:text-gray-300">{count}</td>
                                                    <td className="py-1 text-right text-gray-700 dark:text-gray-300">
                                                        {(((count ?? 0) / column.stats.count) * 100).toFixed(1)}%
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Outliers */}
                    {column.outliers && column.outliers.length > 0 && (
                        <div>
                            <h4 className="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">
                                Outliers ({column.outliers.length})
                            </h4>
                            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <th className="text-left py-2 text-gray-600 dark:text-gray-400">Row</th>
                                            <th className="text-left py-2 text-gray-600 dark:text-gray-400">Value</th>
                                            <th className="text-left py-2 text-gray-600 dark:text-gray-400">Method</th>
                                            <th className="text-right py-2 text-gray-600 dark:text-gray-400">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {column.outliers.slice(0, 20).map((outlier, idx) => (
                                            <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                                                <td className="py-1 text-gray-700 dark:text-gray-300">
                                                    {outlier.rowIndex + 1}
                                                </td>
                                                <td className="py-1 text-gray-700 dark:text-gray-300">
                                                    {outlier.value}
                                                </td>
                                                <td className="py-1 text-gray-700 dark:text-gray-300">
                                                    {outlier.method.toUpperCase()}
                                                </td>
                                                <td className="py-1 text-right text-gray-700 dark:text-gray-300">
                                                    {outlier.score.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {column.outliers.length > 20 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                        Showing first 20 of {column.outliers.length} outliers
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};