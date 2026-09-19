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
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/bitjungle/gopca/internal/core"
	pkgcsv "github.com/bitjungle/gopca/pkg/csv"
	"github.com/bitjungle/gopca/pkg/types"
	"github.com/spf13/cobra"
)

// AnalyzeOptions holds all the options for the analyze command
type AnalyzeOptions struct {
	// PCA parameters
	Components int
	Method     string

	// Kernel PCA parameters
	KernelType   string
	KernelGamma  float64
	KernelDegree int
	KernelCoef0  float64

	// Temporal PCA parameters
	TemporalLags      int
	VarianceExplained float64
	ImputeMethod      string

	// Preprocessing options
	MeanCenter      bool
	Scale           string // "none", "standard", "robust"
	ScaleOnly       bool
	SNV             bool
	SavGol          SavGolOptions
	VectorNorm      bool
	NoMeanCentering bool

	// Data format options
	NoHeaders  bool
	NoIndex    bool
	Delimiter  string
	NAValues   string
	TargetCols string

	// Missing data handling
	MissingStrategy string
	MissingPercent  float64

	// Output options
	OutputFormat   string
	OutputDir      string
	OutputScores   bool
	OutputLoadings bool
	OutputVariance bool
	OutputAll      bool
	IncludeMetrics bool

	// Exclude options
	ExcludeRows    string
	ExcludeColumns string

	// Verbose output
	Verbose bool
}

