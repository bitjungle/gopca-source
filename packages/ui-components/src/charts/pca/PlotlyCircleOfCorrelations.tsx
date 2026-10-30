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

// Circle of Correlations visualization for PCA

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Data, Layout } from 'plotly.js';
import { getPlotlyTheme, mergeLayouts } from '../utils/plotlyTheme';
import { getExportMenuItems } from '../utils/plotlyExport';
import { PLOT_CONFIG, getScaledMarkerSize } from '../config/plotConfig';
import { PlotlyWithFullscreen } from '../utils/plotlyFullscreen';
import { getWatermarkDataUrlSync } from '../assets/watermark';
import { placeCircleLabels } from '../utils/circleLabelPlacement';
import { escapeHoverText } from '../utils/hoverText';
import { PlotlyVisualizationConfig } from '../core/PlotlyVisualization';

export interface CircleOfCorrelationsData {
  /**
   * Correlations between each variable and each component, as
   * [n_components][n_variables].
   *
   * These must be correlations, not loadings. The two differ by a factor of
   * sqrt(eigenvalue)/sd, so substituting loadings draws every arrow short — on
   * standardised data the leading eigenvalues exceed 1, which puts the unit
   * circle permanently out of reach and strips the arrow lengths of the meaning
   * this plot exists to convey. See issue #793.
   */
  correlations: number[][];
  variableNames: string[];
  explainedVariance: number[];
}

export interface CircleOfCorrelationsConfig extends PlotlyVisualizationConfig {
  /**
   * Rendered size of the square plot in pixels, used only to keep labels apart.
   *
   * Label size is fixed in pixels while positions are in data units, so the two
   * can only be compared through the rendered scale. Assuming a size makes the
   * de-confliction too eager in a large window and too shy in a small one, so
   * PCACircleOfCorrelations measures its container and passes the real value;
   * the default is a fallback for callers that construct this class directly.
   */
  plotSizePx?: number;
  pcX?: number;  // PC for X-axis (1-indexed)
  pcY?: number;  // PC for Y-axis (1-indexed)
  showCircle?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  minVectorLength?: number;  // Minimum vector length to display
  colorByMagnitude?: boolean;
  arrowWidth?: number;
  labelSize?: number;
  colorScheme?: string[];  // Color palette for visualization
}

/**
 * Circle of Correlations showing variable correlations with principal components
 * Vectors represent correlations between original variables and PCs
 * Reference: Abdi & Williams (2010), "Principal component analysis"
 */
export class PlotlyCircleOfCorrelations {
  private data: CircleOfCorrelationsData;
  private config: CircleOfCorrelationsConfig;

  constructor(data: CircleOfCorrelationsData, config?: CircleOfCorrelationsConfig) {
    this.data = data;
    this.config = {
      pcX: 1,
      pcY: 2,
      showCircle: true,
      showGrid: true,
      showLabels: true,
      minVectorLength: 0.1,
      colorByMagnitude: false,  // Changed to false for consistency with Biplot
      arrowWidth: 2,
      labelSize: 10,
      ...config
    };
  }

  private prepareData() {
    const { correlations, variableNames } = this.data;
    const pcX = (this.config.pcX || 1) - 1;
    const pcY = (this.config.pcY || 2) - 1;

    // Correlations between each variable and the two selected components.
    // Not loadings: substituting those is the defect fixed in #793.
    const correlationsX = correlations[pcX];
    const correlationsY = correlations[pcY];

    // Calculate vector magnitudes
    const magnitudes = correlationsX.map((x, i) =>
      Math.sqrt(x * x + correlationsY[i] * correlationsY[i])
    );

    // Filter by minimum vector length
    const filteredIndices = magnitudes
      .map((mag, i) => mag >= this.config.minVectorLength! ? i : -1)
      .filter(i => i >= 0);

    return {
      correlationsX: filteredIndices.map(i => correlationsX[i]),
      correlationsY: filteredIndices.map(i => correlationsY[i]),
      filteredNames: filteredIndices.map(i => variableNames[i]),
      magnitudes: filteredIndices.map(i => magnitudes[i]),
      pcX,
      pcY
    };
  }

  getTraces(): Data[] {
    const traces: Data[] = [];
    const { correlationsX, correlationsY, filteredNames, magnitudes } = this.prepareData();

    // Add unit circle
    if (this.config.showCircle) {
      const theta = Array.from({ length: 101 }, (_, i) => (i * 2 * Math.PI) / 100);
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: theta.map(t => Math.cos(t)),
        y: theta.map(t => Math.sin(t)),
        line: {
          color: 'gray',
          width: 2,
          dash: 'dash'
        },
        showlegend: false,
        hoverinfo: 'skip'
      });

