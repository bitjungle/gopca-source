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

// Loadings Plot with bar chart and line chart modes

import React, { useMemo } from 'react';
import { Data, Layout } from 'plotly.js';
import { getPlotlyTheme, mergeLayouts } from '../utils/plotlyTheme';
import { formatThresholdValue } from '../utils/thresholdLabel';
import { PlotlyVisualizationConfig } from '../core/PlotlyVisualization';
import { getExportMenuItems } from '../utils/plotlyExport';
import { PLOT_CONFIG } from '../config/plotConfig';
import { PlotlyWithFullscreen } from '../utils/plotlyFullscreen';
import { getWatermarkDataUrlSync } from '../assets/watermark';

export interface LoadingsPlotData {
  loadings: number[][];  // [components][variables]
  variableNames: string[];
  componentIndex?: number;  // Which PC to show (0-based)
}

export interface LoadingsPlotConfig extends PlotlyVisualizationConfig {
  mode?: 'bar' | 'line' | 'grouped';
  colorScheme?: string[];
  showThreshold?: boolean;
  thresholdValue?: number;
  maxVariables?: number;
  sortByMagnitude?: boolean;
  showGrid?: boolean;
  showMarkers?: boolean; // For line mode: whether to show markers (false for many variables)
}

/**
 * Loadings Plot showing variable contributions to principal components
 * Supports bar chart, line chart, and grouped bar modes
 * Reference: Johnson & Wichern (2007), Applied Multivariate Statistical Analysis, Ch. 8
 */
export class PlotlyLoadingsPlot {
  private data: LoadingsPlotData;
  private config: LoadingsPlotConfig;

  constructor(data: LoadingsPlotData, config?: LoadingsPlotConfig) {
    this.data = data;
    this.config = {
      mode: 'bar',
      showThreshold: true,
      thresholdValue: 0.3,
      sortByMagnitude: false,
      showGrid: true,
      showMarkers: true, // Default to showing markers
      ...config
    };
  }

  private prepareData() {
    const { loadings, variableNames } = this.data;
    const componentIndex = this.data.componentIndex || 0;

    // Get loadings for selected component
    let componentLoadings = loadings[componentIndex];
    let sortedVariableNames = [...variableNames];

    // Sort by magnitude if requested
    if (this.config.sortByMagnitude) {
      const indices = Array.from({ length: variableNames.length }, (_, i) => i);
      indices.sort((a, b) => Math.abs(componentLoadings[b]) - Math.abs(componentLoadings[a]));

      componentLoadings = indices.map(i => componentLoadings[i]);
      sortedVariableNames = indices.map(i => variableNames[i]);
    }

    // Limit variables if specified
    if (this.config.maxVariables && this.config.maxVariables < variableNames.length) {
      componentLoadings = componentLoadings.slice(0, this.config.maxVariables);
      sortedVariableNames = sortedVariableNames.slice(0, this.config.maxVariables);
    }

    return { componentLoadings, sortedVariableNames };
  }

  getTraces(): Data[] {
    const traces: Data[] = [];
    const { componentLoadings, sortedVariableNames } = this.prepareData();
    const componentIndex = this.data.componentIndex || 0;

    if (this.config.mode === 'bar') {
      // Bar chart mode
      const colors = this.config.colorScheme || ['#3b82f6', '#ef4444'];
      traces.push({
        type: 'bar',
        x: sortedVariableNames,
        y: componentLoadings,
        name: `PC${componentIndex + 1} Loadings`,
        marker: {
          color: componentLoadings.map(v => v >= 0 ? colors[0] : colors[1]),
          opacity: 0.8
        },
        hovertemplate: '<b>%{x}</b><br>Loading: %{y:.3f}<extra></extra>'
      });
    } else if (this.config.mode === 'line') {
      // Line chart mode - use indices for x-axis
      const colors = this.config.colorScheme || ['#3b82f6', '#ef4444'];
      // Spectroscopic datasets name their columns by wavelength ("1100", "1102", ...).
      // When every variable name parses as a number, plot against those values so the
      // axis carries physical meaning; otherwise fall back to the positional index.
      const numericNames = sortedVariableNames.map(n => Number(n));
      const namesAreNumeric = sortedVariableNames.length > 0 &&
        numericNames.every(v => Number.isFinite(v));
      const xValues = namesAreNumeric
        ? numericNames
        : Array.from({ length: sortedVariableNames.length }, (_, i) => i);

      const trace: any = {
        type: 'scatter',
        mode: this.config.showMarkers ? 'lines+markers' : 'lines',
        x: xValues,
        y: componentLoadings,
        text: sortedVariableNames,
        name: `PC${componentIndex + 1} Loadings`,
        line: {
          color: colors[0],
          width: 2
        },
        hovertemplate: '<b>%{text}</b><br>Loading: %{y:.3f}<br>Index: %{x}<extra></extra>'
      };

      // Only add marker property if we're showing markers
      if (this.config.showMarkers) {
        trace.marker = {
          size: 8,
          color: componentLoadings.map(v => v >= 0 ? colors[0] : colors[1])
        };
      }

      traces.push(trace);
    } else if (this.config.mode === 'grouped') {
      // Grouped bar chart for multiple components
      const numComponents = Math.min(3, this.data.loadings.length);
      for (let i = 0; i < numComponents; i++) {
        const { componentLoadings: loadings, sortedVariableNames: names } =
          this.prepareDataForComponent(i);

        traces.push({
          type: 'bar',
          x: names,
          y: loadings,
          name: `PC${i + 1}`,
          marker: {
            color: this.config.colorScheme![i % this.config.colorScheme!.length],
            opacity: 0.8
          },
          hovertemplate: '<b>%{x}</b><br>PC' + (i + 1) + ': %{y:.3f}<extra></extra>'
        });
      }
    }

    return traces;
  }

