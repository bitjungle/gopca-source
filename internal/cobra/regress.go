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
	"errors"
	"fmt"
	"math"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/bitjungle/gopca/internal/core"
	"github.com/bitjungle/gopca/internal/crossval"
	pkgcsv "github.com/bitjungle/gopca/pkg/csv"
	"github.com/bitjungle/gopca/pkg/types"
	"github.com/spf13/cobra"
)

// RegressOptions holds all the options for the regress command.
type RegressOptions struct {
	// Response selection
	Response      string
	ListResponses bool

	// Model size. Components fixes the count; MaxComponents caps the sweep when
	// the count is chosen by cross-validation.
	Components    int
	MaxComponents int

	// Validation design
	CV        string
	CVScheme  string
	CVGroup   string
	CVRepeats int
	CVSeed    int64

	// Selection rule
	Select    string
	Tolerance float64
	WoldR     float64
	Metric    string

	// Predictor side, mirroring analyze
	Method          string
	Scale           string
	ScaleOnly       bool
	SNV             bool
	VectorNorm      bool
	SavGol          SavGolOptions
	NoMeanCentering bool
	MissingStrategy string

	// Data format
	NoHeaders  bool
	NoIndex    bool
	Delimiter  string
	NAValues   string
	TargetCols string

	// Exclusions
	ExcludeRows    string
	ExcludeColumns string

	// Output
	OutputFormat string
	OutputDir    string
	Verbose      bool
}

