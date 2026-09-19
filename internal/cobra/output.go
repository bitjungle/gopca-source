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
)

// outputTableFormat outputs PCA results in table format
func outputTableFormat(result *types.PCAResult, data *pkgcsv.Data,
	outputScores, outputLoadings, outputVariance, includeMetrics bool, varianceExplained float64,
	config types.PCAConfig) error {

	// What was done to the data before the decomposition, stated once at the top.
	// Without it two runs that transformed the data completely differently produce
	// output distinguishable only by its digits (#982).
	fmt.Printf("\nPreprocessing: %s\n", describePreprocessing(config))

	// Diagnostics (Q/T²) are computed once by the shared core pipeline
	// (AttachDiagnostics) and attached to result.Metrics; reuse them. They are
	// empty for methods where per-sample reconstruction does not apply — kernel
	// and temporal PCA, and NIPALS with native missing values — in which case a
	// placeholder keeps the table columns aligned.
	var metrics []types.SampleMetrics
	if includeMetrics && outputScores {
		if len(result.Metrics) > 0 {
			metrics = result.Metrics
		} else {
			metrics = make([]types.SampleMetrics, len(result.Scores))
		}
	}

	// Output scores table
	if outputScores {
		fmt.Println("\nPCA Scores:")
		fmt.Println("──────────────────────────────────────────────────────────────")

		// Print headers
		fmt.Printf("%-15s", "Sample_ID")
		for i := 0; i < len(result.ComponentLabels); i++ {
			fmt.Printf("%12s", result.ComponentLabels[i])
		}
		if includeMetrics {
			fmt.Printf("%15s%18s%10s%10s", "Hotelling T²", "Mahalanobis Dist", "RSS", "Outlier")
		}
		fmt.Println()
		fmt.Println("──────────────────────────────────────────────────────────────")

		// Add data rows (show first 20 and last 5 for large datasets)
		nRows := len(result.Scores)
		rowsToShow := nRows
		if nRows > 25 {
			rowsToShow = 25
		}

		for i := 0; i < rowsToShow; i++ {
			rowIdx := i
			if i >= 20 && nRows > 25 {
				// Skip to last 5 rows
				rowIdx = nRows - (25 - i)
				if i == 20 {
					// Add ellipsis row
					fmt.Printf("%-15s", "...")
					for j := 0; j < len(result.ComponentLabels); j++ {
						fmt.Printf("%12s", "...")
					}
					if includeMetrics {
						fmt.Printf("%15s%18s%10s%10s", "...", "...", "...", "...")
					}
					fmt.Println()
				}
			}

			// Sample ID
			sampleID := fmt.Sprintf("Sample_%d", rowIdx+1)
			if rowIdx < len(data.RowNames) {
				sampleID = data.RowNames[rowIdx]
			}
			fmt.Printf("%-15s", sampleID)

			// PC scores
			for j := 0; j < len(result.ComponentLabels); j++ {
				fmt.Printf("%12.4f", result.Scores[rowIdx][j])
			}

			// Metrics
			if includeMetrics && metrics != nil {
				metric := metrics[rowIdx]
				outlierStr := "False"
				if metric.IsOutlier {
					outlierStr = "True"
				}
				fmt.Printf("%15.4f%18.4f%10.4f%10s",
					metric.HotellingT2, metric.Mahalanobis, metric.RSS, outlierStr)
			}

			fmt.Println()
		}

		if nRows > 25 {
			fmt.Printf("\nShowing first 20 and last 5 of %d samples\n", nRows)
		}
	}

	// Output loadings table (skip for kernel PCA and temporal PCA which have different loading structures)
	if outputLoadings {
		if result.Method != "kernel" && result.Method != "temporal" {
			fmt.Println("\nPCA Loadings:")
			fmt.Println("──────────────────────────────────────────────────────────────")

			// Print headers
			fmt.Printf("%-25s", "Variable")
			for i := 0; i < len(result.ComponentLabels); i++ {
				fmt.Printf("%12s", result.ComponentLabels[i])
			}
			fmt.Println()
			fmt.Println("──────────────────────────────────────────────────────────────")

			// Add loading rows (show first 20 and last 5 for large datasets)
			nFeatures := len(data.Headers)
			featuresToShow := nFeatures
			if nFeatures > 25 {
				featuresToShow = 25
			}

			for i := 0; i < featuresToShow; i++ {
				featureIdx := i
				if i >= 20 && nFeatures > 25 {
					// Skip to last 5 features
					featureIdx = nFeatures - (25 - i)
					if i == 20 {
						// Add ellipsis row
						fmt.Printf("%-25s", "...")
						for j := 0; j < len(result.ComponentLabels); j++ {
							fmt.Printf("%12s", "...")
						}
						fmt.Println()
					}
				}

				fmt.Printf("%-25s", data.Headers[featureIdx])
				for j := 0; j < len(result.ComponentLabels); j++ {
					fmt.Printf("%12.4f", result.Loadings[featureIdx][j])
				}
				fmt.Println()
			}

			if nFeatures > 25 {
				fmt.Printf("\nShowing first 20 and last 5 of %d features\n", nFeatures)
			}
		} else if result.Method == "kernel" {
			fmt.Println("\nNote: Loadings are not available for Kernel PCA")
		} else if result.Method == "temporal" {
			fmt.Println("\nNote: Temporal PCA loadings have a different structure (components × lagged features)")
		}
	}

	// Output variance table
	if outputVariance {
		fmt.Println("\nExplained Variance:")
		fmt.Println("──────────────────────────────────────────────────────────────")
		fmt.Printf("%-15s%15s%15s\n", "Component", "Variance", "Cumulative")
		fmt.Println("──────────────────────────────────────────────────────────────")

		// The engine reports fractions of 1; a reader wants percentages, so the
		// conversion happens here at the point of display rather than in the
		// values themselves (#848).
		for i := 0; i < len(result.ComponentLabels); i++ {
			fmt.Printf("%-15s%14.1f%%%14.1f%%\n",
				result.ComponentLabels[i],
				result.ExplainedVarRatio[i]*100,
				result.CumulativeVar[i]*100)
		}

		// Add feedback when variance explained criterion was used
		if varianceExplained > 0 {
			fmt.Printf("\n✓ Selected %d components to achieve %.1f%% cumulative variance (target: %.1f%%)\n",
				len(result.ComponentLabels),
				result.CumulativeVar[len(result.ComponentLabels)-1]*100,
				varianceExplained*100)
		}
	}

	// Output diagnostic limits if available
	if includeMetrics && (result.T2Limit95 > 0 || result.QLimit95 > 0) {
		fmt.Println("\nDiagnostic Confidence Limits:")
		fmt.Println("──────────────────────────────────────────────────────────────")
		fmt.Printf("%-30s%20s%20s\n", "Metric", "95% Limit", "99% Limit")
		fmt.Println("──────────────────────────────────────────────────────────────")

		if result.T2Limit95 > 0 {
			fmt.Printf("%-30s%20.4f%20.4f\n", "Hotelling's T²", result.T2Limit95, result.T2Limit99)
		}
		if result.QLimit95 > 0 {
			fmt.Printf("%-30s%20.4f%20.4f\n", "Q-residuals (SPE)", result.QLimit95, result.QLimit99)
		}
	}

	return nil
}

