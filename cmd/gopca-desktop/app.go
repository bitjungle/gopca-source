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
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/bitjungle/gopca/internal/config"
	"github.com/bitjungle/gopca/internal/core"
	"github.com/bitjungle/gopca/internal/datasets"
	"github.com/bitjungle/gopca/internal/utils"
	"github.com/bitjungle/gopca/internal/version"
	pkgcsv "github.com/bitjungle/gopca/pkg/csv"
	"github.com/bitjungle/gopca/pkg/integration"
	"github.com/bitjungle/gopca/pkg/types"
	"github.com/bitjungle/gopca/pkg/validation"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"gonum.org/v1/gonum/mat"
)

// App struct
type App struct {
	ctx             context.Context
	fileToOpen      string
	tutorialDataset string // non-empty when running as a tutorial window
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// SetFileToOpen sets the file path to open on startup
func (a *App) SetFileToOpen(path string) {
	a.fileToOpen = path
}

// SetTutorialDataset marks this instance as a tutorial window for the given dataset.
// Must be called before Wails starts (i.e. before wails.Run).
func (a *App) SetTutorialDataset(dataset string) {
	a.tutorialDataset = dataset
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// If a file was specified via --open, emit an event to load it
	if a.fileToOpen != "" {
		// Give the frontend a moment to set up event listeners
		go func() {
			time.Sleep(500 * time.Millisecond)
			runtime.LogInfo(a.ctx, fmt.Sprintf("Emitting load-file-on-startup event with file: %s", a.fileToOpen))
			runtime.EventsEmit(a.ctx, "load-file-on-startup", a.fileToOpen)
		}()
	}
}

// GetVersion returns the application version
func (a *App) GetVersion() string {
	return version.Get().Short()
}

// LoadCSVFile loads a CSV file from the given path
func (a *App) LoadCSVFile(filePath string) (*FileDataJSON, error) {
	// Read file content
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// Parse the CSV content
	return a.ParseCSV(string(content))
}

// CalculateEllipsesRequest represents a request to calculate confidence ellipses
type CalculateEllipsesRequest struct {
	Scores      [][]float64 `json:"scores"`
	GroupLabels []string    `json:"groupLabels"`
	XComponent  int         `json:"xComponent"`
	YComponent  int         `json:"yComponent"`
}

// CalculateEllipsesResponse represents the response with calculated ellipses
type CalculateEllipsesResponse struct {
	GroupEllipses90 map[string]EllipseParams `json:"groupEllipses90"`
	GroupEllipses95 map[string]EllipseParams `json:"groupEllipses95"`
	GroupEllipses99 map[string]EllipseParams `json:"groupEllipses99"`
	Success         bool                     `json:"success"`
	Error           string                   `json:"error,omitempty"`
}

// CalculateEllipses calculates confidence ellipses for given scores and groups
func (a *App) CalculateEllipses(request CalculateEllipsesRequest) CalculateEllipsesResponse {
	// Validate input
	if len(request.Scores) == 0 || len(request.GroupLabels) == 0 {
		return CalculateEllipsesResponse{
			Success: false,
			Error:   "Invalid input: scores and group labels are required",
		}
	}

	if len(request.Scores) != len(request.GroupLabels) {
		return CalculateEllipsesResponse{
			Success: false,
			Error:   fmt.Sprintf("Scores and group labels must have the same length (scores: %d, labels: %d)", len(request.Scores), len(request.GroupLabels)),
		}
	}

	// Validate scores structure
	if len(request.Scores[0]) == 0 {
		return CalculateEllipsesResponse{
			Success: false,
			Error:   "Scores matrix has no columns",
		}
	}

	// Check component indices
	maxComponent := len(request.Scores[0]) - 1
	if request.XComponent < 0 || request.XComponent > maxComponent || request.YComponent < 0 || request.YComponent > maxComponent {
		return CalculateEllipsesResponse{
			Success: false,
			Error:   fmt.Sprintf("Component indices out of bounds (x: %d, y: %d, max: %d)", request.XComponent, request.YComponent, maxComponent),
		}
	}

	// Convert scores to matrix
	scoresMatrix := mat.NewDense(len(request.Scores), len(request.Scores[0]), nil)
	for i, row := range request.Scores {
		for j, val := range row {
			scoresMatrix.Set(i, j, val)
		}
	}

	// Calculate ellipses for all three confidence levels
	response := CalculateEllipsesResponse{
		Success:         true,
		GroupEllipses90: make(map[string]EllipseParams),
		GroupEllipses95: make(map[string]EllipseParams),
		GroupEllipses99: make(map[string]EllipseParams),
	}

	confidenceLevels := []float64{0.90, 0.95, 0.99}
	allErrors := []string{}
	for _, confidenceLevel := range confidenceLevels {
		coreEllipses, err := core.CalculateGroupEllipses(scoresMatrix, request.GroupLabels, request.XComponent, request.YComponent, confidenceLevel)
		if err != nil {
			// Log error but continue with other confidence levels
			allErrors = append(allErrors, fmt.Sprintf("%.0f%%: %v", confidenceLevel*100, err))
		}
		if err == nil && len(coreEllipses) > 0 {
			ellipses := make(map[string]EllipseParams)
			for group, ellipse := range coreEllipses {
				ellipses[group] = EllipseParams{
					CenterX:         ellipse.CenterX,
					CenterY:         ellipse.CenterY,
					MajorAxis:       ellipse.MajorAxis,
					MinorAxis:       ellipse.MinorAxis,
					Angle:           ellipse.Angle,
					ConfidenceLevel: ellipse.ConfidenceLevel,
				}
			}

			switch confidenceLevel {
			case 0.90:
				response.GroupEllipses90 = ellipses
			case 0.95:
				response.GroupEllipses95 = ellipses
			case 0.99:
				response.GroupEllipses99 = ellipses
			}
		}
	}

	// If we have some ellipses but also some errors, include a warning
	if len(allErrors) > 0 && (len(response.GroupEllipses90) > 0 || len(response.GroupEllipses95) > 0 || len(response.GroupEllipses99) > 0) {
		// Some ellipses were calculated successfully, just log warnings
		fmt.Printf("Warning: Some ellipse calculations failed: %v\n", allErrors)
	} else if len(allErrors) > 0 && len(response.GroupEllipses90) == 0 && len(response.GroupEllipses95) == 0 && len(response.GroupEllipses99) == 0 {
		// No ellipses were calculated
		response.Success = false
		response.Error = fmt.Sprintf("Failed to calculate any ellipses: %v", allErrors)
	}

	return response
}

// FileData represents the structure of CSV data for the frontend
type FileData struct {
	Headers              []string             `json:"headers"`
	RowNames             []string             `json:"rowNames"`
	Data                 [][]float64          `json:"data"`
	MissingMask          [][]bool             `json:"missingMask,omitempty"`
	CategoricalColumns   map[string][]string  `json:"categoricalColumns,omitempty"`
	NumericTargetColumns map[string][]float64 `json:"numericTargetColumns,omitempty"`
}

// applySavGolSettings copies Savitzky-Golay settings onto an engine
// configuration, and refuses the one method that would discard them.
//
// Three paths reach the engine from this application -- running an analysis,
// running a regression, and exporting a model -- and each builds its own
// types.PCAConfig by hand. Sharing this one function does not make a forgotten
// call impossible, but it makes it a visibly missing line rather than three
// fields that quietly stayed zero. The export path is the one worth worrying
// about: a model written without the filter still loads, still transforms, and
// projects unfiltered data onto loadings fitted on filtered data.
//
// Temporal PCA is refused rather than ignored. It builds its own preprocessor
// and applies no transform along the variable axis, so a filter set here would
// be accepted and silently dropped -- which is exactly what --snv does today
// on that path (#889).
func applySavGolSettings(config *types.PCAConfig, window, polyOrder, deriv int) error {
	// Only zero means off. A negative window would otherwise be swallowed here
	// and the run would proceed unfiltered without a word, which is the failure
	// this whole path exists to avoid; the CLI rejects it for the same reason.
	if window < 0 {
		return fmt.Errorf("Savitzky-Golay window length must be a positive odd number, or 0 to disable the filter, got %d", window)
	}
	if window == 0 {
		return nil
	}
	if config.Method == "temporal" {
		return fmt.Errorf("Savitzky-Golay filtering is not supported with Temporal PCA: " +
			"it works along the time axis and applies no transform along the variable axis")
	}
	if err := (core.SavGolConfig{
		WindowLength: window,
		PolyOrder:    polyOrder,
		Deriv:        deriv,
	}).ValidateShape(); err != nil {
		return err
	}
	config.SavGolWindow = window
	config.SavGolPolyOrder = polyOrder
	config.SavGolDeriv = deriv
	return nil
}

// PreprocessPreviewRequest asks for the row stage applied to a handful of
// samples, so the interface can show what a filter did without running a
// decomposition.
//
// Data carries only the rows to be drawn, chosen by the caller. Nothing in the
// row stage is fitted, so those rows receive exactly what a full run would give
// them -- see core.PreviewRowStage. Sending a sample is therefore not an
// approximation, and it keeps both directions of the call small: a spectral
// dataset can be nine hundred rows of a thousand variables, and no plot can
// show that anyway.
type PreprocessPreviewRequest struct {
	Data            [][]float64 `json:"data"`
	SNV             bool        `json:"snv"`
	VectorNorm      bool        `json:"vectorNorm"`
	SavGolWindow    int         `json:"savgolWindow,omitempty"`
	SavGolPolyOrder int         `json:"savgolPolyOrder,omitempty"`
	SavGolDeriv     int         `json:"savgolDeriv,omitempty"`
}

// PreprocessPreviewResponse carries the processed rows, or the reason there are
// none.
type PreprocessPreviewResponse struct {
	Success bool        `json:"success"`
	Error   string      `json:"error,omitempty"`
	Data    [][]float64 `json:"data,omitempty"`
}

// PreprocessPreview applies the row stage to the rows it is given.
//
// Errors are returned in the response rather than thrown, because every one of
// them is a configuration the user is in the middle of typing -- an even window,
// an order above the window -- and an exception for a half-finished number would
// be noise.
func (a *App) PreprocessPreview(request PreprocessPreviewRequest) PreprocessPreviewResponse {
	processed, err := core.PreviewRowStage(types.Matrix(request.Data), types.PCAConfig{
		SNV:             request.SNV,
		VectorNorm:      request.VectorNorm,
		SavGolWindow:    request.SavGolWindow,
		SavGolPolyOrder: request.SavGolPolyOrder,
		SavGolDeriv:     request.SavGolDeriv,
	})
	if err != nil {
		return PreprocessPreviewResponse{Success: false, Error: err.Error()}
	}
	return PreprocessPreviewResponse{Success: true, Data: processed}
}

// VariableAxisRequest asks whether the variables form an axis a derivative can
// be taken along. It carries the matrix as it will actually be analysed, after
// exclusions, because that is what the answer depends on.
type VariableAxisRequest struct {
	Data    [][]float64 `json:"data"`
	Headers []string    `json:"headers"`
}

// VariableAxisResponse is core.AxisReport as the interface receives it.
type VariableAxisResponse struct {
	Variables        int     `json:"variables"`
	Continuity       float64 `json:"continuity"`
	SmoothnessFactor float64 `json:"smoothnessFactor"`
	Measurable       bool    `json:"measurable"`
	IsContinuous     bool    `json:"isContinuous"`
	NamesNumeric     bool    `json:"namesNumeric"`
	SpacingUniform   bool    `json:"spacingUniform"`
	DistinctSteps    int     `json:"distinctSteps"`
}

// AnalyzeVariableAxis reports whether Savitzky-Golay makes sense for this data.
//
// Computed in Go rather than in the frontend so there is one implementation of
// the statistic, not two. The alternative -- reimplementing it in TypeScript to
// avoid sending the matrix -- would put the same rule in two languages with
// nothing comparing them, and the interface and the command line would be free
// to disagree about whether a dataset is a continuum.
//
// The matrix is already sent on every run, and this is called only when the data
// or the exclusions change, so the transfer is not the frequent cost it might
// look like.
func (a *App) AnalyzeVariableAxis(request VariableAxisRequest) VariableAxisResponse {
	report := core.AnalyzeVariableAxis(types.Matrix(request.Data), request.Headers)
	return VariableAxisResponse{
		Variables:        report.Variables,
		Continuity:       report.Continuity,
		SmoothnessFactor: report.SmoothnessFactor,
		Measurable:       report.Measurable,
		IsContinuous:     report.IsContinuous,
		NamesNumeric:     report.NamesNumeric,
		SpacingUniform:   report.SpacingUniform,
		DistinctSteps:    report.DistinctSteps,
	}
}

// PCARequest represents a PCA analysis request from the frontend
type PCARequest struct {
	Data          [][]float64 `json:"data"`
	MissingMask   [][]bool    `json:"missingMask,omitempty"`
	Headers       []string    `json:"headers"`
	RowNames      []string    `json:"rowNames"`
	Components    int         `json:"components"`
	MeanCenter    bool        `json:"meanCenter"`
	StandardScale bool        `json:"standardScale"`
	RobustScale   bool        `json:"robustScale"`
	ScaleOnly     bool        `json:"scaleOnly"`
	SNV           bool        `json:"snv"`
	VectorNorm    bool        `json:"vectorNorm"`
	// Savitzky-Golay smoothing and differentiation along the variable axis.
	// A window of zero means no filter. The names must match the fields the
	// configuration panel stores and the request the frontend spreads them
	// into; nothing in either language checks that, so cmd/gopca-desktop has a
	// test that compares these tags against the TypeScript.
	SavGolWindow    int    `json:"savgolWindow,omitempty"`
	SavGolPolyOrder int    `json:"savgolPolyOrder,omitempty"`
	SavGolDeriv     int    `json:"savgolDeriv,omitempty"`
	Method          string `json:"method"`
	ExcludedRows    []int  `json:"excludedRows,omitempty"`
	ExcludedColumns []int  `json:"excludedColumns,omitempty"`
	MissingStrategy string `json:"missingStrategy,omitempty"`
	// Kernel PCA parameters
	KernelType   string  `json:"kernelType,omitempty"`
	KernelGamma  float64 `json:"kernelGamma,omitempty"`
	KernelDegree int     `json:"kernelDegree,omitempty"`
	KernelCoef0  float64 `json:"kernelCoef0,omitempty"`
	// Temporal PCA parameters
	TemporalLags      int     `json:"temporalLags,omitempty"`
	VarianceExplained float64 `json:"varianceExplained,omitempty"`
	// Grouping parameters for confidence ellipses
	GroupColumn string   `json:"groupColumn,omitempty"`
	GroupLabels []string `json:"groupLabels,omitempty"`
	// Metadata for eigencorrelations
	MetadataNumeric            map[string][]float64 `json:"metadataNumeric,omitempty"`
	MetadataCategorical        map[string][]string  `json:"metadataCategorical,omitempty"`
	CalculateEigencorrelations bool                 `json:"calculateEigencorrelations,omitempty"`
}

// EllipseParams represents confidence ellipse parameters for a group
type EllipseParams struct {
	CenterX         float64 `json:"centerX"`
	CenterY         float64 `json:"centerY"`
	MajorAxis       float64 `json:"majorAxis"`
	MinorAxis       float64 `json:"minorAxis"`
	Angle           float64 `json:"angle"`
	ConfidenceLevel float64 `json:"confidenceLevel"`
}

// PCAResponse represents the PCA analysis results
type PCAResponse struct {
	Success         bool                     `json:"success"`
	Error           string                   `json:"error,omitempty"`
	Result          *PCAResultJSON           `json:"result,omitempty"`
	Info            string                   `json:"info,omitempty"`
	GroupEllipses90 map[string]EllipseParams `json:"groupEllipses90,omitempty"`
	GroupEllipses95 map[string]EllipseParams `json:"groupEllipses95,omitempty"`
	GroupEllipses99 map[string]EllipseParams `json:"groupEllipses99,omitempty"`
	// FilteredCategoricalColumns contains categorical data after rows are dropped
	// This ensures the frontend uses properly aligned data when coloring by category
	FilteredCategoricalColumns   map[string][]string  `json:"filteredCategoricalColumns,omitempty"`
	FilteredNumericTargetColumns map[string][]float64 `json:"filteredNumericTargetColumns,omitempty"`
}

// RunPCA performs PCA analysis on the provided data
func (a *App) RunPCA(request PCARequest) (response PCAResponse) {
	// Recover from any panic to prevent app crash
	defer func() {
		if r := recover(); r != nil {
			response = PCAResponse{
				Success: false,
				Error:   fmt.Sprintf("Unexpected error during PCA analysis: %v", r),
			}
		}
	}()

	// Validate request
	if len(request.Data) == 0 {
		return PCAResponse{
			Success: false,
			Error:   "No data provided",
		}
	}

	if request.Components <= 0 {
		request.Components = 5 // Default to 5 components
	}

	// Restore NaN values from missing mask
	dataToAnalyze := make([][]float64, len(request.Data))
	for i := range request.Data {
		dataToAnalyze[i] = make([]float64, len(request.Data[i]))
		for j := range request.Data[i] {
			if request.MissingMask != nil && i < len(request.MissingMask) && j < len(request.MissingMask[i]) && request.MissingMask[i][j] {
				dataToAnalyze[i][j] = math.NaN()
			} else {
				dataToAnalyze[i][j] = request.Data[i][j]
			}
		}
	}

	// Track how many rows are excluded
	rowsExcluded := len(request.ExcludedRows)

	// Filter data if exclusions are provided
	if len(request.ExcludedRows) > 0 || len(request.ExcludedColumns) > 0 {
		// Filter the data matrix
		filteredData, err := utils.FilterMatrix(dataToAnalyze, request.ExcludedRows, request.ExcludedColumns)
		if err != nil {
			return PCAResponse{
				Success: false,
				Error:   fmt.Sprintf("Failed to filter data: %v", err),
			}
		}
		dataToAnalyze = filteredData

		// Filter group labels if rows are excluded
		if len(request.ExcludedRows) > 0 && len(request.GroupLabels) > 0 {
			newGroupLabels := make([]string, 0)
			for i := 0; i < len(request.GroupLabels); i++ {
				if !contains(request.ExcludedRows, i) {
					newGroupLabels = append(newGroupLabels, request.GroupLabels[i])
				}
			}
			request.GroupLabels = newGroupLabels
		}

		// Filter metadata categorical columns if rows are excluded
		if len(request.ExcludedRows) > 0 && len(request.MetadataCategorical) > 0 {
			for colName, colData := range request.MetadataCategorical {
				filteredCol := make([]string, 0, len(colData)-len(request.ExcludedRows))
				for i := 0; i < len(colData); i++ {
					if !contains(request.ExcludedRows, i) {
						filteredCol = append(filteredCol, colData[i])
					}
				}
				request.MetadataCategorical[colName] = filteredCol
			}
		}

		// Filter metadata numeric columns if rows are excluded
		if len(request.ExcludedRows) > 0 && len(request.MetadataNumeric) > 0 {
			for colName, colData := range request.MetadataNumeric {
				filteredCol := make([]float64, 0, len(colData)-len(request.ExcludedRows))
				for i := 0; i < len(colData); i++ {
					if !contains(request.ExcludedRows, i) {
						filteredCol = append(filteredCol, colData[i])
					}
				}
				request.MetadataNumeric[colName] = filteredCol
			}
		}

		// Note: We don't need to filter headers and row names for PCA computation
		// The frontend handles the display of selected data
	}

	// Check for missing values and handle based on strategy
	hasMissing := false
	missingInfo := &types.MissingValueInfo{}
	rowsDropped := 0

	// Count missing values
	for i := 0; i < len(dataToAnalyze); i++ {
		for j := 0; j < len(dataToAnalyze[i]); j++ {
			if math.IsNaN(dataToAnalyze[i][j]) {
				hasMissing = true
				missingInfo.TotalMissing++
			}
		}
	}

	// Handle missing values based on strategy
	if hasMissing {
		// Default strategy if not specified
		if request.MissingStrategy == "" {
			request.MissingStrategy = "error"
		}

		switch request.MissingStrategy {
		case "error":
			return PCAResponse{
				Success: false,
				Error:   fmt.Sprintf("Missing values detected (%d values). Please select a strategy to handle them: 'drop' to remove rows, 'mean' to impute with column means, or 'native' for NIPALS native handling.", missingInfo.TotalMissing),
			}
		case "native":
			// For native handling with NIPALS, we don't pre-process missing values
			// Validate that NIPALS method is selected
			if strings.ToLower(request.Method) != "nipals" {
				return PCAResponse{
					Success: false,
					Error:   "Native missing value handling is only supported with the NIPALS method",
				}
			}
			// Data remains unchanged, NIPALS will handle missing values internally
		case "drop", "mean", "median":
			// Create missing value handler
			strategy := types.MissingValueStrategy(request.MissingStrategy)
			handler := core.NewMissingValueHandler(strategy)

			// Convert to types.Matrix for handler
			matrix := types.Matrix(dataToAnalyze)

			// Create missing info manually since we don't have CSVData here
			selectedCols := make([]int, len(dataToAnalyze[0]))
			for i := range selectedCols {
				selectedCols[i] = i
			}

			// Build missing info
			actualMissingInfo := &types.MissingValueInfo{
				ColumnIndices:   selectedCols,
				RowsAffected:    []int{},
				MissingByColumn: make(map[int]int),
			}

			// Find rows with missing values
			rowsWithMissing := make(map[int]bool)
			for i := 0; i < len(dataToAnalyze); i++ {
				for j := 0; j < len(dataToAnalyze[i]); j++ {
					if math.IsNaN(dataToAnalyze[i][j]) {
						rowsWithMissing[i] = true
						actualMissingInfo.MissingByColumn[j]++
						actualMissingInfo.TotalMissing++
					}
				}
			}

			// Convert map to slice
			for row := range rowsWithMissing {
				actualMissingInfo.RowsAffected = append(actualMissingInfo.RowsAffected, row)
			}

			// Apply missing value strategy
			cleanedData, err := handler.HandleMissingValues(matrix, actualMissingInfo, selectedCols)
			if err != nil {
				return PCAResponse{
					Success: false,
					Error:   fmt.Sprintf("Failed to handle missing values: %v", err),
				}
			}

			dataToAnalyze = cleanedData
			rowsDropped = len(actualMissingInfo.RowsAffected)

			// Update row names if rows were dropped
			if request.MissingStrategy == "drop" && rowsDropped > 0 {
				// Create a map of rows to keep
				keepRows := make(map[int]bool)
				for i := 0; i < len(matrix); i++ {
					keepRows[i] = true
				}
				for _, rowIdx := range actualMissingInfo.RowsAffected {
					delete(keepRows, rowIdx)
				}

				// Filter row names
				newRowNames := []string{}
				for i := 0; i < len(request.RowNames); i++ {
					if keepRows[i] {
						newRowNames = append(newRowNames, request.RowNames[i])
					}
				}
				request.RowNames = newRowNames

				// Also filter group labels if provided
				if len(request.GroupLabels) > 0 {
					newGroupLabels := []string{}
					for i := 0; i < len(request.GroupLabels); i++ {
						if keepRows[i] {
							newGroupLabels = append(newGroupLabels, request.GroupLabels[i])
						}
					}
					request.GroupLabels = newGroupLabels
				}

				// Filter metadata categorical columns to match dropped rows
				// This ensures frontend has properly aligned data for coloring
				if len(request.MetadataCategorical) > 0 {
					for colName, colData := range request.MetadataCategorical {
						filteredCol := []string{}
						for i := 0; i < len(colData); i++ {
							if keepRows[i] {
								filteredCol = append(filteredCol, colData[i])
							}
						}
						request.MetadataCategorical[colName] = filteredCol
					}
				}

				// Filter metadata numeric columns
				if len(request.MetadataNumeric) > 0 {
					for colName, colData := range request.MetadataNumeric {
						filteredCol := []float64{}
						for i := 0; i < len(colData); i++ {
							if keepRows[i] {
								filteredCol = append(filteredCol, colData[i])
							}
						}
						request.MetadataNumeric[colName] = filteredCol
					}
				}
			}
		default:
			return PCAResponse{
				Success: false,
				Error:   fmt.Sprintf("Invalid missing value strategy: %s", request.MissingStrategy),
			}
		}
	}

	// Create PCA configuration
	config := types.PCAConfig{
		Components:      request.Components,
		MeanCenter:      request.MeanCenter,
		StandardScale:   request.StandardScale,
		RobustScale:     request.RobustScale,
		ScaleOnly:       request.ScaleOnly,
		SNV:             request.SNV,
		VectorNorm:      request.VectorNorm,
		Method:          strings.ToLower(request.Method),
		ExcludedRows:    request.ExcludedRows,
		ExcludedColumns: request.ExcludedColumns,
		MissingStrategy: types.MissingValueStrategy(request.MissingStrategy),
	}

	if err := applySavGolSettings(&config, request.SavGolWindow, request.SavGolPolyOrder, request.SavGolDeriv); err != nil {
		return PCAResponse{Success: false, Error: err.Error()}
	}

	// Add kernel parameters if using kernel PCA
	if strings.ToLower(request.Method) == "kernel" {
		config.KernelType = request.KernelType
		config.KernelGamma = request.KernelGamma
		config.KernelDegree = request.KernelDegree
		config.KernelCoef0 = request.KernelCoef0

		// Skip preprocessing that involves centering for kernel PCA
		// But allow scale-only, SNV, and vector normalization
		if !config.ScaleOnly {
			config.MeanCenter = false
			config.StandardScale = false
			config.RobustScale = false
		}
	}

	// Add temporal parameters if using temporal PCA
	if strings.ToLower(request.Method) == "temporal" {
		config.TemporalLags = request.TemporalLags
		config.VarianceExplained = request.VarianceExplained
	}

	// Perform PCA and attach diagnostic metrics (Q/T² + confidence limits) for
	// linear methods. Diagnostics are computed inside the shared core pipeline
	// against the exact preprocessed matrix the engine used, so the CLI and
	// Desktop produce identical metrics for identical input (see #716).
	result, err := core.RunPCAWithDiagnostics(dataToAnalyze, config)
	if err != nil {
		return PCAResponse{
			Success: false,
			Error:   fmt.Sprintf("PCA fit failed: %v", err),
		}
	}

	// For temporal PCA, adjust row names and metadata to match reduced number of scores
	if strings.ToLower(request.Method) == "temporal" && len(result.Scores) > 0 {
		newRowCount := len(result.Scores)

		// Adjust row names - keep only the first newRowCount names
		if len(request.RowNames) > newRowCount {
			request.RowNames = request.RowNames[:newRowCount]
		}

		// Adjust group labels if provided
		if len(request.GroupLabels) > newRowCount {
			request.GroupLabels = request.GroupLabels[:newRowCount]
		}

		// Adjust metadata categorical columns
		for colName, colData := range request.MetadataCategorical {
			if len(colData) > newRowCount {
				request.MetadataCategorical[colName] = colData[:newRowCount]
			}
		}

		// Adjust metadata numeric columns
		for colName, colData := range request.MetadataNumeric {
			if len(colData) > newRowCount {
				request.MetadataNumeric[colName] = colData[:newRowCount]
			}
		}

	}

	// Update component labels to use filtered headers if needed
	if len(result.ComponentLabels) == 0 {
		// Use ComponentsComputed if available (for temporal PCA), otherwise use requested components
		numComponents := request.Components
		if result.ComponentsComputed > 0 {
			numComponents = result.ComponentsComputed
		}
		// Also ensure we don't exceed the actual number of score columns
		if len(result.Scores) > 0 && len(result.Scores[0]) < numComponents {
			numComponents = len(result.Scores[0])
		}
		result.ComponentLabels = make([]string, numComponents)
		for i := 0; i < numComponents; i++ {
			result.ComponentLabels[i] = fmt.Sprintf("PC%d", i+1)
		}
	}

	// Add variable labels from headers (excluding the ones that were filtered out)
	filteredHeaders := make([]string, 0)
	for j, header := range request.Headers {
		if !contains(request.ExcludedColumns, j) {
			filteredHeaders = append(filteredHeaders, header)
		}
	}
	result.VariableLabels = filteredHeaders

	// Calculate eigencorrelations if requested
	if request.CalculateEigencorrelations && (len(request.MetadataNumeric) > 0 || len(request.MetadataCategorical) > 0) {
		// Verify metadata dimensions match scores before calculation
		nSamples := len(result.Scores)
		dimensionMismatch := false

		for colName, colData := range request.MetadataCategorical {
			if len(colData) != nSamples {
				fmt.Printf("Warning: Categorical variable '%s' has %d values, expected %d\n", colName, len(colData), nSamples)
				dimensionMismatch = true
			}
		}
		for colName, colData := range request.MetadataNumeric {
			if len(colData) != nSamples {
				fmt.Printf("Warning: Numeric variable '%s' has %d values, expected %d\n", colName, len(colData), nSamples)
				dimensionMismatch = true
			}
		}

		if dimensionMismatch {
			fmt.Printf("Warning: Skipping eigencorrelation calculation due to dimension mismatch\n")
		} else {
			// Convert scores to mat.Matrix
			scoresMatrix := mat.NewDense(len(result.Scores), len(result.Scores[0]), nil)
			for i, row := range result.Scores {
				for j, val := range row {
					scoresMatrix.Set(i, j, val)
				}
			}

			// Create correlation request
			corrRequest := core.CorrelationRequest{
				Scores:              scoresMatrix,
				MetadataNumeric:     request.MetadataNumeric,
				MetadataCategorical: request.MetadataCategorical,
				Components:          nil,       // Use all components
				Method:              "pearson", // Default to Pearson
			}

			// Calculate correlations
			corrResult, err := core.CalculateEigencorrelations(corrRequest)
			if err != nil {
				fmt.Printf("Warning: failed to calculate eigencorrelations: %v\n", err)
			} else {
				result.Eigencorrelations = &types.EigencorrelationResult{
					Correlations: corrResult.Correlations,
					PValues:      corrResult.PValues,
					Variables:    corrResult.Variables,
					Components:   corrResult.Components,
					Method:       "pearson",
				}
			}
		}
	}

	// Build info message about missing value handling
	infoMsg := ""
	if hasMissing && request.MissingStrategy != "error" {
		switch request.MissingStrategy {
		case "drop":
			infoMsg = fmt.Sprintf("Dropped %d rows containing missing values.", rowsDropped)
		case "mean":
			infoMsg = fmt.Sprintf("Imputed %d missing values with column means.", missingInfo.TotalMissing)
		case "median":
			infoMsg = fmt.Sprintf("Imputed %d missing values with column medians.", missingInfo.TotalMissing)
		}
	}

	// Calculate confidence ellipses for all confidence levels if groups are provided
	var groupEllipses90, groupEllipses95, groupEllipses99 map[string]EllipseParams
	if len(request.GroupLabels) > 0 && len(result.Scores) > 0 {
		// Convert scores to matrix once
		scoresMatrix := mat.NewDense(len(result.Scores), len(result.Scores[0]), nil)
		for i, row := range result.Scores {
			for j, val := range row {
				scoresMatrix.Set(i, j, val)
			}
		}

		// Calculate ellipses for all three confidence levels (default to PC1 vs PC2)
		confidenceLevels := []float64{0.90, 0.95, 0.99}
		for _, confidenceLevel := range confidenceLevels {
			coreEllipses, err := core.CalculateGroupEllipses(scoresMatrix, request.GroupLabels, 0, 1, confidenceLevel)
			if err == nil && len(coreEllipses) > 0 {
				ellipses := make(map[string]EllipseParams)
				for group, ellipse := range coreEllipses {
					ellipses[group] = EllipseParams{
						CenterX:         ellipse.CenterX,
						CenterY:         ellipse.CenterY,
						MajorAxis:       ellipse.MajorAxis,
						MinorAxis:       ellipse.MinorAxis,
						Angle:           ellipse.Angle,
						ConfidenceLevel: ellipse.ConfidenceLevel,
					}
				}

				// Assign to appropriate variable
				switch confidenceLevel {
				case 0.90:
					groupEllipses90 = ellipses
				case 0.95:
					groupEllipses95 = ellipses
				case 0.99:
					groupEllipses99 = ellipses
				}
			}
		}
	}

	// Prepare filtered categorical and numeric columns for the frontend
	// If rows were dropped OR excluded OR using temporal PCA, the metadata in the request has already been filtered above
	// We pass it to the frontend so it can use properly aligned data when coloring by category
	var filteredCategoricalCols map[string][]string
	var filteredNumericTargetCols map[string][]float64

	if (rowsDropped > 0 && request.MissingStrategy == "drop") || rowsExcluded > 0 || strings.ToLower(request.Method) == "temporal" {
		// Pass the already-filtered metadata columns
		// For temporal PCA, these were adjusted in the adjustment block above
		filteredCategoricalCols = request.MetadataCategorical
		filteredNumericTargetCols = request.MetadataNumeric
	}

	return PCAResponse{
		Success:                      true,
		Result:                       ConvertPCAResultToJSON(result),
		Info:                         infoMsg,
		GroupEllipses90:              groupEllipses90,
		GroupEllipses95:              groupEllipses95,
		GroupEllipses99:              groupEllipses99,
		FilteredCategoricalColumns:   filteredCategoricalCols,
		FilteredNumericTargetColumns: filteredNumericTargetCols,
	}
}

// contains checks if a slice contains a value
func contains(slice []int, val int) bool {
	for _, item := range slice {
		if item == val {
			return true
		}
	}
	return false
}

// SaveFile handles saving exported plot data
func (a *App) SaveFile(fileName string, dataURL string) error {
	// Show save dialog
	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: fileName,
		Title:           "Save Plot",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "PNG Image",
				Pattern:     "*.png",
			},
			{
				DisplayName: "SVG Image",
				Pattern:     "*.svg",
			},
		},
	})

	if err != nil {
		return fmt.Errorf("failed to open save dialog: %v", err)
	}

	// User cancelled
	if filePath == "" {
		return nil
	}

	// Parse the data URL
	parts := strings.SplitN(dataURL, ",", 2)
	if len(parts) != 2 {
		return fmt.Errorf("invalid data URL format")
	}

	// Decode based on format
	var data []byte
	if strings.Contains(parts[0], "base64") {
		// PNG format (base64 encoded)
		data, err = base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			return fmt.Errorf("failed to decode base64 data: %v", err)
		}
	} else {
		// SVG format (URL encoded)
		decodedSVG, err := url.QueryUnescape(parts[1])
		if err != nil {
			return fmt.Errorf("failed to decode SVG data: %v", err)
		}
		data = []byte(decodedSVG)
	}

	// Write to file
	err = os.WriteFile(filePath, data, 0644)
	if err != nil {
		return fmt.Errorf("failed to write file: %v", err)
	}

	return nil
}