// NewRegressCommand creates the regress subcommand.
func NewRegressCommand() *cobra.Command {
	opts := &RegressOptions{}

	cmd := &cobra.Command{
		Use:   "regress [flags] <input.csv>",
		Short: "Fit a principal component regression model",
		Long: `Fit a Principal Component Regression (PCR) model.

PCR predicts a numeric response from principal component scores. The components
come from the predictors alone, without looking at the response, so a component
that matters for prediction can carry very little predictor variance. Choose the
number of components by cross-validation rather than by explained variance.

The response is a numeric column marked with the #target suffix. Run with
--list-responses to see which columns qualify in a given file.

Three error figures are reported and they are not interchangeable:

  RMSEC    training residuals of the final model. Describes the fit. It is NOT
           an estimate of future performance, because the model has seen every
           row it is scored on.
  RMSECV   held-out predictions from cross-validation. Used to choose the number
           of components.
  RMSEP    an independent test set. Not produced here; a test set must be kept
           out of model development entirely.

EXAMPLES:
  # See which columns can be predicted
  pca regress --list-responses corn.csv

  # Choose the component count by 10-fold cross-validation
  pca regress --response "Moisture#target" --cv 10 corn.csv

  # Leave-one-out, which is K-fold with as many folds as there are groups
  pca regress --response "Moisture#target" --cv loo corn.csv

  # Keep replicates of one object together, so none straddles a fold boundary
  pca regress --response "Yield#target" --cv 10 --cv-group "BatchID" process.csv

  # Fix the component count instead of selecting it
  pca regress --response "Oil#target" --components 7 corn.csv

  # Save scores, coefficients and the error curve
  pca regress --response "Protein#target" --cv 10 -o results/ corn.csv`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := opts.SavGol.validate(cmd, opts.Method, opts.MissingStrategy); err != nil {
				return err
			}
			return runRegress(opts, args[0])
		},
	}

	cmd.Flags().StringVar(&opts.Response, "response", "",
		"Name of the numeric #target column to predict")
	cmd.Flags().BoolVar(&opts.ListResponses, "list-responses", false,
		"List the columns that can be used as a response, then exit")

	cmd.Flags().IntVarP(&opts.Components, "components", "c", 0,
		"Fixed number of components to retain (default: choose by cross-validation)")
	cmd.Flags().IntVar(&opts.MaxComponents, "max-components", 20,
		"Largest number of components to consider when selecting by cross-validation")

	cmd.Flags().StringVar(&opts.CV, "cv", "10",
		"Number of cross-validation folds, or \"loo\" for leave-one-out")
	cmd.Flags().StringVar(&opts.CVScheme, "cv-scheme", "random",
		"Fold layout: random, contiguous, forward-chaining")
	cmd.Flags().StringVar(&opts.CVGroup, "cv-group", "",
		"Categorical column whose levels must not be split across folds")
	cmd.Flags().IntVar(&opts.CVRepeats, "cv-repeats", 1,
		"Repeat the whole design with fresh partitions")
	cmd.Flags().Int64Var(&opts.CVSeed, "cv-seed", 42,
		"Seed for the fold shuffle, recorded so a run can be reproduced")

	cmd.Flags().StringVar(&opts.Select, "select", types.SelectOneSE,
		"Selection rule: min, one-se, tolerance, wold, first-min")
	cmd.Flags().Float64Var(&opts.Tolerance, "tolerance", 0,
		"For --select tolerance: acceptable error increase, in response units")
	cmd.Flags().Float64Var(&opts.WoldR, "wold-r", 1.0,
		"For --select wold: PRESS ratio threshold, conventionally 0.90 to 1.00")
	cmd.Flags().StringVar(&opts.Metric, "metric", "rmse",
		"Selection metric: rmse or mae")

	cmd.Flags().StringVarP(&opts.Method, "method", "m", "svd",
		"PCA method: svd or nipals")
	cmd.Flags().BoolVar(&opts.NoMeanCentering, "no-mean-centering", false,
		"Skip mean centering")
	cmd.Flags().StringVar(&opts.Scale, "scale", "none",
		"Scaling: none, standard, robust")
	cmd.Flags().BoolVar(&opts.ScaleOnly, "scale-only", false,
		"Divide by standard deviation without mean centering")
	cmd.Flags().BoolVar(&opts.SNV, "snv", false,
		"Standard Normal Variate, applied per row")
	addSavGolFlags(cmd, &opts.SavGol)
	cmd.Flags().BoolVar(&opts.VectorNorm, "vector-norm", false,
		"L2 normalization, applied per row")
	cmd.Flags().StringVar(&opts.MissingStrategy, "missing-strategy", "error",
		"Missing predictor handling: error, drop, zero, native (NIPALS only)")

	cmd.Flags().BoolVar(&opts.NoHeaders, "no-headers", false,
		"First row contains data, not column names")
	cmd.Flags().BoolVar(&opts.NoIndex, "no-index", false,
		"First column contains data, not row names")
	cmd.Flags().StringVar(&opts.Delimiter, "delimiter", ",",
		"CSV field delimiter")
	cmd.Flags().StringVar(&opts.NAValues, "na-values", ",NA,N/A,nan,NaN,null,NULL,m",
		"Comma-separated list of strings representing missing values")
	cmd.Flags().StringVar(&opts.TargetCols, "target-columns", "",
		"Additional columns to treat as targets and exclude from the predictors")

	cmd.Flags().StringVar(&opts.ExcludeRows, "exclude-rows", "",
		"Comma-separated 1-based row indices or ranges to exclude")
	cmd.Flags().StringVar(&opts.ExcludeColumns, "exclude-columns", "",
		"Comma-separated column names or 1-based indices to exclude")

	cmd.Flags().StringVarP(&opts.OutputFormat, "format", "f", "table",
		"Output format: table, json")
	cmd.Flags().StringVarP(&opts.OutputDir, "output", "o", "",
		"Directory for output files")
	cmd.Flags().BoolVarP(&opts.Verbose, "verbose", "v", false,
		"Verbose output")

	return cmd
}

