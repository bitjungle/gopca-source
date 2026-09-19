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

package cobra

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/bitjungle/gopca/internal/core"
	pkgcsv "github.com/bitjungle/gopca/pkg/csv"
	"github.com/bitjungle/gopca/pkg/types"
	"github.com/bitjungle/gopca/pkg/validation"
	"github.com/spf13/cobra"
)

// TransformOptions holds all the options for the transform command
type TransformOptions struct {
	// Output options
	OutputFormat string
	OutputDir    string

	// Data format options
	NoHeaders bool
	NoIndex   bool
	Delimiter string
	NAValues  string
}

// NewTransformCommand creates the transform subcommand
func NewTransformCommand() *cobra.Command {
	opts := &TransformOptions{}

	cmd := &cobra.Command{
		Use:   "transform [flags] <model.json> <input.csv>",
		Short: "Transform new data using a trained PCA model",
		Long: `Transform new data using a previously trained PCA model.

The transform command applies a saved PCA model to new data, projecting
it into the principal component space. The model must be in JSON format
from a previous analyze command.

EXAMPLES:
  # Transform new data using saved model
  pca transform model.json new_data.csv

  # Transform and save to specific directory
  pca transform -o results/ model.json new_data.csv

  # Transform data with different CSV format
  pca transform --delimiter ";" model.json data.csv`,
		Args: cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runTransform(opts, args[0], args[1])
		},
	}

	// Output options
	cmd.Flags().StringVarP(&opts.OutputFormat, "format", "f", "table",
		"Output format: table, json")
	cmd.Flags().StringVarP(&opts.OutputDir, "output", "o", "",
		"Output directory for results")

	// Data format options
	cmd.Flags().BoolVar(&opts.NoHeaders, "no-headers", false,
		"First row contains data, not column names")
	cmd.Flags().BoolVar(&opts.NoIndex, "no-index", false,
		"First column contains data, not row names")
	cmd.Flags().StringVar(&opts.Delimiter, "delimiter", ",",
		"CSV field delimiter")
	cmd.Flags().StringVar(&opts.NAValues, "na-values", ",NA,N/A,nan,NaN,null,NULL,m",
		"Comma-separated list of strings representing missing values")

	return cmd
}

