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

import React, { useEffect, useRef, useMemo } from 'react';
import Plotly from './plotly-bundle';
import { ScatterChartProps } from './types';
import { getPlotlyTheme, mergeLayouts, calculatePlotlyLabels, getPlotlyTextPosition } from './utils';
import { identityLineEnds } from './utils/identityLine';
import { useChartTheme } from '../hooks/useChartTheme';

export const PlotlyScatterChart: React.FC<ScatterChartProps> = ({
  data,
  domain,
  margin,
  width = '100%',
  height = 400,
  className,
  xDataKey = 'x',
  yDataKey = 'y',
  xLabel,
  yLabel,
  showGrid = true,
  showReferenceLines = true,
  identityLine = false,
  fill = '#3b82f6',
  stroke
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useChartTheme();

  // Extract data points
  const plotData = useMemo(() => {
    return data.map(d => ({
      x: d[xDataKey] as number,
      y: d[yDataKey] as number,
      label: d.label as string | undefined,
      index: d.index as number | undefined
    }));
  }, [data, xDataKey, yDataKey]);

  // Calculate smart labels if labels are provided
  const labels = useMemo(() => {
    const hasLabels = plotData.some(d => d.label);
    if (!hasLabels) {
return plotData.map(() => '');
}

    return calculatePlotlyLabels({
      showLabels: true,
      maxLabels: 10, // Default max labels
      labels: plotData.map(d => d.label || ''),
      data: plotData
    });
  }, [plotData]);

  // Calculate text positions for labels
  const textPositions = useMemo(() => {
    return plotData.map(d => getPlotlyTextPosition(d.x, d.y));
  }, [plotData]);

  useEffect(() => {
    if (!containerRef.current) {
return;
}

    const baseTheme = getPlotlyTheme(theme);

    // Prepare traces
    const traces = [{
      x: plotData.map(d => d.x),
      y: plotData.map(d => d.y),
      mode: (labels.some(l => l) ? 'markers+text' : 'markers') as any,
      type: 'scatter' as const,
      marker: {
        color: fill,
        size: 8,
        line: stroke ? {
          color: stroke,
          width: 1
        } : undefined
      },
      text: labels,
      textposition: textPositions as any,
      textfont: {
        size: 10,
        color: theme === 'dark' ? '#e5e7eb' : '#1f2937'
      },
      hovertemplate: '%{text}<br>X: %{x:.2f}<br>Y: %{y:.2f}<extra></extra>'
    }];

    // Add reference lines if requested
    if (showReferenceLines) {
      // The lines have to span something, and without an explicit domain that
      // was a hardcoded -10 to 10. Plotly's autorange accounts for every trace,
      // so those lines dragged the view out to at least that span whatever the
      // data was: a response living between 9.4 and 11.0 was drawn into a corner
      // of a plot reaching from -10 to 12. Span the data instead, so a reference
      // line marks the axis without deciding the scale.
      const xs = plotData.map(p => p.x).filter(v => Number.isFinite(v));
      const ys = plotData.map(p => p.y).filter(v => Number.isFinite(v));
      const spanX: [number, number] = domain?.x ?? [
        Math.min(0, ...xs), Math.max(0, ...xs)
      ];
      const spanY: [number, number] = domain?.y ?? [
        Math.min(0, ...ys), Math.max(0, ...ys)
      ];
      // Vertical line at x=0
      traces.push({
        x: [0, 0],
        y: spanY,
        mode: 'lines',
        type: 'scatter' as const,
        line: {
          color: theme === 'dark' ? '#6b7280' : '#9ca3af',
          width: 1,
          dash: 'solid'
        },
        showlegend: false,
        hoverinfo: 'skip'
      } as any);

      // Horizontal line at y=0
      traces.push({
        x: spanX,
        y: [0, 0],
        mode: 'lines',
        type: 'scatter' as const,
        line: {
          color: theme === 'dark' ? '#6b7280' : '#9ca3af',
          width: 1,
          dash: 'solid'
        },
        showlegend: false,
        hoverinfo: 'skip'
      } as any);
    }

    // A y = x reference, for plots comparing two measurements of the same
    // quantity. Judging deviation from the diagonal by eye needs the diagonal
    // drawn and both axes on one scale; see the identityLine prop.
    //
    // The endpoints, including the empty and non-finite cases, live in
    // charts/utils/identityLine so they can be tested without rendering Plotly.
    const ends = identityLine ? identityLineEnds(plotData, domain?.x) : null;
    if (ends) {
      const [from, to] = ends;
      traces.push({
        x: [from, to],
        y: [from, to],
        mode: 'lines',
        type: 'scatter' as const,
        line: {
          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
          width: 1,
          dash: 'dash'
        },
        showlegend: false,
        hoverinfo: 'skip'
      } as any);
    }

    // Prepare layout
    const layout = mergeLayouts(
      baseTheme.layout,
      {
        xaxis: {
          title: xLabel ? { text: xLabel } : undefined,
          range: domain?.x,
          showgrid: showGrid,
          zeroline: showReferenceLines
        },
        yaxis: {
          title: yLabel ? { text: yLabel } : undefined,
          range: domain?.y,
          showgrid: showGrid,
          zeroline: showReferenceLines
        },
        showlegend: false,
        hovermode: 'closest',
        margin: margin ? {
          l: margin.left ?? 60,
          r: margin.right ?? 30,
          t: margin.top ?? 30,
          b: margin.bottom ?? 60
        } : baseTheme.layout.margin,
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
  }, [data, plotData, labels, textPositions, theme, domain, margin, width, height, identityLine,
      xLabel, yLabel, showGrid, showReferenceLines, fill, stroke]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width, height }}
    />
  );
};