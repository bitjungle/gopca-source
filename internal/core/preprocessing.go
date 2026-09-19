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

package core

import (
	"fmt"
	"math"
	"sort"

	"github.com/bitjungle/gopca/pkg/types"
	"gonum.org/v1/gonum/stat"
)

const (
	// Minimum variance/norm threshold to avoid division by zero
	MinVarianceThreshold = 1e-8
)

// Preprocessor handles data preprocessing for PCA
type Preprocessor struct {
	// Preprocessing parameters
	MeanCenter    bool
	StandardScale bool
	RobustScale   bool
	ScaleOnly     bool
	SNV           bool
	VectorNorm    bool

	// Fitted parameters
	mean        []float64
	scale       []float64
	originalStd []float64 // Original standard deviations before scaling
	median      []float64
	mad         []float64
	fitted      bool

	// SNV parameters (stored but currently not used - row transforms are model-less)
	// Kept for potential future use in specialized inverse transforms
	rowMeans   []float64
	rowStdDevs []float64

	// savGolConfig, when set, applies a Savitzky-Golay filter along the variable
	// axis after SNV or vector normalisation and before any column statistics.
	// savGol is the filter compiled for the width of the data actually seen; it
	// is built on first use because the configuration alone does not determine
	// it, and cleared whenever the width changes.
	savGolConfig *SavGolConfig
	savGol       *SavGol
}

// NewPreprocessor creates a new preprocessor instance
func NewPreprocessor(meanCenter, standardScale, robustScale bool) *Preprocessor {
	return &Preprocessor{
		MeanCenter:    meanCenter,
		StandardScale: standardScale,
		RobustScale:   robustScale,
	}
}

// NewPreprocessorFull creates a new preprocessor instance with all options
func NewPreprocessorFull(meanCenter, standardScale, robustScale, snv, vectorNorm bool) *Preprocessor {
	return &Preprocessor{
		MeanCenter:    meanCenter,
		StandardScale: standardScale,
		RobustScale:   robustScale,
		SNV:           snv,
		VectorNorm:    vectorNorm,
	}
}

// NewPreprocessorWithScaleOnly creates a new preprocessor instance with scale-only option
func NewPreprocessorWithScaleOnly(meanCenter, standardScale, robustScale, scaleOnly, snv, vectorNorm bool) *Preprocessor {
	return &Preprocessor{
		MeanCenter:    meanCenter,
		StandardScale: standardScale,
		RobustScale:   robustScale,
		ScaleOnly:     scaleOnly,
		SNV:           snv,
		VectorNorm:    vectorNorm,
	}
}

// ApplySavGolConfig transfers the Savitzky-Golay settings from a PCAConfig onto
// a preprocessor, doing nothing when no window is set.
//
// Every construction site goes through this rather than reading the three
// fields itself, so a path that forgets the filter is a missing call rather than
// a silently dropped setting -- which is how --snv came to be accepted and
// ignored by temporal PCA.
func ApplySavGolConfig(p *Preprocessor, config types.PCAConfig) error {
	if config.SavGolWindow <= 0 {
		return nil
	}
	return p.SetSavitzkyGolay(SavGolConfig{
		WindowLength: config.SavGolWindow,
		PolyOrder:    config.SavGolPolyOrder,
		Deriv:        config.SavGolDeriv,
	})
}

// PreviewRowStage applies only the row-wise stage of preprocessing: SNV or
// vector normalisation, then Savitzky-Golay. Column centring and scaling are
// deliberately left out.
//
// This exists so an interface can show what a filter did to the spectra without
// running a decomposition. Column centring is excluded because centred spectra
// are hard to read -- every one of them is pulled toward zero by the mean
// spectrum, which is a separate and well understood step -- and because "the
// preprocessed spectra" in the chemometric sense means exactly this stage.
//
// The rows given need not be the whole dataset. Nothing in this stage is fitted:
// SNV and vector normalisation are computed from the row being transformed, and
// the Savitzky-Golay operator depends only on the number of variables. So the
// result for a handful of rows is identical to what those rows would receive in
// a full run, and a preview can send thirty spectra rather than nine hundred
// without becoming an approximation. That property is asserted in the tests,
// because it is the whole basis for sampling.
func PreviewRowStage(data types.Matrix, config types.PCAConfig) (types.Matrix, error) {
	if len(data) == 0 || len(data[0]) == 0 {
		return nil, fmt.Errorf("no data to preprocess")
	}

	p := &Preprocessor{SNV: config.SNV, VectorNorm: config.VectorNorm}
	if err := ApplySavGolConfig(p, config); err != nil {
		return nil, err
	}
	if !p.hasRowStage() {
		// Nothing to do, but the caller still wants a matrix it may keep.
		out := make(types.Matrix, len(data))
		for i, row := range data {
			out[i] = append([]float64(nil), row...)
		}
		return out, nil
	}
	return p.applyRowStage(data, false)
}

