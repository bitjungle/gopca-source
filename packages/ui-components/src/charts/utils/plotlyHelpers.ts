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

import { Data } from 'plotly.js';
import { EllipseParams } from './plotlyMath';
import { uniqueCategoryLevels } from './categoryOrder';

export interface PlotlyLabelConfig {
  showLabels: boolean;
  maxLabels: number;
  labels: string[];
  data: Array<{ x: number; y: number; index?: number }>;
}

/**
 * Calculate which points should have labels based on distance from origin
 * This preserves the beloved smart label selection feature from the original implementation
 */
export function calculatePlotlyLabels(config: PlotlyLabelConfig): string[] {
  const { showLabels, maxLabels, labels, data } = config;

  if (!showLabels || !labels || labels.length === 0) {
    return data.map(() => '');
  }

  // Calculate distances and sort to find extreme points
  const pointsWithDistance = data.map((point, idx) => ({
    index: point.index ?? idx,
    distance: Math.sqrt(point.x ** 2 + point.y ** 2)
  }));

  // Sort by distance and get top N
  const topIndices = new Set(
    pointsWithDistance
      .sort((a, b) => b.distance - a.distance)
      .slice(0, maxLabels)
      .map(p => p.index)
  );

  // Return labels for top points only
  return data.map((_, idx) =>
    topIndices.has(idx) && labels[idx] ? labels[idx] : ''
  );
}

/**
 * Get text position based on point quadrant to avoid overlaps
 */
export function getPlotlyTextPosition(x: number, y: number): string {
  if (x >= 0 && y >= 0) {
return 'top right';
}
  if (x < 0 && y >= 0) {
return 'top left';
}
  if (x < 0 && y < 0) {
return 'bottom left';
}
  return 'bottom right';
}

/**
 * Generate ellipse trace for confidence intervals
 */
export function generateEllipseTrace(
  params: EllipseParams,
  color: string,
  name?: string
): Partial<Data> {
  const { centerX, centerY, majorAxis, minorAxis, angle } = params;
  const steps = 50;
  const points: { x: number[]; y: number[] } = { x: [], y: [] };

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    // Ellipse in local coordinates
    const localX = majorAxis * Math.cos(t);
    const localY = minorAxis * Math.sin(t);

    // Apply rotation
    const rotatedX = localX * Math.cos(angle) - localY * Math.sin(angle);
    const rotatedY = localX * Math.sin(angle) + localY * Math.cos(angle);

    // Translate to center
    points.x.push(centerX + rotatedX);
    points.y.push(centerY + rotatedY);
  }

  return {
    x: points.x,
    y: points.y,
    mode: 'lines',
    line: {
      color,
      width: 2,
      dash: 'dash'
    },
    showlegend: false,
    hoverinfo: 'skip',
    name: name || 'Confidence Ellipse',
    type: 'scatter'
  };
}

/**
 * Convert hex color to rgba with opacity
 */
export function hexToRgba(hex: string, opacity: number = 1): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
return hex;
}

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get color palette for categorical data
 */
export const COLOR_PALETTES = {
  default: [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
  ],
  colorblindSafe: [
    '#0173B2', '#DE8F05', '#029E73', '#CC78BC', '#ECE133',
    '#56B4E9', '#F0E442', '#D55E00', '#009E73', '#999999'
  ],
  pastel: [
    '#a8dadc', '#f1faee', '#ffd6a5', '#ff9999', '#c9ada7',
    '#b8bedd', '#f2cc8f', '#81b29a', '#e07a5f', '#ddbea9'
  ]
};

export function getColorFromPalette(
  palette: keyof typeof COLOR_PALETTES,
  index: number
): string {
  const colors = COLOR_PALETTES[palette] || COLOR_PALETTES.default;
  return colors[index % colors.length];
}

/**
 * Format axis label with variance percentage
 */
export function formatAxisLabel(label: string, variance?: number): string {
  if (variance !== undefined) {
    return `${label} (${variance.toFixed(1)}%)`;
  }
  return label;
}

/**
 * Create a unit circle for correlation plots
 */
export function createUnitCircle(color: string = '#666666'): Partial<Data> {
  const steps = 100;
  const x: number[] = [];
  const y: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    x.push(Math.cos(angle));
    y.push(Math.sin(angle));
  }

  return {
    x,
    y,
    mode: 'lines',
    line: {
      color,
      width: 1,
      dash: 'dot'
    },
    showlegend: false,
    hoverinfo: 'skip',
    type: 'scatter'
  };
}

/**
 * Interpolate between colors in a palette for continuous data
 * @param value - The normalized value between 0 and 1
 * @param palette - Array of color strings to interpolate between
 * @returns Interpolated color string
 */
export function interpolateColor(value: number, palette: string[]): string {
  if (!palette || palette.length === 0) {
return '#808080';
}
  if (palette.length === 1) {
return palette[0];
}

  // Clamp value between 0 and 1
  const normalizedValue = Math.max(0, Math.min(1, value));

  // Calculate position in palette
  const scaledValue = normalizedValue * (palette.length - 1);
  const lowerIndex = Math.floor(scaledValue);
  const upperIndex = Math.ceil(scaledValue);
  const fraction = scaledValue - lowerIndex;

  // If exact match, return the color
  if (lowerIndex === upperIndex) {
    return palette[lowerIndex];
  }

  // Parse colors and interpolate
  const lowerColor = parseColor(palette[lowerIndex]);
  const upperColor = parseColor(palette[upperIndex]);

  const r = Math.round(lowerColor.r + (upperColor.r - lowerColor.r) * fraction);
  const g = Math.round(lowerColor.g + (upperColor.g - lowerColor.g) * fraction);
  const b = Math.round(lowerColor.b + (upperColor.b - lowerColor.b) * fraction);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Parse a color string to RGB components
 */
function parseColor(color: string): { r: number; g: number; b: number } {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.substring(1);
    const bigint = parseInt(hex, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  // Handle rgb/rgba colors
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3])
    };
  }

  // Default gray if parsing fails
  return { r: 128, g: 128, b: 128 };
}

/**
 * Get color for a continuous value using a sequential palette
 * @param value - The actual data value
 * @param min - Minimum value in the data range
 * @param max - Maximum value in the data range
 * @param palette - Sequential color palette
 * @returns Color string for the value
 */
export function getSequentialColor(
  value: number | null | undefined,
  min: number,
  max: number,
  palette: string[]
): string {
  // Handle missing values
  if (value === null || value === undefined || !isFinite(value)) {
    return '#9CA3AF'; // Gray for missing values
  }

  // Handle edge case where min equals max
  if (min === max) {
    return interpolateColor(0.5, palette);
  }

  // Normalize value to 0-1 range
  const normalized = (value - min) / (max - min);
  return interpolateColor(normalized, palette);
}

/**
 * Map categorical groups to colors from a qualitative palette
 * @param groups - Array of group labels
 * @param palette - Qualitative color palette
 * @returns Map of group to color
 */
export function createColorMap(
  groups: string[],
  palette: string[]
): Map<string, string> {
  const uniqueGroups = uniqueCategoryLevels(groups);
  const colorMap = new Map<string, string>();

  uniqueGroups.forEach((group, index) => {
    colorMap.set(group, palette[index % palette.length]);
  });

  // Add special color for missing values
  colorMap.set('Missing', '#9CA3AF');

  return colorMap;
}