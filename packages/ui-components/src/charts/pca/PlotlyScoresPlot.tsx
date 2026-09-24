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

// PCA Scores Plot with confidence ellipses, smart labels, and density overlays

import React, { useMemo } from 'react';
import { Data, Layout, Config } from 'plotly.js';
import { PlotlyVisualization, PlotlyVisualizationConfig } from '../core/PlotlyVisualization';
import { PlotlyWithFullscreen } from '../utils/plotlyFullscreen';
import {
  calculateConfidenceEllipse,
  generateEllipsePath,
  calculateSmartLabels,
  kernelDensityEstimate2D,
  Point2D
} from '../utils/plotlyMath';
import { optimizeTraceType, getOptimalConfig } from '../utils/plotlyPerformance';
import { sampleLabel } from '../utils/sampleLabel';
import { paletteOverflowNote, truncateLegendLabel } from '../utils/legendLabels';
import { escapeHoverText } from '../utils/hoverText';
import { getExportMenuItems } from '../utils/plotlyExport';
import { getScaledMarkerSize } from '../config/plotConfig';

export interface ScoresPlotData {
  scores: number[][];
  groups: string[];
  groupValues?: number[]; // For continuous data
  groupType?: 'categorical' | 'continuous';
  sampleNames?: string[];
  explainedVariance: number[];
  pc1?: number;
  pc2?: number;
}

export interface ScoresPlotConfig extends PlotlyVisualizationConfig {
  showEllipses?: boolean;
  ellipseConfidence?: number;
  showSmartLabels?: boolean;
  maxLabels?: number;
  showDensity?: boolean;
  colorScheme?: string[];
}

/**
 * PCA Scores Plot with advanced features
 * Implements smart labels, confidence ellipses, and optional density overlays
 */
export class PlotlyScoresPlot extends PlotlyVisualization<ScoresPlotData> {
  protected scoresConfig: ScoresPlotConfig;

  constructor(data: ScoresPlotData, config?: ScoresPlotConfig) {
    super(data, config);
    this.scoresConfig = {
      showEllipses: true,
      ellipseConfidence: 0.95,
      showSmartLabels: true,
      maxLabels: 10,
      showDensity: false,
      colorScheme: [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
        '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
      ],
      ...config
    };
  }

  protected getDataSize(): number {
    return this.data.scores.length;
  }

