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

// 3D PCA Scores Plot with interactive rotation and group visualization

import React, { useMemo } from 'react';
import { Data, Layout, Config } from 'plotly.js';
import { getPlotlyTheme, mergeLayouts, ThemeMode } from '../utils/plotlyTheme';
import { getExportMenuItems } from '../utils/plotlyExport';
import { PLOT_CONFIG, getScaledMarkerSize, getScaledFontSizes } from '../config/plotConfig';
import { PlotlyWithFullscreen } from '../utils/plotlyFullscreen';
import { getWatermarkDataUrlSync } from '../assets/watermark';
import { sampleLabel } from '../utils/sampleLabel';
import { paletteOverflowNote, truncateLegendLabel } from '../utils/legendLabels';
import { escapeHoverText } from '../utils/hoverText';

export interface Scores3DPlotData {
  scores: number[][];
  groups: string[];
  sampleNames?: string[];
  explainedVariance: number[];
  groupValues?: number[]; // For continuous data
  groupType?: 'categorical' | 'continuous';
  pc1?: number;
  pc2?: number;
  pc3?: number;
}

export interface Scores3DPlotConfig {
  colorScheme?: string[];
  markerSize?: number;
  opacity?: number;
  showProjections?: boolean;
  showLabels?: boolean;  // Whether to show sample labels
  maxLabels?: number;     // Maximum number of labels to display
  cameraPosition?: {
    eye: { x: number; y: number; z: number };
    center?: { x: number; y: number; z: number };
  };
  theme?: ThemeMode;
  fontScale?: number;  // Scale factor for all font sizes (default: 1.0)
}

/**
 * 3D PCA Scores Plot for exploring three principal components simultaneously
 * Enables interactive rotation and perspective changes
 */
export class Plotly3DScoresPlot {
  private data: Scores3DPlotData;
  private config: Scores3DPlotConfig;

  constructor(data: Scores3DPlotData, config?: Scores3DPlotConfig) {
    this.data = data;
    this.config = {
      colorScheme: [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
        '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
      ],
      markerSize: 5,
      opacity: 0.8,
      showProjections: false,
      cameraPosition: {
        eye: { x: 1.5, y: 1.5, z: 1.5 },
        center: { x: 0, y: 0, z: 0 }
      },
      ...config
    };
  }

  getTraces(): Data[] {
    const { scores, groups, sampleNames, groupValues, groupType, pc1 = 0, pc2 = 1, pc3 = 2 } = this.data;
    const traces: Data[] = [];

    // Handle continuous coloring
    if (groupType === 'continuous' && groupValues) {
      // Extract score values for each axis
      const scoresX = scores.map(s => s[pc1]);
      const scoresY = scores.map(s => s[pc2]);
      const scoresZ = scores.map(s => s[pc3]);

      // Filter out invalid values for min/max calculation
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
        return `<b>${label}</b><br>Value: ${valueStr}<br>PC${pc1 + 1}: ${x.toFixed(2)}<br>PC${pc2 + 1}: ${scoresY[i].toFixed(2)}<br>PC${pc3 + 1}: ${scoresZ[i].toFixed(2)}`;
      });

      // Prepare text labels if enabled (limit to maxLabels)
      const maxLabels = this.config.maxLabels || 10;
      const textLabels = this.config.showLabels && sampleNames && scoresX.length > 0
        ? scoresX.map((_, i) => i < maxLabels ? (sampleNames[i] || '') : '')
        : undefined;
      const showText = !!textLabels;

