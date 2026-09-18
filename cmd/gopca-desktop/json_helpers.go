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

package main

import (
	"math"

	"github.com/bitjungle/gopca/pkg/types"
)

// FileDataJSON is a JSON-safe version of FileData
type FileDataJSON struct {
	Headers              []string                       `json:"headers"`
	RowNames             []string                       `json:"rowNames"`
	RowNamesHeader       string                         `json:"rowNamesHeader,omitempty"`
	Data                 [][]types.JSONFloat64          `json:"data"`
	MissingMask          [][]bool                       `json:"missingMask,omitempty"`
	CategoricalColumns   map[string][]string            `json:"categoricalColumns,omitempty"`
	NumericTargetColumns map[string][]types.JSONFloat64 `json:"numericTargetColumns,omitempty"`
}

// ToJSONSafe converts FileData to a JSON-safe version with optimized performance.
//
// Performance optimization: This method uses a two-pass approach to avoid unnecessary
// memory allocations for the missing value mask. For large datasets without missing
// values (like MET with ~100,000 data points), this avoids allocating ~100,000 booleans.
//
// Pass 1: Quick scan to detect if any NaN values exist (can exit early on first NaN)
// Pass 2: Convert data and only build missing mask if needed
//
// The extra pass is worth it because memory allocation is expensive, especially for
// large datasets where the missing mask would consume significant memory unnecessarily.
func (fd *FileData) ToJSONSafe() *FileDataJSON {
	if fd == nil {
		return nil
	}

	// First pass: check if we have any missing values at all
	// This prevents unnecessary allocation for the missing mask
	hasMissing := false
	for i := range fd.Data {
		for j := range fd.Data[i] {
			if math.IsNaN(fd.Data[i][j]) {
				hasMissing = true
				break
			}
		}
		if hasMissing {
			break
		}
	}

	// Second pass: convert float64 data to types.JSONFloat64
	jsonData := make([][]types.JSONFloat64, len(fd.Data))
	var missingMask [][]bool

	// Only allocate missing mask if we actually have missing values
	// This is the key optimization for large datasets without missing values
	if hasMissing {
		missingMask = make([][]bool, len(fd.Data))
	}

	for i, row := range fd.Data {
		jsonData[i] = make([]types.JSONFloat64, len(row))
		if hasMissing {
			missingMask[i] = make([]bool, len(row))
		}

		// Convert row data
		for j, val := range row {
			jsonData[i][j] = types.JSONFloat64(val)
			if hasMissing && math.IsNaN(val) {
				missingMask[i][j] = true
			}
		}
	}

	result := &FileDataJSON{
		Headers:            fd.Headers,
		RowNames:           fd.RowNames,
		RowNamesHeader:     fd.RowNamesHeader,
		Data:               jsonData,
		CategoricalColumns: fd.CategoricalColumns,
	}

	// Only include missing mask if there are missing values
	if hasMissing {
		result.MissingMask = missingMask
	}

	// Convert numeric target columns to JSON-safe format
	if len(fd.NumericTargetColumns) > 0 {
		result.NumericTargetColumns = make(map[string][]types.JSONFloat64)
		for colName, values := range fd.NumericTargetColumns {
			jsonValues := make([]types.JSONFloat64, len(values))
			for i, val := range values {
				jsonValues[i] = types.JSONFloat64(val)
			}
			result.NumericTargetColumns[colName] = jsonValues
		}
	}

	return result
}

