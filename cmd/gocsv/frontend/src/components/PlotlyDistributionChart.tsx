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

import React, { useMemo } from 'react';
import { PlotlyBarChart } from '@gopca/ui-components';
import { dataquality } from '../api/backend';

interface PlotlyDistributionChartProps {
    distribution: dataquality.DistributionInfo;
    columnName: string;
}

export const PlotlyDistributionChart: React.FC<PlotlyDistributionChartProps> = ({
    distribution,
    columnName: _columnName
}) => {
    // const { theme } = useTheme(); // Removed: unused variable

    // Transform histogram data for PlotlyBarChart
    const chartData = useMemo(() => {
        if (!distribution.histogram || distribution.histogram.length === 0) {
            return [];
        }

        return distribution.histogram.map((bin, index) => ({
            x: index, // x as numeric index
            y: bin.count, // y is required by ChartDataPoint interface
            binIndex: index.toString(), // String version for display
            binLabel: `${bin.min.toFixed(2)}-${bin.max.toFixed(2)}`,
            count: bin.count,
            min: bin.min,
            max: bin.max
        }));
    }, [distribution.histogram]);

    if (chartData.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No distribution data available
            </div>
        );
    }

    return (
        <div className="w-full h-64">
            <PlotlyBarChart
                data={chartData}
                dataKey="count"
                xDataKey="binIndex"
                xLabel="Bins"
                yLabel="Frequency"
                margin={{ top: 10, right: 10, bottom: 60, left: 50 }}
                height={256} // h-64 = 16rem = 256px
                fill="#3B82F6"
                showGrid={true}
            />
        </div>
    );
};