// runRegress executes the regress command.
func runRegress(opts *RegressOptions, inputFile string) error {
	data, targets, categorical, err := loadRegressionData(opts, inputFile)
	if err != nil {
		return err
	}

	if opts.ListResponses {
		return listResponses(inputFile, targets, categorical)
	}
	if opts.Response == "" {
		return fmt.Errorf("no response selected: pass --response with the name of a numeric " +
			"#target column, or --list-responses to see which columns qualify")
	}

	y, ok := targets[opts.Response]
	if !ok {
		return unknownResponseError(opts.Response, targets, categorical)
	}

	warnIfResponseLooksCategorical(opts.Response, y)

	config, err := buildPCRConfig(opts, data, categorical)
	if err != nil {
		return err
	}

	if opts.Verbose {
		observed := 0
		for _, v := range y {
			if !math.IsNaN(v) && !math.IsInf(v, 0) {
				observed++
			}
		}
		fmt.Printf("Response %q: %d of %d rows have an observed value\n",
			opts.Response, observed, len(y))
	}

	// Same warning as `pca analyze`: the predictors reach the engine through the
	// same preprocessing, so a filter along an axis with no order to it is just
	// as meaningless here, and a regression puts a number on it that looks
	// authoritative.
	if opts.SavGol.Enabled() {
		warnIfAxisNotContinuous(os.Stderr, core.AnalyzeVariableAxis(data.Matrix, data.Headers))
	}

	engine := core.NewPCREngine()
	result, err := engine.Fit(data.Matrix, y, config)
	if err != nil {
		return withFoldAdvice(err)
	}

	// The fitted preprocessing parameters are needed to export a model a consumer
	// can apply without the training data. They live on the engine rather than in
	// the result, so recover them from the concrete type.
	var preprocessor *core.Preprocessor
	if impl, ok := engine.(*core.PCRImpl); ok {
		preprocessor = impl.Preprocessor()
	}

	switch strings.ToLower(opts.OutputFormat) {
	case "json":
		return outputRegressJSON(result, data, inputFile, opts)
	case "table", "":
		if err := outputRegressTable(result, data, opts); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unknown output format %q: expected table or json", opts.OutputFormat)
	}

	if opts.OutputDir != "" {
		return writeRegressModel(result, data, inputFile, opts, config, preprocessor, categorical, targets)
	}
	return nil
}

// loadRegressionData parses the input file and applies the missing-value strategy.
func loadRegressionData(opts *RegressOptions, inputFile string) (
	*pkgcsv.Data, map[string][]float64, map[string][]string, error) {

	parseOpts := pkgcsv.DefaultOptions()
	parseOpts.HasHeaders = !opts.NoHeaders
	parseOpts.HasRowNames = !opts.NoIndex
	parseOpts.ParseMode = pkgcsv.ParseMixedWithTargets

	delimiter, err := parseDelimiter(opts.Delimiter)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("invalid delimiter: %w", err)
	}
	parseOpts.Delimiter = delimiter

	if opts.NAValues != "" {
		parseOpts.NullValues = strings.Split(opts.NAValues, ",")
		for i := range parseOpts.NullValues {
			parseOpts.NullValues[i] = strings.TrimSpace(parseOpts.NullValues[i])
		}
	}
	if opts.TargetCols != "" {
		parseOpts.TargetCols = strings.Split(opts.TargetCols, ",")
		for i := range parseOpts.TargetCols {
			parseOpts.TargetCols[i] = strings.TrimSpace(parseOpts.TargetCols[i])
		}
	}

	data, err := pkgcsv.NewReader(parseOpts).ReadFile(inputFile)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to parse CSV: %w", err)
	}
	if err := validateCSVData(data); err != nil {
		return nil, nil, nil, fmt.Errorf("data validation failed: %w", err)
	}

	targets := data.NumericTargetColumns
	categorical := data.CategoricalColumns

	if opts.ListResponses {
		return data, targets, categorical, nil
	}

	if err := applyExclusions(opts, data, targets); err != nil {
		return nil, nil, nil, err
	}
	if err := applyMissingStrategy(opts, data, targets); err != nil {
		return nil, nil, nil, err
	}
	return data, targets, categorical, nil
}

