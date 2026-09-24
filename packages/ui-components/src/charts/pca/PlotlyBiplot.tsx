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

// Biplot combining scores and loading vectors

import React, { useMemo } from 'react';
import { Data, Layout } from 'plotly.js';
import {
  selectSmartLabels,
  calculateConfidenceEllipse,
  generateEllipsePath,
  Point2D
} from '../utils/plotlyMath';
import { getPlotlyTheme, mergeLayouts, ThemeMode } from '../utils/plotlyTheme';
import { getExportMenuItems } from '../utils/plotlyExport';
import { PLOT_CONFIG, getScaledMarkerSize } from '../config/plotConfig';
import { PlotlyWithFullscreen } from '../utils/plotlyFullscreen';
import { getWatermarkDataUrlSync } from '../assets/watermark';
import { optimizeTraceType } from '../utils/plotlyPerformance';
import { sampleLabel } from '../utils/sampleLabel';
import { paletteOverflowNote, truncateLegendLabel } from '../utils/legendLabels';
import { escapeHoverText } from '../utils/hoverText';

export interface BiplotData {
  scores: number[][];  // [n_samples][n_components]
  loadings: number[][];  // [n_components][n_variables]
  explainedVariance: number[];
  sampleNames?: string[];
  variableNames: string[];
  groups?: string[];
  groupValues?: number[]; // For continuous data
  groupType?: 'categorical' | 'continuous';
}

export interface BiplotConfig {
  pcX?: number;  // PC for X-axis (1-indexed)
  pcY?: number;  // PC for Y-axis (1-indexed)
  showScores?: boolean;
  showLoadings?: boolean;
  showLabels?: boolean;
  labelThreshold?: number;
  vectorScale?: number;
  colorScheme?: string[];
  pointSize?: number;
  arrowWidth?: number;
  theme?: ThemeMode;
  showEllipses?: boolean;
  ellipseConfidence?: number;
  maxVariables?: number;  // Maximum number of loading vectors to display
  fontScale?: number;  // Scale factor for all font sizes (default: 1.0)
}

/**
 * Biplot visualization combining PCA scores and loading vectors
 * Reference: Gabriel (1971), "The biplot graphic display of matrices with application to principal component analysis"
 */
export class PlotlyBiplot {
  private data: BiplotData;
  private config: BiplotConfig;

  constructor(data: BiplotData, config?: BiplotConfig) {
    this.data = data;
    this.config = {
      pcX: 1,
      pcY: 2,
      showScores: true,
      showLoadings: true,
      showLabels: true,
      labelThreshold: 20,
      vectorScale: 1.0,
      pointSize: 8,
      arrowWidth: 2,
      theme: 'light',
      showEllipses: false,
      ellipseConfidence: 0.95,
      maxVariables: 100,
      ...config
    };
  }

  /**
   * The palette the categorical group traces actually cycle through. Kept in one
   * place so the legend's palette-overflow note (#999) quotes the same count the
   * colors are taken modulo.
   */
  private categoricalPalette(): string[] {
    return this.config.colorScheme ?? ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
  }

  private prepareData() {
    const { scores, loadings } = this.data;
    const pcX = (this.config.pcX || 1) - 1;
    const pcY = (this.config.pcY || 2) - 1;

    // Extract scores for selected PCs
    const scoresX = scores.map(row => row[pcX]);
    const scoresY = scores.map(row => row[pcY]);

    // Calculate maximum loading magnitude for the selected components
    const loadingMagnitudes: number[] = [];
    for (let i = 0; i < loadings[pcX].length; i++) {
      const x = loadings[pcX][i];
      const y = loadings[pcY][i];
      loadingMagnitudes.push(Math.sqrt(x * x + y * y));
    }
    const maxLoadingMagnitude = Math.max(...loadingMagnitudes);

    // Calculate score plot bounds
    const maxAbsScore = Math.max(
      ...scoresX.map(Math.abs),
      ...scoresY.map(Math.abs)
    );
    // Add 20% padding, but ensure minimum visibility
    const plotMax = Math.max(maxAbsScore * 1.2, 1.0);

    // Scale factor to make the largest loading vector reach 70% of plot bounds
    // This maintains consistency with the previous implementation
    const scaleFactor = maxLoadingMagnitude > 0 ? (plotMax * 0.7) / maxLoadingMagnitude : 1;

    // Apply scaling to loadings with optional manual adjustment
    const manualScale = this.config.vectorScale !== undefined ? this.config.vectorScale : 1.0;
    const totalScale = scaleFactor * manualScale;

    const loadingsX = loadings[pcX].map((v: number) => v * totalScale);
    const loadingsY = loadings[pcY].map((v: number) => v * totalScale);

    return { scoresX, scoresY, loadingsX, loadingsY, pcX, pcY };
  }