// LoadIrisDataset loads the built-in iris dataset with species column
func (a *App) LoadIrisDataset() (*FileDataJSON, error) {
	// Hardcoded iris dataset with species column
	csvContent := `sepal length (cm),sepal width (cm),petal length (cm),petal width (cm),species
5.1,3.5,1.4,0.2,setosa
4.9,3.0,1.4,0.2,setosa
4.7,3.2,1.3,0.2,setosa
4.6,3.1,1.5,0.2,setosa
5.0,3.6,1.4,0.2,setosa
5.4,3.9,1.7,0.4,setosa
4.6,3.4,1.4,0.3,setosa
5.0,3.4,1.5,0.2,setosa
4.4,2.9,1.4,0.2,setosa
4.9,3.1,1.5,0.1,setosa
5.4,3.7,1.5,0.2,setosa
4.8,3.4,1.6,0.2,setosa
4.8,3.0,1.4,0.1,setosa
4.3,3.0,1.1,0.1,setosa
5.8,4.0,1.2,0.2,setosa
5.7,4.4,1.5,0.4,setosa
5.4,3.9,1.3,0.4,setosa
5.1,3.5,1.4,0.3,setosa
5.7,3.8,1.7,0.3,setosa
5.1,3.8,1.5,0.3,setosa
5.4,3.4,1.7,0.2,setosa
5.1,3.7,1.5,0.4,setosa
4.6,3.6,1.0,0.2,setosa
5.1,3.3,1.7,0.5,setosa
4.8,3.4,1.9,0.2,setosa
5.0,3.0,1.6,0.2,setosa
5.0,3.4,1.6,0.4,setosa
5.2,3.5,1.5,0.2,setosa
5.2,3.4,1.4,0.2,setosa
4.7,3.2,1.6,0.2,setosa
4.8,3.1,1.6,0.2,setosa
5.4,3.4,1.5,0.4,setosa
5.2,4.1,1.5,0.1,setosa
5.5,4.2,1.4,0.2,setosa
4.9,3.1,1.5,0.2,setosa
5.0,3.2,1.2,0.2,setosa
5.5,3.5,1.3,0.2,setosa
4.9,3.6,1.4,0.1,setosa
4.4,3.0,1.3,0.2,setosa
5.1,3.4,1.5,0.2,setosa
5.0,3.5,1.3,0.3,setosa
4.5,2.3,1.3,0.3,setosa
4.4,3.2,1.3,0.2,setosa
5.0,3.5,1.6,0.6,setosa
5.1,3.8,1.9,0.4,setosa
4.8,3.0,1.4,0.3,setosa
5.1,3.8,1.6,0.2,setosa
4.6,3.2,1.4,0.2,setosa
5.3,3.7,1.5,0.2,setosa
5.0,3.3,1.4,0.2,setosa
7.0,3.2,4.7,1.4,versicolor
6.4,3.2,4.5,1.5,versicolor
6.9,3.1,4.9,1.5,versicolor
5.5,2.3,4.0,1.3,versicolor
6.5,2.8,4.6,1.5,versicolor
5.7,2.8,4.5,1.3,versicolor
6.3,3.3,4.7,1.6,versicolor
4.9,2.4,3.3,1.0,versicolor
6.6,2.9,4.6,1.3,versicolor
5.2,2.7,3.9,1.4,versicolor
5.0,2.0,3.5,1.0,versicolor
5.9,3.0,4.2,1.5,versicolor
6.0,2.2,4.0,1.0,versicolor
6.1,2.9,4.7,1.4,versicolor
5.6,2.9,3.6,1.3,versicolor
6.7,3.1,4.4,1.4,versicolor
5.6,3.0,4.5,1.5,versicolor
5.8,2.7,4.1,1.0,versicolor
6.2,2.2,4.5,1.5,versicolor
5.6,2.5,3.9,1.1,versicolor
5.9,3.2,4.8,1.8,versicolor
6.1,2.8,4.0,1.3,versicolor
6.3,2.5,4.9,1.5,versicolor
6.1,2.8,4.7,1.2,versicolor
6.4,2.9,4.3,1.3,versicolor
6.6,3.0,4.4,1.4,versicolor
6.8,2.8,4.8,1.4,versicolor
6.7,3.0,5.0,1.7,versicolor
6.0,2.9,4.5,1.5,versicolor
5.7,2.6,3.5,1.0,versicolor
5.5,2.4,3.8,1.1,versicolor
5.5,2.4,3.7,1.0,versicolor
5.8,2.7,3.9,1.2,versicolor
6.0,2.7,5.1,1.6,versicolor
5.4,3.0,4.5,1.5,versicolor
6.0,3.4,4.5,1.6,versicolor
6.7,3.1,4.7,1.5,versicolor
6.3,2.3,4.4,1.3,versicolor
5.6,3.0,4.1,1.3,versicolor
5.5,2.5,4.0,1.3,versicolor
5.5,2.6,4.4,1.2,versicolor
6.1,3.0,4.6,1.4,versicolor
5.8,2.6,4.0,1.2,versicolor
5.0,2.3,3.3,1.0,versicolor
5.6,2.7,4.2,1.3,versicolor
5.7,3.0,4.2,1.2,versicolor
5.7,2.9,4.2,1.3,versicolor
6.2,2.9,4.3,1.3,versicolor
5.1,2.5,3.0,1.1,versicolor
5.7,2.8,4.1,1.3,versicolor
6.3,3.3,6.0,2.5,virginica
5.8,2.7,5.1,1.9,virginica
7.1,3.0,5.9,2.1,virginica
6.3,2.9,5.6,1.8,virginica
6.5,3.0,5.8,2.2,virginica
7.6,3.0,6.6,2.1,virginica
4.9,2.5,4.5,1.7,virginica
7.3,2.9,6.3,1.8,virginica
6.7,2.5,5.8,1.8,virginica
7.2,3.6,6.1,2.5,virginica
6.5,3.2,5.1,2.0,virginica
6.4,2.7,5.3,1.9,virginica
6.8,3.0,5.5,2.1,virginica
5.7,2.5,5.0,2.0,virginica
5.8,2.8,5.1,2.4,virginica
6.4,3.2,5.3,2.3,virginica
6.5,3.0,5.5,1.8,virginica
7.7,3.8,6.7,2.2,virginica
7.7,2.6,6.9,2.3,virginica
6.0,2.2,5.0,1.5,virginica
6.9,3.2,5.7,2.3,virginica
5.6,2.8,4.9,2.0,virginica
7.7,2.8,6.7,2.0,virginica
6.3,2.7,4.9,1.8,virginica
6.7,3.3,5.7,2.1,virginica
7.2,3.2,6.0,1.8,virginica
6.2,2.8,4.8,1.8,virginica
6.1,3.0,4.9,1.8,virginica
6.4,2.8,5.6,2.1,virginica
7.2,3.0,5.8,1.6,virginica
7.4,2.8,6.1,1.9,virginica
7.9,3.8,6.4,2.0,virginica
6.4,2.8,5.6,2.2,virginica
6.3,2.8,5.1,1.5,virginica
6.1,2.6,5.6,1.4,virginica
7.7,3.0,6.1,2.3,virginica
6.3,3.4,5.6,2.4,virginica
6.4,3.1,5.5,1.8,virginica
6.0,3.0,4.8,1.8,virginica
6.9,3.1,5.4,2.1,virginica
6.7,3.1,5.6,2.4,virginica
6.9,3.1,5.1,2.3,virginica
5.8,2.7,5.1,1.9,virginica
6.8,3.2,5.9,2.3,virginica
6.7,3.3,5.7,2.5,virginica
6.7,3.0,5.2,2.3,virginica
6.3,2.5,5.0,1.9,virginica
6.5,3.0,5.2,2.0,virginica
6.2,3.4,5.4,2.3,virginica
5.9,3.0,5.1,1.8,virginica`

	// Add row names to the CSV content
	lines := strings.Split(csvContent, "\n")
	var newLines []string
	newLines = append(newLines, ","+lines[0]) // Add empty header for row names column

	speciesCount := map[string]int{"setosa": 0, "versicolor": 0, "virginica": 0}

	for i := 1; i < len(lines); i++ {
		parts := strings.Split(lines[i], ",")
		if len(parts) >= 5 {
			species := parts[4]
			speciesCount[species]++
			rowName := fmt.Sprintf("%s_%02d", species, speciesCount[species])
			newLines = append(newLines, rowName+","+lines[i])
		}
	}

	modifiedContent := strings.Join(newLines, "\n")

	return a.ParseCSV(modifiedContent)
}

