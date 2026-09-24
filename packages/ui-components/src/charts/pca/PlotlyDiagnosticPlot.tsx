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

// Diagnostic Plot for PCA outlier detection

import React, { useMemo } from 'react';
import { Data, Layout } from 'plotly.js';
import { getPlotlyTheme, mergeLayouts } from '../utils/plotlyTheme';
import { getExportMenuItems } from '../utils/plotlyExport';
import { PLOT_CONFIG, getScaledMarkerSize } from '../config/plotConfig';
import { PlotlyWithFullscreen } from '../utils/plotlyFullscreen';
import { getWatermarkDataUrlSync } from '../assets/watermark';
import { PlotlyVisualizationConfig } from '../core/PlotlyVisualization';
import { paletteOverflowNote, truncateLegendLabel } from '../utils/legendLabels';

export interface DiagnosticPlotData {
  mahalanobisDistances: number[];
  residualSumOfSquares: number[];
  sampleNames?: string[];
  groups?: string[];
  groupValues?: number[];
  groupType?: 'categorical' | 'continuous';
}

export interface DiagnosticPlotConfig extends PlotlyVisualizationConfig {
  showThresholds?: boolean;
  mahalanobisThreshold?: number;  // Chi-square based threshold
  rssThreshold?: number;
  confidenceLevel?: number;  // For Mahalanobis threshold calculation
  showLabels?: boolean;
  labelThreshold?: number;  // Number of outliers to label
  pointSize?: number;
  colorScheme?: string[];  // Color palette for visualization
}

/**
 * Diagnostic Plot for identifying outliers in PCA
 * Combines Mahalanobis distance (leverage) and Residual Sum of Squares (RSS)
 *
 * Statistical basis:
 * - X-axis: Mahalanobis distance (Hotelling's T²) - measures leverage in model space
 * - Y-axis: Residual Sum of Squares (Q-statistic/SPE) - measures distance from model space
 *
 * Threshold calculations (performed in backend):
 * - T² limit: Based on F-distribution: T² = p(n-1)/(n-p) * F_{p,n-p}(α)
 *   Reference: Hotelling, H. (1931). The generalization of Student's ratio.
 * - Q limit: Based on Jackson & Mudholkar approximation for SPE distribution
 *   Reference: Jackson & Mudholkar (1979). Control procedures for residuals in PCA.
 */
export class PlotlyDiagnosticPlot {
  private data: DiagnosticPlotData;
  private config: DiagnosticPlotConfig;

  constructor(data: DiagnosticPlotData, config?: DiagnosticPlotConfig) {
    this.data = data;
    this.config = {
      showThresholds: true,
      confidenceLevel: 0.95,
      showLabels: false,  // Default to false as user prefers
      labelThreshold: 10,
      pointSize: 8,
      theme: 'light',
      ...config
    };

    // Validate that thresholds are provided when needed
    if (this.config.showThresholds &&
        (!this.config.mahalanobisThreshold || !this.config.rssThreshold)) {
      console.warn('Diagnostic plot: Thresholds not provided from backend, hiding threshold lines');
      this.config.showThresholds = false;
    }
  }

  /**
   * The palette the categorical group traces actually cycle through. Kept in one
   * place so the legend's palette-overflow note (#999) quotes the same count the
   * colors are taken modulo.
   */
  private categoricalPalette(): string[] {
    return this.config.colorScheme ?? [
      '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
      '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
    ];
  }

  private identifyOutliers() {
    const { mahalanobisDistances, residualSumOfSquares } = this.data;
    const outliers: number[] = [];
    const goodLeverage: number[] = [];
    const orthogonal: number[] = [];
    const regular: number[] = [];

    // Only classify if thresholds are available
    if (this.config.showThresholds && this.config.mahalanobisThreshold && this.config.rssThreshold) {
      mahalanobisDistances.forEach((md, i) => {
        const rss = residualSumOfSquares[i];
        const isMahalanobisOutlier = md > this.config.mahalanobisThreshold!;
        const isRSSOutlier = rss > this.config.rssThreshold!;

        if (isMahalanobisOutlier && isRSSOutlier) {
          outliers.push(i);
        } else if (isMahalanobisOutlier && !isRSSOutlier) {
          goodLeverage.push(i);
        } else if (!isMahalanobisOutlier && isRSSOutlier) {
          orthogonal.push(i);
        } else {
          regular.push(i);
        }
      });
    } else {
      // If no thresholds, all points are regular
      mahalanobisDistances.forEach((_, i) => regular.push(i));
    }

    return { outliers, goodLeverage, orthogonal, regular };
  }