// NewAnalyzeCommand creates the analyze subcommand
func NewAnalyzeCommand() *cobra.Command {
	opts := &AnalyzeOptions{}

	cmd := &cobra.Command{
		Use:   "analyze [flags] <input.csv>",
		Short: "Perform PCA analysis on input data",
		Long: `Perform Principal Component Analysis on CSV data.

The analyze command performs PCA on your data using various algorithms
and preprocessing options. It supports multiple output formats and
advanced diagnostics.

EXAMPLES:
  # Basic PCA with 2 components
  pca analyze data.csv --components 2

  # PCA with standardization and metrics
  pca analyze --standard-scale --include-metrics data.csv

  # Kernel PCA with RBF kernel
  pca analyze --method kernel --kernel-type rbf data.csv

  # Handle missing data by dropping rows
  pca analyze --missing-strategy drop data.csv

  # NIPALS with native missing value handling
  pca analyze --method nipals --missing-strategy native data.csv

  # Temporal PCA with 24 lags (SSA-style)
  pca analyze --method temporal --temporal-lags 24 --components 5 data.csv

  # Temporal PCA with variance explained criterion
  pca analyze --method temporal --temporal-lags 12 --var-explained 0.95 data.csv

  # Output to JSON with full results
  pca analyze -f json --output-dir results/ data.csv`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			// Checked here rather than inside runAnalyze because it needs the
			// command to tell which flags the user actually set, and because a
			// bad combination should be reported before the file is opened.
			if err := opts.SavGol.validate(cmd, opts.Method, opts.MissingStrategy); err != nil {
				return err
			}
			return runAnalyze(opts, args[0])
		},
	}

	// PCA parameters
	cmd.Flags().IntVarP(&opts.Components, "components", "c", 2,
		"Number of principal components")
	cmd.Flags().StringVarP(&opts.Method, "method", "m", "svd",
		"PCA method: svd, nipals, kernel, or temporal")

	// Kernel PCA parameters
	cmd.Flags().StringVar(&opts.KernelType, "kernel-type", "rbf",
		"Kernel type for kernel PCA: linear, poly, rbf")
	cmd.Flags().Float64Var(&opts.KernelGamma, "kernel-gamma", 0.01,
		"Gamma parameter for RBF/poly kernels")
	cmd.Flags().IntVar(&opts.KernelDegree, "kernel-degree", 3,
		"Degree for polynomial kernel")
	cmd.Flags().Float64Var(&opts.KernelCoef0, "kernel-coef0", 1.0,
		"Coef0 for polynomial kernel")

	// Temporal PCA parameters
	cmd.Flags().IntVar(&opts.TemporalLags, "temporal-lags", 0,
		"Number of time lags for temporal PCA (SSA-style)")
	cmd.Flags().Float64Var(&opts.VarianceExplained, "var-explained", 0.0,
		"Target explained variance (0.0-1.0), alternative to --components")
	cmd.Flags().StringVar(&opts.ImputeMethod, "impute-method", "none",
		"Imputation method for temporal PCA: forward, backward, linear, none")

	// Preprocessing options
	cmd.Flags().BoolVar(&opts.NoMeanCentering, "no-mean-centering", false,
		"Disable mean centering")
	cmd.Flags().StringVar(&opts.Scale, "scale", "none",
		"Scaling method: none, standard, robust")
	cmd.Flags().BoolVar(&opts.ScaleOnly, "scale-only", false,
		"Scale without centering")
	cmd.Flags().BoolVar(&opts.SNV, "snv", false,
		"Apply Standard Normal Variate transformation")
	cmd.Flags().BoolVar(&opts.VectorNorm, "vector-norm", false,
		"Apply L2 vector normalization (row-wise)")
	addSavGolFlags(cmd, &opts.SavGol)

	// Data format options
	cmd.Flags().BoolVar(&opts.NoHeaders, "no-headers", false,
		"First row contains data, not column names")
	cmd.Flags().BoolVar(&opts.NoIndex, "no-index", false,
		"First column contains data, not row names")
	cmd.Flags().StringVar(&opts.Delimiter, "delimiter", ",",
		"CSV field delimiter")
	cmd.Flags().StringVar(&opts.NAValues, "na-values", ",NA,N/A,nan,NaN,null,NULL,m",
		"Comma-separated list of strings representing missing values")
	cmd.Flags().StringVar(&opts.TargetCols, "target-columns", "",
		"Comma-separated list of target columns to exclude")

	// Missing data handling
	cmd.Flags().StringVar(&opts.MissingStrategy, "missing-strategy", "error",
		"Strategy for missing values: error (default), mean, median, zero, drop, native (NIPALS only)")
	cmd.Flags().Float64Var(&opts.MissingPercent, "missing-percent", 50.0,
		"Maximum missing percentage before dropping")

	// Output options
	cmd.Flags().StringVarP(&opts.OutputFormat, "format", "f", "table",
		"Output format: table, json")
	cmd.Flags().StringVarP(&opts.OutputDir, "output-dir", "o", "",
		"Output directory for results")
	cmd.Flags().BoolVar(&opts.OutputScores, "output-scores", true,
		"Include PC scores in output")
	cmd.Flags().BoolVar(&opts.OutputLoadings, "output-loadings", true,
		"Include loadings in output")
	cmd.Flags().BoolVar(&opts.OutputVariance, "output-variance", true,
		"Include explained variance in output")
	cmd.Flags().BoolVar(&opts.OutputAll, "output-all", false,
		"Output all results")
	cmd.Flags().BoolVar(&opts.IncludeMetrics, "include-metrics", false,
		"Calculate and include advanced metrics")

	// Exclude options
	cmd.Flags().StringVar(&opts.ExcludeRows, "exclude-rows", "",
		"Row indices to exclude (1-based): e.g., '1,3,5' or '1-5,8-10'")
	cmd.Flags().StringVar(&opts.ExcludeColumns, "exclude-columns", "",
		"Column indices/names to exclude: e.g., '1,3' or '1-5' or 'col1,col2'")

	// Verbose output
	cmd.Flags().BoolVarP(&opts.Verbose, "verbose", "v", false,
		"Enable verbose output")

	return cmd
}

