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

export interface FileData {
  headers: string[];
  rowNames: string[];
  // Names the column the row names were taken from. The first column is always
  // taken, whatever it holds, so this is how the UI can say which variable was
  // consumed (#969). Empty when the file used the blank-header convention.
  rowNamesHeader?: string;
  data: number[][];
  missingMask?: boolean[][];
  categoricalColumns?: {
    [columnName: string]: string[];  // Column name -> array of values for each row
  };
  numericTargetColumns?: {
    [columnName: string]: number[];  // Column name -> array of numeric values for each row
  };
}

export interface PCARequest {
  data: number[][];
  missingMask?: boolean[][];
  headers: string[];
  rowNames: string[];
  components: number;
  meanCenter: boolean;
  standardScale: boolean;
  robustScale: boolean;
  scaleOnly: boolean;
  snv: boolean;
  vectorNorm: boolean;
  // Savitzky-Golay: window of 0 means no filter. Field names must match the
  // json tags on PCARequest in cmd/gopca-desktop/app.go.
  savgolWindow?: number;
  savgolPolyOrder?: number;
  savgolDeriv?: number;
  method: string;
  excludedRows?: number[];
  excludedColumns?: number[];
  missingStrategy?: string;
  // Kernel PCA parameters
  kernelType?: string;
  kernelGamma?: number;
  kernelDegree?: number;
  kernelCoef0?: number;
  // Grouping parameters for confidence ellipses
  groupColumn?: string;
  groupLabels?: string[];
  // Metadata for eigencorrelations
  metadataNumeric?: { [key: string]: number[] };
  metadataCategorical?: { [key: string]: string[] };
  calculateEigencorrelations?: boolean;
}

export interface PCAResult {
  scores: number[][];
  loadings: number[][];
  /**
   * Pearson correlation of each variable with each component, [variables][components].
   * Distinct from loadings by a factor of sqrt(eigenvalue)/sd -- see issue #793.
   * Absent for kernel PCA and for NIPALS with native missing values.
   */
  variable_correlations?: number[][];
  explained_variance: number[];
  explained_variance_ratio: number[];
  /**
   * The eigenvalue array, which may reach past the components kept.
   *
   * Lets the Kaiser criterion reach a verdict rather than a floor: counting
   * over the retained components alone cannot tell "the 10th is the last
   * above 1" from "the 10th is where we stopped looking" (#956).
   *
   * Only SVD fills it with actual eigenvalues throughout. NIPALS pads the tail
   * with the residual variance spread evenly across the remaining components,
   * and kernel PCA's eigenvalues belong to the kernel matrix rather than to the
   * variables, so neither tail can be thresholded at 1. Consumers must check
   * `method` before using anything past `components_computed`.
   */
  all_eigenvalues?: number[];
  cumulative_variance: number[];
  component_labels: string[];
  variable_labels?: string[];
  components_computed: number;
  method: string;
  preprocessing_applied: boolean;
  means?: number[];
  stddevs?: number[];
  metrics?: SampleMetrics[];
  t2_limit_95?: number;
  t2_limit_99?: number;
  q_limit_95?: number;
  q_limit_99?: number;
  eigencorrelations?: EigencorrelationResult;
  temporal_eigenvectors?: number[][];  // U matrix for temporal PCA (lags × components)
  temporal_variable_importance?: number[][];  // Variable importance for temporal PCA (components × variables)
  // Kernel PCA specific fields
  kernel_type?: string;
  kernel_params?: { [key: string]: number };
  kernel_matrix?: number[][];
  kernel_eigenvectors?: number[][];
}

export interface EigencorrelationResult {
  correlations: { [variable: string]: number[] };
  pValues: { [variable: string]: number[] };
  variables: string[];
  components: string[];
  method: string;
}

export interface SampleMetrics {
  hotelling_t2: number;
  mahalanobis: number;
  rss: number;
  is_outlier: boolean;
}

export interface EllipseParams {
  centerX: number;
  centerY: number;
  majorAxis: number;
  minorAxis: number;
  angle: number;
  confidenceLevel: number;
}

export interface PCAResponse {
  success: boolean;
  error?: string;
  result?: PCAResult;
  info?: string;
  groupEllipses90?: Record<string, EllipseParams>;
  groupEllipses95?: Record<string, EllipseParams>;
  groupEllipses99?: Record<string, EllipseParams>;
  // Filtered categorical and numeric columns after rows are dropped
  // These ensure proper alignment with the reduced scores matrix
  filteredCategoricalColumns?: Record<string, string[]>;
  filteredNumericTargetColumns?: Record<string, number[]>;
}