// PCAResultJSON is a JSON-safe version of types.PCAResult
type PCAResultJSON struct {
	Scores                     [][]types.JSONFloat64       `json:"scores"`
	Loadings                   [][]types.JSONFloat64       `json:"loadings"`
	ExplainedVar               []types.JSONFloat64         `json:"explained_variance"`
	ExplainedVarRatio          []types.JSONFloat64         `json:"explained_variance_ratio"`
	CumulativeVar              []types.JSONFloat64         `json:"cumulative_variance"`
	ComponentLabels            []string                    `json:"component_labels"`
	VariableLabels             []string                    `json:"variable_labels,omitempty"`
	ComponentsComputed         int                         `json:"components_computed"`
	Method                     string                      `json:"method"`
	PreprocessingApplied       bool                        `json:"preprocessing_applied"`
	Means                      []types.JSONFloat64         `json:"means,omitempty"`
	StdDevs                    []types.JSONFloat64         `json:"stddevs,omitempty"`
	Metrics                    []SampleMetricsJSON         `json:"metrics,omitempty"`
	T2Limit95                  types.JSONFloat64           `json:"t2_limit_95,omitempty"`
	T2Limit99                  types.JSONFloat64           `json:"t2_limit_99,omitempty"`
	QLimit95                   types.JSONFloat64           `json:"q_limit_95,omitempty"`
	QLimit99                   types.JSONFloat64           `json:"q_limit_99,omitempty"`
	VariableCorrelations       [][]types.JSONFloat64       `json:"variable_correlations,omitempty"`
	Eigencorrelations          *EigencorrelationResultJSON `json:"eigencorrelations,omitempty"`
	AllEigenvalues             []types.JSONFloat64         `json:"all_eigenvalues,omitempty"`
	TemporalEigenvectors       [][]types.JSONFloat64       `json:"temporal_eigenvectors,omitempty"`
	TemporalVariableImportance [][]types.JSONFloat64       `json:"temporal_variable_importance,omitempty"`
	// Kernel PCA specific fields
	KernelType         string                       `json:"kernel_type,omitempty"`
	KernelParams       map[string]types.JSONFloat64 `json:"kernel_params,omitempty"`
	KernelMatrix       [][]types.JSONFloat64        `json:"kernel_matrix,omitempty"`
	KernelEigenvectors [][]types.JSONFloat64        `json:"kernel_eigenvectors,omitempty"`
}

// EigencorrelationResultJSON is a JSON-safe version of types.EigencorrelationResult
type EigencorrelationResultJSON struct {
	Correlations map[string][]types.JSONFloat64 `json:"correlations"`
	PValues      map[string][]types.JSONFloat64 `json:"pValues"`
	Variables    []string                       `json:"variables"`
	Components   []string                       `json:"components"`
	Method       string                         `json:"method"`
}

// SampleMetricsJSON is a JSON-safe version of types.SampleMetrics
type SampleMetricsJSON struct {
	HotellingT2 types.JSONFloat64 `json:"hotelling_t2"`
	Mahalanobis types.JSONFloat64 `json:"mahalanobis"`
	RSS         types.JSONFloat64 `json:"rss"`
	IsOutlier   bool              `json:"is_outlier"`
}