  getTraces(): Data[] {
    const traces: Data[] = [];
    const { mahalanobisDistances, residualSumOfSquares, sampleNames, groups, groupValues, groupType } = this.data;
    const { outliers, goodLeverage, orthogonal, regular } = this.identifyOutliers();

    const colors = this.categoricalPalette();

    // Determine if we have groups to color by
    const hasGroups = groups && groups.length > 0;
    const isContinuous = groupType === 'continuous' && groupValues;

    if (hasGroups && !isContinuous) {
      // Categorical grouping with shapes for outlier categories
      const uniqueGroups = Array.from(new Set(groups));
      const outlierCategories = [
        { type: 'regular', indices: regular, symbol: 'circle' },
        { type: 'goodLeverage', indices: goodLeverage, symbol: 'square' },
        { type: 'orthogonal', indices: orthogonal, symbol: 'diamond' },
        { type: 'outliers', indices: outliers, symbol: 'x' }
      ];

      // Create traces for each group and outlier category combination
      uniqueGroups.forEach((group, groupIdx) => {
        outlierCategories.forEach(cat => {
          // Filter indices that belong to this group and outlier category
          const filteredIndices = cat.indices.filter(i => groups[i] === group);
          if (filteredIndices.length === 0) {
return;
}

          const categoryName = cat.type === 'regular' ? '' :
                              cat.type === 'goodLeverage' ? ' (Good Leverage)' :
                              cat.type === 'orthogonal' ? ' (Orthogonal)' : ' (Bad Outlier)';

          traces.push({
            type: 'scatter',
            mode: 'markers',
            x: filteredIndices.map(i => mahalanobisDistances[i]),
            y: filteredIndices.map(i => residualSumOfSquares[i]),
            // Group shortened for the legend only; the hover text below names it in
            // full. The outlier-category suffix is kept intact (#999).
            name: truncateLegendLabel(group) + categoryName,
            customdata: filteredIndices.map(i => [i]),
            marker: {
              color: colors[groupIdx % colors.length],
              size: getScaledMarkerSize(this.config.pointSize || 8, this.config.fontScale || 1.0),
              symbol: cat.symbol,
              opacity: 0.7
            },
            text: sampleNames ? filteredIndices.map(i => sampleNames[i]) : undefined,
            hovertemplate: '<b>%{text}</b><br>' +
                          'Group: ' + group + '<br>' +
                          'Mahalanobis: %{x:.2f}<br>' +
                          'RSS: %{y:.2f}<extra></extra>',
            legendgroup: group,
            showlegend: cat.type === 'regular' // Only show legend for regular points
          });
        });
      });
    } else if (isContinuous) {
      // Continuous coloring with shapes for outlier categories
      const outlierCategories = [
        { type: 'regular', indices: regular, symbol: 'circle', name: 'Regular' },
        { type: 'goodLeverage', indices: goodLeverage, symbol: 'square', name: 'Good Leverage' },
        { type: 'orthogonal', indices: orthogonal, symbol: 'diamond', name: 'Orthogonal Outliers' },
        { type: 'outliers', indices: outliers, symbol: 'x', name: 'Bad Outliers' }
      ];

      outlierCategories.forEach(cat => {
        if (cat.indices.length === 0) {
return;
}

        traces.push({
          type: 'scatter',
          mode: 'markers',
          x: cat.indices.map(i => mahalanobisDistances[i]),
          y: cat.indices.map(i => residualSumOfSquares[i]),
          name: cat.name,
          customdata: cat.indices.map(i => [i]),
          marker: {
            color: cat.indices.map(i => groupValues![i]),
            size: getScaledMarkerSize(this.config.pointSize || 8, this.config.fontScale || 1.0),
            symbol: cat.symbol,
            opacity: 0.7,
            colorscale: 'Viridis',
            showscale: cat.type === 'regular', // Only show colorbar for regular points
            colorbar: cat.type === 'regular' ? {
              title: { text: groups?.[0] || 'Value' },
              thickness: 15,
              len: 0.7
            } : undefined
          },
          text: sampleNames ? cat.indices.map(i => sampleNames[i]) : undefined,
          hovertemplate: '<b>%{text}</b><br>' +
                        'Value: %{marker.color:.2f}<br>' +
                        'Mahalanobis: %{x:.2f}<br>' +
                        'RSS: %{y:.2f}<extra></extra>'
        });
      });
    } else {
      // No grouping - use shapes only for outlier categories
      const categories = [
        { name: 'Regular', indices: regular, color: colors[0] || '#10b981', symbol: 'circle' },
        { name: 'Good Leverage', indices: goodLeverage, color: colors[1] || '#3b82f6', symbol: 'square' },
        { name: 'Orthogonal Outliers', indices: orthogonal, color: colors[2] || '#f59e0b', symbol: 'diamond' },
        { name: 'Bad Outliers', indices: outliers, color: colors[3] || '#ef4444', symbol: 'x' }
      ];

      // Add traces for each category
      categories.forEach(cat => {
        if (cat.indices.length === 0) {
return;
}

        traces.push({
          type: 'scatter',
          mode: 'markers',
          x: cat.indices.map(i => mahalanobisDistances[i]),
          y: cat.indices.map(i => residualSumOfSquares[i]),
          name: cat.name,
          customdata: cat.indices.map(i => [i]), // Add global indices for selection
          marker: {
            color: cat.color,
            size: getScaledMarkerSize(this.config.pointSize || 8, this.config.fontScale || 1.0),
            symbol: cat.symbol,
            opacity: 0.7
          },
          text: sampleNames ? cat.indices.map(i => sampleNames[i]) : undefined,
          hovertemplate: '<b>%{text}</b><br>' +
                        'Mahalanobis: %{x:.2f}<br>' +
                        'RSS: %{y:.2f}<extra></extra>'
        });
      });
    }

    // Add labels for samples
    if (this.config.showLabels && sampleNames) {
      // Calculate normalized distance for all points to determine which to label
      // Use thresholds if available, otherwise use max values for normalization
      const maxMahalanobis = this.config.mahalanobisThreshold || Math.max(...mahalanobisDistances) || 1;
      const maxRSS = this.config.rssThreshold || Math.max(...residualSumOfSquares) || 1;

      // Map all points with their distances
      const allPoints = mahalanobisDistances.map((md, i) => ({
        index: i,
        x: md,
        y: residualSumOfSquares[i],
        // Calculate normalized distance from origin
        distance: Math.sqrt(
          Math.pow(md / maxMahalanobis, 2) +
          Math.pow(residualSumOfSquares[i] / maxRSS, 2)
        )
      }));

      // Sort by distance (furthest from origin first) and take top N
      allPoints.sort((a, b) => b.distance - a.distance);
      const topPoints = allPoints.slice(0, this.config.labelThreshold || 10);

      traces.push({
        type: 'scatter',
        mode: 'text',
        x: topPoints.map(p => p.x),
        y: topPoints.map(p => p.y),
        text: topPoints.map(p => sampleNames[p.index]),
        textposition: 'top center',
        textfont: {
          size: Math.round(10 * (this.config.fontScale || 1.0)),
          color: this.config.theme === 'dark' ? '#e5e7eb' : '#374151'
        },
        showlegend: false,
        hoverinfo: 'skip'
      });
    }

    return traces;
  }

