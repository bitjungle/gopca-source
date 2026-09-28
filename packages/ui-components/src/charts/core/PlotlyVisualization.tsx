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

// PlotlyVisualization Base Class - Foundation for all Plotly visualizations

import React from 'react';
import Plot from '../plotly-component';
import { Data, Layout, Config, PlotlyHTMLElement } from 'plotly.js';
import { getPlotlyTheme, mergeLayouts, ThemeMode } from '../utils/plotlyTheme';
import { PLOT_CONFIG } from '../config/plotConfig';
import { getWatermarkDataUrlSync } from '../assets/watermark';

export interface MathReference {
  authors: string;
  title: string;
  year: number;
  page?: string;
  equation?: string;
}

export interface PlotlyVisualizationConfig {
  useWebGL?: boolean;
  dataThreshold?: number;
  enableLasso?: boolean;
  enableCrosshair?: boolean;
  showDensity?: boolean;
  densityType?: 'contour' | 'heatmap' | 'kde';
  exportScale?: number;
  maintainAspectRatio?: boolean;
  theme?: ThemeMode;
  fontScale?: number; // Scale factor for all font sizes (default: 1.0)
}

export interface PlotlyButton {
  name: string;
  title: string;
  icon?: string;
  toggle?: boolean;
  click: (gd: PlotlyHTMLElement) => void;
}

/**
 * Base class for all Plotly visualizations in GoPCA
 * Provides automatic optimization, theming, and advanced features
 */
export abstract class PlotlyVisualization<T = any> {
  protected data: T;
  protected config: PlotlyVisualizationConfig;
  protected theme: ThemeMode;

  // Performance thresholds from centralized config
  protected readonly WEBGL_THRESHOLD = PLOT_CONFIG.performance.webglThreshold;
  protected readonly DECIMATION_THRESHOLD = PLOT_CONFIG.performance.decimationThreshold;
  protected readonly DENSITY_THRESHOLD = PLOT_CONFIG.performance.densityThreshold;

  constructor(data: T, config?: PlotlyVisualizationConfig) {
    this.data = data;
    this.config = {
      useWebGL: true,
      dataThreshold: this.WEBGL_THRESHOLD,
      enableLasso: true,
      enableCrosshair: false,
      showDensity: false,
      densityType: 'contour',
      exportScale: 2,
      maintainAspectRatio: false,
      theme: 'light',
      ...config
    };
    this.theme = this.config.theme || 'light';
  }

  /**
   * Get optimized traces based on data size
   * Automatically switches between scatter, scattergl, and density representations
   */
  protected abstract getTraces(): Data[];

  /**
   * Get standard traces (SVG rendering)
   */
  protected abstract getStandardTraces(): Data[];

  /**
   * Get WebGL optimized traces
   */
  protected abstract getWebGLTraces(): Data[];

  /**
   * Get the plot layout configuration
   */
  protected abstract getLayout(): Partial<Layout>;

  /**
   * Optimize traces based on data size
   * Algorithm: Use WebGL for >1000 points, decimation for >10000, density for >100000
   */
  protected optimizeForPerformance(traces: Data[]): Data[] {
    const dataSize = this.getDataSize();

    if (!this.config.useWebGL || dataSize <= this.config.dataThreshold!) {
      return traces;
    }

    if (dataSize <= this.DECIMATION_THRESHOLD) {
      // Use WebGL rendering (scattergl)
      return this.convertToWebGL(traces);
    }

    if (dataSize <= this.DENSITY_THRESHOLD) {
      // Apply decimation
      return this.decimateData(traces, this.DECIMATION_THRESHOLD);
    }

    // Use density representation
    return this.convertToDensity(traces);
  }

  /**
   * Convert traces to WebGL (scattergl)
   */
  protected convertToWebGL(traces: Data[]): Data[] {
    return traces.map(trace => {
      if (trace.type === 'scatter') {
        return { ...trace, type: 'scattergl' as any };
      }
      return trace;
    });
  }

  /**
   * Decimate data for very large datasets
   * Uses uniform sampling to reduce data points
   */
  protected decimateData(traces: Data[], targetSize: number): Data[] {
    return traces.map(trace => {
      if ('x' in trace && Array.isArray(trace.x)) {
        const originalSize = trace.x.length;
        if (originalSize <= targetSize) {
return trace;
}

        const step = Math.ceil(originalSize / targetSize);
        const decimatedIndices = Array.from(
          { length: Math.floor(originalSize / step) },
          (_, i) => i * step
        );

        const decimatedTrace: any = {
          ...trace,
          x: decimatedIndices.map(i => (trace.x as any[])[i])
        };

        if ('y' in trace && Array.isArray(trace.y)) {
          decimatedTrace.y = decimatedIndices.map(i => (trace.y as any[])[i]);
        }

        if (trace.text) {
          decimatedTrace.text = decimatedIndices.map(i => (trace.text as any[])[i]);
        }

        return decimatedTrace;
      }
      return trace;
    });
  }

  /**
   * Convert to density representation for massive datasets
   * This should be overridden by specific visualizations
   */
  protected convertToDensity(traces: Data[]): Data[] {
    console.warn('Density conversion not implemented for this visualization type');
    return this.decimateData(traces, this.DECIMATION_THRESHOLD);
  }

  /**
   * Get the size of the dataset
   */
  protected abstract getDataSize(): number;

  /**
   * Get enhanced layout with all features
   */
  protected getEnhancedLayout(): Partial<Layout> {
    const baseLayout = this.getLayout();
    const themeLayout = getPlotlyTheme(this.theme, this.config.fontScale).layout;

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

    return mergeLayouts(
      themeLayout,
      baseLayout,
      {
        dragmode: this.config.enableLasso ? 'lasso' : 'zoom',
        hovermode: this.config.enableCrosshair ? 'x unified' : 'closest',
        showlegend: true,
        images: watermarkImages
      }
    );
  }

  /**
   * Get advanced configuration for the plot
   */
  protected getAdvancedConfig(): Partial<Config> {
    const config: Partial<Config> = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToAdd: [],
      toImageButtonOptions: {
        ...PLOT_CONFIG.export.presentation,
        filename: this.getExportFilename()
      }
    };

    return config;
  }

  /**
   * Get export filename for this visualization
   * Override in subclasses to provide specific filenames
   */
  protected getExportFilename(): string {
    return 'pca-plot';
  }

  /**
   * Get default colors from centralized config
   */
  protected getDefaultColors(): string[] {
    return PLOT_CONFIG.colors.categorical;
  }

  /**
   * Get standard marker size from centralized config
   */
  protected getMarkerSize(): number {
    return PLOT_CONFIG.visual.markerSize;
  }

  /**
   * Render the visualization
   */
  render(): React.ReactElement {
    const traces = this.optimizeForPerformance(this.getTraces());
    const layout = this.getEnhancedLayout();
    const themeConfig = getPlotlyTheme(this.theme).config;
    const config = { ...themeConfig, ...this.getAdvancedConfig() };

    return (
      <Plot
        data={traces}
        layout={layout}
        config={config}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler={true}
      />
    );
  }
}