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

// Temporal Variable Importance Plot - Heatmap showing aggregated variable contributions

import React, { useMemo } from 'react';
import { Data, Layout } from 'plotly.js';
import { PlotlyWithFullscreen } from '../utils/plotlyFullscreen';
import { getWatermarkDataUrlSync } from '../assets/watermark';
import { PlotlyVisualizationConfig } from '../core/PlotlyVisualization';
import { PLOT_CONFIG } from '../config/plotConfig';
import { escapeHoverText } from '../utils/hoverText';

export interface TemporalVariableImportanceData {
  importance: number[][];  // [n_components][n_variables]
  variableNames: string[];
  explainedVariance: number[];
}

export interface TemporalVariableImportancePlotConfig extends PlotlyVisualizationConfig {
  maxComponents?: number;
  colorScale?: string | any[];
  showValues?: boolean;
  valueFormat?: string;  // Format string for values (e.g., '.3f')
  annotationThreshold?: number;  // Only show values above this threshold
  colorScheme?: string[];  // Color palette for visualization
  showWatermark?: boolean;  // Whether to show watermark
}

/**
 * Temporal Variable Importance Plot showing aggregated variable contributions
 * across all lags for each principal component in Temporal PCA.
 * Uses RMS (Root Mean Square) aggregation to capture overall contribution strength.
 *
 * References:
 * - Golyandina et al. (2015): "Multivariate and 2D Extensions of Singular Spectrum Analysis"
 * - Ghil et al. (2002): "Advanced Spectral Methods for Climatic Time Series"
 */
export class PlotlyTemporalVariableImportance {
  private data: TemporalVariableImportanceData;
  private config: TemporalVariableImportancePlotConfig;

  constructor(data: TemporalVariableImportanceData, config?: TemporalVariableImportancePlotConfig) {
    this.data = data;
    this.config = {
      colorScale: 'Blues',
      showValues: true,
      valueFormat: '.3f',
      annotationThreshold: 0.01,
      theme: 'light',
      showWatermark: true,  // Enable watermark by default for consistency
      ...config
    };
  }

  private prepareData() {
    const { importance, variableNames, explainedVariance } = this.data;

    // Ensure we have valid data
    if (!importance || importance.length === 0 || !variableNames) {
      return { matrix: [], componentLabels: [], variableNames: [], numComponents: 0 };
    }

    // Limit components based on available data
    const maxAvailableComponents = Math.min(
      importance.length,
      explainedVariance?.length || importance.length
    );

    const numComponents = this.config.maxComponents
      ? Math.min(this.config.maxComponents, maxAvailableComponents)
      : maxAvailableComponents;

    // Prepare importance matrix for heatmap
    const matrix = importance.slice(0, numComponents);

    // Create component labels with explained variance
    const componentLabels = Array.from({ length: numComponents }, (_, i) => {
      const variance = explainedVariance && i < explainedVariance.length
        ? explainedVariance[i].toFixed(1)
        : '0.0';
      return `PC${i + 1} (${variance}%)`;
    });

    // Sort variables by importance in first component for better visualization
    const indices = Array.from({ length: variableNames.length }, (_, i) => i);
    indices.sort((a, b) => matrix[0][b] - matrix[0][a]);

    const orderedVariableNames = indices.map(i => variableNames[i]);
    const orderedMatrix = matrix.map(row => indices.map(i => row[i]));

    return {
      matrix: orderedMatrix,
      componentLabels,
      variableNames: orderedVariableNames,
      numComponents
    };
  }

  render() {
    const { matrix, componentLabels, variableNames, numComponents } = this.prepareData();

    if (numComponents === 0) {
      return {
        data: [],
        layout: {
          title: 'No data available',
          xaxis: { visible: false },
          yaxis: { visible: false },
          showlegend: false
        }
      };
    }

    // Create hover text and annotation text
    const hoverText = matrix.map((row, i) =>
      row.map((value, j) => {
        const varName = variableNames[j];
        const pcLabel = componentLabels[i];
        return `Variable: ${escapeHoverText(varName)}<br>Component: ${pcLabel}<br>Importance: ${value.toFixed(4)}`;
      })
    );

    // Create annotations for values above threshold
    const annotations: any[] = [];
    if (this.config.showValues) {
      matrix.forEach((row, i) => {
        row.forEach((value, j) => {
          if (Math.abs(value) >= (this.config.annotationThreshold || 0)) {
            annotations.push({
              x: variableNames[j],
              y: componentLabels[i],
              text: value.toFixed(3),
              showarrow: false,
              font: {
                size: 10,
                color: value > 0.5 ? 'white' : 'black'
              }
            });
          }
        });
      });
    }

    // Prepare heatmap trace
    const trace: Data = {
      type: 'heatmap',
      z: matrix,
      x: variableNames,
      y: componentLabels,
      colorscale: this.config.colorScale,
      colorbar: {
        title: {
          text: 'Importance<br>(RMS)',
          side: 'right' as const
        },
        tickmode: 'linear' as const,
        tick0: 0,
        dtick: 0.1,
        thickness: 15,
        len: 0.7
      },
      hovertext: hoverText as any,
      hovertemplate: '%{hovertext}<extra></extra>',
      showscale: true
    };

    // Get theme configuration
    const theme = this.config.theme || 'light';
    const isDarkMode = theme === 'dark';

    // Create layout
    const layout: Partial<Layout> = {
      title: {
        text: 'Variable Importance (RMS Aggregated Across Lags)',
        font: { size: 16 }
      },
      xaxis: {
        title: {
          text: 'Variables'
        },
        tickangle: -45,
        automargin: true,
        side: 'bottom' as const
      },
      yaxis: {
        title: {
          text: 'Principal Components'
        },
        automargin: true
      },
      annotations,
      // Remove fixed width/height to allow responsive sizing
      autosize: true,
      margin: {
        l: 120,
        r: 80,
        t: 80,
        b: 140  // Slightly more bottom margin for rotated labels
      },
      paper_bgcolor: isDarkMode ? '#1a1a1a' : 'white',
      plot_bgcolor: isDarkMode ? '#1a1a1a' : 'white',
      font: {
        color: isDarkMode ? '#e5e5e5' : '#333333'
      }
    };

    // Add watermark using consistent config
    if (this.config.showWatermark && PLOT_CONFIG.watermark.enabled) {
      const watermarkDataUrl = getWatermarkDataUrlSync();
      if (watermarkDataUrl) {
        layout.images = [{
          source: watermarkDataUrl,
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
          layer: 'above'  // Changed from 'below' to match working implementations
        }];
      }
    }

    return {
      data: [trace],
      layout,
      config: {
        displayModeBar: true,
        displaylogo: false,
        responsive: true
      }
    };
  }
}

/**
 * React component wrapper for Temporal Variable Importance Plot
 */
export const PCATemporalVariableImportancePlot: React.FC<{
  data: TemporalVariableImportanceData;
  config?: TemporalVariableImportancePlotConfig;
}> = ({ data, config }) => {
  const plot = useMemo(() => new PlotlyTemporalVariableImportance(data, config), [data, config]);
  const { data: plotData, layout, config: plotConfig } = plot.render();

  return (
    <PlotlyWithFullscreen
      data={plotData}
      layout={layout}
      config={plotConfig}
    />
  );
};