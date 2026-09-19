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
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/bitjungle/gopca/internal/core"
	pkgcsv "github.com/bitjungle/gopca/pkg/csv"
	"github.com/bitjungle/gopca/pkg/types"
)

// maxListedRows caps how many rows of a per-sample table are printed before the
// middle is elided.
const maxListedRows = 20

// maxListedCoefficients caps how many regression coefficients are printed. On
// spectra there can be a thousand, and a wall of numbers hides the few that
// matter.
const maxListedCoefficients = 15

// outputRegressTable prints a human-readable summary.
//
// The three error figures are printed with their distinct names and a note about
// what each one means. RMSEC in particular is easy to mistake for a performance
// estimate, and on a well-fitted model it is the smallest and most flattering of
// the three.
func outputRegressTable(result *types.PCRResult, data *pkgcsv.Data, opts *RegressOptions,
	config types.PCAConfig) error {
	fmt.Printf("\nPrincipal Component Regression: %s\n", result.Response)
	fmt.Println("──────────────────────────────────────────────────────────────")
	fmt.Printf("  Components retained     %d\n", result.Components)
	fmt.Printf("  Rows with a response    %d\n", len(result.LabelledRows))
	if len(result.ExcludedRows) > 0 {
		fmt.Printf("  Rows without a response %d  (used for the decomposition only)\n",
			len(result.ExcludedRows))
	}
	fmt.Printf("  Predictors              %d\n", len(result.PCA.Loadings))
	fmt.Printf("  Method                  %s\n", result.PCA.Method)
	fmt.Printf("  Preprocessing           %s\n", describePreprocessing(config))

	fmt.Println("\nError")
	fmt.Println("──────────────────────────────────────────────────────────────")
	fmt.Printf("  RMSEC   %12.6g   training residuals; describes the fit, not future performance\n",
		result.RMSEC)
	fmt.Printf("  R2C     %12.6g\n", result.R2C)

	if result.CV != nil {
		i := indexOfCandidate(result.CV, result.Components)
		if i >= 0 {
			// Which of the two held-out figures actually drove the choice depends
			// on --metric. Attributing the selection to RMSECV regardless would
			// credit a number that was never compared against anything whenever
			// the user selected on MAE.
			if result.CV.Metric == types.MetricMAE {
				fmt.Printf("  RMSECV  %12.6g   held out\n", result.CV.RMSECV[i])
				fmt.Printf("  MAE     %12.6g   held out; this is what chose the component count\n",
					result.CV.MAE[i])
			} else {
				fmt.Printf("  RMSECV  %12.6g   held out; this is what chose the component count\n",
					result.CV.RMSECV[i])
				fmt.Printf("  MAE     %12.6g   held out\n", result.CV.MAE[i])
			}
			fmt.Printf("  Q2      %12.6g\n", result.CV.Q2[i])
			fmt.Printf("  bias    %12.6g   mean signed error; a large value with a small SEP\n",
				result.CV.Bias[i])
			fmt.Printf("  SEP     %12.6g   is a precise model with a systematic offset\n",
				result.CV.SEP[i])
		}
		fmt.Printf("\n  Design  %s, seed %d", result.CV.Design, result.CV.Seed)
		if result.CV.GroupBy != "" {
			fmt.Printf(", grouped by %s", result.CV.GroupBy)
		}
		fmt.Printf("\n  Rule    %s on %s\n", result.CV.Rule, metricLabel(result.CV.Metric))
		if result.CV.SelectedByAlternateMetric != result.CV.Selected {
			other := "MAE"
			if result.CV.Metric == types.MetricMAE {
				other = "RMSE"
			}
			fmt.Printf("\n  Note    scoring by %s would have chosen %d components rather than %d.\n"+
				"          The two disagree when a few large residuals drive the choice:\n"+
				"          RMSE is driven by the largest of them, MAE by the typical one.\n",
				other, result.CV.SelectedByAlternateMetric, result.CV.Selected)
		}
		printSelectionCurve(result.CV)
	} else {
		fmt.Println("\n  No cross-validation was run, because the component count was fixed.\n" +
			"  RMSEC above is the only error figure available, and it is a description\n" +
			"  of the fit rather than an estimate of performance. Drop --components to\n" +
			"  have the count chosen by cross-validation and get a held-out figure.")
	}

	// Printed whether or not cross-validation ran. With a fixed component count
	// RMSEC is the only number on screen, which is exactly when it is most likely
	// to be read as something it is not.
	fmt.Println("\n  RMSEP is not reported: it requires a test set held out of model\n" +
		"  development entirely, which this command does not create.")

	printCoefficients(result, data)
	printPredictions(result, data)

	if opts.OutputDir != "" {
		return writeRegressFiles(result, data, opts)
	}
	return nil
}