  getEnhancedLayout(): Partial<Layout> {
    const baseLayout = this.getLayout();
    const themeLayout = getPlotlyTheme(this.config.theme || 'light', this.config.fontScale).layout;

    // Add watermark if enabled
    let watermarkImages: any[] = [];
    if (PLOT_CONFIG.watermark.enabled) {
      const watermarkUrl = getWatermarkDataUrlSync();
      watermarkImages = [{
        source: watermarkUrl,
        xref: PLOT_CONFIG.watermark.position.xref,
        yref: PLOT_CONFIG.watermark.position.yref,
        x: PLOT_CONFIG.watermark.position.x,
        y: PLOT_CONFIG.watermark.position.y,
        sizex: PLOT_CONFIG.watermark.size.width / 400,  // Normalize to plot units
        sizey: PLOT_CONFIG.watermark.size.height / 400, // Normalize to plot units
        xanchor: PLOT_CONFIG.watermark.position.xanchor,
        yanchor: PLOT_CONFIG.watermark.position.yanchor,
        sizing: 'contain',
        opacity: PLOT_CONFIG.watermark.opacity,
        layer: 'above'
      }];
    }

    return mergeLayouts(themeLayout, baseLayout, { images: watermarkImages });
  }

  getLayout(): Partial<Layout> {
    const { mahalanobisDistances, residualSumOfSquares } = this.data;

    // More groups than the palette can distinguish (#999). Skipped for a
    // continuous coloring: there colorScheme is a sequential colorscale whose
    // stop count says nothing about repeated swatches, and there are none.
    const overflowNote = this.data.groupType === 'continuous'
      ? null
      : paletteOverflowNote(
          new Set(this.data.groups ?? []).size,
          this.categoricalPalette().length
        );

    const layout: Partial<Layout> = {
      title: {
        text: 'PCA Diagnostic Plot'
      },
      xaxis: {
        title: {
          text: 'Mahalanobis Distance (Hotelling\'s T²)'
        },
        zeroline: false,
        showgrid: true,
        gridcolor: 'rgba(128, 128, 128, 0.2)',
        rangemode: 'tozero'
      },
      yaxis: {
        title: {
          text: 'Residual Sum of Squares (Q-statistic)'
        },
        zeroline: false,
        showgrid: true,
        gridcolor: 'rgba(128, 128, 128, 0.2)',
        rangemode: 'tozero'
      },
      hovermode: 'closest',
      showlegend: true,
      legend: {
        x: 1.02,
        y: 1,
        xanchor: 'left',
        yanchor: 'top',
        borderwidth: 1,
        // Present only when the palette has run out, above the swatches it
        // qualifies (#999).
        ...(overflowNote ? { title: { text: overflowNote } } : {})
      },
      shapes: [],
      annotations: []
    };

    // Add threshold lines with proper labels
    if (this.config.showThresholds && this.config.mahalanobisThreshold && this.config.rssThreshold) {
      // T² threshold (vertical line) - represents Hotelling's T-squared limit
      layout.shapes!.push({
        type: 'line',
        x0: this.config.mahalanobisThreshold,
        x1: this.config.mahalanobisThreshold,
        y0: 0,
        y1: 1,
        yref: 'paper',
        line: {
          color: this.config.colorScheme?.[3] || '#C44E52',  // Use palette color (red from deep palette)
          width: 2,
          dash: 'dash'
        }
      });

      // Q threshold (horizontal line) - represents SPE/Q-statistic limit
      layout.shapes!.push({
        type: 'line',
        x0: 0,
        x1: 1,
        xref: 'paper',
        y0: this.config.rssThreshold,
        y1: this.config.rssThreshold,
        line: {
          color: this.config.colorScheme?.[3] || '#C44E52',  // Use palette color (red from deep palette)
          width: 2,
          dash: 'dash'
        }
      });

      // Add quadrant labels
      const maxMD = Math.max(...mahalanobisDistances) * 1.1;
      const maxRSS = Math.max(...residualSumOfSquares) * 1.1;

      // Calculate confidence percentage for labels
      const confidencePercent = Math.round((this.config.confidenceLevel || 0.95) * 100);

      layout.annotations = [
        // Threshold labels
        {
          text: `T²-limit (${confidencePercent}%)`,
          x: this.config.mahalanobisThreshold,
          y: maxRSS * 0.95,  // Position near top of plot
          xanchor: 'left',
          yanchor: 'bottom',
          showarrow: false,
          font: { size: Math.round(11 * (this.config.fontScale || 1.0)), color: this.config.colorScheme?.[3] || '#C44E52' },
          textangle: '-90'
        },
        {
          text: `Q-limit (${confidencePercent}%)`,
          x: maxMD * 0.95,  // Position near right of plot
          y: this.config.rssThreshold,
          xanchor: 'right',
          yanchor: 'bottom',
          showarrow: false,
          font: { size: 11, color: this.config.colorScheme?.[3] || '#C44E52' }
        },
        {
          text: 'Regular',
          x: this.config.mahalanobisThreshold! / 2,
          y: this.config.rssThreshold! / 2,
          showarrow: false,
          font: { size: Math.round(12 * (this.config.fontScale || 1.0)), color: 'gray' },
          opacity: 0.5
        },
        {
          text: 'Good Leverage',
          x: (this.config.mahalanobisThreshold! + maxMD) / 2,
          y: this.config.rssThreshold! / 2,
          showarrow: false,
          font: { size: Math.round(12 * (this.config.fontScale || 1.0)), color: 'gray' },
          opacity: 0.5
        },
        {
          text: 'Orthogonal',
          x: this.config.mahalanobisThreshold! / 2,
          y: (this.config.rssThreshold! + maxRSS) / 2,
          showarrow: false,
          font: { size: Math.round(12 * (this.config.fontScale || 1.0)), color: 'gray' },
          opacity: 0.5
        },
        {
          text: 'Bad Outliers',
          x: (this.config.mahalanobisThreshold! + maxMD) / 2,
          y: (this.config.rssThreshold! + maxRSS) / 2,
          showarrow: false,
          font: { size: Math.round(12 * (this.config.fontScale || 1.0)), color: 'gray' },
          opacity: 0.5
        }
      ];
    }

    return layout;
  }

