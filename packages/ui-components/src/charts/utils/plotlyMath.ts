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

// Mathematical utilities for Plotly visualizations with academic references

export interface Point2D {
  x: number;
  y: number;
}

export interface EllipseParams {
  centerX: number;
  centerY: number;
  majorAxis: number;
  minorAxis: number;
  angle: number; // in radians
}

/**
 * Calculate confidence ellipse parameters using chi-square distribution
 * Reference: Johnson & Wichern (2007), Applied Multivariate Statistical Analysis, Ch. 4
 *
 * @param points - Bivariate data points
 * @param confidence - Confidence level (0.90, 0.95, 0.99)
 * @returns Ellipse parameters (center, axes, angle)
 *
 * Algorithm complexity: O(n) where n is the number of data points
 */
export function calculateConfidenceEllipse(
  points: Point2D[],
  confidence: number = 0.95
): EllipseParams {
  // Calculate mean
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;

  // Calculate covariance matrix elements
  let cov_xx = 0, cov_yy = 0, cov_xy = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    cov_xx += dx * dx;
    cov_yy += dy * dy;
    cov_xy += dx * dy;
  }
  cov_xx /= (n - 1);
  cov_yy /= (n - 1);
  cov_xy /= (n - 1);

  // Eigendecomposition of 2x2 covariance matrix
  // Reference: Johnson & Wichern (2007), Equation 4.8
  const trace = cov_xx + cov_yy;
  const det = cov_xx * cov_yy - cov_xy * cov_xy;
  const discriminant = Math.sqrt(Math.max(0, trace * trace - 4 * det));

  const eigenvalue1 = (trace + discriminant) / 2;
  const eigenvalue2 = (trace - discriminant) / 2;

  // Angle of rotation (principal axis)
  const angle = Math.atan2(2 * cov_xy, cov_xx - cov_yy) / 2;

  // Chi-square critical value for 2 degrees of freedom
  const chiSquare = getChiSquareCritical(confidence, 2);

  // Ellipse axes lengths
  const majorAxis = 2 * Math.sqrt(chiSquare * Math.max(eigenvalue1, eigenvalue2));
  const minorAxis = 2 * Math.sqrt(chiSquare * Math.min(eigenvalue1, eigenvalue2));

  return {
    centerX: meanX,
    centerY: meanY,
    majorAxis,
    minorAxis,
    angle
  };
}

/**
 * Get chi-square critical value
 * Reference: Johnson & Wichern (2007), Table 3 in Appendix
 */
export function getChiSquareCritical(confidence: number, df: number): number {
  // Chi-square critical values for df=2
  const chiSquareTable: Record<number, number> = {
    0.90: 4.605,
    0.95: 5.991,
    0.99: 9.210
  };

  if (df !== 2) {
    console.warn('Chi-square values only implemented for df=2');
  }

  return chiSquareTable[confidence] || chiSquareTable[0.95];
}

/**
 * Generate ellipse path points for plotting
 * @param params - Ellipse parameters
 * @param numPoints - Number of points to generate (default 100)
 * @returns Array of points forming the ellipse
 */
export function generateEllipsePath(
  params: EllipseParams,
  numPoints: number = 100
): Point2D[] {
  const points: Point2D[] = [];
  const angleStep = (2 * Math.PI) / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    const theta = i * angleStep;

    // Point on standard ellipse
    const x0 = (params.majorAxis / 2) * Math.cos(theta);
    const y0 = (params.minorAxis / 2) * Math.sin(theta);

    // Rotate by angle
    const cos_a = Math.cos(params.angle);
    const sin_a = Math.sin(params.angle);
    const x = x0 * cos_a - y0 * sin_a + params.centerX;
    const y = x0 * sin_a + y0 * cos_a + params.centerY;

    points.push({ x, y });
  }

  return points;
}

/**
 * Calculate smart labels - select points furthest from origin
 * This preserves the smart label selection feature from the previous implementation
 *
 * @param points - Data points
 * @param maxLabels - Maximum number of labels to show
 * @returns Indices of points to label
 */
