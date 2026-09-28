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

import React, { useEffect, useRef } from 'react';
import Plotly from './plotly-bundle';
import { BarChartProps } from './types';
import { getPlotlyTheme, mergeLayouts } from './utils';
import { useChartTheme } from '../hooks/useChartTheme';

export const PlotlyBarChart: React.FC<BarChartProps> = ({
  data,
  dataKey,
  xDataKey = 'x',
  xLabel,
  yLabel,
  domain,
  margin,
  width = '100%',
  height = 400,
  className,
  showGrid = true,
  fill = '#3b82f6'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useChartTheme();

  useEffect(() => {
    if (!containerRef.current) {
return;
}

    const baseTheme = getPlotlyTheme(theme);

    // Prepare data
    const xValues = data.map(d => d[xDataKey]);
    const yValues = data.map(d => d[dataKey]);

    // Determine colors based on positive/negative values for loadings-style plots
    const colors = yValues.map(v => {
      if (typeof v === 'number') {
        return v >= 0 ? fill : '#ef4444'; // Blue for positive, red for negative
      }
      return fill;
    });

    // Create trace
    const traces = [{
      x: xValues,
      y: yValues,
      type: 'bar' as const,
      marker: {
        color: colors
      },
      hovertemplate: '%{x}<br>%{y:.3f}<extra></extra>'
    }];

    // Prepare layout
    const layout = mergeLayouts(
      baseTheme.layout,
      {
        xaxis: {
          title: xLabel ? { text: xLabel } : undefined,
          showgrid: false,
          tickangle: -45,
          automargin: true
        },
        yaxis: {
          title: yLabel ? { text: yLabel } : undefined,
          range: domain?.y,
          showgrid: showGrid,
          zeroline: true,
          zerolinecolor: theme === 'dark' ? '#6b7280' : '#9ca3af',
          zerolinewidth: 2
        },
        showlegend: false,
        hovermode: 'closest',
        margin: margin ? {
          l: margin.left ?? 60,
          r: margin.right ?? 30,
          t: margin.top ?? 30,
          b: margin.bottom ?? 100
        } : { ...baseTheme.layout.margin, b: 100 },
        width: typeof width === 'number' ? width : undefined,
        height: typeof height === 'number' ? height : undefined,
        autosize: typeof width === 'string'
      }
    );

    // Create or update plot
    Plotly.react(containerRef.current, traces, layout, baseTheme.config);

    // Handle resize
    const handleResize = () => {
      if (containerRef.current) {
        Plotly.Plots.resize(containerRef.current);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) {
        Plotly.purge(containerRef.current);
      }
    };
  }, [data, dataKey, xDataKey, xLabel, yLabel, domain, margin, width, height,
      theme, showGrid, fill]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width, height }}
    />
  );
};