// printSelectionCurve prints the cross-validated error against component count,
// which is the plot a user would otherwise have to draw to justify the choice.
func printSelectionCurve(report *types.CVReport) {
	// The column shown is the one the rule read. Printing RMSECV while marking a
	// row chosen on MAE would put the selection marker beside a number that had
	// no part in choosing it.
	curve, label := report.RMSECV, "RMSECV"
	if report.Metric == types.MetricMAE {
		curve, label = report.MAE, "MAE"
	}

	fmt.Println("\nCross-validated error by component count")
	fmt.Println("──────────────────────────────────────────────────────────────")
	fmt.Printf("  %3s %14s %12s %10s\n", "k", label, "Q2", "")
	for i, k := range report.Candidates {
		marker := ""
		if k == report.Selected {
			marker = "  <- selected"
		}
		fmt.Printf("  %3d %14.6g %12.4f%s\n", k, curve[i], report.Q2[i], marker)
	}
	if len(report.Candidates) > 0 && report.Candidates[0] == 0 {
		fmt.Println("\n  k=0 is the intercept-only baseline: it predicts the training mean.")
	}

	// A selection that lands on the last candidate is not evidence that the last
	// candidate is best; it is evidence that the sweep stopped too early. The
	// curve was still improving when it ran out of room, and the reported error is
	// the best of a range that was cut short rather than a minimum.
	if len(report.Candidates) > 1 {
		last := report.Candidates[len(report.Candidates)-1]
		if report.Selected == last {
			fmt.Printf("\n  Note: the search stopped at its ceiling of %d components and the\n"+
				"  error was still falling. Raise --max-components to see whether it\n"+
				"  keeps improving; the value chosen here is the end of the range, not\n"+
				"  a minimum within it.\n", last)
		}
	}
}

// printCoefficients prints the original-scale coefficients, largest first.
func printCoefficients(result *types.PCRResult, data *pkgcsv.Data) {
	if !result.OriginalScaleValid {
		fmt.Println("\nRegression coefficients")
		fmt.Println("──────────────────────────────────────────────────────────────")
		fmt.Println("  Not available. Row-wise preprocessing (SNV or vector normalization)")
		fmt.Println("  scales each sample by a statistic of that same sample, so no fixed set")
		fmt.Println("  of per-variable coefficients reproduces the model's predictions.")
		fmt.Println("  The model still predicts correctly through the full pipeline.")
		return
	}

	type coefficient struct {
		name  string
		value float64
	}
	coefficients := make([]coefficient, len(result.Coefficients))
	for i, v := range result.Coefficients {
		name := fmt.Sprintf("Variable %d", i+1)
		if i < len(data.Headers) && data.Headers[i] != "" {
			name = data.Headers[i]
		}
		coefficients[i] = coefficient{name: name, value: v}
	}
	sort.SliceStable(coefficients, func(a, b int) bool {
		return math.Abs(coefficients[a].value) > math.Abs(coefficients[b].value)
	})

	shown := len(coefficients)
	if shown > maxListedCoefficients {
		shown = maxListedCoefficients
	}

	fmt.Printf("\nRegression coefficients (largest %d of %d, original scale)\n",
		shown, len(coefficients))
	fmt.Println("──────────────────────────────────────────────────────────────")
	fmt.Printf("  %-32s %16s\n", "Variable", "Coefficient")
	for i := 0; i < shown; i++ {
		fmt.Printf("  %-32s %16.8g\n", truncate(coefficients[i].name, 32), coefficients[i].value)
	}
	fmt.Printf("  %-32s %16.8g\n", "(intercept)", result.InterceptOriginal)
}