// applyExclusions removes the rows and columns the caller asked to leave out.
//
// Exclusions are applied before missing-value handling, so that a row dropped
// here never influences a later decision, and before the fit, so that an excluded
// outlier cannot reach the decomposition through the unlabelled path.
//
// Rows are the delicate part. The response, the categorical columns and the row
// names are all indexed by row, so every one of them has to lose exactly the same
// rows as the matrix. Filtering the matrix alone would pair each surviving sample
// with a different sample's response, and nothing downstream would look wrong.
func applyExclusions(opts *RegressOptions, data *pkgcsv.Data, targets map[string][]float64) error {
	if opts.ExcludeColumns != "" {
		columns, err := parseExcludeColumns(opts.ExcludeColumns, data.Headers)
		if err != nil {
			return err
		}
		if len(columns) > 0 {
			excluded := make(map[int]bool, len(columns))
			for _, column := range columns {
				excluded[column] = true
			}
			if len(excluded) >= data.Columns {
				return fmt.Errorf("--exclude-columns would remove every predictor")
			}

			for i := range data.Matrix {
				kept := make([]float64, 0, data.Columns-len(excluded))
				for j, v := range data.Matrix[i] {
					if !excluded[j] {
						kept = append(kept, v)
					}
				}
				data.Matrix[i] = kept
			}
			headers := make([]string, 0, len(data.Headers))
			for j, name := range data.Headers {
				if !excluded[j] {
					headers = append(headers, name)
				}
			}
			data.Headers = headers
			data.Columns = len(headers)

			if opts.Verbose {
				fmt.Printf("Excluded %d predictor columns; %d remain.\n",
					len(excluded), data.Columns)
			}
		}
	}

	if opts.ExcludeRows == "" {
		return nil
	}
	rows, err := parseExcludeIndices(opts.ExcludeRows)
	if err != nil {
		return err
	}
	if len(rows) == 0 {
		return nil
	}

	excluded := make(map[int]bool, len(rows))
	for _, row := range rows {
		if row < 0 || row >= data.Rows {
			return fmt.Errorf("--exclude-rows names row %d, but the data has %d rows",
				row+1, data.Rows)
		}
		excluded[row] = true
	}
	if len(excluded) >= data.Rows {
		return fmt.Errorf("--exclude-rows would remove every observation")
	}

	matrix := make([]([]float64), 0, data.Rows-len(excluded))
	for i, row := range data.Matrix {
		if !excluded[i] {
			matrix = append(matrix, row)
		}
	}
	data.Matrix = matrix
	data.Rows = len(matrix)

	for name, values := range targets {
		targets[name] = filterByRow(values, excluded)
	}
	for name, values := range data.CategoricalColumns {
		data.CategoricalColumns[name] = filterCategoricalByRow(values, excluded)
	}
	if len(data.RowNames) > 0 {
		data.RowNames = filterCategoricalByRow(data.RowNames, excluded)
	}

	if opts.Verbose {
		fmt.Printf("Excluded %d rows; %d remain.\n", len(excluded), data.Rows)
	}
	return nil
}