// FileSelectionResult contains both parsed data and the file path
type FileSelectionResult struct {
	Data     *FileDataJSON `json:"data"`
	FilePath string        `json:"filePath"`
}

// SelectCSVFile opens a native file dialog for selecting CSV files and returns parsed data with file path
func (a *App) SelectCSVFile() (*FileSelectionResult, error) {
	dialogOptions := runtime.OpenDialogOptions{
		Title: "Select CSV File",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "CSV Files",
				Pattern:     "*.csv",
			},
			{
				DisplayName: "All Files",
				Pattern:     "*.*",
			},
		},
	}

	filePath, err := runtime.OpenFileDialog(a.ctx, dialogOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to open file dialog: %w", err)
	}

	// User cancelled
	if filePath == "" {
		return nil, nil
	}

	// Read the file content
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// Parse the CSV content
	data, err := a.ParseCSV(string(content))
	if err != nil {
		return nil, err
	}

	// Return both parsed data and file path
	return &FileSelectionResult{
		Data:     data,
		FilePath: filePath,
	}, nil
}

// LoadDatasetFile loads a CSV file from the embedded data
func (a *App) LoadDatasetFile(filename string) (*FileDataJSON, error) {
	// First try to get the embedded dataset
	if content, ok := datasets.GetDataset(filename); ok {
		return a.ParseCSV(content)
	}

	// If not found in embedded data, try file system as fallback
	// This is useful during development
	possiblePaths := []string{
		filepath.Join("data", filename),
		filepath.Join("..", "..", "data", filename),
		filepath.Join("../../data", filename),
	}

	for _, path := range possiblePaths {
		content, err := os.ReadFile(path)
		if err == nil {
			return a.ParseCSV(string(content))
		}
	}

	return nil, fmt.Errorf("dataset file not found: %s", filename)
}