      // Inner reference circle at sqrt(0.5) ~ 0.707, the radius at which a
      // variable has half its variance captured by the two components shown.
      // (A circle at radius 0.5 would mark 25%, which is not a level anyone reads for.)
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: theta.map(t => Math.SQRT1_2 * Math.cos(t)),
        y: theta.map(t => Math.SQRT1_2 * Math.sin(t)),
        line: {
          color: 'lightgray',
          width: 1,
          dash: 'dot'
        },
        showlegend: false,
        hoverinfo: 'skip'
      });
    }

    // Add correlation vectors - assign each variable a color from the palette
    filteredNames.forEach((name, i) => {
      let color: string;
      if (this.config.colorScheme && this.config.colorScheme.length > 0) {
        // Assign each variable its own color from the palette
        // Use modulo to cycle through palette if more variables than colors
        const paletteIndex = i % this.config.colorScheme.length;
        color = this.config.colorScheme[paletteIndex];
      } else if (this.config.colorByMagnitude) {
        // Fallback to HSL gradient based on magnitude if no palette
        color = `hsl(${240 - magnitudes[i] * 240}, 70%, 50%)`;  // Blue to red gradient
      } else {
        // Default fallback color
        color = '#ef4444';
      }

      // Vector line
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: [0, correlationsX[i]],
        y: [0, correlationsY[i]],
        line: {
          color: color,
          width: this.config.arrowWidth || 2
        },
        showlegend: false,
        hovertemplate: `<b>${escapeHoverText(name)}</b><br>` +
                       `PC${(this.config.pcX || 1)}: ${correlationsX[i].toFixed(3)}<br>` +
                       `PC${(this.config.pcY || 2)}: ${correlationsY[i].toFixed(3)}<br>` +
                       `Magnitude: ${magnitudes[i].toFixed(3)}<extra></extra>`
      });

      // Arrowhead marker
      traces.push({
        type: 'scatter',
        mode: 'markers',
        x: [correlationsX[i]],
        y: [correlationsY[i]],
        marker: {
          symbol: 'circle',
          size: getScaledMarkerSize(6, this.config.fontScale || 1.0),
          color: color
        },
        showlegend: false,
        hoverinfo: 'skip'
      });
    });

    // Add labels
    if (this.config.showLabels) {
      // Placed with a de-confliction pass rather than radially, because two
      // arrows at nearly the same angle put their names on top of each other --
      // and those are the tightly correlated variables a reader is trying to
      // tell apart, so the labels failed exactly where they mattered (#830).
      // Each label keeps its own radius, so arrow length still reads correctly.
      const labelSize = Math.round((this.config.labelSize || 10) * (this.config.fontScale || 1.0));
      const placed = placeCircleLabels(
        filteredNames.map((text, i) => ({ text, x: correlationsX[i], y: correlationsY[i] })),
        { fontSizePx: labelSize, plotSizePx: this.config.plotSizePx }
      );

      traces.push({
        type: 'scatter',
        mode: 'text',
        x: placed.map((p) => p.x),
        y: placed.map((p) => p.y),
        text: filteredNames.map(escapeHoverText),
        textposition: 'middle center',
        textfont: {
          size: labelSize,
          color: this.config.theme === 'dark' ? '#e5e7eb' : '#374151'
        },
        showlegend: false,
        hoverinfo: 'skip'
      });
    }

    // Add axes through origin
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: [-1.1, 1.1],
      y: [0, 0],
      line: {
        color: this.config.theme === 'dark' ? '#6b7280' : '#374151',
        width: 1
      },
      showlegend: false,
      hoverinfo: 'skip'
    });

    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: [0, 0],
      y: [-1.1, 1.1],
      line: {
        color: this.config.theme === 'dark' ? '#6b7280' : '#374151',
        width: 1
      },
      showlegend: false,
      hoverinfo: 'skip'
    });

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
    const { pcX, pcY } = this.prepareData();

    const layout: Partial<Layout> = {
      title: {
        text: 'Circle of Correlations'
      },
      xaxis: {
        title: {
          text: `PC${pcX + 1} (${explainedVariance[pcX].toFixed(1)}%)`
        },
        range: [-1.2, 1.2],
        zeroline: false,
        showgrid: this.config.showGrid,
        gridcolor: 'rgba(128, 128, 128, 0.2)',
        scaleanchor: 'y',
        scaleratio: 1,
        // With scaleanchor alone, Plotly satisfies the 1:1 ratio in a container
        // wider than it is tall by widening the x range -- so the declared
        // [-1.2, 1.2] was inert, the axis ran to roughly +/-3, and the unit
        // circle shrank to about a third of the panel. Constraining the domain
        // instead shrinks the plotting area to a square and keeps the range,
        // which matters here because this plot is read by distance from the
        // origin against a fixed reference circle.
        constrain: 'domain',
        constraintoward: 'center'
      },
      yaxis: {
        title: {
          text: `PC${pcY + 1} (${explainedVariance[pcY].toFixed(1)}%)`
        },
        range: [-1.2, 1.2],
        zeroline: false,
        showgrid: this.config.showGrid,
        gridcolor: 'rgba(128, 128, 128, 0.2)',
        constrain: 'domain',
        constraintoward: 'middle'
      },
      hovermode: 'closest',
      showlegend: false,
      annotations: [
        // Add quadrant labels
        {
          text: '+/+',
          x: 1.05,
          y: 1.05,
          xref: 'x',
          yref: 'y',
          showarrow: false,
          font: { size: Math.round(12 * (this.config.fontScale || 1.0)), color: 'gray' }
        },
        {
          text: '-/+',
          x: -1.05,
          y: 1.05,
          xref: 'x',
          yref: 'y',
          showarrow: false,
          font: { size: Math.round(12 * (this.config.fontScale || 1.0)), color: 'gray' }
        },
        {
          text: '-/-',
          x: -1.05,
          y: -1.05,
          xref: 'x',
          yref: 'y',
          showarrow: false,
          font: { size: Math.round(12 * (this.config.fontScale || 1.0)), color: 'gray' }
        },
        {
          text: '+/-',
          x: 1.05,
          y: -1.05,
          xref: 'x',
          yref: 'y',
          showarrow: false,
          font: { size: Math.round(12 * (this.config.fontScale || 1.0)), color: 'gray' }
        }
      ]
    };

    // Add arrow annotations for vectors
    const { correlationsX, correlationsY, magnitudes } = this.prepareData();
    const arrowAnnotations = correlationsX.map((_x, i) => {
      let arrowColor: string;
      if (this.config.colorByMagnitude) {
        arrowColor = `hsl(${240 - magnitudes[i] * 240}, 70%, 50%)`;
      } else if (this.config.colorScheme && this.config.colorScheme.length > 0) {
        // Use the same palette index as the line trace for this variable so
        // arrowhead and line always share the same color.
        arrowColor = this.config.colorScheme[i % this.config.colorScheme.length];
      } else {
        arrowColor = '#3b82f6';
      }
      return {
        x: correlationsX[i],
        y: correlationsY[i],
        ax: 0,
        ay: 0,
        xref: 'x' as any,
        yref: 'y' as any,
        axref: 'x' as any,
        ayref: 'y' as any,
        showarrow: true,
        arrowhead: 2,
        arrowsize: 1,
        arrowwidth: this.config.arrowWidth,
        arrowcolor: arrowColor
      };
    });

    layout.annotations = [...(layout.annotations || []), ...arrowAnnotations];

    return layout;
  }

  getConfig(): Partial<any> {
    return {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToAdd: getExportMenuItems() as any,
      toImageButtonOptions: {
        ...PLOT_CONFIG.export.presentation,
        filename: 'circle-of-correlations'
      }
    };
  }
}