// runTransform executes the transform command
func runTransform(opts *TransformOptions, modelFile, inputFile string) error {
	// Load the PCA model
	modelData, err := os.ReadFile(modelFile)
	if err != nil {
		return fmt.Errorf("failed to read model file: %w", err)
	}

	// Validate model against schema
	validator, err := validation.NewModelValidator("v1")
	if err != nil {
		// Schema validation not available, continue without validation
		fmt.Fprintf(os.Stderr, "Warning: Schema validation not available: %v\n", err)
	} else {
		if err := validator.ValidateModel(modelData); err != nil {
			return fmt.Errorf("model validation failed: %w", err)
		}
	}

	var pcaOutputData types.PCAOutputData
	if err := json.Unmarshal(modelData, &pcaOutputData); err != nil {
		return fmt.Errorf("failed to parse model JSON: %w", err)
	}

	// Parse CSV options
	parseOpts := pkgcsv.DefaultOptions()
	parseOpts.HasHeaders = !opts.NoHeaders
	parseOpts.HasRowNames = !opts.NoIndex
	parsedDelim, delimErr := parseDelimiter(opts.Delimiter)
	if delimErr != nil {
		return fmt.Errorf("invalid delimiter: %w", delimErr)
	}
	parseOpts.Delimiter = parsedDelim
	// Use ParseMixedWithTargets to properly identify and exclude target columns
	parseOpts.ParseMode = pkgcsv.ParseMixedWithTargets

	// Parse NA values
	if opts.NAValues != "" {
		parseOpts.NullValues = strings.Split(opts.NAValues, ",")
		for i := range parseOpts.NullValues {
			parseOpts.NullValues[i] = strings.TrimSpace(parseOpts.NullValues[i])
		}
	}

	// Load new data
	reader := pkgcsv.NewReader(parseOpts)
	data, err := reader.ReadFile(inputFile)
	if err != nil {
		return fmt.Errorf("failed to parse CSV: %w", err)
	}

	// Validate data
	if err := validateCSVData(data); err != nil {
		return fmt.Errorf("data validation failed: %w", err)
	}

	// Extract feature columns that match the model's feature labels
	// This handles cases where target columns are present in the data
	modelFeatures := pcaOutputData.Model.FeatureLabels

	// Create a map for quick lookup of model feature indices
	modelFeatureMap := make(map[string]int)
	for i, label := range modelFeatures {
		modelFeatureMap[label] = i
	}

	// Find indices of data columns that match model features
	dataColumnIndices := make([]int, 0, len(modelFeatures))
	missingFeatures := make([]string, 0)

	for _, modelFeature := range modelFeatures {
		found := false
		for j, dataHeader := range data.Headers {
			if dataHeader == modelFeature {
				dataColumnIndices = append(dataColumnIndices, j)
				found = true
				break
			}
		}
		if !found {
			missingFeatures = append(missingFeatures, modelFeature)
		}
	}

	// Check if all required features are present
	if len(missingFeatures) > 0 {
		return fmt.Errorf("missing required features in data: %v", missingFeatures)
	}

	// Filter the data matrix to include only the feature columns in the correct order
	filteredMatrix := make([][]float64, len(data.Matrix))
	for i := range data.Matrix {
		filteredMatrix[i] = make([]float64, len(dataColumnIndices))
		for j, colIdx := range dataColumnIndices {
			filteredMatrix[i][j] = data.Matrix[i][colIdx]
		}
	}

	// Update data structure with filtered matrix
	data.Matrix = filteredMatrix
	data.Columns = len(modelFeatures)
	data.Headers = modelFeatures

	// Create preprocessor from saved parameters
	preprocessor, err := preprocessorFromModel(pcaOutputData.Preprocessing)
	if err != nil {
		return err
	}

	// Apply preprocessing
	processedData, err := preprocessor.Transform(data.Matrix)
	if err != nil {
		return fmt.Errorf("preprocessing failed: %w", err)
	}

	// Some methods cannot project new data from the model file alone, and the
	// shape of their stored loadings would otherwise be misread (#809).
	if err := checkTransformSupported(pcaOutputData.Metadata.Config.Method); err != nil {
		return err
	}

	// Project data using loadings
	scores, err := ProjectData(processedData, pcaOutputData.Model.Loadings)
	if err != nil {
		return fmt.Errorf("projection failed: %w", err)
	}

	// Create result structure
	result := &types.PCAResult{
		Scores:          scores,
		Loadings:        pcaOutputData.Model.Loadings,
		ExplainedVar:    pcaOutputData.Model.ExplainedVariance,
		CumulativeVar:   pcaOutputData.Model.CumulativeVariance,
		ComponentLabels: pcaOutputData.Model.ComponentLabels,
		Method:          pcaOutputData.Metadata.Config.Method,
	}

	// Measure each sample against the model before reporting anything about it.
	// A prediction the model has no basis for looks exactly like one it does,
	// and until now nothing here said which was which (#978).
	limits := limitsFrom(pcaOutputData.Diagnostics)
	fits := computeSampleFits(processedData, scores, pcaOutputData.Model.Loadings,
		pcaOutputData.Model.ExplainedVariance, limits)

	// A model carrying a regression block predicts a response as well as
	// projecting, so emit the predictions alongside the scores.
	if pcaOutputData.Regression != nil {
		predictions, err := predictFromModel(pcaOutputData.Regression, scores)
		if err != nil {
			return err
		}
		printTransformPredictions(pcaOutputData.Regression, predictions, data, fits, limits)

		// The file being transformed often carries the response already. Until
		// now it was read and ignored, while `pca regress --help` said RMSEP was
		// "not produced here" -- so the one honest error figure was a column away
		// and uncomputed.
		if measured, ok := measuredResponseFrom(data, pcaOutputData.Regression.Response); ok {
			printPredictionError(predictions, measured, fits, limits)
		}
	}

	// Output results based on format
	switch opts.OutputFormat {
	case "json":
		return outputTransformJSON(result, data, inputFile, opts.OutputDir, fits, limits)
	default: // table
		return outputTransformTable(result, data, fits, limits)
	}
}