  getConfig(): Partial<any> {
    return {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToAdd: getExportMenuItems() as any,
      toImageButtonOptions: {
        ...PLOT_CONFIG.export.presentation,
        filename: 'diagnostic-plot'
      }
    };
  }
}

/**
 * React component wrapper for Diagnostic Plot
 */
export const PCADiagnosticPlot: React.FC<{
  data: DiagnosticPlotData;
  config?: DiagnosticPlotConfig;
  onSelection?: (indices: number[]) => void;
  excludedRows?: number[];
}> = ({ data, config, onSelection, excludedRows = [] }) => {
  const plot = useMemo(() => new PlotlyDiagnosticPlot(data, config), [data, config]);

  // Apply opacity to excluded rows
  const tracesWithOpacity = useMemo(() => {
    const traces = plot.getTraces();
    if (excludedRows.length > 0) {
      return traces.map(trace => {
        const traceAny = trace as any;
        if (traceAny.customdata) {
          const updatedTrace: any = { ...trace };
          const numPoints = (traceAny.x as number[]).length;
          const opacity = new Array(numPoints).fill(1);

          // Get the global indices from customdata
          const globalIndices = (traceAny.customdata as number[][]).map(cd => cd[0]);
          globalIndices.forEach((globalIdx, localIdx) => {
            if (excludedRows.includes(globalIdx)) {
              opacity[localIdx] = 0.2;
            }
          });

          if (updatedTrace.marker) {
            updatedTrace.marker = {
              ...updatedTrace.marker,
              opacity
            };
          }
          return updatedTrace;
        }
        return trace;
      });
    }
    return traces;
  }, [plot, excludedRows]);

  // Handle selection events
  const handlePlotlyEvent = React.useCallback((event: any) => {
    if (event?.points && onSelection) {
      const indices = event.points.map((point: any) => {
        // Use customdata if available, otherwise use pointIndex
        return point.customdata?.[0] ?? point.pointIndex;
      }).filter((idx: number) => idx !== undefined && idx !== null);

      if (indices.length > 0) {
        console.log('PCADiagnosticPlot: Selection event', indices);
        onSelection(indices);
      }
    }
  }, [onSelection]);

  // Get layout with lasso selection enabled
  const layoutWithSelection = useMemo(() => {
    const baseLayout = plot.getEnhancedLayout();
    return {
      ...baseLayout,
      dragmode: 'lasso' as const,
      selectdirection: 'diagonal' as const
    };
  }, [plot]);

  return (
    <PlotlyWithFullscreen
      data={tracesWithOpacity}
      layout={layoutWithSelection}
      config={plot.getConfig()}
      style={{ width: '100%', height: '100%' }}
      onSelected={handlePlotlyEvent}
    />
  );
};