      traces.push({
        type: 'scatter3d',
        mode: showText ? 'markers+text' as any : 'markers',
        name: 'Scores',
        x: scoresX,
        y: scoresY,
        z: scoresZ,
        text: textLabels,
        textposition: 'top center',
        textfont: showText ? {
          size: Math.round(10 * (this.config.fontScale || 1.0)),
          color: 'currentColor'
        } : undefined,
        hovertext: hovertext,
        hovertemplate: '%{hovertext}<extra></extra>',
        marker: {
          size: getScaledMarkerSize(this.config.markerSize || 5, this.config.fontScale || 1.0),
          color: groupValues,
          colorscale: colorscale,
          cmin: min,
          cmax: max,
          showscale: true,
          colorbar: {
            title: {
              text: 'Value'
            },
            thickness: 15,
            len: 0.9
          },
          opacity: this.config.opacity
        }
      });
    } else {
      // Categorical coloring - existing implementation
      // Get unique groups
      const uniqueGroups = Array.from(new Set(groups));

      // Create 3D scatter trace for each group
      uniqueGroups.forEach((group, groupIndex) => {
        const groupIndices = groups.map((g, i) => g === group ? i : -1).filter(i => i >= 0);
        const groupScores = groupIndices.map(i => scores[i]);

        // Prepare hover text
        const hovertext = groupIndices.map(i => {
          const label = sampleLabel(sampleNames, i);
          // Escaped: Plotly parses hover text as markup, and this is the one place
          // the untruncated value is guaranteed readable (#999).
          return `<b>${escapeHoverText(label)}</b><br>Group: ${escapeHoverText(group)}<br>PC${pc1 + 1}: ${scores[i][pc1].toFixed(2)}<br>PC${pc2 + 1}: ${scores[i][pc2].toFixed(2)}<br>PC${pc3 + 1}: ${scores[i][pc3].toFixed(2)}`;
        });

        // Prepare text labels if enabled (limit per group)
        const maxLabelsPerGroup = Math.ceil((this.config.maxLabels || 10) / uniqueGroups.length);
        const groupSampleNames = groupIndices.map(i => sampleLabel(sampleNames, i));
        const textLabels = this.config.showLabels && sampleNames && groupSampleNames.length > 0
          ? groupSampleNames.map((name, idx) => idx < maxLabelsPerGroup ? name : '')
          : undefined;
        const showText = !!textLabels;

        traces.push({
          type: 'scatter3d',
          mode: showText ? 'markers+text' as any : 'markers',
          // Legend only; hovertext above carries the full value (#999).
          name: truncateLegendLabel(group),
          x: groupScores.map(s => s[pc1]),
          y: groupScores.map(s => s[pc2]),
          z: groupScores.map(s => s[pc3]),
          text: textLabels,
          textposition: 'top center',
          textfont: showText ? {
            size: Math.round(10 * (this.config.fontScale || 1.0)),
            color: 'currentColor'
          } : undefined,
          hovertext: hovertext,
          hovertemplate: '%{hovertext}<extra></extra>',
          marker: {
            size: getScaledMarkerSize(this.config.markerSize || 5, this.config.fontScale || 1.0),
            color: this.config.colorScheme![groupIndex % this.config.colorScheme!.length],
            opacity: this.config.opacity
          }
        });
      });
    }

    // Add projection traces if enabled
    if (this.config.showProjections) {
      traces.push(...this.getProjectionTraces());
    }

    return traces;
  }

  private getProjectionTraces(): Data[] {
    const { scores, groups, pc1 = 0, pc2 = 1, pc3 = 2 } = this.data;
    const projectionTraces: Data[] = [];
    const uniqueGroups = Array.from(new Set(groups));

    uniqueGroups.forEach((group, groupIndex) => {
      const groupIndices = groups.map((g, i) => g === group ? i : -1).filter(i => i >= 0);
      const groupScores = groupIndices.map(i => scores[i]);

      const color = this.config.colorScheme![groupIndex % this.config.colorScheme!.length];

      // XY plane projection (z=min)
      const minZ = Math.min(...scores.map(s => s[pc3]));
      projectionTraces.push({
        type: 'scatter3d',
        mode: 'markers',
        x: groupScores.map(s => s[pc1]),
        y: groupScores.map(s => s[pc2]),
        z: groupScores.map(() => minZ),
        marker: {
          size: getScaledMarkerSize(2, this.config.fontScale || 1.0),
          color: color,
          opacity: 0.3
        },
        showlegend: false,
        hoverinfo: 'skip'
      });

      // XZ plane projection (y=min)
      const minY = Math.min(...scores.map(s => s[pc2]));
      projectionTraces.push({
        type: 'scatter3d',
        mode: 'markers',
        x: groupScores.map(s => s[pc1]),
        y: groupScores.map(() => minY),
        z: groupScores.map(s => s[pc3]),
        marker: {
          size: getScaledMarkerSize(2, this.config.fontScale || 1.0),
          color: color,
          opacity: 0.3
        },
        showlegend: false,
        hoverinfo: 'skip'
      });

      // YZ plane projection (x=min)
      const minX = Math.min(...scores.map(s => s[pc1]));
      projectionTraces.push({
        type: 'scatter3d',
        mode: 'markers',
        x: groupScores.map(() => minX),
        y: groupScores.map(s => s[pc2]),
        z: groupScores.map(s => s[pc3]),
        marker: {
          size: getScaledMarkerSize(2, this.config.fontScale || 1.0),
          color: color,
          opacity: 0.3
        },
        showlegend: false,
        hoverinfo: 'skip'
      });
    });

    return projectionTraces;
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
    const { explainedVariance, pc1 = 0, pc2 = 1, pc3 = 2 } = this.data;

    // More groups than the palette can distinguish (#999). Recomputed here so
    // the layout does not depend on getTraces having run first. Skipped for a
    // continuous coloring: there colorScheme is a sequential colorscale whose
    // stop count says nothing about repeated swatches, and there are none.
    const overflowNote = this.data.groupType === 'continuous'
      ? null
      : paletteOverflowNote(
          new Set(this.data.groups ?? []).size,
          this.config.colorScheme?.length ?? 0
        );

    // Get scaled font sizes based on fontScale
    const scaledFonts = getScaledFontSizes(this.config.fontScale || 1.0);

    // Theme-aware colors for 3D scene
    const isDark = this.config.theme === 'dark';
    const sceneColors = {
      backgroundcolor: isDark ? 'rgba(31, 41, 55, 0.5)' : 'rgba(230, 230, 230, 0.5)',
      gridcolor: isDark ? 'rgba(75, 85, 99, 0.5)' : 'rgba(200, 200, 200, 0.5)',
      zerolinecolor: isDark ? 'rgba(107, 114, 128, 0.8)' : 'rgba(128, 128, 128, 0.8)'
    };

    return {
      title: {
        text: '3D PCA Scores Plot'
      },
      scene: {
        xaxis: {
          title: {
            text: `PC${pc1 + 1} (${explainedVariance[pc1].toFixed(1)}%)`,
            font: { size: scaledFonts.axis }
          },
          tickfont: { size: scaledFonts.label },
          backgroundcolor: sceneColors.backgroundcolor,
          gridcolor: sceneColors.gridcolor,
          showbackground: true,
          zerolinecolor: sceneColors.zerolinecolor
        },
        yaxis: {
          title: {
            text: `PC${pc2 + 1} (${explainedVariance[pc2].toFixed(1)}%)`,
            font: { size: scaledFonts.axis }
          },
          tickfont: { size: scaledFonts.label },
          backgroundcolor: sceneColors.backgroundcolor,
          gridcolor: sceneColors.gridcolor,
          showbackground: true,
          zerolinecolor: sceneColors.zerolinecolor
        },
        zaxis: {
          title: {
            text: `PC${pc3 + 1} (${explainedVariance[pc3].toFixed(1)}%)`,
            font: { size: scaledFonts.axis }
          },
          tickfont: { size: scaledFonts.label },
          backgroundcolor: sceneColors.backgroundcolor,
          gridcolor: sceneColors.gridcolor,
          showbackground: true,
          zerolinecolor: sceneColors.zerolinecolor
        },
        camera: this.config.cameraPosition,
        aspectmode: 'cube',
        hovermode: 'closest'
      },
      showlegend: true,
      legend: {
        borderwidth: 1,
        font: { size: Math.round(12 * (this.config.fontScale || 1.0)) },
        // Present only when the palette has run out, above the swatches it
        // qualifies (#999).
        ...(overflowNote ? { title: { text: overflowNote } } : {}),
        x: 1.02,
        y: 1,
        xanchor: 'left',
        yanchor: 'top'
      }
    };
  }

  getConfig(): Partial<Config> {
    return {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToAdd: getExportMenuItems(),
      toImageButtonOptions: {
        ...PLOT_CONFIG.export.presentation,
        filename: 'pca-3d-scores'
      }
    };
  }
}

