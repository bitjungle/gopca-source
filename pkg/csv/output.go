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

package csv

import (
	"time"

	"github.com/bitjungle/gopca/internal/core"
	"github.com/bitjungle/gopca/internal/version"
	"github.com/bitjungle/gopca/pkg/types"
	"github.com/google/uuid"
)

// ExportMetadata contains optional metadata for PCA export
type ExportMetadata struct {
	InputFilename string   // Original input file name
	Description   string   // User-provided description
	Tags          []string // User-defined tags
}

// ConvertToPCAOutputData converts PCAResult and Data to PCAOutputData for export
// This function is shared between CLI and Desktop applications
func ConvertToPCAOutputData(result *types.PCAResult, data *Data, preprocessedData types.Matrix, includeMetrics bool,
	config types.PCAConfig, preprocessor *core.Preprocessor,
	categoricalData map[string][]string, targetData map[string][]float64) *types.PCAOutputData {
	return ConvertToPCAOutputDataWithMetadata(result, data, preprocessedData, includeMetrics, config,
		preprocessor, categoricalData, targetData, nil)
}

// ConvertToPCROutputData builds an exportable model from a principal component
// regression fit.
//
// It reuses the PCA converter and attaches the regression block, so the two model
// kinds share one artifact format. A consumer that only understands the
// decomposition can ignore the extra block and still read the file, and
// pca transform gains predictions from the same model it already loads.
func ConvertToPCROutputData(result *types.PCRResult, data *Data, includeMetrics bool,
	config types.PCAConfig, preprocessor *core.Preprocessor,
	categoricalData map[string][]string, targetData map[string][]float64,
	exportMeta *ExportMetadata) *types.PCAOutputData {

	output := ConvertToPCAOutputDataWithMetadata(result.PCA, data, result.PCA.PreprocessedData,
		includeMetrics, config, preprocessor, categoricalData, targetData, exportMeta)

	output.Regression = &types.RegressionModel{
		Response:           result.Response,
		Components:         result.Components,
		ScoreCoefficients:  result.ScoreCoefficients,
		Intercept:          result.Intercept,
		Coefficients:       result.Coefficients,
		InterceptOriginal:  result.InterceptOriginal,
		OriginalScaleValid: result.OriginalScaleValid,
		ResponseMean:       result.ResponseMean,
		RMSEC:              result.RMSEC,
		R2C:                result.R2C,
		Validation:         result.CV,
	}
	return output
}