// applyMissingStrategy resolves missing predictor values before fitting, keeping
// the response aligned with the rows that survive.
//
// Mean and median imputation are refused. Both estimate a value from the data,
// which makes them learned steps, and a learned step applied before
// cross-validation lets the held-out rows influence what the model trains on.
// Supporting them honestly means refitting the imputation inside every fold; until
// that exists, offering them here would quietly make every reported error
// optimistic. Dropping rows and substituting a constant estimate nothing, so both
// are safe.
func applyMissingStrategy(opts *RegressOptions, data *pkgcsv.Data, targets map[string][]float64) error {
	strategy := strings.ToLower(opts.MissingStrategy)

	switch strategy {
	case "mean", "median":
		return fmt.Errorf(
			"--missing-strategy %s is not available for regression: imputing from column "+
				"statistics estimates values from the data, so applying it before "+
				"cross-validation would let the held-out rows influence the model and make "+
				"every reported error optimistic. Use drop or zero, or --method nipals "+
				"with --missing-strategy native", strategy)
	case "error", "drop", "zero", "native":
	default:
		return fmt.Errorf("invalid missing value strategy %q: expected error, drop, zero, "+
			"or native (NIPALS only)", opts.MissingStrategy)
	}

	selected := make([]int, data.Columns)
	for i := range selected {
		selected[i] = i
	}
	missing := data.GetMissingValueInfo(selected)
	if !missing.HasMissing() {
		return nil
	}

	if strategy == "native" {
		if strings.ToLower(opts.Method) != "nipals" {
			return fmt.Errorf("native missing-value handling requires --method nipals, not %s",
				opts.Method)
		}
		if opts.Verbose {
			fmt.Printf("NIPALS will handle %d missing predictor values natively.\n",
				missing.TotalMissing)
		}
		return nil
	}
	if strategy == "error" {
		return fmt.Errorf("missing predictor values detected (%d values across %d rows): "+
			"use --missing-strategy drop or zero, or --method nipals with "+
			"--missing-strategy native", missing.TotalMissing, len(missing.RowsAffected))
	}

	handler := core.NewMissingValueHandler(types.MissingValueStrategy(strategy))
	cleaned, err := handler.HandleMissingValues(data.Matrix, missing, selected)
	if err != nil {
		return fmt.Errorf("failed to handle missing values: %w", err)
	}

	if strategy == "drop" {
		dropped := make(map[int]bool, len(missing.RowsAffected))
		for _, row := range missing.RowsAffected {
			dropped[row] = true
		}

		// The response and any grouping column are indexed by row, so they must
		// lose exactly the same rows. Filtering the matrix alone would silently
		// pair each surviving spectrum with the wrong response.
		for name, values := range targets {
			targets[name] = filterByRow(values, dropped)
		}
		for name, values := range data.CategoricalColumns {
			data.CategoricalColumns[name] = filterCategoricalByRow(values, dropped)
		}
		if len(data.RowNames) > 0 {
			data.RowNames = filterCategoricalByRow(data.RowNames, dropped)
		}
		if opts.Verbose {
			fmt.Printf("Dropped %d rows with missing predictors; %d remain.\n",
				len(missing.RowsAffected), len(cleaned))
		}
	} else if opts.Verbose {
		fmt.Printf("Substituted zero for %d missing predictor values.\n", missing.TotalMissing)
	}

	data.Matrix = cleaned
	data.Rows = len(cleaned)
	return nil
}

func filterByRow(values []float64, dropped map[int]bool) []float64 {
	out := make([]float64, 0, len(values))
	for i, v := range values {
		if !dropped[i] {
			out = append(out, v)
		}
	}
	return out
}

func filterCategoricalByRow(values []string, dropped map[int]bool) []string {
	out := make([]string, 0, len(values))
	for i, v := range values {
		if !dropped[i] {
			out = append(out, v)
		}
	}
	return out
}

// buildPCRConfig turns command line options into an engine configuration.
func buildPCRConfig(opts *RegressOptions, data *pkgcsv.Data,
	categorical map[string][]string) (types.PCRConfig, error) {

	config := types.PCRConfig{
		PCA: types.PCAConfig{
			Method:          strings.ToLower(opts.Method),
			MeanCenter:      !opts.NoMeanCentering,
			StandardScale:   opts.Scale == "standard",
			RobustScale:     opts.Scale == "robust",
			ScaleOnly:       opts.ScaleOnly,
			SNV:             opts.SNV,
			VectorNorm:      opts.VectorNorm,
			MissingStrategy: types.MissingValueStrategy(strings.ToLower(opts.MissingStrategy)),
		},
		Response: opts.Response,
	}
	opts.SavGol.applyTo(&config.PCA)

	if opts.Scale != "none" && opts.Scale != "standard" && opts.Scale != "robust" {
		return config, fmt.Errorf("invalid scale %q: expected none, standard or robust", opts.Scale)
	}

	if opts.Components > 0 {
		config.PCA.Components = opts.Components
		config.Selection = types.SelectionConfig{
			Mode:   "fixed",
			Fixed:  opts.Components,
			Metric: opts.Metric,
		}
		return config, nil
	}

	config.PCA.Components = opts.MaxComponents

	folds, err := parseFolds(opts.CV)
	if err != nil {
		return config, err
	}

	scheme := strings.ToLower(opts.CVScheme)
	switch scheme {
	case types.CVRandom, types.CVContiguous, types.CVForwardChaining:
	default:
		return config, fmt.Errorf("invalid --cv-scheme %q: expected %s, %s or %s",
			opts.CVScheme, types.CVRandom, types.CVContiguous, types.CVForwardChaining)
	}

	cv := types.CVConfig{
		Scheme:  scheme,
		Folds:   folds,
		Repeats: opts.CVRepeats,
		Seed:    opts.CVSeed,
	}

	if opts.CVGroup != "" {
		levels, ok := categorical[opts.CVGroup]
		if !ok {
			return config, unknownGroupError(opts.CVGroup, categorical)
		}
		if len(levels) != data.Rows {
			return config, fmt.Errorf("grouping column %q has %d values but the data has %d rows",
				opts.CVGroup, len(levels), data.Rows)
		}
		cv.GroupBy = opts.CVGroup
		cv.Groups = encodeGroups(levels)
	}

	config.Selection = types.SelectionConfig{
		Mode:      "cv",
		Metric:    opts.Metric,
		Rule:      strings.ToLower(opts.Select),
		Tolerance: opts.Tolerance,
		WoldR:     opts.WoldR,
		CV:        cv,
	}
	return config, nil
}