// printPredictions prints measured against predicted for the labelled rows.
func printPredictions(result *types.PCRResult, data *pkgcsv.Data) {
	fmt.Println("\nPredicted against measured")
	fmt.Println("──────────────────────────────────────────────────────────────")

	header := "  %-20s %14s %14s %14s"
	fmt.Printf(header+"\n", "Sample", "Measured", "Fitted", "Residual")
	if result.CV != nil && len(result.CV.OutOfFold) == len(result.LabelledRows) {
		fmt.Printf("  %-20s %14s %14s %14s %14s\n", "", "", "", "", "Held-out")
	}

	shown := len(result.LabelledRows)
	if shown > maxListedRows {
		shown = maxListedRows
	}
	for i := 0; i < shown; i++ {
		row := result.LabelledRows[i]
		name := fmt.Sprintf("Row %d", row+1)
		if row < len(data.RowNames) && data.RowNames[row] != "" {
			name = data.RowNames[row]
		}
		measured := result.Fitted[i] + result.Residuals[i]
		fmt.Printf(header, truncate(name, 20), formatFloat(measured),
			formatFloat(result.Fitted[i]), formatFloat(result.Residuals[i]))
		if result.CV != nil && len(result.CV.OutOfFold) == len(result.LabelledRows) {
			fmt.Printf(" %14s", formatFloat(result.CV.OutOfFold[i]))
		}
		fmt.Println()
	}
	if len(result.LabelledRows) > shown {
		fmt.Printf("  ... %d more rows\n", len(result.LabelledRows)-shown)
	}
}

// outputRegressJSON writes the full result as JSON.
func outputRegressJSON(result *types.PCRResult, data *pkgcsv.Data,
	inputFile string, opts *RegressOptions) error {

	encoded, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to encode result: %w", err)
	}

	if opts.OutputDir == "" {
		fmt.Println(string(encoded))
		return nil
	}

	if err := os.MkdirAll(opts.OutputDir, 0o755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}
	path := generateOutputPath(inputFile, opts.OutputDir, "_pcr.json")
	if err := os.WriteFile(path, encoded, 0o600); err != nil {
		return fmt.Errorf("failed to write %s: %w", path, err)
	}
	fmt.Printf("\nResults saved to: %s\n", path)
	return writeRegressFiles(result, data, opts)
}