  protected getTraces(): Data[] {
    const { scores, groups, groupValues, groupType = 'categorical', sampleNames, pc1 = 0, pc2 = 1 } = this.data;
    const traces: Data[] = [];

    // Validate scores data
    if (!scores || scores.length === 0) {
      console.error('PlotlyScoresPlot: No scores data available');
      return [];
    }

    // Validate that each score has enough components
    const invalidScores = scores.some(s => !s || !Array.isArray(s) || s.length <= Math.max(pc1, pc2));
    if (invalidScores) {
      console.error(`PlotlyScoresPlot: Invalid scores data - not enough components for PC${pc1 + 1} and PC${pc2 + 1}`);
      return [];
    }

    // Handle continuous vs categorical data
    if (groupType === 'continuous' && groupValues) {
      return this.getContinuousTraces();
    }

    // Handle empty groups - default to single group
    const effectiveGroups = groups && groups.length > 0 ? groups : scores.map(() => 'All Samples');

    // Get unique groups
    const uniqueGroups = Array.from(new Set(effectiveGroups));

    // Calculate smart labels globally
    const allPoints: Point2D[] = scores.map(s => ({ x: s[pc1], y: s[pc2] }));
    const smartLabelIndices = this.scoresConfig.showSmartLabels
      ? calculateSmartLabels(allPoints, this.scoresConfig.maxLabels!)
      : [];

    // Add density overlay if enabled
    if (this.scoresConfig.showDensity && scores.length > 20) {
      traces.push(...this.getDensityTraces(uniqueGroups, pc1, pc2));
    }

    // Create traces for each group
    uniqueGroups.forEach((group, groupIndex) => {
      const groupIndices = effectiveGroups.map((g, i) => g === group ? i : -1).filter(i => i >= 0);
      const groupScores = groupIndices.map(i => scores[i]);
      const groupPoints = groupScores.map(s => ({ x: s[pc1], y: s[pc2] }));

      // Prepare hover text
      const hovertext = groupIndices.map(i => {
        const label = sampleLabel(sampleNames, i);
        // Escaped: Plotly parses hover text as markup, and this is the one place
        // the untruncated value is guaranteed readable (#999).
        return `<b>${escapeHoverText(label)}</b><br>Group: ${escapeHoverText(group)}<br>PC${pc1 + 1}: ${scores[i][pc1].toFixed(2)}<br>PC${pc2 + 1}: ${scores[i][pc2].toFixed(2)}`;
      });

      // Determine trace type based on performance
      const traceType = optimizeTraceType(groupScores, this.config.dataThreshold!);

      // Main scatter trace - markers only (WebGL compatible)
      traces.push({
        type: traceType as any,
        mode: 'markers',
        // Shortened for the legend only. The full value is in hovertext above,
        // so nothing is lost by not printing it twice (#999).
        name: truncateLegendLabel(group),
        x: groupScores.map(s => s[pc1]),
        y: groupScores.map(s => s[pc2]),
        customdata: groupIndices, // Add global indices as customdata
        hovertext: hovertext,
        hovertemplate: '%{hovertext}<extra></extra>',
        marker: {
          size: getScaledMarkerSize(8, this.config.fontScale || 1.0),
          color: this.scoresConfig.colorScheme![groupIndex % this.scoresConfig.colorScheme!.length],
          opacity: 0.8
        }
        // DO NOT set selectedpoints - let Plotly handle selection naturally
      });

      // Add confidence ellipse if enabled
      if (this.scoresConfig.showEllipses && groupScores.length > 2) {
        const ellipseTrace = this.getEllipseTrace(groupPoints, group, groupIndex);
        if (ellipseTrace) {
          traces.push(ellipseTrace);
        }
      }
    });

    // Add text labels as a separate trace (if enabled)
    // This ensures text renders properly with both scatter and scattergl
    if (this.scoresConfig.showSmartLabels && smartLabelIndices.length > 0) {
      const labelX: number[] = [];
      const labelY: number[] = [];
      const labelText: string[] = [];

      smartLabelIndices.forEach(i => {
        labelX.push(scores[i][pc1]);
        labelY.push(scores[i][pc2]);
        labelText.push(sampleLabel(sampleNames, i));
      });

      traces.push({
        type: 'scatter',
        mode: 'text',
        x: labelX,
        y: labelY,
        text: labelText,
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

  protected getStandardTraces(): Data[] {
    return this.getTraces();
  }

  protected getWebGLTraces(): Data[] {
    const traces = this.getTraces();
    return traces.map(trace => {
      if (trace.type === 'scatter' && trace.mode?.includes('markers')) {
        return { ...trace, type: 'scattergl' as any };
      }
      return trace;
    });
  }

  private getContinuousTraces(): Data[] {
    const { scores, groupValues, sampleNames, pc1 = 0, pc2 = 1 } = this.data;
    const traces: Data[] = [];

    // Validate scores data
    if (!scores || scores.length === 0) {
      console.error('PlotlyScoresPlot: No scores data available for continuous plot');
      return [];
    }

    // Validate that each score has enough components
    const invalidScores = scores.some(s => !s || !Array.isArray(s) || s.length <= Math.max(pc1, pc2));
    if (invalidScores) {
      console.error(`PlotlyScoresPlot: Invalid scores data - not enough components for PC${pc1 + 1} and PC${pc2 + 1}`);
      return [];
    }

    if (!groupValues || groupValues.length === 0) {
      return this.getTraces(); // Fall back to categorical
    }

    // Calculate min/max for continuous values
    const validValues = groupValues.filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v));
    const min = Math.min(...validValues);
    const max = Math.max(...validValues);

    // Calculate smart labels globally
    const allPoints: Point2D[] = scores.map(s => ({ x: s[pc1], y: s[pc2] }));
    const smartLabelIndices = this.scoresConfig.showSmartLabels
      ? calculateSmartLabels(allPoints, this.scoresConfig.maxLabels!)
      : [];

    // Create a custom colorscale from the palette
    const palette = this.scoresConfig.colorScheme || ['#440154', '#31688e', '#35b779', '#fde725'];
    const colorscale: [number, string][] = palette.map((color, i) => [
      i / (palette.length - 1),
      color
    ]);

    // Prepare hover text
    const hovertext = scores.map((score, i) => {
      const label = sampleLabel(sampleNames, i);
      const value = groupValues[i];
      const valueStr = value !== null && value !== undefined && !isNaN(value) && isFinite(value)
        ? value.toFixed(2)
        : 'Missing';
      return `<b>${label}</b><br>Value: ${valueStr}<br>PC${pc1 + 1}: ${score[pc1].toFixed(2)}<br>PC${pc2 + 1}: ${score[pc2].toFixed(2)}`;
    });

    // Check if we have any actual labels to display
    const hasLabels = smartLabelIndices.length > 0;

    // Create main scatter trace with gradient colors (markers only)
    // Separate from text to avoid Plotly rendering issues with colorscale + text
    traces.push({
      type: 'scatter',
      mode: 'markers',
      name: 'Samples',
      x: scores.map(s => s[pc1]),
      y: scores.map(s => s[pc2]),
      customdata: scores.map((_, i) => i), // Add global indices
      hovertext: hovertext,
      hovertemplate: '%{hovertext}<extra></extra>',
      marker: {
        size: getScaledMarkerSize(8, this.config.fontScale || 1.0),
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
        opacity: 0.8
      }
      // DO NOT set selectedpoints - let Plotly handle selection naturally
    });

    // Add text labels as a separate trace (if enabled)
    // This prevents rendering issues when combining gradient colors with text
    if (hasLabels && this.scoresConfig.showSmartLabels) {
      const labelX: number[] = [];
      const labelY: number[] = [];
      const labelText: string[] = [];

      smartLabelIndices.forEach(i => {
        labelX.push(scores[i][pc1]);
        labelY.push(scores[i][pc2]);
        labelText.push(sampleLabel(sampleNames, i));
      });

      traces.push({
        type: 'scatter',
        mode: 'text',
        x: labelX,
        y: labelY,
        text: labelText,
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

  private getEllipseTrace(points: Point2D[], groupName: string, groupIndex: number): Data | null {
    if (points.length < 3) {
return null;
}

    try {
      const ellipseParams = calculateConfidenceEllipse(points, this.scoresConfig.ellipseConfidence!);
      const ellipsePath = generateEllipsePath(ellipseParams);

      return {
        type: 'scatter',
        mode: 'lines',
        x: ellipsePath.map(p => p.x),
        y: ellipsePath.map(p => p.y),
        line: {
          color: this.scoresConfig.colorScheme![groupIndex % this.scoresConfig.colorScheme!.length],
          width: 2,
          dash: 'dash'
        },
        showlegend: false,
        hoverinfo: 'skip',
        name: `${groupName} (${(this.scoresConfig.ellipseConfidence! * 100).toFixed(0)}% CI)`
      };
    } catch (error) {
      console.warn(`Failed to calculate ellipse for group ${groupName}:`, error);
      return null;
    }
  }

  private getDensityTraces(groups: string[], pc1: number, pc2: number): Data[] {
    const traces: Data[] = [];
    const uniqueGroups = Array.from(new Set(groups));

    uniqueGroups.forEach((group, groupIndex) => {
      const groupIndices = groups.map((g, i) => g === group ? i : -1).filter(i => i >= 0);
      const groupPoints: Point2D[] = groupIndices.map(i => ({
        x: this.data.scores[i][pc1],
        y: this.data.scores[i][pc2]
      }));

      if (groupPoints.length < 5) {
return;
} // Need enough points for KDE

      try {
        const kde = kernelDensityEstimate2D(groupPoints, 'scott', 30);

        traces.push({
          type: 'contour',
          x: kde.x,
          y: kde.y,
          z: kde.z,
          showscale: false,
          colorscale: [
            [0, 'rgba(255,255,255,0)'],
            [1, this.scoresConfig.colorScheme![groupIndex % this.scoresConfig.colorScheme!.length]]
          ],
          opacity: 0.2,
          contours: {
            coloring: 'heatmap',
            showlines: false
          },
          hoverinfo: 'skip',
          showlegend: false
        });
      } catch (error) {
        console.warn(`Failed to calculate density for group ${group}:`, error);
      }
    });

    return traces;
  }

  protected getLayout(): Partial<Layout> {
    const { explainedVariance, pc1 = 0, pc2 = 1 } = this.data;

    // More groups than the palette can distinguish (#999). Recomputed here so
    // the layout does not depend on getTraces having run first. Skipped for a
    // continuous coloring: there colorScheme is a sequential colorscale whose
    // stop count says nothing about repeated swatches, and there are none.
    const overflowNote = this.data.groupType === 'continuous'
      ? null
      : paletteOverflowNote(
          new Set(this.data.groups ?? []).size,
          this.scoresConfig.colorScheme?.length ?? 0
        );

    return {
      title: {
        text: 'PCA Scores Plot'
      },
      xaxis: {
        title: {
          text: `PC${pc1 + 1} (${explainedVariance[pc1].toFixed(1)}%)`
        },
        zeroline: true,
        zerolinecolor: 'rgba(128, 128, 128, 0.5)',
        gridcolor: 'rgba(128, 128, 128, 0.2)'
      },
      yaxis: {
        title: {
          text: `PC${pc2 + 1} (${explainedVariance[pc2].toFixed(1)}%)`
        },
        zeroline: true,
        zerolinecolor: 'rgba(128, 128, 128, 0.5)',
        gridcolor: 'rgba(128, 128, 128, 0.2)',
        scaleanchor: this.config.maintainAspectRatio ? 'x' : undefined,
        scaleratio: this.config.maintainAspectRatio ? 1 : undefined
      },
      hovermode: 'closest',
      dragmode: this.config.enableLasso !== false ? 'lasso' : 'zoom',
      selectdirection: 'any' as any,
      // Said in the legend's own title, above the swatches it qualifies, when
      // there are more groups than the palette can distinguish (#999).
      // A `legend: undefined` key would survive mergeLayouts' shallow spread and
      // wipe the theme's legend styling, so omit the key entirely instead.
      ...(overflowNote ? { legend: { title: { text: overflowNote } } } : {})
    };
  }

  /**
   * Public method to get optimized traces based on data size
   */
  public getOptimizedTraces(): Data[] {
    const dataSize = this.getDataSize();
    const perfConfig = getOptimalConfig(
      dataSize,
      Array.from(new Set(this.data.groups)).length > 1,
      true
    );

    return perfConfig.useWebGL ? this.getWebGLTraces() : this.getStandardTraces();
  }

  /**
   * Public method to get the layout
   */
  public getPlotLayout(): Partial<Layout> {
    return this.getEnhancedLayout();
  }

  /**
   * Public method to get the config
   */
  public getPlotConfig(): Partial<Config> {
    const baseConfig = this.getAdvancedConfig();
    const config = {
      ...baseConfig,
      modeBarButtonsToAdd: getExportMenuItems() as any
    };

    console.log('PlotlyScoresPlot Config:', {
      modeBarButtons: config.modeBarButtonsToRemove,
      enableLasso: this.config.enableLasso
    });

    return config;
  }
}

/**
 * React component wrapper for PlotlyScoresPlot
 */
export const PCAScoresPlot: React.FC<{
  data: ScoresPlotData;
  config?: ScoresPlotConfig;
  onSelection?: (indices: number[]) => void;
  onDeselect?: () => void;
  excludedRows?: number[];
}> = ({ data, config, onSelection, onDeselect, excludedRows = [] }) => {
  const plot = useMemo(() => new PlotlyScoresPlot(data, config), [data, config]);

  const handleSelected = (event: any) => {
    if (onSelection && event?.points && event.points.length > 0) {
      // Extract global indices from customdata
      const indices = event.points.map((p: any) =>
        p.customdata !== undefined ? p.customdata : p.pointNumber
      );
      onSelection(indices);
    }
  };

  const handleDeselect = () => {
    if (onDeselect) {
      onDeselect();
    } else if (onSelection) {
      onSelection([]);
    }
  };

  // Modify traces to show excluded points with reduced opacity
  const modifiedTraces = useMemo(() => {
    const traces = plot.getOptimizedTraces();

    if (!excludedRows || excludedRows.length === 0) {
      return traces;
    }

    const excludedSet = new Set(excludedRows);

    return traces.map((trace: any) => {
      // Only modify traces with customdata (scatter/scattergl point traces)
      if (trace.customdata && trace.marker) {
        // Create per-point opacity array based on customdata indices
        const opacities = trace.customdata.map((globalIndex: number) =>
          excludedSet.has(globalIndex) ? 0.2 : 0.8
        );

        return {
          ...trace,
          marker: {
            ...trace.marker,
            opacity: opacities
          }
        };
      }
      return trace;
    });
  }, [plot, excludedRows]);

  return (
    <PlotlyWithFullscreen
      data={modifiedTraces}
      layout={plot.getPlotLayout()}
      config={plot.getPlotConfig()}
      style={{ width: '100%', height: '100%' }}
      onSelected={handleSelected}
      onDeselect={handleDeselect}
    />
  );
};