// SetSavitzkyGolay enables Savitzky-Golay filtering along the variable axis.
//
// There is no constructor parameter for this. The existing constructors already
// take six positional booleans, and three more integers among them would be a
// row of unlabelled arguments at every call site -- the kind of signature where
// transposing two values compiles and produces a different filter.
//
// Only the configuration's shape is checked here. Whether the window fits the
// data cannot be known until the data arrives, and is checked then.
func (p *Preprocessor) SetSavitzkyGolay(cfg SavGolConfig) error {
	if err := cfg.ValidateShape(); err != nil {
		return err
	}
	stored := cfg
	p.savGolConfig = &stored
	p.savGol = nil
	return nil
}

// SavitzkyGolayEnabled reports whether a Savitzky-Golay filter is configured.
func (p *Preprocessor) SavitzkyGolayEnabled() bool { return p.savGolConfig != nil }

// SavitzkyGolayFilter returns the compiled filter, or nil if none is configured
// or the preprocessor has not yet seen data.
//
// Callers collapsing a model back onto original variables need the operator
// itself, not merely the knowledge that one was applied.
func (p *Preprocessor) SavitzkyGolayFilter() *SavGol { return p.savGol }

// hasRowStage reports whether anything happens before column statistics.
func (p *Preprocessor) hasRowStage() bool {
	return p.SNV || p.VectorNorm || p.savGolConfig != nil
}

// compileSavGol builds the filter for a given number of variables, reusing the
// previous one when the width is unchanged.
func (p *Preprocessor) compileSavGol(nVars int) error {
	if p.savGolConfig == nil {
		return nil
	}
	if p.savGol != nil && p.savGol.NumVars() == nVars {
		return nil
	}
	filter, err := NewSavGol(*p.savGolConfig, nVars)
	if err != nil {
		return err
	}
	p.savGol = filter
	return nil
}

// applyRowStage applies everything that acts along a row: SNV or vector
// normalisation first, then Savitzky-Golay.
//
// The order is deliberate and matches how the two are used together in
// spectroscopy. Scatter correction is a property of the sample -- it divides a
// spectrum by its own spread -- while the derivative is a property of the
// wavelength axis. Differentiating first and normalising afterwards would let
// each sample's derivative be rescaled by the spread of its own derivative,
// which is not what either step is for.
//
// The returned matrix is always freshly allocated, so callers may keep the input.
func (p *Preprocessor) applyRowStage(data types.Matrix, storeStats bool) (types.Matrix, error) {
	if len(data) == 0 || len(data[0]) == 0 {
		return nil, fmt.Errorf("empty data matrix")
	}
	if err := p.compileSavGol(len(data[0])); err != nil {
		return nil, err
	}

	out := make(types.Matrix, len(data))
	for i := range data {
		row := data[i]
		if p.SNV || p.VectorNorm {
			row = p.applyRowWisePreprocessing(row, storeStats, i)
		} else {
			row = append([]float64(nil), row...)
		}
		if p.savGol != nil {
			filtered, err := p.savGol.Apply(row)
			if err != nil {
				return nil, fmt.Errorf("row %d: %w", i, err)
			}
			row = filtered
		}
		out[i] = row
	}
	return out, nil
}

