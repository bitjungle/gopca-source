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

import React, { useEffect, useRef, Children, isValidElement } from 'react';
import Plotly from './plotly-bundle';
import { ComposedChartProps } from './types';
import { getPlotlyTheme, mergeLayouts, getColorFromPalette } from './utils';
import { useChartTheme } from '../hooks/useChartTheme';

export const PlotlyComposedChart: React.FC<ComposedChartProps> = ({
  data,
  xDataKey = 'x',
  xLabel,
  yLabel,
  domain,
  margin,
  width = '100%',
  height = 400,
  className,
  showGrid = true,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useChartTheme();

  useEffect(() => {
    if (!containerRef.current) {
return;
}

    const baseTheme = getPlotlyTheme(theme);
    const traces: any[] = [];
    let hasSecondaryAxis = false;

    // Process children to extract chart configurations
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) {
return;
}

      const childProps = child.props as any;
      const dataKey = childProps.dataKey;

      if (!dataKey) {
return;
}

      const xValues = data.map(d => d[xDataKey]);
      const yValues = data.map(d => d[dataKey]);

      if (child.type && (child.type as any).displayName === 'Bar') {
        // Bar chart trace
        const colors = data.map((_, i) => getColorFromPalette('default', i));
        traces.push({
          x: xValues,
          y: yValues,
          type: 'bar',
          name: childProps.name || dataKey,
          marker: {
            color: childProps.fill || colors
          },
          yaxis: childProps.yAxisId === 'right' ? 'y2' : 'y',
          hovertemplate: '%{x}<br>%{y:.1f}%<extra></extra>'
        });

        if (childProps.yAxisId === 'right') {
          hasSecondaryAxis = true;
        }
      } else if (child.type && (child.type as any).displayName === 'Line') {
        // Line chart trace
        traces.push({
          x: xValues,
          y: yValues,
          type: 'scatter',
          mode: 'lines+markers',
          name: childProps.name || dataKey,
          line: {
            color: childProps.stroke || '#10b981',
            width: childProps.strokeWidth || 2
          },
          marker: {
            color: childProps.stroke || '#10b981',
            size: 6
          },
          yaxis: childProps.yAxisId === 'right' ? 'y2' : 'y',
          hovertemplate: '%{x}<br>%{y:.1f}%<extra></extra>'
        });

        if (childProps.yAxisId === 'right') {
          hasSecondaryAxis = true;
        }
      }
    });

    // Add threshold line at 80% for scree plots
    const hasExplainedVariance = data.some(d => 'explainedVariance' in d);
    const hasCumulativeVariance = data.some(d => 'cumulativeVariance' in d);

    if (hasExplainedVariance && hasCumulativeVariance) {
      // This is likely a scree plot, add 80% threshold line
      const xRange = [data[0][xDataKey], data[data.length - 1][xDataKey]];
      traces.push({
        x: xRange,
        y: [80, 80],
        type: 'scatter',
        mode: 'lines',
        line: {
          color: '#ef4444',
          width: 2,
          dash: 'dash'
        },
        showlegend: false,
        hoverinfo: 'skip',
        yaxis: 'y2'
      });

      // Add text annotation for the threshold
      traces.push({
        x: [xRange[1]],
        y: [80],
        type: 'scatter',
        mode: 'text',
        text: ['80%'],
        textposition: 'middle left',
        textfont: {
          color: '#ef4444',
          size: 12
        },
        showlegend: false,
        hoverinfo: 'skip',
        yaxis: 'y2'
      });
    }

    // Prepare layout
    const layout = mergeLayouts(
      baseTheme.layout,
      {
        xaxis: {
          title: { text: xLabel || 'Principal Component' },
          showgrid: false,
          tickmode: 'array',
          tickvals: data.map(d => d[xDataKey]),
          ticktext: data.map(d => d[xDataKey])
        },
        yaxis: {
          title: { text: yLabel || 'Explained Variance (%)' },
          range: domain?.y || [0, Math.max(...data.map(d => d.explainedVariance || 0)) * 1.1],
          showgrid: showGrid,
          zeroline: true
        },
        showlegend: hasSecondaryAxis,
        legend: {
          x: 0.5,
          y: -0.15,
          xanchor: 'center',
          yanchor: 'top',
          orientation: 'h'
        },
        hovermode: 'x unified',
        margin: margin ? {
          l: margin.left ?? 60,
          r: margin.right ?? 30,
          t: margin.top ?? 30,
          b: margin.bottom ?? 80
        } : { ...baseTheme.layout.margin, b: 80 },
        width: typeof width === 'number' ? width : undefined,
        height: typeof height === 'number' ? height : undefined,
        autosize: typeof width === 'string'
      }
    );

    // Add secondary y-axis if needed
    if (hasSecondaryAxis) {
      (layout as any).yaxis2 = {
        title: 'Cumulative Variance (%)',
        overlaying: 'y',
        side: 'right',
        range: [0, 105],
        showgrid: false,
        zeroline: false,
        tickfont: {
          color: '#10b981'
        },
        titlefont: {
          color: '#10b981'
        }
      };
    }

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
  }, [data, xDataKey, xLabel, yLabel, domain, margin, width, height,
      theme, showGrid, children]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width, height }}
    />
  );
};