// withFoldAdvice adds the way out of a too-many-folds error, in this command's
// own vocabulary.
//
// The engine states the constraint and names no remedy on purpose: leave-one-out
// is spelled K = 0 inside the engine, "Leave one out" in GoPCA Desktop's menu,
// and --cv loo here -- with 0 refused outright by parseFolds below. A remedy
// written in the engine had to be wrong for somebody, and it was: the message
// advised "use 0", and a user who followed it hit "invalid --cv 0" (#973).
//
// Any other error passes through untouched.
func withFoldAdvice(err error) error {
	var tooMany *crossval.TooManyFolds
	if !errors.As(err, &tooMany) {
		return err
	}
	return fmt.Errorf("%w. Use --cv %d or fewer, or --cv loo for leave-one-out",
		err, tooMany.Available)
}

// parseFolds accepts a fold count or the word "loo".
//
// Leave-one-out is expressed as zero folds, which the engine reads as "as many
// folds as there are groups". With the default grouping of one row per group that
// is K-fold at K equal to the row count, so the two spellings describe one design
// rather than two algorithms.
func parseFolds(value string) (int, error) {
	trimmed := strings.ToLower(strings.TrimSpace(value))
	if trimmed == "loo" || trimmed == "leave-one-out" {
		return 0, nil
	}
	folds, err := strconv.Atoi(trimmed)
	if err != nil {
		return 0, fmt.Errorf("invalid --cv %q: expected a number of folds or \"loo\"", value)
	}
	if folds < 2 {
		return 0, fmt.Errorf("invalid --cv %d: use at least 2 folds, or \"loo\" for "+
			"leave-one-out", folds)
	}
	return folds, nil
}

// encodeGroups maps categorical levels to dense integer identifiers, ordered by
// first appearance so that the same file always yields the same design.
func encodeGroups(levels []string) []int {
	ids := make(map[string]int, len(levels))
	groups := make([]int, len(levels))
	for i, level := range levels {
		id, seen := ids[level]
		if !seen {
			id = len(ids)
			ids[level] = id
		}
		groups[i] = id
	}
	return groups
}