export function calculateSmartLabels(
  points: Point2D[],
  maxLabels: number = 10
): number[] {
  // Calculate distances from origin
  const distances = points.map((p, i) => ({
    index: i,
    distance: Math.sqrt(p.x * p.x + p.y * p.y)
  }));

  // Sort by distance and take the top N distinct positions.
  distances.sort((a, b) => b.distance - a.distance);

  // One label per coordinate. Rows that repeat another row's values produce
  // bit-identical scores, and the furthest points from the origin are often
  // exactly those stacks -- so taking the top N indices drew several labels on
  // one pixel as an unreadable smear and left the rest of the plot bare. On
  // al_alloy "Max labels: 10" bought five readable labels (#1017). The key is
  // exact equality on purpose: thinning *near* neighbours would be a different
  // feature, and the duplicates this is for are identical, not close.
  const taken = new Set<string>();
  const selected: number[] = [];
  for (const { index } of distances) {
    if (selected.length >= maxLabels) {
      break;
    }
    const key = `${points[index].x},${points[index].y}`;
    if (taken.has(key)) {
      continue;
    }
    taken.add(key);
    selected.push(index);
  }
  return selected;
}

// Alias for consistency
export const selectSmartLabels = calculateSmartLabels;

/**
 * 2D Kernel Density Estimation using Gaussian kernel
 * Reference: Scott (1992), "Multivariate Density Estimation", Wiley
 *
 * @param points - Data points
 * @param bandwidth - Bandwidth parameter ('scott', 'silverman', or numeric)
 * @param gridSize - Grid resolution (default 50x50)
 * @returns Density grid for contour plotting
 */
export function kernelDensityEstimate2D(
  points: Point2D[],
  bandwidth: 'scott' | 'silverman' | number = 'scott',
  gridSize: number = 50
): { x: number[], y: number[], z: number[][] } {
  const n = points.length;

  // Calculate bandwidth using Scott's or Silverman's rule
  let h: number;
  if (bandwidth === 'scott') {
    // Scott's rule: h = n^(-1/6) * std
    const stdX = calculateStandardDeviation(points.map(p => p.x));
    const stdY = calculateStandardDeviation(points.map(p => p.y));
    h = Math.pow(n, -1/6) * Math.sqrt(stdX * stdY);
  } else if (bandwidth === 'silverman') {
    // Silverman's rule: h = 0.9 * min(std, IQR/1.34) * n^(-1/5)
    const stdX = calculateStandardDeviation(points.map(p => p.x));
    const stdY = calculateStandardDeviation(points.map(p => p.y));
    h = 0.9 * Math.sqrt(stdX * stdY) * Math.pow(n, -1/5);
  } else {
    h = bandwidth;
  }

  // Create grid
  const xMin = Math.min(...points.map(p => p.x)) - 3 * h;
  const xMax = Math.max(...points.map(p => p.x)) + 3 * h;
  const yMin = Math.min(...points.map(p => p.y)) - 3 * h;
  const yMax = Math.max(...points.map(p => p.y)) + 3 * h;

  const xStep = (xMax - xMin) / gridSize;
  const yStep = (yMax - yMin) / gridSize;

  const x = Array.from({ length: gridSize }, (_, i) => xMin + i * xStep);
  const y = Array.from({ length: gridSize }, (_, i) => yMin + i * yStep);
  const z: number[][] = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));

  // Calculate density at each grid point
  const norm = 1 / (2 * Math.PI * h * h * n);

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      let density = 0;
      for (const point of points) {
        const dx = (x[j] - point.x) / h;
        const dy = (y[i] - point.y) / h;
        const dist2 = dx * dx + dy * dy;
        density += Math.exp(-0.5 * dist2);
      }
      z[i][j] = density * norm;
    }
  }

  return { x, y, z };
}

/**
 * Calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}