// predictFromModel applies a stored regression to freshly projected scores.
//
// The score-space form is used rather than the collapsed original-scale
// coefficients, because it is the one that stays correct under every
// preprocessing option: row-wise transforms have no fixed coefficient vector, and
// the scores handed in have already been through the full pipeline.
func predictFromModel(model *types.RegressionModel, scores types.Matrix) ([]float64, error) {
	k := len(model.ScoreCoefficients)
	if k > 0 && len(scores) > 0 && len(scores[0]) < k {
		return nil, fmt.Errorf(
			"the model regresses on %d components but only %d could be projected from this data",
			k, len(scores[0]))
	}

	predictions := make([]float64, len(scores))
	for i := range scores {
		value := model.Intercept
		for j := 0; j < k; j++ {
			value += model.ScoreCoefficients[j] * scores[i][j]
		}
		predictions[i] = value
	}
	return predictions, nil
}

// printTransformPredictions reports predictions for new data.
//
// No error figure accompanies each prediction. The measured response for these
// rows is unknown, which is the point of predicting, and quoting the model's
// training or cross-validated error beside a new prediction invites reading it as
// that prediction's uncertainty. It is not: it is an average over the calibration
// set, and a sample unlike that set can be predicted far worse.
func printTransformPredictions(model *types.RegressionModel, predictions []float64,
	data *pkgcsv.Data, fits []sampleFit, limits modelLimits) {

	fmt.Printf("\nPredicted %s\n", model.Response)
	fmt.Println("──────────────────────────────────────────────────────────────")
	if limits.HasT2 || limits.HasRSS {
		fmt.Printf("  %-24s %16s %10s %10s\n", "Sample", "Predicted", "T²", "Q")
	} else {
		fmt.Printf("  %-24s %16s\n", "Sample", "Predicted")
	}

	shown := len(predictions)
	if shown > maxListedRows {
		shown = maxListedRows
	}
	for i := 0; i < shown; i++ {
		name := fmt.Sprintf("Row %d", i+1)
		if i < len(data.RowNames) && data.RowNames[i] != "" {
			name = data.RowNames[i]
		}
		if i < len(fits) && (limits.HasT2 || limits.HasRSS) {
			mark := ""
			if fits[i].Outside() {
				mark = "  outside the model"
			}
			fmt.Printf("  %-24s %16.8g %10.4g %10.3g%s\n",
				truncate(name, 24), predictions[i], fits[i].T2, fits[i].RSS, mark)
			continue
		}
		fmt.Printf("  %-24s %16.8g\n", truncate(name, 24), predictions[i])
	}
	if len(predictions) > shown {
		fmt.Printf("  ... %d more rows\n", len(predictions)-shown)
	}

	printFitSummary(fits, limits)

	fmt.Printf("\n  Model: %d components, RMSEC %.6g", model.Components, model.RMSEC)
	if model.Validation != nil {
		if i := indexOfCandidate(model.Validation, model.Components); i >= 0 {
			fmt.Printf(", RMSECV %.6g", model.Validation.RMSECV[i])
		}
	}
	fmt.Println("\n  Those figures describe the calibration set. They are not the uncertainty")
	fmt.Println("  of any individual prediction above, and a sample unlike the calibration")
	fmt.Println("  data can be predicted far worse than they suggest.")
}