  getTraces(): Data[] {
    const traces: Data[] = [];
    const { scoresX, scoresY, loadingsX, loadingsY, pcX, pcY } = this.prepareData();
    const { groups, groupValues, groupType, sampleNames, variableNames } = this.data;

    // Add scores scatter plot
    if (this.config.showScores) {
      // Handle continuous vs categorical data
      if (groupType === 'continuous' && groupValues) {
        // Continuous coloring
        const validValues = groupValues.filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v));
        const min = Math.min(...validValues);
        const max = Math.max(...validValues);

        // Create a custom colorscale from the palette
        const palette = this.config.colorScheme || ['#440154', '#31688e', '#35b779', '#fde725'];
        const colorscale: [number, string][] = palette.map((color, i) => [
          i / (palette.length - 1),
          color
        ]);

        // Prepare hover text
        const hovertext = scoresX.map((x, i) => {
          const label = sampleLabel(sampleNames, i);
          const value = groupValues[i];
          const valueStr = value !== null && value !== undefined && !isNaN(value) && isFinite(value)
            ? value.toFixed(2)
            : 'Missing';
          return `<b>${label}</b><br>Value: ${valueStr}<br>PC${pcX + 1}: ${x.toFixed(2)}<br>PC${pcY + 1}: ${scoresY[i].toFixed(2)}`;
        });

        // Use WebGL for better performance with large datasets
        const traceType = optimizeTraceType(scoresX, 100);

        traces.push({
          type: traceType as any,
          mode: 'markers',
          x: scoresX,
          y: scoresY,
          name: 'Scores',
          hovertext: hovertext,
          hovertemplate: '%{hovertext}<extra></extra>',
          customdata: scoresX.map((_, i) => [i]), // Add global indices for selection
          marker: {
            size: getScaledMarkerSize(this.config.pointSize || 8, this.config.fontScale || 1.0),
            color: groupValues, // Use raw numeric values
            colorscale: colorscale, // Use custom colorscale from palette
            cmin: min,
            cmax: max,
            showscale: true,
            colorbar: {
              title: {
                text: 'Value'
              } as any,
              thickness: 15,
              len: 0.9
            },
            opacity: 0.7
          }
        });
      } else if (groups) {
        // Group by categories
        const uniqueGroups = Array.from(new Set(groups));
        const palette = this.categoricalPalette();
        uniqueGroups.forEach((group, i) => {
          const indices = groups.map((g, idx) => g === group ? idx : -1).filter(idx => idx >= 0);

          const groupX = indices.map((idx: number) => scoresX[idx]);
          const groupY = indices.map((idx: number) => scoresY[idx]);

          // Use WebGL for better performance with large datasets
          const groupTraceType = optimizeTraceType(groupX, 100);

          traces.push({
            type: groupTraceType as any,
            mode: 'markers',
            x: groupX,
            y: groupY,
            // Legend only; the hover text below carries the full value (#999).
            name: truncateLegendLabel(group),
            customdata: indices.map(idx => [idx]), // Add global indices for selection
            marker: {
              color: palette[i % palette.length],
              size: getScaledMarkerSize(this.config.pointSize || 8, this.config.fontScale || 1.0),
              opacity: 0.7
            },
            text: sampleNames
              ? indices.map((idx: number) => escapeHoverText(sampleNames[idx]))
              : undefined,
            // Group named here because the legend entry may be truncated (#999),
            // escaped because Plotly parses hover text as markup.
            hovertemplate: '<b>%{text}</b><br>Group: ' + escapeHoverText(group) + '<br>PC' +
                          (pcX + 1) + ': %{x:.2f}<br>PC' + (pcY + 1) + ': %{y:.2f}<extra></extra>'
          });

          // Add confidence ellipse if enabled
          if (this.config.showEllipses && groupX.length > 2) {
            const points: Point2D[] = groupX.map((x, idx) => ({ x, y: groupY[idx] }));
            try {
              const ellipseParams = calculateConfidenceEllipse(points, this.config.ellipseConfidence || 0.95);
              const ellipsePath = generateEllipsePath(ellipseParams);

              traces.push({
                type: 'scatter',
                mode: 'lines',
                x: ellipsePath.map(p => p.x),
                y: ellipsePath.map(p => p.y),
                line: {
                  color: palette[i % palette.length],
                  width: 2,
                  dash: 'dash'
                },
                showlegend: false,
                hoverinfo: 'skip',
                name: `${group} (${(this.config.ellipseConfidence! * 100).toFixed(0)}% CI)`
              });
            } catch (error) {
              console.warn(`Failed to calculate ellipse for group ${group}:`, error);
            }
          }
        });
      } else {
        // Single group
        // Use WebGL for better performance with large datasets
        const singleGroupTraceType = optimizeTraceType(scoresX, 100);

        traces.push({
          type: singleGroupTraceType as any,
          mode: 'markers',
          x: scoresX,
          y: scoresY,
          name: 'Scores',
          customdata: scoresX.map((_, i) => [i]), // Add global indices for selection
          marker: {
            color: this.config.colorScheme?.[0] || '#3b82f6',
            size: getScaledMarkerSize(this.config.pointSize || 8, this.config.fontScale || 1.0),
            opacity: 0.7
          },
          text: sampleNames,
          hovertemplate: '<b>%{text}</b><br>PC' + (pcX + 1) + ': %{x:.2f}<br>PC' +
                        (pcY + 1) + ': %{y:.2f}<extra></extra>'
        });
      }