/**
 * React component wrapper for 3D Scores Plot
 */
export const PCA3DScoresPlot: React.FC<{
  data: Scores3DPlotData;
  config?: Scores3DPlotConfig;
}> = ({ data, config }) => {
  // Always call hooks first, before any conditional returns
  const plot = useMemo(() => new Plotly3DScoresPlot(data, config), [data, config]);

  // Check if we have enough components for 3D visualization
  const pc3 = data.pc3 ?? 2;
  const numComponents = data.scores[0]?.length || 0;
  const numExplainedVariance = data.explainedVariance?.length || 0;

  // Validate that we have at least 3 components
  if (numComponents < 3 || pc3 >= numComponents || numExplainedVariance < 3 || pc3 >= numExplainedVariance) {
    const theme = config?.theme || 'light';
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }}>
        <p style={{
          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
          textAlign: 'center',
          marginBottom: '10px'
        }}>
          3D Scores Plot requires at least 3 principal components.
        </p>
        <p style={{
          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
          textAlign: 'center',
          fontSize: '14px'
        }}>
          Current PCA has only {numComponents} component{numComponents === 1 ? '' : 's'}.
          Please use the 2D Scores Plot visualization instead.
        </p>
      </div>
    );
  }

  return (
    <PlotlyWithFullscreen
      data={plot.getTraces()}
      layout={plot.getEnhancedLayout()}
      config={plot.getConfig()}
      style={{ width: '100%', height: '100%' }}
    />
  );
};