// printFitSummary states how many samples the model did not recognise.
//
// The count is the number a reader acts on -- scanning a marked column of 240
// rows is not the same as being told that 8 of them are extrapolations. Silence
// when the model carries no limits is deliberate too, but it is a different
// silence and says so, because "none exceeded" and "nothing to compare against"
// are opposite conclusions (#978).
func printFitSummary(fits []sampleFit, limits modelLimits) {
	if len(fits) == 0 {
		return
	}
	if !limits.HasT2 && !limits.HasRSS {
		fmt.Println("\n  This model carries no T² or Q limits, so nothing here says whether a")
		fmt.Println("  sample resembles the calibration data. Models written before GoPCA")
		fmt.Println("  recorded them look the same as models where every sample is ordinary.")
		return
	}

	outside := countOutside(fits)
	fmt.Printf("\n  %d of %d samples fall outside the model's 95%% limits (%s).\n",
		outside, len(fits), describeLimits(limits))
	if outside > 0 {
		// Deliberately not "these are extrapolations". This command is often
		// pointed at the data the model was fitted on, where a sample past the
		// limit is not novel at all -- roughly 5% of any calibration set exceeds
		// its own 95% limit by construction, and more than that when the limits'
		// distributional assumptions do not hold. What can be said without
		// knowing the provenance is what was measured.
		fmt.Println("  The model accounts for those poorly. Whether that makes them novel")
		fmt.Println("  depends on whether they were part of the calibration, which this")
		fmt.Println("  command cannot know.")
	}
}

// Output functions for transform command
func outputTransformTable(result *types.PCAResult, data *pkgcsv.Data,
	fits []sampleFit, limits modelLimits) error {

	fmt.Println("\nTransformed Scores:")
	fmt.Println("──────────────────────────────────────────────────────────────")

	// A model without a regression block still projects, and a projection still
	// deserves to say how well it fitted. Without these columns the only output
	// carrying a verdict would be the one that happens to predict a response
	// (#978).
	reportFit := limits.HasT2 || limits.HasRSS

	// Print headers
	fmt.Printf("%-15s", "Sample_ID")
	for i := 0; i < len(result.ComponentLabels); i++ {
		fmt.Printf("%12s", result.ComponentLabels[i])
	}
	if reportFit {
		fmt.Printf("%12s%12s", "T²", "Q")
	}
	fmt.Println()
	fmt.Println("──────────────────────────────────────────────────────────────")

	// Print scores
	for i := 0; i < len(result.Scores); i++ {
		sampleID := fmt.Sprintf("Sample_%d", i+1)
		if i < len(data.RowNames) {
			sampleID = data.RowNames[i]
		}
		fmt.Printf("%-15s", sampleID)

		for j := 0; j < len(result.ComponentLabels); j++ {
			fmt.Printf("%12.4f", result.Scores[i][j])
		}
		if reportFit && i < len(fits) {
			fmt.Printf("%12.4g%12.3g", fits[i].T2, fits[i].RSS)
			if fits[i].Outside() {
				fmt.Printf("  outside the model")
			}
		}
		fmt.Println()
	}

	printFitSummary(fits, limits)
	return nil
}

func outputTransformJSON(result *types.PCAResult, data *pkgcsv.Data,
	inputFile, outputDir string, fits []sampleFit, limits modelLimits) error {
	// Generate output path
	dir := filepath.Dir(inputFile)
	base := filepath.Base(inputFile)
	ext := filepath.Ext(base)
	baseName := strings.TrimSuffix(base, ext)

	if outputDir != "" {
		dir = outputDir
		if err := os.MkdirAll(outputDir, 0750); err != nil {
			return fmt.Errorf("failed to create output directory: %w", err)
		}
	}

	outputFile := filepath.Join(dir, baseName+"_transformed.json")

	// Create output structure.
	//
	// hotelling_t2 and rss are spelled as the model schema spells them for the
	// training rows (results.samples.metrics), so one quantity keeps one name
	// across the two files a reader is likely to hold open together. The verdict
	// is deliberately not called is_outlier: that field judges a row against a
	// limit fitted on data including it, and this one against a model the row had
	// no part in (#978).
	type sampleOutput struct {
		ID           string             `json:"id"`
		Scores       map[string]float64 `json:"scores"`
		HotellingT2  *float64           `json:"hotelling_t2,omitempty"`
		RSS          *float64           `json:"rss,omitempty"`
		OutsideModel *bool              `json:"outside_model,omitempty"`
	}
	type TransformOutput struct {
		Samples []sampleOutput `json:"samples"`
	}

	reportFit := limits.HasT2 || limits.HasRSS

	var output TransformOutput
	for i := 0; i < len(result.Scores); i++ {
		sampleID := fmt.Sprintf("Sample_%d", i+1)
		if i < len(data.RowNames) {
			sampleID = data.RowNames[i]
		}

		scores := make(map[string]float64)
		for j := 0; j < len(result.ComponentLabels); j++ {
			scores[result.ComponentLabels[j]] = result.Scores[i][j]
		}

		sample := sampleOutput{ID: sampleID, Scores: scores}
		if i < len(fits) {
			// The statistics are reported whenever they were computed. The verdict
			// only when there was something to compare them against, so an absent
			// outside_model says "no limits in the model" rather than "within
			// them" -- opposite conclusions that a false would conflate.
			t2, rss := fits[i].T2, fits[i].RSS
			sample.HotellingT2, sample.RSS = &t2, &rss
			if reportFit {
				outside := fits[i].Outside()
				sample.OutsideModel = &outside
			}
		}
		output.Samples = append(output.Samples, sample)
	}

	// Marshal JSON
	jsonData, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	// Write output
	if err := os.WriteFile(outputFile, jsonData, 0644); err != nil {
		return fmt.Errorf("failed to write JSON file: %w", err)
	}

	fmt.Printf("\nResults saved to: %s\n", outputFile)
	return nil
}