// applyRowWisePreprocessing applies SNV or Vector Normalization to a single row
// Parameters:
//   - row: the data row to transform
//   - storeStats: if true and rowIndex >= 0, stores statistics for potential inverse transform
//   - rowIndex: index of the row (only used when storeStats is true)
func (p *Preprocessor) applyRowWisePreprocessing(row []float64, storeStats bool, rowIndex int) []float64 {
	result := make([]float64, len(row))
	copy(result, row)

	if p.SNV {
		// Apply Standard Normal Variate (SNV): (x - row_mean) / row_std
		// SNV is commonly used in spectroscopy to remove multiplicative scatter effects
		// Reference: Barnes, R.J., Dhanoa, M.S., & Lister, S.J. (1989). Standard normal variate transformation
		// and de-trending of near-infrared diffuse reflectance spectra. Applied Spectroscopy, 43(5), 772-777.
		rowMean := stat.Mean(result, nil)
		rowStdDev := stat.StdDev(result, nil)

		// Store for potential inverse transform (though currently not used for SNV)
		if storeStats && p.rowMeans != nil && rowIndex >= 0 && rowIndex < len(p.rowMeans) {
			p.rowMeans[rowIndex] = rowMean
			p.rowStdDevs[rowIndex] = rowStdDev
		}

		if rowStdDev < MinVarianceThreshold {
			// Just center if std dev is too small
			for j := range result {
				result[j] -= rowMean
			}
		} else {
			for j := range result {
				result[j] = (result[j] - rowMean) / rowStdDev
			}
		}
	} else if p.VectorNorm {
		// Apply L2 Vector Normalization: x / ||x||
		norm := 0.0
		for _, val := range result {
			norm += val * val
		}
		norm = math.Sqrt(norm)

		// Store norm for potential inverse transform (though currently not used)
		if storeStats && p.rowStdDevs != nil && rowIndex >= 0 && rowIndex < len(p.rowStdDevs) {
			p.rowStdDevs[rowIndex] = norm
		}

		if norm > MinVarianceThreshold {
			for j := range result {
				result[j] /= norm
			}
		}
	}

	return result
}

// FitTransform fits the preprocessor and transforms the data
func (p *Preprocessor) FitTransform(data types.Matrix) (types.Matrix, error) {
	// If anything acts along the rows, column statistics must be fitted on the
	// data as it looks after that stage, not before it.
	if p.hasRowStage() {
		// Initialize storage for row statistics during fitting
		n := len(data)
		p.rowMeans = make([]float64, n)
		p.rowStdDevs = make([]float64, n)

		dataForFit, err := p.applyRowStage(data, true)
		if err != nil {
			return nil, err
		}

		// Fit column statistics on row-normalized data
		if err := p.Fit(dataForFit); err != nil {
			return nil, err
		}

		// Important: We've already fitted on SNV-normalized data
		// Now we return the transformed data (which includes row-wise and column-wise preprocessing)
		// The Transform method will apply SNV fresh and then use the fitted column statistics
	} else {
		// Standard case: fit on original data
		if err := p.Fit(data); err != nil {
			return nil, err
		}
	}

	return p.Transform(data)
}

// Fit calculates preprocessing parameters from the data
func (p *Preprocessor) Fit(data types.Matrix) error {
	if len(data) == 0 || len(data[0]) == 0 {
		return fmt.Errorf("empty data matrix")
	}

	n, m := len(data), len(data[0])

	// Initialize parameter arrays
	p.mean = make([]float64, m)
	p.scale = make([]float64, m)
	p.originalStd = make([]float64, m)
	p.median = make([]float64, m)
	p.mad = make([]float64, m)

	// Calculate parameters for each feature
	for j := 0; j < m; j++ {
		col := make([]float64, n)
		for i := 0; i < n; i++ {
			col[i] = data[i][j]
		}

		// Mean
		p.mean[j] = stat.Mean(col, nil)

		// Always calculate original standard deviation
		p.originalStd[j] = stat.StdDev(col, nil)

		// Standard deviation for scaling
		if p.StandardScale || p.ScaleOnly {
			p.scale[j] = p.originalStd[j]
			if p.scale[j] < MinVarianceThreshold {
				p.scale[j] = 1.0 // Avoid division by zero
			}
		} else {
			p.scale[j] = 1.0
		}

		// Robust scaling parameters
		if p.RobustScale {
			// Sort the column data for quantile calculation
			sortedCol := make([]float64, len(col))
			copy(sortedCol, col)
			sort.Float64s(sortedCol)

			p.median[j] = stat.Quantile(0.5, stat.Empirical, sortedCol, nil)
			p.mad[j] = medianAbsoluteDeviation(col, p.median[j])
			if p.mad[j] < MinVarianceThreshold {
				p.mad[j] = 1.0 // Avoid division by zero
			}
		}
	}

	p.fitted = true
	return nil
}