/**
 * React component wrapper for Circle of Correlations
 */
export const PCACircleOfCorrelations: React.FC<{
  data: CircleOfCorrelationsData;
  config?: CircleOfCorrelationsConfig;
}> = ({ data, config }) => {
  const container = useRef<HTMLDivElement>(null);
  const [measuredSize, setMeasuredSize] = useState<number | undefined>(undefined);

  // Label de-confliction needs the rendered size, because text is sized in
  // pixels and positions are in data units. The plot is responsive and also
  // opens fullscreen, so a fixed assumption would separate labels too eagerly
  // in a large window and too little in a small one.
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) {
        return;
      }
      // The plot is square and fits the smaller dimension.
      const size = Math.round(Math.min(box.width, box.height));
      // Only react to real changes, and ignore sub-pixel jitter: setting state
      // on every observation would re-run the placement continuously and could
      // feed back into the layout.
      setMeasuredSize((previous) =>
        previous !== undefined && Math.abs(previous - size) < 8 ? previous : size);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const plot = useMemo(
    () => new PlotlyCircleOfCorrelations(data, { ...config, plotSizePx: measuredSize ?? config?.plotSizePx }),
    [data, config, measuredSize]
  );

  return (
    <div ref={container} style={{ width: '100%', height: '100%' }}>
      <PlotlyWithFullscreen
        data={plot.getTraces()}
        layout={plot.getEnhancedLayout()}
        config={plot.getConfig()}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};