// checkTransformSupported reports whether a model of the given method can
// project new data from the model file alone.
//
// Kernel PCA projects through the kernel evaluated between new samples and the
// training set, so it needs the training data, which the model file does not
// carry. Temporal PCA's loadings live over a lagged embedding, so new data would
// have to be re-embedded with the same lag structure first. Neither can be
// approximated by multiplying by the stored loadings, so both are refused rather
// than given a plausible but wrong answer.
func checkTransformSupported(method string) error {
	switch strings.ToLower(method) {
	case "kernel":
		return fmt.Errorf("this model was fitted with kernel PCA, which cannot transform new data: " +
			"projection requires the original training data and the kernel function, which the model file does not store. " +
			"Run 'pca analyze' over the combined data instead")
	case "temporal":
		return fmt.Errorf("this model was fitted with temporal PCA, which cannot transform new data: " +
			"its loadings describe a lagged embedding rather than the input variables, so new data must be re-embedded. " +
			"Run 'pca analyze' over the combined series instead")
	}
	return nil
}

// preprocessorFromModel rebuilds the preprocessing a saved model was fitted
// with, so new data passes through exactly the same transformation.
//
// This is a function rather than inline code so it can be tested against the
// writing side. A model's preprocessing crosses three representations on its way
// here -- the PCAConfig that fitted it, the JSON written to disk, and the
// PreprocessingInfo parsed back -- and each hop is hand-maintained. A setting
// dropped at any of them still yields scores of the right shape and plausible
// magnitude, projected onto loadings that no longer match the data.
func preprocessorFromModel(info types.PreprocessingInfo) (*core.Preprocessor, error) {
	preprocessor := core.NewPreprocessorWithScaleOnly(
		info.MeanCenter,
		info.StandardScale,
		info.RobustScale,
		info.ScaleOnly,
		info.SNV,
		info.VectorNorm,
	)

	// The Savitzky-Golay filter has no fitted parameters to restore: the
	// operator follows entirely from these three numbers and the variable count,
	// which the model's feature list has already pinned.
	if info.SavGolWindow > 0 {
		if err := preprocessor.SetSavitzkyGolay(core.SavGolConfig{
			WindowLength: info.SavGolWindow,
			PolyOrder:    info.SavGolPolyOrder,
			Deriv:        info.SavGolDeriv,
		}); err != nil {
			return nil, fmt.Errorf("restoring the model's Savitzky-Golay filter: %w", err)
		}
	}

	if err := preprocessor.SetFittedParameters(
		info.Parameters.FeatureMeans,
		info.Parameters.FeatureStdDevs,
		info.Parameters.FeatureMedians,
		info.Parameters.FeatureMADs,
		info.Parameters.RowMeans,
		info.Parameters.RowStdDevs,
	); err != nil {
		return nil, fmt.Errorf("failed to restore preprocessing parameters: %w", err)
	}
	return preprocessor, nil
}