// PCAConfig represents PCA configuration from the frontend
type PCAConfig struct {
	Components      int    `json:"components"`
	MeanCenter      bool   `json:"meanCenter"`
	StandardScale   bool   `json:"standardScale"`
	RobustScale     bool   `json:"robustScale"`
	ScaleOnly       bool   `json:"scaleOnly"`
	SNV             bool   `json:"snv"`
	VectorNorm      bool   `json:"vectorNorm"`
	SavGolWindow    int    `json:"savgolWindow,omitempty"`
	SavGolPolyOrder int    `json:"savgolPolyOrder,omitempty"`
	SavGolDeriv     int    `json:"savgolDeriv,omitempty"`
	Method          string `json:"method"`
	MissingStrategy string `json:"missingStrategy"`
	// Kernel PCA parameters
	KernelType   string  `json:"kernelType,omitempty"`
	KernelGamma  float64 `json:"kernelGamma,omitempty"`
	KernelDegree int     `json:"kernelDegree,omitempty"`
	KernelCoef0  float64 `json:"kernelCoef0,omitempty"`
}

// ModelMetricsRequest contains the request for model metrics calculation
type ModelMetricsRequest struct {
	Loadings          [][]float64 `json:"loadings"`
	ExplainedVariance []float64   `json:"explainedVariance"`
	VariableLabels    []string    `json:"variableLabels"`
	SelectedPC        int         `json:"selectedPC"`
	StandardScale     bool        `json:"standardScale"`
	RobustScale       bool        `json:"robustScale"`
	OriginalData      [][]float64 `json:"originalData,omitempty"` // For scale detection
}