// writeRegressFiles writes the per-sample predictions, the coefficients and the
// selection curve as CSV, so that the numbers behind the summary can be plotted.
func writeRegressFiles(result *types.PCRResult, data *pkgcsv.Data, opts *RegressOptions) error {
	if err := os.MkdirAll(opts.OutputDir, 0o755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	predictions := &strings.Builder{}
	predictions.WriteString("sample,measured,fitted,residual")
	hasOOF := result.CV != nil && len(result.CV.OutOfFold) == len(result.LabelledRows)
	if hasOOF {
		predictions.WriteString(",held_out")
	}
	predictions.WriteString("\n")
	for i, row := range result.LabelledRows {
		name := fmt.Sprintf("Row %d", row+1)
		if row < len(data.RowNames) && data.RowNames[row] != "" {
			name = data.RowNames[row]
		}
		measured := result.Fitted[i] + result.Residuals[i]
		fmt.Fprintf(predictions, "%s,%g,%g,%g", csvField(name), measured,
			result.Fitted[i], result.Residuals[i])
		if hasOOF {
			fmt.Fprintf(predictions, ",%g", result.CV.OutOfFold[i])
		}
		predictions.WriteString("\n")
	}
	if err := writeRegressFile(opts.OutputDir, "pcr_predictions.csv", predictions.String()); err != nil {
		return err
	}

	if result.OriginalScaleValid {
		coefficients := &strings.Builder{}
		coefficients.WriteString("variable,coefficient\n")
		for i, v := range result.Coefficients {
			name := fmt.Sprintf("Variable %d", i+1)
			if i < len(data.Headers) && data.Headers[i] != "" {
				name = data.Headers[i]
			}
			fmt.Fprintf(coefficients, "%s,%g\n", csvField(name), v)
		}
		fmt.Fprintf(coefficients, "%s,%g\n", "(intercept)", result.InterceptOriginal)
		if err := writeRegressFile(opts.OutputDir, "pcr_coefficients.csv",
			coefficients.String()); err != nil {
			return err
		}
	}

	if result.CV != nil {
		curve := &strings.Builder{}
		curve.WriteString("components,rmsecv,rmsecv_mean,rmsecv_se,bias,sep,mae,q2,selected\n")
		for i, k := range result.CV.Candidates {
			selected := 0
			if k == result.CV.Selected {
				selected = 1
			}
			fmt.Fprintf(curve, "%d,%g,%g,%g,%g,%g,%g,%g,%d\n", k,
				result.CV.RMSECV[i], result.CV.RMSECVMean[i], result.CV.RMSECVSE[i],
				result.CV.Bias[i], result.CV.SEP[i], result.CV.MAE[i], result.CV.Q2[i], selected)
		}
		if err := writeRegressFile(opts.OutputDir, "pcr_selection_curve.csv",
			curve.String()); err != nil {
			return err
		}
	}
	return nil
}

func writeRegressFile(dir, name, content string) error {
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		return fmt.Errorf("failed to write %s: %w", path, err)
	}
	fmt.Printf("Wrote %s\n", path)
	return nil
}

// csvField quotes a field when it contains a character that would otherwise
// change the shape of the row.
func csvField(value string) string {
	if strings.ContainsAny(value, ",\"\n\r") {
		return `"` + strings.ReplaceAll(value, `"`, `""`) + `"`
	}
	return value
}

func indexOfCandidate(report *types.CVReport, k int) int {
	for i, candidate := range report.Candidates {
		if candidate == k {
			return i
		}
	}
	return -1
}

func truncate(value string, width int) string {
	if len(value) <= width {
		return value
	}
	if width <= 1 {
		return value[:width]
	}
	return value[:width-1] + "…"
}

func formatFloat(v float64) string {
	if math.IsNaN(v) {
		return "-"
	}
	return fmt.Sprintf("%.6g", v)
}

// writeRegressModel exports a model file that pca transform can apply to new data.
//
// The artifact is the ordinary PCA model with a regression block attached, so a
// consumer that only understands the decomposition can still read it. That is why
// the block is additive rather than a separate format: one file type, and the two
// commands stay interchangeable.
func writeRegressModel(result *types.PCRResult, data *pkgcsv.Data, inputFile string,
	opts *RegressOptions, config types.PCRConfig, preprocessor *core.Preprocessor,
	categorical map[string][]string, targets map[string][]float64) error {

	model := pkgcsv.ConvertToPCROutputData(result, data, false, config.PCA, preprocessor,
		categorical, targets, &pkgcsv.ExportMetadata{InputFilename: filepath.Base(inputFile)})

	encoded, err := json.MarshalIndent(model, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to encode the model: %w", err)
	}

	path := filepath.Join(opts.OutputDir, "pcr_model.json")
	if err := os.WriteFile(path, encoded, 0o600); err != nil {
		return fmt.Errorf("failed to write %s: %w", path, err)
	}
	fmt.Printf("Wrote %s\n", path)
	fmt.Printf("  Apply it with: pca transform %s <new_data.csv>\n", path)
	return nil
}

// metricLabel names an error curve as a reader sees it. The report's Metric is
// the empty string on models written before the field existed, which means RMSE.
func metricLabel(metric string) string {
	if metric == types.MetricMAE {
		return "MAE"
	}
	return "RMSECV"
}