// ToJSONSafe converts types.PCAResult to a JSON-safe version
func ConvertPCAResultToJSON(result *types.PCAResult) *PCAResultJSON {
	if result == nil {
		return nil
	}

	jsonResult := &PCAResultJSON{
		Scores:               types.ConvertFloat64MatrixToJSON(result.Scores),
		Loadings:             types.ConvertFloat64MatrixToJSON(result.Loadings),
		ExplainedVar:         types.ConvertFloat64SliceToJSON(result.ExplainedVar),
		ExplainedVarRatio:    types.ConvertFloat64SliceToJSON(result.ExplainedVarRatio),
		CumulativeVar:        types.ConvertFloat64SliceToJSON(result.CumulativeVar),
		ComponentLabels:      result.ComponentLabels,
		VariableLabels:       result.VariableLabels,
		ComponentsComputed:   result.ComponentsComputed,
		Method:               result.Method,
		PreprocessingApplied: result.PreprocessingApplied,
		Means:                types.ConvertFloat64SliceToJSON(result.Means),
		StdDevs:              types.ConvertFloat64SliceToJSON(result.StdDevs),
		// Needed by the Circle of Correlations, which must not fall back to
		// loadings (#793). Forgetting it here is why the plot vanished from the
		// menu: the engine produced the correlations, but this struct -- not
		// types.PCAResult -- is what the desktop frontend actually receives.
		VariableCorrelations: types.ConvertFloat64MatrixToJSON(result.VariableCorrelations),
	}

	// Convert metrics if present
	if len(result.Metrics) > 0 {
		jsonResult.Metrics = make([]SampleMetricsJSON, len(result.Metrics))
		for i, metric := range result.Metrics {
			jsonResult.Metrics[i] = SampleMetricsJSON{
				HotellingT2: types.JSONFloat64(metric.HotellingT2),
				Mahalanobis: types.JSONFloat64(metric.Mahalanobis),
				RSS:         types.JSONFloat64(metric.RSS),
				IsOutlier:   metric.IsOutlier,
			}
		}
	}

	// Convert confidence limits
	jsonResult.T2Limit95 = types.JSONFloat64(result.T2Limit95)
	jsonResult.T2Limit99 = types.JSONFloat64(result.T2Limit99)
	jsonResult.QLimit95 = types.JSONFloat64(result.QLimit95)
	jsonResult.QLimit99 = types.JSONFloat64(result.QLimit99)

	// Convert eigencorrelations if present
	if result.Eigencorrelations != nil {
		jsonResult.Eigencorrelations = &EigencorrelationResultJSON{
			Variables:    result.Eigencorrelations.Variables,
			Components:   result.Eigencorrelations.Components,
			Method:       result.Eigencorrelations.Method,
			Correlations: types.ConvertFloat64MapToJSON(result.Eigencorrelations.Correlations),
			PValues:      types.ConvertFloat64MapToJSON(result.Eigencorrelations.PValues),
		}
	}

	// Convert all eigenvalues if present
	jsonResult.AllEigenvalues = types.ConvertFloat64SliceToJSON(result.AllEigenvalues)

	// Convert temporal fields (for temporal PCA)
	jsonResult.TemporalEigenvectors = types.ConvertFloat64MatrixToJSON(result.TemporalEigenvectors)
	jsonResult.TemporalVariableImportance = types.ConvertFloat64MatrixToJSON(result.TemporalVariableImportance)

	// Convert kernel PCA specific fields
	jsonResult.KernelType = result.KernelType
	jsonResult.KernelParams = types.ConvertFloat64ParamsMapToJSON(result.KernelParams)
	jsonResult.KernelMatrix = types.ConvertFloat64MatrixToJSON(result.KernelMatrix)
	jsonResult.KernelEigenvectors = types.ConvertFloat64MatrixToJSON(result.KernelEigenvectors)

	// Convert temporal eigenvectors if present (for temporal PCA)
	if len(result.TemporalEigenvectors) > 0 {
		jsonResult.TemporalEigenvectors = make([][]types.JSONFloat64, len(result.TemporalEigenvectors))
		for i, row := range result.TemporalEigenvectors {
			jsonResult.TemporalEigenvectors[i] = make([]types.JSONFloat64, len(row))
			for j, val := range row {
				jsonResult.TemporalEigenvectors[i][j] = types.JSONFloat64(val)
			}
		}
	}

	// Convert temporal variable importance if present (for temporal PCA)
	if len(result.TemporalVariableImportance) > 0 {
		jsonResult.TemporalVariableImportance = make([][]types.JSONFloat64, len(result.TemporalVariableImportance))
		for i, row := range result.TemporalVariableImportance {
			jsonResult.TemporalVariableImportance[i] = make([]types.JSONFloat64, len(row))
			for j, val := range row {
				jsonResult.TemporalVariableImportance[i][j] = types.JSONFloat64(val)
			}
		}
	}

	// Convert kernel PCA specific fields
	jsonResult.KernelType = result.KernelType

	// Convert kernel parameters if present
	if len(result.KernelParams) > 0 {
		jsonResult.KernelParams = make(map[string]types.JSONFloat64)
		for key, val := range result.KernelParams {
			jsonResult.KernelParams[key] = types.JSONFloat64(val)
		}
	}

	// Convert kernel matrix if present
	if len(result.KernelMatrix) > 0 {
		jsonResult.KernelMatrix = make([][]types.JSONFloat64, len(result.KernelMatrix))
		for i, row := range result.KernelMatrix {
			jsonResult.KernelMatrix[i] = make([]types.JSONFloat64, len(row))
			for j, val := range row {
				jsonResult.KernelMatrix[i][j] = types.JSONFloat64(val)
			}
		}
	}

	// Convert kernel eigenvectors if present
	if len(result.KernelEigenvectors) > 0 {
		jsonResult.KernelEigenvectors = make([][]types.JSONFloat64, len(result.KernelEigenvectors))
		for i, row := range result.KernelEigenvectors {
			jsonResult.KernelEigenvectors[i] = make([]types.JSONFloat64, len(row))
			for j, val := range row {
				jsonResult.KernelEigenvectors[i][j] = types.JSONFloat64(val)
			}
		}
	}

	return jsonResult
}