// ModelMetricsResponse contains calculated model metrics
type ModelMetricsResponse struct {
	MostInfluentialVariable string  `json:"mostInfluentialVariable"`
	LoadingValue            float64 `json:"loadingValue"`
	RecommendedComponents   int     `json:"recommendedComponents"`
	VarianceCaptured        float64 `json:"varianceCaptured"`
	KaiserComponents        int     `json:"kaiserComponents"` // -1 if not applicable
	ScaleRatio              float64 `json:"scaleRatio"`
	ScaleWarning            string  `json:"scaleWarning,omitempty"`
	Success                 bool    `json:"success"`
	Error                   string  `json:"error,omitempty"`
}

// CalculateModelMetrics calculates key model metrics for the Model Overview
func (a *App) CalculateModelMetrics(request ModelMetricsRequest) ModelMetricsResponse {
	// Validate input
	if len(request.Loadings) == 0 || len(request.Loadings[0]) == 0 {
		return ModelMetricsResponse{
			Success:          false,
			Error:            "Invalid loadings matrix",
			KaiserComponents: -1,
		}
	}

	if len(request.VariableLabels) == 0 {
		return ModelMetricsResponse{
			Success:          false,
			Error:            "Variable labels are required",
			KaiserComponents: -1,
		}
	}

	// Ensure selectedPC is valid
	if request.SelectedPC < 0 || request.SelectedPC >= len(request.Loadings[0]) {
		request.SelectedPC = 0 // Default to PC1
	}

	// Find most influential variable for selected PC
	mostInfluentialVar := ""
	maxLoading := 0.0

	for i, row := range request.Loadings {
		if i < len(request.VariableLabels) && request.SelectedPC < len(row) {
			absLoading := math.Abs(row[request.SelectedPC])
			if absLoading > maxLoading {
				maxLoading = absLoading
				mostInfluentialVar = request.VariableLabels[i]
			}
		}
	}

	// Calculate variance-based recommendation (80% threshold)
	recommendedComponents := 0
	varianceCaptured := 0.0
	targetVariance := 80.0 // 80% threshold

	cumulative := 0.0
	for i, variance := range request.ExplainedVariance {
		cumulative += variance
		if cumulative >= targetVariance && recommendedComponents == 0 {
			recommendedComponents = i + 1
			varianceCaptured = cumulative
		}
	}

	// If we haven't reached 80%, use all components
	if recommendedComponents == 0 {
		recommendedComponents = len(request.ExplainedVariance)
		varianceCaptured = cumulative
	}

	// Calculate Kaiser criterion only if data is standardized
	kaiserComponents := -1 // -1 indicates not applicable
	if request.StandardScale {
		kaiserComponents = 0
		numVariables := len(request.Loadings)

		for _, variance := range request.ExplainedVariance {
			// Convert percentage to eigenvalue approximation
			// For standardized data, total variance = number of variables
			eigenvalue := (variance / 100.0) * float64(numVariables)
			if eigenvalue > 1.0 {
				kaiserComponents++
			} else {
				break // Eigenvalues are ordered, so we can stop here
			}
		}

		if kaiserComponents == 0 {
			kaiserComponents = 1
		}
	}

	// Calculate scale heterogeneity if original data is provided
	scaleRatio := 1.0
	scaleWarning := ""

	if len(request.OriginalData) > 0 && len(request.OriginalData[0]) > 0 {
		// Calculate variance for each column (variable)
		numRows := len(request.OriginalData)
		numCols := len(request.OriginalData[0])

		if numRows > 1 && numCols > 0 {
			minVar := math.MaxFloat64
			maxVar := 0.0

			for j := 0; j < numCols; j++ {
				// Calculate mean
				mean := 0.0
				validCount := 0
				for i := 0; i < numRows; i++ {
					if !math.IsNaN(request.OriginalData[i][j]) {
						mean += request.OriginalData[i][j]
						validCount++
					}
				}
				if validCount > 0 {
					mean /= float64(validCount)

					// Calculate variance
					variance := 0.0
					for i := 0; i < numRows; i++ {
						if !math.IsNaN(request.OriginalData[i][j]) {
							diff := request.OriginalData[i][j] - mean
							variance += diff * diff
						}
					}
					if validCount > 1 {
						variance /= float64(validCount - 1)

						if variance > 0 {
							if variance < minVar {
								minVar = variance
							}
							if variance > maxVar {
								maxVar = variance
							}
						}
					}
				}
			}

			// Calculate scale ratio.
			//
			// Reported as a ratio of standard deviations, not of variances. The
			// sentence below says "scales", and a scale is a magnitude, so
			// quoting the squared quantity overstated it by the ratio itself:
			// 24 element columns whose standard deviations span 21,494x were
			// described as differing by 462,008,282x (#957).
			//
			// The thresholds are square-rooted alongside it -- 100 -> 10 and
			// 10000 -> 100 -- so the warning fires on exactly the datasets it
			// fired on before. Only the number shown changes.
			if minVar > 0 && minVar < math.MaxFloat64 {
				scaleRatio = math.Sqrt(maxVar / minVar)

				// Generate warning if scales are heterogeneous and not standardized
				if scaleRatio > 10 && !request.StandardScale && !request.RobustScale {
					if scaleRatio > 100 {
						scaleWarning = fmt.Sprintf("Variables have very different scales (%.0fx difference). Consider standardization unless this is intentional.", scaleRatio)
					} else {
						scaleWarning = fmt.Sprintf("Variables have different scales (%.0fx difference). Consider if standardization is needed.", scaleRatio)
					}
				}
			}
		}
	}

	return ModelMetricsResponse{
		MostInfluentialVariable: mostInfluentialVar,
		LoadingValue:            maxLoading,
		RecommendedComponents:   recommendedComponents,
		VarianceCaptured:        varianceCaptured,
		KaiserComponents:        kaiserComponents,
		ScaleRatio:              scaleRatio,
		ScaleWarning:            scaleWarning,
		Success:                 true,
	}
}