  private prepareDataForComponent(componentIndex: number) {
    const { loadings, variableNames } = this.data;
    let componentLoadings = loadings[componentIndex];
    let sortedVariableNames = [...variableNames];

    if (this.config.sortByMagnitude) {
      const indices = Array.from({ length: variableNames.length }, (_, i) => i);
      indices.sort((a, b) => Math.abs(componentLoadings[b]) - Math.abs(componentLoadings[a]));

      componentLoadings = indices.map(i => componentLoadings[i]);
      sortedVariableNames = indices.map(i => variableNames[i]);
    }

    if (this.config.maxVariables && this.config.maxVariables < variableNames.length) {
      componentLoadings = componentLoadings.slice(0, this.config.maxVariables);
      sortedVariableNames = sortedVariableNames.slice(0, this.config.maxVariables);
    }

    return { componentLoadings, sortedVariableNames };
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
    const { sortedVariableNames } = this.prepareData();
    const componentIndex = this.data.componentIndex || 0;

    const layout: Partial<Layout> = {
      title: {
        text: this.config.mode === 'grouped'
          ? 'Loadings Comparison'
          : `Loadings Plot - PC${componentIndex + 1}`
      },
      xaxis: {
        title: {
          text: this.config.mode === 'line'
            ? (sortedVariableNames.length > 0 &&
               sortedVariableNames.every(n => Number.isFinite(Number(n)))
                ? 'Variable'
                : 'Variable Index')
            : 'Variables'
        },
        type: this.config.mode === 'line' ? 'linear' : 'category',
        tickangle: this.config.mode === 'bar' && sortedVariableNames.length > 10 ? -45 : 0
      },
      yaxis: {
        title: {
          text: 'Loading Value'
        },
        zeroline: true,
        zerolinewidth: 2,
        zerolinecolor: 'black',
        showgrid: this.config.showGrid,
        gridcolor: 'rgba(128, 128, 128, 0.2)'
      },
      hovermode: 'x unified',
      showlegend: this.config.mode === 'grouped',
      legend: {
        x: 1.02,
        y: 1,
        xanchor: 'left',
        yanchor: 'top',
        borderwidth: 1
      },
      shapes: [],
      annotations: []
    };

    // Add threshold lines if enabled
    if (this.config.showThreshold) {
      layout.shapes = [
        {
          type: 'line',
          x0: 0,
          x1: 1,
          xref: 'paper',
          y0: this.config.thresholdValue,
          y1: this.config.thresholdValue,
          yref: 'y',
          line: {
            color: 'orange',
            width: 2,
            dash: 'dash'
          }
        },
        {
          type: 'line',
          x0: 0,
          x1: 1,
          xref: 'paper',
          y0: -this.config.thresholdValue!,
          y1: -this.config.thresholdValue!,
          yref: 'y',
          line: {
            color: 'orange',
            width: 2,
            dash: 'dash'
          }
        }
      ];

      layout.annotations = [
        {
          text: `Threshold: ±${formatThresholdValue(this.config.thresholdValue!)}`,
          // Anchored inside the plot area, not outside it. `xanchor: 'left'` at
          // x: 1 extends the text into the right margin, which nothing reserves
          // space for -- 30px against a 171px label, so it read "Thres" (#1000).
          x: 1,
          xref: 'paper',
          y: this.config.thresholdValue!,
          yref: 'y',
          xanchor: 'right',
          yanchor: 'bottom',
          showarrow: false,
          font: {
            color: 'orange',
            size: Math.round(10 * (this.config.fontScale || 1.0))
          }
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
        filename: 'loadings-plot'
      }
    };
  }
}

/**
 * React component wrapper for Loadings Plot
 */
export const PCALoadingsPlot: React.FC<{
  data: LoadingsPlotData;
  config?: LoadingsPlotConfig;
}> = ({ data, config }) => {
  const plot = useMemo(() => new PlotlyLoadingsPlot(data, config), [data, config]);

  return (
    <PlotlyWithFullscreen
      data={plot.getTraces()}
      layout={plot.getEnhancedLayout()}
      config={plot.getConfig()}
      style={{ width: '100%', height: '100%' }}
    />
  );
};