// Transform applies the preprocessing to data
func (p *Preprocessor) Transform(data types.Matrix) (types.Matrix, error) {
	if !p.fitted {
		return nil, fmt.Errorf("preprocessor not fitted: call Fit first")
	}

	if len(data) == 0 || len(data[0]) == 0 {
		return nil, fmt.Errorf("empty data matrix")
	}

	n, m := len(data), len(data[0])
	if m != len(p.mean) {
		return nil, fmt.Errorf("data has %d features, expected %d", m, len(p.mean))
	}

	// Create output matrix - start with copy of input data
	result := make(types.Matrix, n)
	for i := 0; i < n; i++ {
		result[i] = make([]float64, m)
		copy(result[i], data[i])
	}

	// Apply the row stage first: SNV or vector normalization, then Savitzky-Golay.
	//
	// For transformation of new data, row statistics are calculated fresh. This
	// is critical: we do NOT use stored row statistics from training. The
	// Savitzky-Golay operator, by contrast, is fixed -- it depends on the
	// configuration and the variable count, never on the sample -- so new data
	// passes through exactly the filter the model was fitted with.
	if p.hasRowStage() {
		staged, err := p.applyRowStage(result, false)
		if err != nil {
			return nil, err
		}
		result = staged
	}

	// Then apply column-wise preprocessing
	for i := 0; i < n; i++ {
		for j := 0; j < m; j++ {
			val := result[i][j]

			// Apply centering and scaling
			if p.RobustScale {
				// Robust scaling: (x - median) / MAD
				val = (val - p.median[j]) / p.mad[j]
			} else if p.ScaleOnly {
				// Scale-only (variance scaling): divide by std dev without mean centering
				val /= p.scale[j]
			} else {
				// Standard scaling
				if p.MeanCenter {
					val -= p.mean[j]
				}
				if p.StandardScale {
					val /= p.scale[j]
				}
			}

			result[i][j] = val
		}
	}

	return result, nil
}

// columnBranch names the three mutually exclusive column-wise transformations.
type columnBranch int

const (
	branchRobust    columnBranch = iota // (x - median) / MAD
	branchScaleOnly                     // x / scale, no centering
	branchStandard                      // optional mean centering, optional scaling
)

// columnStage reports which branch the column-wise stage takes.
//
// The four boolean fields are not independent. RobustScale and ScaleOnly each
// suppress everything below them, so asking for mean centering alongside either
// has no effect. Everything that needs to know what the column stage does asks
// here rather than re-deriving the precedence, because a second copy is how
// #987 happened: the exported artifact read the requested flags and recorded a
// pipeline the training run had not used.
func (p *Preprocessor) columnStage() columnBranch {
	switch {
	case p.RobustScale:
		return branchRobust
	case p.ScaleOnly:
		return branchScaleOnly
	default:
		return branchStandard
	}
}

// AppliedColumnStats describes the column-wise transformation Transform
// actually performs, as distinct from the flags that were requested.
type AppliedColumnStats struct {
	MeanCenter    bool
	StandardScale bool
	RobustScale   bool
	ScaleOnly     bool
}

// AppliedColumnStatistics reports which column-wise branch Transform takes.
//
// The four flags are not independent: Transform chooses one of three branches in
// precedence order, so RobustScale and ScaleOnly each suppress everything below
// them. Asking for mean centering alongside either has no effect on the data.
//
// Three of the five reachable combinations therefore differ between what was
// requested and what happened (#987):
//
//	requested                      applied
//	mean_center + scale_only    -> scale_only alone; nothing was centered
//	mean_center + robust_scale  -> robust_scale alone; centering was on the
//	                               median, not the mean
//	robust_scale alone          -> robust_scale alone; the data IS centered,
//	                               on the median
//
// Callers that record what a model did -- the exported artifact above all --
// must use this rather than the requested flags. This function and Transform
// must agree; TestAppliedColumnStatisticsMatchesTransform asserts that they do,
// by applying the reported flags independently and comparing the result.
func (p *Preprocessor) AppliedColumnStatistics() AppliedColumnStats {
	switch p.columnStage() {
	case branchRobust:
		// (x - median) / MAD. Centered, but not on the mean, so MeanCenter is
		// false: it names a mean centering that did not happen. That the data is
		// centered at all is carried by RobustScale.
		return AppliedColumnStats{RobustScale: true}
	case branchScaleOnly:
		// x / scale, with no centering of any kind.
		return AppliedColumnStats{ScaleOnly: true}
	default:
		return AppliedColumnStats{MeanCenter: p.MeanCenter, StandardScale: p.StandardScale}
	}
}