// parseDelimiter converts a delimiter string to a rune, handling escape sequences
// and validating the input according to CSV standards.
// Common escape sequences like \t (tab), \n (newline), and \r (carriage return)
// are automatically converted to their respective rune values.
// Returns an error if the delimiter is empty or contains more than one character.
func parseDelimiter(delimStr string) (rune, error) {
	if delimStr == "" {
		return 0, fmt.Errorf("delimiter cannot be empty")
	}

	// Handle common escape sequences
	switch delimStr {
	case "\\t":
		return '\t', nil
	case "\\n":
		return '\n', nil
	case "\\r":
		return '\r', nil
	}

	// Convert to rune and validate single character
	runes := []rune(delimStr)
	if len(runes) != 1 {
		return 0, fmt.Errorf("delimiter must be a single character, got %d characters", len(runes))
	}

	return runes[0], nil
}

// runAnalyze executes the analyze command
func runAnalyze(opts *AnalyzeOptions, inputFile string) error {
	// Parse CSV options
	parseOpts := pkgcsv.DefaultOptions()
	parseOpts.HasHeaders = !opts.NoHeaders
	parseOpts.HasRowNames = !opts.NoIndex

	// Parse delimiter with validation and escape sequence handling
	var err error
	parseOpts.Delimiter, err = parseDelimiter(opts.Delimiter)
	if err != nil {
		return fmt.Errorf("invalid delimiter: %w", err)
	}

	parseOpts.ParseMode = pkgcsv.ParseMixedWithTargets

	// Parse NA values
	if opts.NAValues != "" {
		parseOpts.NullValues = strings.Split(opts.NAValues, ",")
		for i := range parseOpts.NullValues {
			parseOpts.NullValues[i] = strings.TrimSpace(parseOpts.NullValues[i])
		}
	}

	// Parse target columns
	if opts.TargetCols != "" {
		parseOpts.TargetCols = strings.Split(opts.TargetCols, ",")
		for i := range parseOpts.TargetCols {
			parseOpts.TargetCols[i] = strings.TrimSpace(parseOpts.TargetCols[i])
		}
		// Enable mixed parsing with target column support
	}

	// Load CSV data with target column detection
	reader := pkgcsv.NewReader(parseOpts)
	data, err := reader.ReadFile(inputFile)
	if err != nil {
		return fmt.Errorf("failed to parse CSV: %w", err)
	}

	// Validate data
	if err := validateCSVData(data); err != nil {
		return fmt.Errorf("data validation failed: %w", err)
	}

	// Early detection and reporting of missing values
	selectedCols := make([]int, 0, data.Columns)
	for i := 0; i < data.Columns; i++ {
		selectedCols = append(selectedCols, i)
	}
	missingInfo := data.GetMissingValueInfo(selectedCols)

	if missingInfo.HasMissing() {
		totalValues := data.Rows * data.Columns
		missingPercent := float64(missingInfo.TotalMissing) * 100.0 / float64(totalValues)
		rowsWithMissing := len(missingInfo.RowsAffected)
		rowsPercent := float64(rowsWithMissing) * 100.0 / float64(data.Rows)

		// Report missing values to user
		if opts.Verbose {
			fmt.Printf("Missing values detected:\n")
			fmt.Printf("  Total missing: %d of %d values (%.1f%%)\n",
				missingInfo.TotalMissing, totalValues, missingPercent)
			fmt.Printf("  Rows affected: %d of %d rows (%.1f%%)\n",
				rowsWithMissing, data.Rows, rowsPercent)

			// Report by column
			if len(missingInfo.MissingByColumn) > 0 {
				fmt.Printf("  Missing by column:\n")
				for colIdx, count := range missingInfo.MissingByColumn {
					colName := fmt.Sprintf("Column %d", colIdx+1)
					if colIdx < len(data.Headers) && data.Headers[colIdx] != "" {
						colName = data.Headers[colIdx]
					}
					colPercent := float64(count) * 100.0 / float64(data.Rows)
					fmt.Printf("    %s: %d (%.1f%%)\n", colName, count, colPercent)
				}
			}
		}

		// Validate method compatibility with native strategy
		if opts.MissingStrategy == "native" {
			if strings.ToLower(opts.Method) != "nipals" {
				return fmt.Errorf("native missing value handling is only supported with the NIPALS method, not %s", opts.Method)
			}
		}

		// Check if using SVD with missing values without proper strategy
		if strings.ToLower(opts.Method) == "svd" && opts.MissingStrategy == "error" {
			return fmt.Errorf("missing values detected (%d values, %.1f%%). SVD requires complete data. "+
				"Use --missing-strategy with one of: drop, mean, median, zero. "+
				"Or use --method nipals with --missing-strategy native for native handling",
				missingInfo.TotalMissing, missingPercent)
		}
	}

	// Handle missing values based on strategy
	if missingInfo.HasMissing() && opts.MissingStrategy != "error" && opts.MissingStrategy != "native" {
		// Handle missing values based on strategy
		if opts.MissingStrategy != "drop" && opts.MissingStrategy != "mean" &&
			opts.MissingStrategy != "median" && opts.MissingStrategy != "zero" {
			return fmt.Errorf("invalid missing value strategy: %s. Valid options are: error, drop, mean, median, zero, native (NIPALS only)", opts.MissingStrategy)
		}

		if opts.Verbose {
			fmt.Printf("Applying missing value strategy: %s\n", opts.MissingStrategy)
		}

		if missingInfo.HasMissing() {
			// Handle missing values using the specified strategy
			handler := core.NewMissingValueHandler(types.MissingValueStrategy(opts.MissingStrategy))
			cleanData, err := handler.HandleMissingValues(data.Matrix, missingInfo, selectedCols)
			if err != nil {
				return fmt.Errorf("failed to handle missing values: %w", err)
			}

			// Update data matrix and affected row names for drop strategy
			if opts.MissingStrategy == "drop" && len(data.RowNames) > 0 {
				// Filter row names to match the cleaned data
				cleanRowNames := make([]string, 0, len(cleanData))
				droppedRows := make(map[int]bool)
				for _, row := range missingInfo.RowsAffected {
					droppedRows[row] = true
				}
				for i, name := range data.RowNames {
					if !droppedRows[i] {
						cleanRowNames = append(cleanRowNames, name)
					}
				}
				data.RowNames = cleanRowNames
			}

			data.Matrix = cleanData
			data.Rows = len(cleanData)

			if opts.Verbose {
				if opts.MissingStrategy == "drop" {
					fmt.Printf("Dropped %d rows with missing values. Data now has %d rows.\n",
						len(missingInfo.RowsAffected), data.Rows)
				} else {
					fmt.Printf("Imputed %d missing values using %s strategy.\n",
						missingInfo.TotalMissing, opts.MissingStrategy)
				}
			}
		}
	} else if opts.MissingStrategy == "native" && missingInfo.HasMissing() {
		// NIPALS will handle missing values internally
		if opts.Verbose {
			fmt.Printf("NIPALS will handle %d missing values natively.\n", missingInfo.TotalMissing)
		}
	}

	// Create PCA configuration
	meanCenter := !opts.NoMeanCentering
	standardScale := opts.Scale == "standard"
	robustScale := opts.Scale == "robust"

	config := types.PCAConfig{
		Components:      opts.Components,
		Method:          opts.Method,
		MeanCenter:      meanCenter,
		StandardScale:   standardScale,
		RobustScale:     robustScale,
		ScaleOnly:       opts.ScaleOnly,
		SNV:             opts.SNV,
		VectorNorm:      opts.VectorNorm,
		MissingStrategy: types.MissingValueStrategy(opts.MissingStrategy),
	}
	opts.SavGol.applyTo(&config)

	// Add kernel parameters if using kernel PCA
	if opts.Method == "kernel" {
		config.KernelType = opts.KernelType
		config.KernelGamma = opts.KernelGamma
		config.KernelDegree = opts.KernelDegree
		config.KernelCoef0 = opts.KernelCoef0
	}

	// Add temporal parameters if using temporal PCA
	if opts.Method == "temporal" {
		config.TemporalLags = opts.TemporalLags
		config.VarianceExplained = opts.VarianceExplained
		config.ImputeMethod = opts.ImputeMethod

		// Validate temporal lags
		if config.TemporalLags <= 0 {
			return fmt.Errorf("temporal PCA requires --temporal-lags to be specified and positive")
		}

		// If using variance explained, don't require components
		if config.VarianceExplained > 0 {
			config.Components = 0 // Will be determined by variance explained
		}
	}

	// Parse exclude options
	if opts.ExcludeRows != "" {
		var err error
		config.ExcludedRows, err = parseExcludeIndices(opts.ExcludeRows)
		if err != nil {
			return err
		}
	}
	if opts.ExcludeColumns != "" {
		var err error
		config.ExcludedColumns, err = parseExcludeColumns(opts.ExcludeColumns, data.Headers)
		if err != nil {
			return err
		}
	}

	// Apply row and column exclusions to the data
	if len(config.ExcludedRows) > 0 || len(config.ExcludedColumns) > 0 {
		// Create a map for quick lookup of excluded rows
		excludedRowMap := make(map[int]bool)
		for _, row := range config.ExcludedRows {
			excludedRowMap[row] = true
		}

		// Create a map for quick lookup of excluded columns
		excludedColMap := make(map[int]bool)
		for _, col := range config.ExcludedColumns {
			excludedColMap[col] = true
		}

		// Filter rows
		filteredMatrix := make([][]float64, 0)
		filteredRowNames := make([]string, 0)
		for i, row := range data.Matrix {
			if !excludedRowMap[i] {
				// Filter columns from this row
				filteredRow := make([]float64, 0)
				for j, val := range row {
					if !excludedColMap[j] {
						filteredRow = append(filteredRow, val)
					}
				}
				filteredMatrix = append(filteredMatrix, filteredRow)
				if len(data.RowNames) > i {
					filteredRowNames = append(filteredRowNames, data.RowNames[i])
				}
			}
		}

		// Filter column headers
		filteredHeaders := make([]string, 0)
		for i, header := range data.Headers {
			if !excludedColMap[i] {
				filteredHeaders = append(filteredHeaders, header)
			}
		}

		// Update data with filtered results
		originalRows := data.Rows
		originalCols := data.Columns
		data.Matrix = filteredMatrix
		data.Rows = len(filteredMatrix)
		data.Columns = len(filteredHeaders)
		data.Headers = filteredHeaders
		data.RowNames = filteredRowNames

		if opts.Verbose {
			if len(config.ExcludedRows) > 0 {
				fmt.Printf("Excluded %d rows (keeping %d of %d rows)\n",
					len(config.ExcludedRows), data.Rows, originalRows)
			}
			if len(config.ExcludedColumns) > 0 {
				fmt.Printf("Excluded %d columns (keeping %d of %d columns)\n",
					len(config.ExcludedColumns), data.Columns, originalCols)
			}
		}
	}

	// Warn if a Savitzky-Golay filter has been asked for on variables that do not
	// form a continuum. The engine will run it and return numbers either way; a
	// derivative along an axis with no order to it is noise differentiated, and
	// nothing about the output would say so.
	//
	// Checked here rather than with the other flag validation because it needs
	// the matrix as it will actually be analysed, after exclusions.
	if opts.SavGol.Enabled() {
		warnIfAxisNotContinuous(os.Stderr, core.AnalyzeVariableAxis(data.Matrix, data.Headers))
	}

	// Fit PCA and attach diagnostics (Q/T² + confidence limits) via the shared
	// core pipeline, so the CLI and Desktop compute identical metrics against the
	// exact matrix the engine used (result.PreprocessedData) — see #716.
	result, err := core.RunPCAWithDiagnostics(data.Matrix, config)
	if err != nil {
		return fmt.Errorf("PCA analysis failed: %w", err)
	}

	// Distinguish "diagnostics don't apply" (PreprocessedData nil for
	// kernel/temporal/native-missing) from "diagnostics failed" (PreprocessedData
	// present but no metrics attached). In the latter case the table would print
	// zero-valued placeholders; warn so they aren't mistaken for real Q/T² values.
	if opts.IncludeMetrics && result.PreprocessedData != nil && len(result.Metrics) == 0 {
		fmt.Fprintln(os.Stderr, "Warning: diagnostic metrics (Q/T²) could not be computed; reported values are placeholders.")
	}

	// Reuse the engine's preprocessed matrix for output so downstream metrics stay
	// consistent with the attached diagnostics.
	preprocessedData := result.PreprocessedData

	// Check if we need to handle NIPALS with native missing values specially
	// The JSON exporter needs the fitted preprocessor for the extended parameters
	// (feature medians/MADs, row means/std devs) that the result does not carry.
	// FitPreprocessorForExport re-fits it, including for native NIPALS missing-
	// value handling, where the statistics have to skip the absent entries.
	preprocessor, _, err := core.FitPreprocessorForExport(data.Matrix, config)
	if err != nil {
		return fmt.Errorf("preprocessing for output metadata failed: %w", err)
	}

	// Output results based on format
	switch opts.OutputFormat {
	case "json":
		return outputJSONFormat(result, data, preprocessedData, inputFile, opts, config, preprocessor,
			data.CategoricalColumns, data.NumericTargetColumns)
	default: // table
		outputScores := opts.OutputScores || opts.OutputAll
		outputLoadings := opts.OutputLoadings || opts.OutputAll
		outputVariance := opts.OutputVariance || opts.OutputAll
		return outputTableFormat(result, data,
			outputScores, outputLoadings, outputVariance, opts.IncludeMetrics, opts.VarianceExplained,
			config)
	}
}