// ExportPCAModelRequest contains the data needed to export a PCA model
type ExportPCAModelRequest struct {
	Data            [][]float64      `json:"data"`
	Headers         []string         `json:"headers"`
	RowNames        []string         `json:"rowNames"`
	PCAResult       *types.PCAResult `json:"pcaResult"`
	Config          PCAConfig        `json:"config"`
	ExcludedRows    []int            `json:"excludedRows"`
	ExcludedColumns []int            `json:"excludedColumns"`
	Filename        string           `json:"filename,omitempty"` // Original data filename
}

// toEngineConfig converts the exported configuration into the engine's own.
//
// A function rather than inline code so it can be tested: the rest of
// ExportPCAModel is behind a save dialog, and this conversion is the one place
// where a setting chosen in the panel can fail to reach the written model. A
// model exported without its Savitzky-Golay filter still loads and still
// transforms -- it just projects unfiltered data onto loadings fitted on
// filtered data, which no inspection of the file would reveal.
func (r ExportPCAModelRequest) toEngineConfig() types.PCAConfig {
	return types.PCAConfig{
		Components:      r.Config.Components,
		MeanCenter:      r.Config.MeanCenter,
		StandardScale:   r.Config.StandardScale,
		RobustScale:     r.Config.RobustScale,
		ScaleOnly:       r.Config.ScaleOnly,
		SNV:             r.Config.SNV,
		VectorNorm:      r.Config.VectorNorm,
		SavGolWindow:    r.Config.SavGolWindow,
		SavGolPolyOrder: r.Config.SavGolPolyOrder,
		SavGolDeriv:     r.Config.SavGolDeriv,
		Method:          r.Config.Method,
		ExcludedRows:    r.ExcludedRows,
		ExcludedColumns: r.ExcludedColumns,
		MissingStrategy: types.MissingValueStrategy(r.Config.MissingStrategy),
		KernelType:      r.Config.KernelType,
		KernelGamma:     r.Config.KernelGamma,
		KernelDegree:    r.Config.KernelDegree,
		KernelCoef0:     r.Config.KernelCoef0,
	}
}