// InverseTransform reverses the preprocessing
// Note: When SNV is combined with column-wise preprocessing, the inverse transform
// only reverses the column-wise operations. Full reversal of SNV after column
// preprocessing would require storing the full transformed matrix.
func (p *Preprocessor) InverseTransform(data types.Matrix) (types.Matrix, error) {
	if !p.fitted {
		return nil, fmt.Errorf("preprocessor not fitted")
	}

	n, m := len(data), len(data[0])
	if m != len(p.mean) {
		return nil, fmt.Errorf("data has %d features, expected %d", m, len(p.mean))
	}

	// Create output matrix
	result := make(types.Matrix, n)
	for i := 0; i < n; i++ {
		result[i] = make([]float64, m)
		for j := 0; j < m; j++ {
			val := data[i][j]

			// Reverse scaling and centering (column-wise operations only)
			if p.RobustScale {
				// Reverse robust scaling
				val = val*p.mad[j] + p.median[j]
			} else if p.ScaleOnly {
				// Reverse scale-only
				val *= p.scale[j]
			} else {
				// Reverse standard scaling
				if p.StandardScale {
					val *= p.scale[j]
				}
				if p.MeanCenter {
					val += p.mean[j]
				}
			}

			result[i][j] = val
		}
	}

	// Note: SNV reversal is not performed when combined with column preprocessing
	// as it would require the intermediate state after SNV but before column operations

	return result, nil
}

// medianAbsoluteDeviation calculates MAD for robust scaling
//
// Mathematical References:
//   - Hampel, F.R., Ronchetti, E.M., Rousseeuw, P.J., & Stahel, W.A. (1986).
//     Robust Statistics: The Approach Based on Influence Functions. Wiley.
//   - Huber, P.J. (1981). Robust Statistics. Wiley.
//
// The scale factor 1.4826 makes MAD consistent with standard deviation for normally distributed data.
// This ensures MAD(X) ≈ σ when X ~ N(μ, σ²)
func medianAbsoluteDeviation(data []float64, median float64) float64 {
	deviations := make([]float64, len(data))
	for i, v := range data {
		deviations[i] = math.Abs(v - median)
	}

	// Sort deviations for quantile calculation
	sort.Float64s(deviations)

	// MAD = median(|x - median(x)|)
	return stat.Quantile(0.5, stat.Empirical, deviations, nil) * 1.4826 // Scale factor for consistency with std dev
}

// RemoveOutliers removes outliers based on z-score
func RemoveOutliers(data types.Matrix, threshold float64) (types.Matrix, []int, error) {
	if len(data) == 0 || len(data[0]) == 0 {
		return data, []int{}, nil
	}

	n, m := len(data), len(data[0])

	// First, calculate mean and std dev for each column
	means := make([]float64, m)
	stdDevs := make([]float64, m)

	for j := 0; j < m; j++ {
		col := make([]float64, n)
		for i := 0; i < n; i++ {
			col[i] = data[i][j]
		}
		means[j] = stat.Mean(col, nil)
		stdDevs[j] = stat.StdDev(col, nil)
	}

	// Now check each row for outliers
	keepRows := []int{}
	for i := 0; i < n; i++ {
		isOutlier := false
		for j := 0; j < m; j++ {
			if stdDevs[j] > 0 {
				zScore := math.Abs((data[i][j] - means[j]) / stdDevs[j])
				if zScore > threshold {
					isOutlier = true
					break
				}
			}
		}

		if !isOutlier {
			keepRows = append(keepRows, i)
		}
	}

	// Create cleaned data
	cleanData := make(types.Matrix, len(keepRows))
	for idx, row := range keepRows {
		cleanData[idx] = data[row]
	}

	return cleanData, keepRows, nil
}

// VariableTransform applies mathematical transformations to variables
type TransformType string