      // Add smart labels for scores
      if (this.config.showLabels && sampleNames) {
        const scorePoints = scoresX.map((x, i) => ({ x, y: scoresY[i] }));
        const selectedIndices = selectSmartLabels(
          scorePoints,
          this.config.labelThreshold || 20
        );

        traces.push({
          type: 'scatter',
          mode: 'text',
          x: selectedIndices.map(i => scoresX[i]),
          y: selectedIndices.map(i => scoresY[i]),
          text: selectedIndices.map(i => sampleNames[i]),
          textposition: 'top center',
          textfont: {
            size: Math.round(10 * (this.config.fontScale || 1.0)),
            color: this.config.theme === 'dark' ? '#e5e7eb' : '#374151'
          },
          showlegend: false,
          hoverinfo: 'skip'
        });
      }
    }

    // Add loading vectors
    if (this.config.showLoadings) {
      // Calculate magnitude for all vectors
      const allVectors = variableNames.map((name, i) => {
        const magnitude = Math.sqrt(loadingsX[i]**2 + loadingsY[i]**2);
        return { name, i, magnitude };
      });

      // Check if we need to filter based on maxVariables
      const needsFiltering = allVectors.length > (this.config.maxVariables || 100);

      // Filter to top N vectors by magnitude if needed
      let validVectors = allVectors;
      if (needsFiltering) {
        validVectors = [...allVectors]
          .sort((a, b) => b.magnitude - a.magnitude)
          .slice(0, this.config.maxVariables || 100);
      }

      // Filter out very small vectors
      const minMagnitude = 0.01;
      validVectors = validVectors.filter(v => v.magnitude >= minMagnitude);

      // Store for later use in title
      (this as any)._needsFiltering = needsFiltering;
      (this as any)._totalVariables = allVectors.length;
      (this as any)._displayedVariables = validVectors.length;

      // Add all loading vectors as a single trace for better performance
      if (validVectors.length > 0) {
        const vectorX: number[] = [];
        const vectorY: number[] = [];
        const vectorText: string[] = [];

        validVectors.forEach(v => {
          if (!v) {
return;
}
          // Add line from origin to loading point
          vectorX.push(0, loadingsX[v.i]);
          vectorX.push(null as any);  // null creates line break
          vectorY.push(0, loadingsY[v.i]);
          vectorY.push(null as any);
          vectorText.push('', v.name, '');
        });

        // Add loading vectors as lines
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x: vectorX,
          y: vectorY,
          line: {
            color: this.config.colorScheme?.[1] || '#ef4444',
            width: this.config.arrowWidth || 2
          },
          name: 'Loadings',
          showlegend: false,
          hoverinfo: 'skip'
        });

        // Add arrowheads as markers at the end of vectors
        traces.push({
          type: 'scatter',
          mode: 'markers',
          x: validVectors.map(v => v ? loadingsX[v.i] : 0),
          y: validVectors.map(v => v ? loadingsY[v.i] : 0),
          marker: {
            symbol: 'arrow',
            size: getScaledMarkerSize(12, this.config.fontScale || 1.0),
            color: this.config.colorScheme?.[1] || '#ef4444'
          } as any,
          showlegend: false,
          hovertemplate: validVectors.map(v =>
            `<b>${v?.name}</b><br>Loading X: %{x:.3f}<br>Loading Y: %{y:.3f}<extra></extra>`
          )
        });

        // Add text labels for variables
        const labelPositions = validVectors.map(v => {
          if (!v) {
return { x: 0, y: 0 };
}
          // Position labels slightly beyond the arrow tip
          const scale = 1.15;
          return {
            x: loadingsX[v.i] * scale,
            y: loadingsY[v.i] * scale
          };
        });

        traces.push({
          type: 'scatter',
          mode: 'text',
          x: labelPositions.map(p => p.x),
          y: labelPositions.map(p => p.y),
          text: validVectors.map(v => v?.name || ''),
          textposition: 'middle center',
          textfont: {
            size: Math.round(10 * (this.config.fontScale || 1.0)),
            color: this.config.colorScheme?.[1] || '#ef4444'
          },
          showlegend: false,
          hoverinfo: 'skip'
        });
      }
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
    const { pcX, pcY, scoresX, scoresY, loadingsX, loadingsY } = this.prepareData();
    const { explainedVariance } = this.data;

    // More groups than the palette can distinguish (#999). Skipped for a
    // continuous coloring: there colorScheme is a sequential colorscale whose
    // stop count says nothing about repeated swatches, and there are none.
    const overflowNote = this.data.groupType === 'continuous'
      ? null
      : paletteOverflowNote(
          new Set(this.data.groups ?? []).size,
          this.categoricalPalette().length
        );

    // Calculate axis ranges to accommodate both scores and loadings
    const allX = [...scoresX, ...loadingsX, 0];
    const allY = [...scoresY, ...loadingsY, 0];
    const xRange = [Math.min(...allX) * 1.2, Math.max(...allX) * 1.2];
    const yRange = [Math.min(...allY) * 1.2, Math.max(...allY) * 1.2];

    // Create title with filtering indicator if needed
    let titleText = 'Biplot';
    if ((this as any)._needsFiltering) {
      titleText += `<br><span style="font-size: 12px; color: #f59e0b;">Showing top ${(this as any)._displayedVariables} of ${(this as any)._totalVariables} variables</span>`;
    }

    const layout: Partial<Layout> = {
      title: {
        text: titleText
      },
      xaxis: {
        title: {
          text: `PC${pcX + 1} (${explainedVariance[pcX].toFixed(1)}%)`
        },
        zeroline: true,
        zerolinewidth: 1,
        zerolinecolor: 'gray',
        showgrid: true,
        gridcolor: 'rgba(128, 128, 128, 0.2)',
        range: xRange
      },
      yaxis: {
        title: {
          text: `PC${pcY + 1} (${explainedVariance[pcY].toFixed(1)}%)`
        },
        zeroline: true,
        zerolinewidth: 1,
        zerolinecolor: 'gray',
        showgrid: true,
        gridcolor: 'rgba(128, 128, 128, 0.2)',
        range: yRange,
        scaleanchor: 'x',
        scaleratio: 1
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
      annotations: []
    };

    return layout;
  }

  getConfig(): Partial<any> {
    return {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToAdd: getExportMenuItems() as any,
      toImageButtonOptions: {
        ...PLOT_CONFIG.export.presentation,
        filename: 'biplot'
      }
    };
  }
}

/**
 * React component wrapper for Biplot
 */
export const PCABiplot: React.FC<{
  data: BiplotData;
  config?: BiplotConfig;
  onSelection?: (indices: number[]) => void;
  excludedRows?: number[];
}> = ({ data, config, onSelection, excludedRows = [] }) => {
  const plot = useMemo(() => new PlotlyBiplot(data, config), [data, config]);

  // Apply opacity to excluded rows
  const tracesWithOpacity = useMemo(() => {
    const traces = plot.getTraces();
    if (excludedRows.length > 0 && traces.length > 0) {
      // The first trace is typically the scores/points
      const scoresTrace: any = { ...traces[0] };
      if (scoresTrace.marker) {
        const numPoints = (scoresTrace.x as number[]).length;
        const opacity = new Array(numPoints).fill(1);
        excludedRows.forEach(idx => {
          if (idx < numPoints) {
            opacity[idx] = 0.2;
          }
        });
        scoresTrace.marker = {
          ...scoresTrace.marker,
          opacity
        };
      }
      return [scoresTrace, ...traces.slice(1)];
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
        console.log('PCABiplot: Selection event', indices);
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