// Helper functions for parsing exclude options
// parseExcludeIndices resolves a comma-separated spec of 1-based row indices,
// accepting individual values and inclusive ranges ("1-5,8"). Unlike columns,
// rows have no names, so every token must be numeric.
//
// Malformed tokens are reported rather than skipped, for the same reason as
// parseExcludeColumns: a silently ignored exclusion yields an analysis that is
// not the one the user asked for.
func parseExcludeIndices(excludeStr string) ([]int, error) {
	indexSet := make(map[int]bool)
	var unmatched []string

	for _, part := range strings.Split(excludeStr, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		if idx := strings.Index(part, "-"); idx > 0 {
			var start, end int
			if _, err1 := fmt.Sscanf(part[:idx], "%d", &start); err1 == nil {
				if _, err2 := fmt.Sscanf(part[idx+1:], "%d", &end); err2 == nil {
					if start < 1 || start > end {
						unmatched = append(unmatched, fmt.Sprintf("%q (invalid range)", part))
						continue
					}
					for i := start; i <= end; i++ {
						indexSet[i-1] = true
					}
					continue
				}
			}
			unmatched = append(unmatched, fmt.Sprintf("%q (not a valid range)", part))
			continue
		}

		var single int
		if _, err := fmt.Sscanf(part, "%d", &single); err != nil || single < 1 {
			unmatched = append(unmatched, fmt.Sprintf("%q (not a positive integer)", part))
			continue
		}
		indexSet[single-1] = true
	}

	if len(unmatched) > 0 {
		return nil, fmt.Errorf("--exclude-rows: could not resolve %s; "+
			"rows are given as 1-based indices, e.g. 1,3,5 or 1-5,8",
			strings.Join(unmatched, ", "))
	}

	indices := make([]int, 0, len(indexSet))
	for idx := range indexSet {
		indices = append(indices, idx)
	}
	sort.Ints(indices)
	return indices, nil
}

