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

// Scree Plot with dual y-axis for explained and cumulative variance

import React, { useMemo } from 'react';
import { Data, Layout } from 'plotly.js';
import { getPlotlyTheme, mergeLayouts } from '../utils/plotlyTheme';
import { formatThresholdValue } from '../utils/thresholdLabel';
import { PlotlyVisualizationConfig } from '../core/PlotlyVisualization';
import { getExportMenuItems } from '../utils/plotlyExport';
import { PLOT_CONFIG } from '../config/plotConfig';
import { PlotlyWithFullscreen } from '../utils/plotlyFullscreen';
import { getWatermarkDataUrlSync } from '../assets/watermark';

export interface ScreePlotData {
  explainedVariance: number[];
  cumulativeVariance: number[];
  eigenvalues?: number[];
}

export interface ScreePlotConfig extends PlotlyVisualizationConfig {
  colorScheme?: string[];
  showCumulativeLine?: boolean;
  showThresholdLine?: boolean;
  thresholdValue?: number;
  maxComponents?: number;
}

/**
 * Scree Plot showing explained variance per component and cumulative variance
 * Dual y-axis visualization with bar chart and line plot
 */
export class PlotlyScreePlot {
  private data: ScreePlotData;
  private config: ScreePlotConfig;

  constructor(data: ScreePlotData, config?: ScreePlotConfig) {
    this.data = data;
    this.config = {
      showCumulativeLine: true,
      showThresholdLine: true,
      thresholdValue: 80,
      maxComponents: undefined,
      ...config
    };
  }

  getTraces(): Data[] {
    const traces: Data[] = [];
    const { explainedVariance, cumulativeVariance } = this.data;

    // Limit components if specified
    const numComponents = this.config.maxComponents
      ? Math.min(this.config.maxComponents, explainedVariance.length)
      : explainedVariance.length;

    const componentIndices = Array.from({ length: numComponents }, (_, i) => i + 1);
    const componentLabels = componentIndices.map(i => `PC${i}`);

    // Bar chart for explained variance
    traces.push({
      type: 'bar',
      x: componentLabels,
      y: explainedVariance.slice(0, numComponents),
      name: 'Explained Variance',
      marker: {
        color: componentIndices.map(i => {
          const colors = this.config.colorScheme || ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
          return colors[(i - 1) % colors.length];
        }),
        opacity: 0.8
      },
      yaxis: 'y',
      hovertemplate: '<b>%{x}</b><br>Explained: %{y:.1f}%<extra></extra>'
    });

    // Line chart for cumulative variance
    if (this.config.showCumulativeLine) {
      traces.push({
        type: 'scatter',
        mode: 'lines+markers',
        x: componentLabels,
        y: cumulativeVariance.slice(0, numComponents),
        name: 'Cumulative Variance',
        line: {
          color: this.config.colorScheme?.[2] || '#10b981',
          width: 2
        },
        marker: {
          size: 8,
          color: this.config.colorScheme?.[2] || '#10b981'
        },
        yaxis: 'y2',
        hovertemplate: '<b>%{x}</b><br>Cumulative: %{y:.1f}%<extra></extra>'
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
    const { explainedVariance } = this.data;
    const numComponents = this.config.maxComponents
      ? Math.min(this.config.maxComponents, explainedVariance.length)
      : explainedVariance.length;

    const layout: Partial<Layout> = {
      title: {
        text: 'Scree Plot'
      },
      xaxis: {
        title: {
          text: 'Principal Component'
        },
        type: 'category',
        tickangle: numComponents > 10 ? -45 : 0
      },
      yaxis: {
        title: {
          text: 'Explained Variance (%)',
          font: { color: '#3b82f6' }
        },
        side: 'left',
        rangemode: 'tozero',
        showgrid: true,
        gridcolor: 'rgba(128, 128, 128, 0.2)'
      },
      yaxis2: {
        title: {
          text: 'Cumulative Variance (%)',
          font: { color: '#10b981' }
        },
        overlaying: 'y',
        side: 'right',
        range: [0, 105],
        showgrid: false
      } as any,
      hovermode: 'x unified',
      showlegend: true,
      legend: {
        x: 0.5,
        y: -0.15,
        xanchor: 'center',
        yanchor: 'top',
        orientation: 'h',
        borderwidth: 1
      },
      shapes: [],
      annotations: []
    };

    // Add threshold line if enabled
    if (this.config.showThresholdLine && this.config.showCumulativeLine) {
      layout.shapes = [
        {
          type: 'line',
          x0: 0,
          x1: 1,
          xref: 'paper',
          y0: this.config.thresholdValue,
          y1: this.config.thresholdValue,
          yref: 'y2',
          line: {
            color: this.config.colorScheme?.[3] || '#C44E52',  // Use palette color (red from deep palette)
            width: 2,
            dash: 'dash'
          }
        }
      ];

      layout.annotations = [
        {
          text: `${formatThresholdValue(this.config.thresholdValue!)}%`,
          // Inside the plot area: at x: 1 with `xanchor: 'left'` this sat in the
          // right margin strip, on top of the secondary axis tick labels (#1000).
          x: 1,
          xref: 'paper',
          y: this.config.thresholdValue!,
          yref: 'y2',
          xanchor: 'right',
          // Above the line rather than centered on it: inside the plot area the
          // dashed line would otherwise run straight through the boxed label.
          // Matches how the loadings plot places the same kind of label.
          yanchor: 'bottom',
          showarrow: false,
          font: {
            color: this.config.colorScheme?.[3] || '#C44E52',  // Use palette color
            size: 12
          },
          bordercolor: this.config.colorScheme?.[3] || '#C44E52',
          borderwidth: 1,
          borderpad: 2
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
        filename: 'scree-plot'
      }
    };
  }
}

/**
 * React component wrapper for Scree Plot
 */
export const PCAScreePlot: React.FC<{
  data: ScreePlotData;
  config?: ScreePlotConfig;
}> = ({ data, config }) => {
  const plot = useMemo(() => new PlotlyScreePlot(data, config), [data, config]);

  return (
    <PlotlyWithFullscreen
      data={plot.getTraces()}
      layout={plot.getEnhancedLayout()}
      config={plot.getConfig()}
      style={{ width: '100%', height: '100%' }}
    />
  );
};