// ExportPCAModel exports the complete PCA model to a JSON file
func (a *App) ExportPCAModel(request ExportPCAModelRequest) error {
	// Show save dialog
	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: "pca_model.json",
		Title:           "Export PCA Model",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "JSON Files",
				Pattern:     "*.json",
			},
		},
	})

	if err != nil {
		return fmt.Errorf("failed to open save dialog: %v", err)
	}

	// User cancelled
	if filePath == "" {
		return nil
	}

	// Convert PCA config to types.PCAConfig
	pcaConfig := request.toEngineConfig()

	// Re-fit the preprocessor so the exported model carries the parameters that
	// were applied, and so metrics are computed against the same matrix the
	// engine used. This must not be a plain FitTransform: with NIPALS native
	// missing-value handling the data still contains NaNs, and Preprocessor
	// would silently return NaN means and standard deviations, which cannot even
	// be marshalled to JSON. FitPreprocessorForExport handles that case with
	// NaN-aware column statistics and returns a nil matrix, suppressing
	// diagnostics exactly as the engine does.
	preprocessor, preprocessedData, err := core.FitPreprocessorForExport(request.Data, pcaConfig)
	if err != nil {
		return fmt.Errorf("failed to preprocess data for export: %v", err)
	}

	// Create a mock CSVData structure for the output conversion
	csvData := &pkgcsv.Data{
		Headers:  request.Headers,
		RowNames: request.RowNames,
		Matrix:   request.Data,
		Rows:     len(request.Data),
		Columns:  len(request.Headers),
	}

	// Create export metadata if we have a filename
	var exportMeta *pkgcsv.ExportMetadata
	if request.Filename != "" {
		exportMeta = &pkgcsv.ExportMetadata{
			InputFilename: filepath.Base(request.Filename),
		}
	}

	// Convert to PCAOutputData using the shared function from pkg/csv with metadata
	// Note: We don't have categorical/target data in the export request, so pass nil
	outputData := pkgcsv.ConvertToPCAOutputDataWithMetadata(request.PCAResult, csvData, preprocessedData, true,
		pcaConfig, preprocessor, nil, nil, exportMeta)

	// Marshal to JSON
	jsonData, err := json.MarshalIndent(outputData, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal model data: %v", err)
	}

	// Validate the exported model against schema
	validator, err := validation.NewModelValidator("v1")
	if err != nil {
		// Schema validation not available, continue without validation
		fmt.Fprintf(os.Stderr, "Warning: Schema validation not available: %v\n", err)
	} else {
		if err := validator.ValidateModel(jsonData); err != nil {
			// Log validation error but still save the file
			fmt.Fprintf(os.Stderr, "Warning: Exported model validation failed: %v\n", err)
		}
	}

	// Write to file
	err = os.WriteFile(filePath, jsonData, 0644)
	if err != nil {
		return fmt.Errorf("failed to write model file: %v", err)
	}

	return nil
}