const (
	TransformLog        TransformType = "log"
	TransformSqrt       TransformType = "sqrt"
	TransformSquare     TransformType = "square"
	TransformReciprocal TransformType = "reciprocal"
)

// ApplyTransform applies a mathematical transformation to specified columns
func ApplyTransform(data types.Matrix, columns []int, transform TransformType) (types.Matrix, error) {
	if len(data) == 0 || len(data[0]) == 0 {
		return data, nil
	}

	n, m := len(data), len(data[0])

	// Validate columns
	for _, c := range columns {
		if c < 0 || c >= m {
			return nil, fmt.Errorf("column index %d out of bounds", c)
		}
	}

	// Create transformed data
	result := make(types.Matrix, n)
	for i := 0; i < n; i++ {
		result[i] = make([]float64, m)
		copy(result[i], data[i])
	}

	// Apply transformation to specified columns
	for _, col := range columns {
		for i := 0; i < n; i++ {
			val := result[i][col]

			switch transform {
			case TransformLog:
				if val <= 0 {
					return nil, fmt.Errorf("cannot take log of non-positive value at [%d,%d]", i, col)
				}
				result[i][col] = math.Log(val)

			case TransformSqrt:
				if val < 0 {
					return nil, fmt.Errorf("cannot take sqrt of negative value at [%d,%d]", i, col)
				}
				result[i][col] = math.Sqrt(val)

			case TransformSquare:
				result[i][col] = val * val

			case TransformReciprocal:
				if math.Abs(val) < 1e-10 {
					return nil, fmt.Errorf("cannot take reciprocal of zero at [%d,%d]", i, col)
				}
				result[i][col] = 1.0 / val

			default:
				return nil, fmt.Errorf("unknown transform type: %s", transform)
			}
		}
	}

	return result, nil
}

// GetMeans returns the fitted mean values
func (p *Preprocessor) GetMeans() []float64 {
	if !p.fitted {
		return nil
	}
	return p.mean
}

// GetStdDevs returns the fitted standard deviation values (original, before scaling)
func (p *Preprocessor) GetStdDevs() []float64 {
	if !p.fitted {
		return nil
	}
	return p.originalStd
}

// ColumnAffine returns the per-column center and divisor that the column-wise
// stage of Transform applies, so that a caller can express the whole
// preprocessing step as a single affine map a = (x - center) / divisor.
//
// This exists because none of the individual getters answers that question.
// GetStdDevs returns the standard deviations as measured, which are computed
// whether or not scaling is applied and are not clamped, so dividing by them
// reproduces Transform only in the one case where standard scaling is enabled
// and no column was near constant. Robust scaling centers on the median and
// divides by the MAD on a separate branch entirely. A caller reconstructing the
// map from the flags would be duplicating the branch structure of Transform, and
// the two copies would eventually disagree; the numbers that come out of such a
// disagreement look perfectly reasonable, which is what makes it worth avoiding.
//
// The returned slices describe the column-wise stage only. When row-wise
// preprocessing is enabled the full map is not affine at all, because SNV and
// vector normalization scale each row by a statistic of that same row; see
// IsRowWiseEnabled.
//
// The slices are freshly allocated and safe for the caller to retain.
func (p *Preprocessor) ColumnAffine() (center, divisor []float64, err error) {
	if !p.fitted {
		return nil, nil, fmt.Errorf("preprocessor not fitted: call Fit first")
	}

	m := len(p.mean)
	center = make([]float64, m)
	divisor = make([]float64, m)

	for j := 0; j < m; j++ {
		// The branches below mirror Transform exactly. Keep them in step.
		switch p.columnStage() {
		case branchRobust:
			center[j] = p.median[j]
			divisor[j] = p.mad[j]
		case branchScaleOnly:
			center[j] = 0
			divisor[j] = p.scale[j]
		default:
			if p.MeanCenter {
				center[j] = p.mean[j]
			}
			if p.StandardScale {
				divisor[j] = p.scale[j]
			} else {
				divisor[j] = 1
			}
		}
	}

	return center, divisor, nil
}