// parseExcludeColumns resolves a comma-separated exclusion spec into 0-based
// column indices. A token may be a column name, a 1-based index, or a 1-based
// inclusive index range ("3-7").
//
// Resolution order per token is name, then range, then index. Name first matters
// for spectroscopic data, whose columns are named by wavelength: on a file with
// 700 channels named 1100..2498, "1400" is a wavelength, not column number 1400.
// It also protects the case where a name and an index collide — with columns
// named 5..12, "5" now removes the column called 5 rather than the fifth column.
// Checking the whole token as a name first also lets names containing a hyphen
// ("col-1") resolve correctly.
//
// Every token that resolves to nothing is reported. Silently dropping an
// unmatched name would let a typo produce an analysis of the full data while the
// user believed a region had been excluded.
// indexOfHeader returns the position of an exact column-name match.
func indexOfHeader(headers []string, name string) (int, bool) {
	for i, header := range headers {
		if header == name {
			return i, true
		}
	}
	return 0, false
}

func parseExcludeColumns(excludeStr string, headers []string) ([]int, error) {
	indexSet := make(map[int]bool)
	var unmatched []string

	for _, part := range strings.Split(excludeStr, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		// 1. Exact column name.
		matched := false
		for i, header := range headers {
			if header == part {
				indexSet[i] = true
				matched = true
				break
			}
		}
		if matched {
			continue
		}

		// 2. Inclusive range "start-end", by column name at both ends.
		// Checked before the index interpretation so that a spectral axis
		// reads naturally: on a dataset whose columns are named 1100..2498,
		// "1400-1450" is the wavelength band, not columns 1400 through 1450.
		// GoPCA Desktop's variable selector resolves ranges the same way.
		if idx := strings.Index(part, "-"); idx > 0 {
			lo, okLo := indexOfHeader(headers, strings.TrimSpace(part[:idx]))
			hi, okHi := indexOfHeader(headers, strings.TrimSpace(part[idx+1:]))
			if okLo && okHi {
				if lo > hi {
					lo, hi = hi, lo
				}
				for i := lo; i <= hi; i++ {
					indexSet[i] = true
				}
				continue
			}
		}

		// 3. Inclusive 1-based index range "start-end".
		if idx := strings.Index(part, "-"); idx > 0 {
			var start, end int
			if _, err1 := fmt.Sscanf(part[:idx], "%d", &start); err1 == nil {
				if _, err2 := fmt.Sscanf(part[idx+1:], "%d", &end); err2 == nil {
					if start < 1 || end > len(headers) || start > end {
						unmatched = append(unmatched, fmt.Sprintf(
							"%q (index range outside 1-%d)", part, len(headers)))
						continue
					}
					for i := start; i <= end; i++ {
						indexSet[i-1] = true
					}
					continue
				}
			}
		}

		// 4. Single 1-based index.
		var single int
		if _, err := fmt.Sscanf(part, "%d", &single); err == nil {
			if single < 1 || single > len(headers) {
				unmatched = append(unmatched, fmt.Sprintf(
					"%q (index outside 1-%d)", part, len(headers)))
			} else {
				indexSet[single-1] = true
			}
			continue
		}

		unmatched = append(unmatched, fmt.Sprintf("%q (no column with this name)", part))
	}

	if len(unmatched) > 0 {
		return nil, fmt.Errorf("--exclude-columns: could not resolve %s; "+
			"columns may be given by name, by 1-based index, as an index range such as 3-7, "+
			"or as a range between two column names such as 1400-1450",
			strings.Join(unmatched, ", "))
	}

	indices := make([]int, 0, len(indexSet))
	for idx := range indexSet {
		indices = append(indices, idx)
	}
	sort.Ints(indices)
	return indices, nil
}