// GetGUIConfig returns the GUI configuration
func (a *App) GetGUIConfig() *config.GUIConfig {
	return config.DefaultGUIConfig()
}

// GoCSVStatus represents the installation status of GoCSV
type GoCSVStatus struct {
	Installed bool   `json:"installed"`
	Path      string `json:"path,omitempty"`
	Error     string `json:"error,omitempty"`
}

// CheckGoCSVStatus checks if GoCSV is installed and available
func (a *App) CheckGoCSVStatus() *GoCSVStatus {
	integrationConfig := integration.AppConfig{
		Name:        "gocsv",
		CommonPaths: integration.GetCommonPaths("gocsv"),
		DisplayName: "GoCSV",
	}

	status := integration.CheckApp(integrationConfig)

	return &GoCSVStatus{
		Installed: status.Installed,
		Path:      status.Path,
		Error:     status.Error,
	}
}

// OpenInGoCSV saves the current data to a temporary file and opens it in GoCSV
func (a *App) OpenInGoCSV(data *FileData) error {
	if data == nil || len(data.Data) == 0 {
		return fmt.Errorf("no data to export")
	}

	// Check if GoCSV is installed
	status := a.CheckGoCSVStatus()
	if !status.Installed {
		return fmt.Errorf("GoCSV not found: %s", status.Error)
	}

	// Create a temporary file
	tempDir := os.TempDir()
	timestamp := time.Now().Format("20060102_150405")
	tempFile := filepath.Join(tempDir, fmt.Sprintf("gopca_export_%s.csv", timestamp))

	// Write data to temp file
	if err := a.exportDataToCSV(data, tempFile); err != nil {
		return fmt.Errorf("failed to export data: %w", err)
	}

	// Launch GoCSV with the file
	if err := integration.LaunchWithFile(status.Path, tempFile); err != nil {
		return fmt.Errorf("failed to launch GoCSV: %w", err)
	}

	runtime.LogInfo(a.ctx, fmt.Sprintf("Opened data in GoCSV: %s", tempFile))
	return nil
}

// exportDataToCSV exports FileData to a CSV file
func (a *App) exportDataToCSV(data *FileData, filePath string) error {
	var lines []string

	// Add headers (with row name header if row names exist)
	headers := data.Headers
	if len(data.RowNames) > 0 {
		headers = append([]string{"Row"}, headers...)
	}
	lines = append(lines, strings.Join(headers, ","))

	// Add data rows
	for i, row := range data.Data {
		// Convert float64 values to strings
		rowStrings := make([]string, 0, len(row)+1)

		// Add row name if present. Track whether a prefix column was added so the
		// missing-value lookup can map a rowStrings position back to its data column.
		rowNamePrefix := 0
		if len(data.RowNames) > 0 && i < len(data.RowNames) {
			rowStrings = append(rowStrings, data.RowNames[i])
			rowNamePrefix = 1
		}

		// Convert numeric values to strings
		for _, value := range row {
			// Handle missing values
			if data.MissingMask != nil && i < len(data.MissingMask) {
				colIdx := len(rowStrings) - rowNamePrefix
				if colIdx >= 0 && colIdx < len(data.MissingMask[i]) && data.MissingMask[i][colIdx] {
					rowStrings = append(rowStrings, "")
					continue
				}
			}

			// Format float value
			str := fmt.Sprintf("%g", value)
			// Quote if contains special characters
			if strings.Contains(str, ",") || strings.Contains(str, "\"") || strings.Contains(str, "\n") {
				str = fmt.Sprintf("\"%s\"", strings.ReplaceAll(str, "\"", "\"\""))
			}
			rowStrings = append(rowStrings, str)
		}

		lines = append(lines, strings.Join(rowStrings, ","))
	}

	// Write to file
	content := strings.Join(lines, "\n")
	return os.WriteFile(filePath, []byte(content), 0644)
}

// LaunchGoCSV launches GoCSV without a file
func (a *App) LaunchGoCSV() error {
	// Check if GoCSV is installed
	status := a.CheckGoCSVStatus()
	if !status.Installed {
		return fmt.Errorf("GoCSV not found: %s", status.Error)
	}

	var cmd *exec.Cmd

	// On macOS, if it's an app bundle, use 'open' command
	if strings.Contains(status.Path, ".app/Contents/MacOS/") {
		// Extract the .app bundle path
		appIndex := strings.Index(status.Path, ".app")
		if appIndex != -1 {
			appBundlePath := status.Path[:appIndex+4] // Include ".app"
			cmd = exec.Command("open", "-a", appBundlePath)
		} else {
			// Fallback to direct execution
			cmd = exec.Command(status.Path)
		}
	} else {
		// Regular binary or non-macOS
		cmd = exec.Command(status.Path)
	}

	// Launch the application
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to launch GoCSV: %w", err)
	}

	// Detach from the process
	if err := cmd.Process.Release(); err != nil {
		// Not critical, just log it
		runtime.LogInfo(a.ctx, fmt.Sprintf("Process release warning: %v", err))
	}

	runtime.LogInfo(a.ctx, "Launched GoCSV")
	return nil
}

// DownloadGoCSV opens the GoCSV download page in the default browser
func (a *App) DownloadGoCSV() error {
	runtime.BrowserOpenURL(a.ctx, "https://github.com/bitjungle/gopca/releases")
	return nil
}

// AppMode describes the operating mode of the current window.
// The frontend uses this to decide whether to render the main app or a tutorial.
type AppMode struct {
	Mode    string `json:"mode"`    // "main" or "tutorial"
	Dataset string `json:"dataset"` // dataset name when Mode == "tutorial"
}

// GetAppMode returns the operating mode for this window.
// Returns mode "tutorial" with the dataset name when launched via OpenTutorial,
// or mode "main" for the normal application window.
// The frontend calls this once on startup to decide which UI to render.
func (a *App) GetAppMode() AppMode {
	if a.tutorialDataset != "" {
		return AppMode{Mode: "tutorial", Dataset: a.tutorialDataset}
	}
	return AppMode{Mode: "main"}
}

// OpenTutorial launches a separate tutorial window for the named dataset.
// Dataset must match the CSV filename stem: "iris", "wine", "corn", "swiss_roll", or "stocks".
// The tutorial window is a new instance of this binary started with the --tutorial flag;
// it is fully independent and can be closed without affecting the main app.
func (a *App) OpenTutorial(dataset string) error {
	self, err := os.Executable()
	if err != nil {
		return fmt.Errorf("could not determine executable path: %w", err)
	}

	// On macOS, os.Executable() may return the binary inside the .app bundle.
	// exec.Command with the full path works correctly on all platforms.
	cmd := exec.Command(self, "--tutorial", dataset) //nolint:gosec // self is our own executable
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to open tutorial window: %w", err)
	}

	// Detach: the tutorial window is independent of the main app.
	if err := cmd.Process.Release(); err != nil {
		runtime.LogInfo(a.ctx, fmt.Sprintf("tutorial process release warning: %v", err))
	}

	runtime.LogInfo(a.ctx, fmt.Sprintf("Opened tutorial window for dataset: %s", dataset))
	return nil
}