// IsRowWiseEnabled reports whether a row-wise transform is applied.
//
// Row-wise transforms are sample dependent: SNV divides a spectrum by its own
// standard deviation and vector normalization by its own length, both computed
// from the row being transformed rather than from the training set. No fixed set
// of per-column coefficients can reproduce their effect, so callers that want to
// collapse a model into original-variable coefficients must check this first.
func (p *Preprocessor) IsRowWiseEnabled() bool {
	return p.SNV || p.VectorNorm
}

// GetMedians returns the fitted median values
func (p *Preprocessor) GetMedians() []float64 {
	if !p.fitted {
		return nil
	}
	return p.median
}

// GetMADs returns the fitted MAD (Median Absolute Deviation) values
func (p *Preprocessor) GetMADs() []float64 {
	if !p.fitted {
		return nil
	}
	return p.mad
}

// GetRowMeans returns the fitted row mean values (for SNV)
func (p *Preprocessor) GetRowMeans() []float64 {
	if !p.fitted || !p.SNV {
		return nil
	}
	return p.rowMeans
}

// GetRowStdDevs returns the fitted row standard deviation values (for SNV)
func (p *Preprocessor) GetRowStdDevs() []float64 {
	if !p.fitted || !p.SNV {
		return nil
	}
	return p.rowStdDevs
}

// IsSNVEnabled returns whether SNV preprocessing is enabled
func (p *Preprocessor) IsSNVEnabled() bool {
	return p.SNV
}

// GetVarianceByColumn calculates variance for each column
func GetVarianceByColumn(data types.Matrix) ([]float64, error) {
	if len(data) == 0 || len(data[0]) == 0 {
		return nil, fmt.Errorf("empty data matrix")
	}

	m := len(data[0])
	variances := make([]float64, m)

	for j := 0; j < m; j++ {
		col := make([]float64, len(data))
		for i := 0; i < len(data); i++ {
			col[i] = data[i][j]
		}
		variances[j] = stat.Variance(col, nil)
	}

	return variances, nil
}

// GetColumnRanks returns column indices sorted by variance (descending)
func GetColumnRanks(data types.Matrix) ([]int, error) {
	variances, err := GetVarianceByColumn(data)
	if err != nil {
		return nil, err
	}

	// Create index-variance pairs
	type varPair struct {
		index    int
		variance float64
	}

	pairs := make([]varPair, len(variances))
	for i, v := range variances {
		pairs[i] = varPair{index: i, variance: v}
	}

	// Sort by variance (descending)
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].variance > pairs[j].variance
	})

	// Extract sorted indices
	ranks := make([]int, len(pairs))
	for i, p := range pairs {
		ranks[i] = p.index
	}

	return ranks, nil
}

// SetFittedParameters sets the fitted parameters for the preprocessor
func (p *Preprocessor) SetFittedParameters(means, stdDevs, medians, mads, rowMeans, rowStdDevs []float64) error {
	// Basic validation
	if p.MeanCenter && len(means) == 0 {
		return fmt.Errorf("means required when mean centering is enabled")
	}
	if p.StandardScale && len(stdDevs) == 0 {
		return fmt.Errorf("standard deviations required when standard scaling is enabled")
	}
	if p.RobustScale && (len(medians) == 0 || len(mads) == 0) {
		return fmt.Errorf("medians and MADs required when robust scaling is enabled")
	}
	// Note: Row means and standard deviations are NOT required for SNV or VectorNorm
	// because these are calculated fresh for each new sample during transformation

	// Set the parameters
	p.mean = means
	if stdDevs != nil {
		p.originalStd = make([]float64, len(stdDevs))
		copy(p.originalStd, stdDevs)
	}
	p.median = medians
	p.mad = mads
	// Don't set row statistics - they should be calculated fresh for new data
	// p.rowMeans = rowMeans
	// p.rowStdDevs = rowStdDevs

	// Set scale based on the scaling method
	if (p.StandardScale || p.ScaleOnly) && stdDevs != nil {
		p.scale = make([]float64, len(stdDevs))
		copy(p.scale, stdDevs)
	} else if p.RobustScale && mads != nil {
		p.scale = make([]float64, len(mads))
		copy(p.scale, mads)
	} else {
		// For mean centering or row-wise preprocessing without explicit scaling,
		// scale should be 1.0 for all features
		if len(means) > 0 {
			p.scale = make([]float64, len(means))
			for i := range p.scale {
				p.scale[i] = 1.0
			}
		}
	}

	p.fitted = true
	return nil
}