// ConvertToPCAOutputDataWithMetadata converts PCAResult and Data to PCAOutputData with optional metadata
func ConvertToPCAOutputDataWithMetadata(result *types.PCAResult, data *Data, preprocessedData types.Matrix, includeMetrics bool,
	config types.PCAConfig, preprocessor *core.Preprocessor,
	categoricalData map[string][]string, targetData map[string][]float64,
	exportMeta *ExportMetadata) *types.PCAOutputData {

	// Create timestamp
	createdAt := time.Now().Format(time.RFC3339)

	// Generate unique analysis ID
	analysisID := uuid.New().String()

	// Create data source info if we have the data
	var dataSource *types.DataSource
	if exportMeta != nil && exportMeta.InputFilename != "" {
		dataSource = &types.DataSource{
			Filename:      exportMeta.InputFilename,
			NRowsOriginal: data.Rows,
			NColsOriginal: data.Columns,
		}
	}

	// Add optional metadata if provided
	var description string
	var tags []string
	if exportMeta != nil {
		description = exportMeta.Description
		tags = exportMeta.Tags
	}

	// Create model metadata
	// Use the actual method from the result, not the config
	metadata := types.ModelMetadata{
		AnalysisID:      analysisID,
		SoftwareVersion: version.Version, // Use actual GoPCA version
		CreatedAt:       createdAt,
		Software:        "gopca",
		DataSource:      dataSource,
		Description:     description,
		Tags:            tags,
		Config: types.ModelConfig{
			Method:          result.Method,             // Use actual method from result
			NComponents:     result.ComponentsComputed, // Use actual components computed
			MissingStrategy: config.MissingStrategy,
			ExcludedRows:    config.ExcludedRows,
			ExcludedColumns: config.ExcludedColumns,
		},
	}

	// Only include kernel parameters for kernel PCA
	if result.Method == "kernel" {
		metadata.Config.KernelType = config.KernelType
		// Only include relevant parameters based on kernel type
		switch config.KernelType {
		case "rbf":
			metadata.Config.KernelGamma = config.KernelGamma
		case "poly", "polynomial":
			metadata.Config.KernelGamma = config.KernelGamma
			metadata.Config.KernelDegree = config.KernelDegree
			metadata.Config.KernelCoef0 = config.KernelCoef0
			// For linear kernel, only kernel_type is needed
		}
	}

	// Create preprocessing info.
	//
	// The column-statistic booleans record what the preprocessor ACTUALLY did,
	// not what was requested. Those differ: Transform takes one of three
	// branches in precedence order, so asking for mean centering alongside
	// robust or scale-only scaling has no effect on the data. Recording the
	// request made the artifact claim a centering that never happened, and --
	// for robust scaling without --no-mean-centering -- deny one that did
	// (#987).
	//
	// The preprocessor is the only thing that knows which branch it takes, so
	// it is asked rather than the branch being re-derived here. A second copy
	// of the precedence is exactly how this went wrong the first time.
	//
	// Row-wise flags need no such treatment: SNV, vector normalization and
	// Savitzky-Golay are applied whenever configured, so requested and applied
	// already coincide.
	applied := appliedColumnStats(config, preprocessor)

	preprocessingInfo := types.PreprocessingInfo{
		MeanCenter:    applied.MeanCenter,
		StandardScale: applied.StandardScale,
		RobustScale:   applied.RobustScale,
		ScaleOnly:     applied.ScaleOnly,
		SNV:           config.SNV,
		VectorNorm:    config.VectorNorm,
		// Recorded so `pca transform` rebuilds the same filter. These travel as
		// settings rather than as fitted parameters because the operator is
		// determined by them and the variable count alone.
		SavGolWindow:    config.SavGolWindow,
		SavGolPolyOrder: config.SavGolPolyOrder,
		SavGolDeriv:     config.SavGolDeriv,
		Parameters:      types.PreprocessingParams{},
	}

	// Add preprocessing parameters if preprocessor was used
	if preprocessor != nil {
		preprocessingInfo.Parameters.FeatureMeans = preprocessor.GetMeans()
		preprocessingInfo.Parameters.FeatureStdDevs = preprocessor.GetStdDevs()
		preprocessingInfo.Parameters.FeatureMedians = preprocessor.GetMedians()
		preprocessingInfo.Parameters.FeatureMADs = preprocessor.GetMADs()
		preprocessingInfo.Parameters.RowMeans = preprocessor.GetRowMeans()
		preprocessingInfo.Parameters.RowStdDevs = preprocessor.GetRowStdDevs()
	}

	// Create model components
	// Use VariableLabels from result if available (e.g., for temporal PCA lag labels)
	// Otherwise fall back to original data headers
	featureLabels := data.Headers
	if len(result.VariableLabels) > 0 {
		featureLabels = result.VariableLabels
	}

	modelComponents := types.ModelComponents{
		Loadings:               result.Loadings,
		ExplainedVariance:      result.ExplainedVar,
		ExplainedVarianceRatio: result.ExplainedVarRatio,
		CumulativeVariance:     result.CumulativeVar,
		ComponentLabels:        result.ComponentLabels,
		FeatureLabels:          featureLabels,
	}

	// Create results data.
	//
	// Temporal PCA produces one score row per sliding window, T-L+1 of them,
	// while RowNames still has one entry per input row. Window i begins at input
	// row i, so the first len(Scores) names are the right labels and the last
	// L-1 are surplus. Trim them: an exported model that claims 14,976 sample
	// names for 14,945 score rows is internally inconsistent, and a downstream
	// consumer zipping the two arrays has no way to know which end to drop.
	sampleNames := data.RowNames
	if len(sampleNames) > len(result.Scores) {
		sampleNames = sampleNames[:len(result.Scores)]
	}

	resultsData := types.ResultsData{
		Samples: types.SamplesResults{
			Names:  sampleNames,
			Scores: result.Scores,
		},
	}

	// Add metrics if requested (skip for kernel PCA as it doesn't have loadings)
	if includeMetrics && result.Method != "kernel" && preprocessedData != nil {
		metrics, err := core.CalculateMetricsFromPCAResult(result, preprocessedData)
		if err == nil && metrics != nil {
			metricsData := &types.MetricsData{
				HotellingT2: make([]float64, len(metrics)),
				Mahalanobis: make([]float64, len(metrics)),
				RSS:         make([]float64, len(metrics)),
				IsOutlier:   make([]bool, len(metrics)),
			}
			for i, m := range metrics {
				metricsData.HotellingT2[i] = m.HotellingT2
				metricsData.Mahalanobis[i] = m.Mahalanobis
				metricsData.RSS[i] = m.RSS
				metricsData.IsOutlier[i] = m.IsOutlier
			}
			resultsData.Samples.Metrics = metricsData
		}
	} else if includeMetrics && result.Method == "kernel" {
		// For kernel PCA, we can't calculate RSS but we can still calculate some metrics if we have them in the result
		if len(result.Metrics) > 0 {
			metricsData := &types.MetricsData{
				HotellingT2: make([]float64, len(result.Metrics)),
				Mahalanobis: make([]float64, len(result.Metrics)),
				RSS:         make([]float64, len(result.Metrics)),
				IsOutlier:   make([]bool, len(result.Metrics)),
			}
			for i, m := range result.Metrics {
				metricsData.HotellingT2[i] = m.HotellingT2
				metricsData.Mahalanobis[i] = m.Mahalanobis
				metricsData.RSS[i] = m.RSS
				metricsData.IsOutlier[i] = m.IsOutlier
			}
			resultsData.Samples.Metrics = metricsData
		}
	}

	// Create diagnostic limits
	diagnostics := types.DiagnosticLimits{
		T2Limit95: result.T2Limit95,
		T2Limit99: result.T2Limit99,
		QLimit95:  result.QLimit95,
		QLimit99:  result.QLimit99,
	}

	// Add preserved columns if provided
	var preservedColumns *types.PreservedColumns
	if len(categoricalData) > 0 || len(targetData) > 0 {
		preservedColumns = &types.PreservedColumns{
			Categorical:   categoricalData,
			NumericTarget: types.ConvertFloat64MapToJSON(targetData),
		}
	}

	return &types.PCAOutputData{
		Schema:            schemaURL,
		Metadata:          metadata,
		Preprocessing:     preprocessingInfo,
		Model:             modelComponents,
		Results:           resultsData,
		Diagnostics:       diagnostics,
		Eigencorrelations: result.Eigencorrelations,
		PreservedColumns:  preservedColumns,
	}
}

// schemaURL is the $schema every model file declares.
//
// It points at a URL that serves the document. The v1 identifier,
// github.com/bitjungle/gopca/schemas/v1/..., is a web UI path rather than a
// content path and returns 404, so any consumer following $schema to validate
// our output failed (#848). Our own validator never noticed because it loads the
// schemas from an embedded copy.
const schemaURL = "https://raw.githubusercontent.com/bitjungle/gopca/main/schemas/v2/pca-output.schema.json"

// appliedColumnStats reports the column-wise transformation that was actually
// performed. It delegates to the preprocessor, which owns the precedence.
//
// When no preprocessor was fitted -- a model with no column-wise preprocessing
// at all -- there is nothing to ask, and the config is reported as given. In
// that case no branch was taken, so the two cannot disagree.
func appliedColumnStats(config types.PCAConfig, preprocessor *core.Preprocessor) core.AppliedColumnStats {
	if preprocessor == nil {
		return core.AppliedColumnStats{
			MeanCenter:    config.MeanCenter,
			StandardScale: config.StandardScale,
			RobustScale:   config.RobustScale,
			ScaleOnly:     config.ScaleOnly,
		}
	}
	return preprocessor.AppliedColumnStatistics()
}