// outputJSONFormat outputs PCA results in JSON format
func outputJSONFormat(result *types.PCAResult, data *pkgcsv.Data, preprocessedData types.Matrix, inputFile string,
	opts *AnalyzeOptions, config types.PCAConfig, preprocessor *core.Preprocessor,
	categoricalData map[string][]string, targetData map[string][]float64) error {

	// Create export metadata with input filename
	exportMeta := &pkgcsv.ExportMetadata{
		InputFilename: filepath.Base(inputFile),
	}
	// Convert to PCAOutputData with metadata
	outputData := pkgcsv.ConvertToPCAOutputDataWithMetadata(result, data, preprocessedData, opts.IncludeMetrics,
		config, preprocessor, categoricalData, targetData, exportMeta)

	// Generate output paths
	outputFile := generateOutputPath(inputFile, opts.OutputDir, "_pca.json")

	// Create output directory if needed
	if opts.OutputDir != "" {
		if err := os.MkdirAll(opts.OutputDir, 0750); err != nil {
			return fmt.Errorf("failed to create output directory: %w", err)
		}
	}

	// Marshal JSON
	jsonData, err := json.MarshalIndent(outputData, "", "  ")
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

// generateOutputPath creates an output file path based on input file and format
func generateOutputPath(inputFile, outputDir, suffix string) string {
	// Get the directory and base name of the input file
	dir := filepath.Dir(inputFile)
	base := filepath.Base(inputFile)

	// Remove extension to get the base name
	ext := filepath.Ext(base)
	baseName := strings.TrimSuffix(base, ext)

	// Use output directory if specified, otherwise use input directory
	if outputDir != "" {
		dir = outputDir
	}

	return filepath.Join(dir, baseName+suffix)
}