// listResponses prints the columns that can serve as a response.
//
// Categorical targets are listed separately rather than omitted. A user who
// marked a column with #target and cannot find it in the list is owed the reason.
func listResponses(inputFile string, targets map[string][]float64,
	categorical map[string][]string) error {

	names := sortedKeys(targets)

	fmt.Printf("\nResponses available in %s\n", inputFile)
	fmt.Println("──────────────────────────────────────────────────────────────")
	if len(names) == 0 {
		fmt.Println("  (none)")
	}
	for _, name := range names {
		observed, total := countObserved(targets[name])
		note := ""
		if observed < total {
			note = fmt.Sprintf("   %d of %d rows observed", observed, total)
		}
		fmt.Printf("  %-32s numeric%s\n", name, note)
	}

	var skipped []string
	for _, name := range sortedStringKeys(categorical) {
		if strings.Contains(strings.ToLower(name), "#target") {
			skipped = append(skipped, name)
		}
	}
	if len(skipped) > 0 {
		fmt.Println("\nMarked as targets but not usable as a regression response:")
		for _, name := range skipped {
			fmt.Printf("  %-32s categorical\n", name)
		}
		fmt.Println("\nPrincipal component regression predicts a numeric quantity. Predicting a\n" +
			"category is classification, which this tool does not do.")
	}
	fmt.Println()
	return nil
}

// warnIfResponseLooksCategorical prints the shared response advisories.
//
// The detection and the wording live in internal/core so that GoPCA Desktop
// gives the same caution; they were CLI-only at first, which meant the front end
// where a reader is likelier to pick a class-coded column by accident was the one
// that said nothing. This function is now only about presenting them on a
// terminal.
func warnIfResponseLooksCategorical(name string, y []float64) {
	for _, advisory := range core.ResponseAdvisories(name, y) {
		fmt.Printf("%s\n\n", wrapForTerminal("Warning: "+advisory, terminalWidth, "  "))
	}
}

// terminalWidth is the column the CLI's prose wraps at, matching the hand-wrapped
// explanatory text elsewhere in this file.
const terminalWidth = 78

// wrapForTerminal breaks a paragraph so that no rendered line exceeds width,
// indenting every line after the first.
//
// The indent counts against the width, and so does whatever the caller has
// already put on the front of the text. Measuring only the words is the easy
// mistake: it produces a first line as long as the prefix is wide and
// continuation lines as long as the indent, which is how this looked before the
// two were accounted for.
//
// The advisories themselves are stored unwrapped, because the desktop lays them
// out itself; only this side needs fixed columns.
func wrapForTerminal(text string, width int, indent string) string {
	words := strings.Fields(text)
	if len(words) == 0 {
		return ""
	}
	var b strings.Builder
	line := words[0]
	wrapped := false
	for _, w := range words[1:] {
		used := len(line)
		if wrapped {
			used += len(indent)
		}
		if used+1+len(w) > width {
			b.WriteString(line)
			b.WriteString("\n")
			b.WriteString(indent)
			line = w
			wrapped = true
			continue
		}
		line += " " + w
	}
	b.WriteString(line)
	return b.String()
}

func countObserved(values []float64) (observed, total int) {
	for _, v := range values {
		if !math.IsNaN(v) && !math.IsInf(v, 0) {
			observed++
		}
	}
	return observed, len(values)
}

func unknownResponseError(name string, targets map[string][]float64,
	categorical map[string][]string) error {

	if _, isCategorical := categorical[name]; isCategorical {
		return fmt.Errorf("column %q is categorical, so it cannot be a regression response: "+
			"principal component regression predicts a numeric quantity, and predicting a "+
			"category is classification", name)
	}
	available := sortedKeys(targets)
	if len(available) == 0 {
		return fmt.Errorf("no numeric #target column found: mark the response column with "+
			"a #target suffix, or pass --target-columns %s", name)
	}
	return fmt.Errorf("unknown response %q: available responses are %s",
		name, strings.Join(available, ", "))
}

func unknownGroupError(name string, categorical map[string][]string) error {
	available := sortedStringKeys(categorical)
	if len(available) == 0 {
		return fmt.Errorf("unknown grouping column %q: the file has no categorical columns", name)
	}
	return fmt.Errorf("unknown grouping column %q: available categorical columns are %s",
		name, strings.Join(available, ", "))
}

// sortedKeys returns map keys in a stable order.
//
// Map iteration order is deliberately random in Go, so listing responses straight
// from the map would reshuffle them between runs and make scripted output
// non-reproducible.
func sortedKeys(m map[string][]float64) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func sortedStringKeys(m map[string][]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
