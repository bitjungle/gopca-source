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

	"github.com/bitjungle/gopca/internal/crossval"
	"github.com/bitjungle/gopca/internal/utils"
	"github.com/bitjungle/gopca/pkg/types"
	"gonum.org/v1/gonum/mat"
)

// minLabelledRows is the fewest observed responses that can support a fit. Two
// points define a line through any single component, so anything less is not a
// regression.
const minLabelledRows = 3

// PCRImpl implements principal component regression on top of the existing PCA
// engine.
//
// PCR regresses the response on principal component scores. Its first stage is
// exactly the decomposition PCAImpl already performs, so this type adds no
// decomposition code of its own: it fits PCA, then solves a small least-squares
// problem in score space, then maps the result back to the original variables.
//
// The estimator retains the leading k components and is therefore a spectral
// cut-off regularizer. Retaining components because they explain a large share of
// predictor variance is not a valid rule for prediction: PCA never sees the
// response, so a direction carrying almost no predictor variance can carry most
// of the response. Choose k by cross-validation against the deployment loss.
//
// References:
//   - Massy (1965), Principal Components Regression in Exploratory Statistical
//     Research, JASA 60(309), 234-256.
//   - Jolliffe (1982), A Note on the Use of Principal Components in Regression,
//     JRSS C 31(3), 300-303, on why the leading components are not necessarily
//     the predictive ones.
//   - Hastie, Tibshirani & Friedman (2009), The Elements of Statistical
//     Learning, 2nd ed., §3.5.1.
type PCRImpl struct {
	// Fitted state, sufficient to predict without the training data.
	preprocessor *Preprocessor
	// loadings holds the retained components, p × k. It is nil when no components
	// were retained, because a matrix cannot have zero columns; that is the
	// intercept-only model, which is a legitimate and useful baseline rather than
	// a degenerate case to reject.
	loadings  *mat.Dense
	gamma     []float64 // k score-space coefficients
	intercept float64
	nVars     int
	fitted    bool

	config types.PCRConfig
}

// NewPCREngine creates a new principal component regression engine.
func NewPCREngine() types.PCREngine {
	return &PCRImpl{}
}

// Fit builds a PCR model predicting y from data.
//
// Entries of y that are not finite mark rows whose response was not observed.
// Those rows are excluded from the regression but still inform the
// decomposition, because PCA does not use the response and discarding otherwise
// usable predictor rows would throw away real information. In the calibration
// data this tool targets, responses measured on overlapping but distinct subsets
// are the normal case rather than an edge case.
//
// Algorithm complexity: O(n p min(n,p)) for the decomposition, which dominates.
// Cross-validation multiplies that by the number of folds, but not by the number
// of candidate component counts; see crossValidate.
func (p *PCRImpl) Fit(data types.Matrix, y []float64, config types.PCRConfig) (*types.PCRResult, error) {
	if err := validatePCRInput(data, y, config); err != nil {
		return nil, err
	}
	p.config = config

	labelled, excluded := partitionByResponse(y)
	if len(labelled) < minLabelledRows {
		return nil, fmt.Errorf(
			"only %d of %d rows have an observed value for %q, need at least %d: "+
				"check that the response column is the one you intended",
			len(labelled), len(data), config.Response, minLabelledRows)
	}

	kMax, err := resolveMaxComponents(data, labelled, config)
	if err != nil {
		return nil, err
	}

	selected := config.Selection.Fixed
	var report *types.CVReport

	if config.Selection.Mode == "cv" {
		report, err = p.crossValidate(data, y, labelled, config, kMax)
		if err != nil {
			return nil, fmt.Errorf("cross-validation failed: %w", err)
		}
		selected = report.Selected
	}
	if selected > kMax {
		return nil, fmt.Errorf("cannot retain %d components: at most %d are available", selected, kMax)
	}

	// The final decomposition uses every available row, unlabelled ones included,
	// matching what each fold did. It computes kMax components rather than just
	// the selected count so that the result carries the full variance profile a
	// caller needs to show a scree plot beside the selection curve.
	pca := &PCAImpl{}
	pcaConfig := config.PCA
	pcaConfig.Components = kMax
	pcaResult, err := pca.Fit(data, pcaConfig)
	if err != nil {
		return nil, fmt.Errorf("PCA stage failed: %w", err)
	}

	// Attach the diagnostic limits, as RunPCAWithDiagnostics does for `pca
	// analyze`. Without this the exported model carries "diagnostics": {} and
	// nothing applying it can say whether a new sample resembles the calibration
	// set. A regression model is the artifact that most needs to say so, because
	// its output is a number somebody acts on (#977).
	//
	// The limits describe the PCA model as stored, which is fitted with kMax
	// components rather than the count the regression retains. That is the same
	// rule `analyze` follows -- limits for the model in the file -- and it keeps
	// the two commands agreeing on identical input. A consumer reading them
	// should take the component count from len(model.explained_variance), not
	// from regression.components.
	//
	// Failures are non-fatal here for the same reason they are there: a missing
	// diagnostic should not cost the caller a fitted model.
	_ = AttachDiagnostics(pcaResult)

	fit, err := fitScoreRegression(pcaResult.Scores, y, labelled, selected)
	if err != nil {
		return nil, fmt.Errorf("score-space regression failed: %w", err)
	}

	result := &types.PCRResult{
		PCA:               pcaResult,
		Response:          config.Response,
		Components:        selected,
		ScoreCoefficients: fit.gamma,
		Intercept:         fit.intercept,
		ResponseMean:      fit.responseMean,
		Fitted:            fit.fitted,
		CV:                report,
		LabelledRows:      labelled,
		ExcludedRows:      excluded,
	}

	measured := gather(y, labelled)
	result.Residuals = make([]float64, len(measured))
	for i := range measured {
		result.Residuals[i] = measured[i] - fit.fitted[i]
	}

	metrics, err := ComputeRegressionMetrics(fit.fitted, measured)
	if err != nil {
		return nil, fmt.Errorf("scoring the training fit failed: %w", err)
	}
	result.RMSEC = metrics.RMSE
	result.R2C = metrics.R2

	// Retain only the components the regression actually uses, so that Predict
	// cannot silently project onto more directions than were fitted.
	p.preprocessor = pca.preprocessor
	p.loadings = retainColumns(pca.loadings, selected)
	p.gamma = fit.gamma
	p.intercept = fit.intercept
	p.nVars = len(data[0])
	p.fitted = true

	if err := p.attachOriginalScale(result); err != nil {
		return nil, err
	}

	return result, nil
}

// Preprocessor returns the fitted preprocessing parameters, or nil when no
// preprocessing was applied.
//
// Exporting a model needs the centring and scaling values so that a consumer can
// reproduce the pipeline, and they live on the preprocessor rather than in the
// result. Returns nil before Fit has run.
func (p *PCRImpl) Preprocessor() *Preprocessor {
	if !p.fitted {
		return nil
	}
	return p.preprocessor
}

// FitPredict fits the model and returns its result in one step.
func (p *PCRImpl) FitPredict(data types.Matrix, y []float64, config types.PCRConfig) (*types.PCRResult, error) {
	return p.Fit(data, y, config)
}

// Predict applies the fitted model to new data.
//
// Prediction always runs the explicit pipeline (preprocess, project, apply the
// score coefficients) rather than the collapsed original-scale form, so that it
// stays correct when row-wise preprocessing makes the collapsed form unavailable.
func (p *PCRImpl) Predict(data types.Matrix) ([]float64, error) {
	if !p.fitted {
		return nil, fmt.Errorf("model not fitted: call Fit first")
	}
	if len(data) == 0 || len(data[0]) == 0 {
		return nil, fmt.Errorf("empty data matrix")
	}

	if len(data[0]) != p.nVars {
		return nil, fmt.Errorf("data has %d variables, model expects %d", len(data[0]), p.nVars)
	}

	// With no components retained the model is its intercept, and there is nothing
	// to project onto.
	if p.loadings == nil {
		predictions := make([]float64, len(data))
		for i := range predictions {
			predictions[i] = p.intercept
		}
		return predictions, nil
	}

	processed := data
	if p.preprocessor != nil {
		var err error
		processed, err = p.preprocessor.Transform(data)
		if err != nil {
			return nil, fmt.Errorf("preprocessing failed: %w", err)
		}
	}

	x := utils.MatrixToDense(processed)
	n, _ := x.Dims()
	scores := mat.NewDense(n, len(p.gamma), nil)
	scores.Mul(x, p.loadings)

	predictions := make([]float64, n)
	for i := 0; i < n; i++ {
		sum := p.intercept
		for j := range p.gamma {
			sum += p.gamma[j] * scores.At(i, j)
		}
		predictions[i] = sum
	}
	return predictions, nil
}

// scoreRegression is the outcome of the least-squares stage.
type scoreRegression struct {
	gamma        []float64
	intercept    float64
	fitted       []float64
	responseMean float64
}

// fitScoreRegression regresses the response on the leading k score columns of
// the labelled rows, fitting an explicit intercept.
//
// The intercept is fitted rather than removed by centring the response. Centring
// would be equivalent only when the score columns themselves have zero mean over
// the regressed rows, which holds when the decomposition and the regression use
// the same mean-centred rows but not when the decomposition also saw rows whose
// response was unobserved. Fitting the intercept keeps one code path correct in
// both situations.
//
// For the same reason this solves a general least-squares problem instead of the
// per-component shortcut gamma_j = t_j'y / t_j't_j: that shortcut assumes the
// design columns are orthogonal over exactly the rows being regressed, which is
// not true of a labelled subset.
func fitScoreRegression(scores types.Matrix, y []float64, rows []int, k int) (*scoreRegression, error) {
	if k < 0 {
		return nil, fmt.Errorf("component count must not be negative, got %d", k)
	}
	if len(scores) == 0 {
		return nil, fmt.Errorf("no scores to regress on")
	}
	if k > len(scores[0]) {
		return nil, fmt.Errorf("cannot retain %d components: only %d were computed", k, len(scores[0]))
	}

	measured := gather(y, rows)
	design := designMatrix(scores, rows, k)

	solver, err := newNestedLeastSquares(design, measured)
	if err != nil {
		return nil, err
	}
	// The intercept occupies the first column, so k components need k+1 columns.
	if solver.Rank() < k+1 {
		return nil, fmt.Errorf(
			"only %d of the %d requested components are linearly independent over the %d rows "+
				"with an observed response; retain at most %d",
			solver.Rank()-1, k, len(rows), solver.Rank()-1)
	}

	coefficients, err := solver.Coefficients(k + 1)
	if err != nil {
		return nil, err
	}

	fitted := make([]float64, len(rows))
	for column := 0; column <= k; column++ {
		if err := solver.FittedInto(fitted, column); err != nil {
			return nil, err
		}
	}

	var sum float64
	for _, v := range measured {
		sum += v
	}

	return &scoreRegression{
		gamma:        coefficients[1:],
		intercept:    coefficients[0],
		fitted:       fitted,
		responseMean: sum / float64(len(measured)),
	}, nil
}

// attachOriginalScale collapses the fitted pipeline into coefficients on the
// original predictor scale, when that is possible.
//
// With column-wise preprocessing a = (x - center) / divisor, the prediction
//
//	y = intercept + sum_j gamma_j (a . v_j) = intercept + a . theta
//
// expands to a plain linear function of x with beta_p = theta_p / divisor_p and
// an intercept of intercept - center . beta. SNV and vector normalization break
// this: they scale each row by a statistic of that same row, so no fixed
// coefficient vector reproduces their effect. In that case the fields are left
// empty and OriginalScaleValid is false, because a plausible-looking wrong
// coefficient is worse than an absent one.
//
// A Savitzky-Golay filter is the opposite case, and it is worth being explicit
// about why. It also acts along a row, but it is the same operator for every
// sample, so it composes into the coefficients as a transpose and the collapsed
// form survives. Treating "acts along a row" as automatically disqualifying
// would have thrown that away and reported the deployable form as unavailable
// when it was merely one matrix multiply out of reach.
func (p *PCRImpl) attachOriginalScale(result *types.PCRResult) error {
	nVars := p.nVars
	k := 0
	if p.loadings != nil {
		_, k = p.loadings.Dims()
	}

	if p.preprocessor != nil && p.preprocessor.IsRowWiseEnabled() {
		result.OriginalScaleValid = false
		return nil
	}

	center := make([]float64, nVars)
	divisor := make([]float64, nVars)
	for j := range divisor {
		divisor[j] = 1
	}
	if p.preprocessor != nil {
		var err error
		center, divisor, err = p.preprocessor.ColumnAffine()
		if err != nil {
			return fmt.Errorf("recovering the preprocessing map failed: %w", err)
		}
		if len(center) != nVars {
			return fmt.Errorf("preprocessing describes %d variables but the loadings have %d",
				len(center), nVars)
		}
	}

	beta := make([]float64, nVars)
	for v := 0; v < nVars; v++ {
		var theta float64
		for j := 0; j < k; j++ {
			theta += p.loadings.At(v, j) * p.gamma[j]
		}
		beta[v] = theta / divisor[v]
	}

	intercept := p.intercept
	for v := 0; v < nVars; v++ {
		intercept -= center[v] * beta[v]
	}

	// A Savitzky-Golay filter sits before the column statistics, so beta at this
	// point is stated in filtered variables. Unlike SNV it can be undone: the
	// filter is a fixed linear operator S, identical for every sample, so
	// predicting from S x with coefficients beta is the same as predicting from
	// x with coefficients S^T beta. Collapsing it means a deployed model needs
	// the original wavelengths and nothing else -- no filtering step to
	// reimplement, and no chance of reimplementing it differently.
	if p.preprocessor != nil && p.preprocessor.SavitzkyGolayEnabled() {
		filter := p.preprocessor.SavitzkyGolayFilter()
		if filter == nil {
			return fmt.Errorf("a Savitzky-Golay filter is configured but was never compiled, " +
				"so the original-scale coefficients cannot be recovered")
		}
		collapsed, err := filter.ApplyTranspose(beta)
		if err != nil {
			return fmt.Errorf("collapsing the Savitzky-Golay filter into the coefficients: %w", err)
		}
		beta = collapsed
	}

	result.Coefficients = beta
	result.InterceptOriginal = intercept
	result.OriginalScaleValid = true
	return nil
}

// partitionByResponse splits row indices into those with an observed response and
// those without.
func partitionByResponse(y []float64) (labelled, excluded []int) {
	for i, v := range y {
		if isFinite(v) {
			labelled = append(labelled, i)
		} else {
			excluded = append(excluded, i)
		}
	}
	return labelled, excluded
}

// gather picks the values at the given indices, in order.
func gather(values []float64, indices []int) []float64 {
	out := make([]float64, len(indices))
	for i, idx := range indices {
		out[i] = values[idx]
	}
	return out
}

// designMatrix builds [1 | scores[rows, :k]], the least-squares design for a
// k-component regression with an intercept.
func designMatrix(scores types.Matrix, rows []int, k int) *mat.Dense {
	m := mat.NewDense(len(rows), k+1, nil)
	for i, row := range rows {
		m.Set(i, 0, 1)
		for j := 0; j < k; j++ {
			m.Set(i, j+1, scores[row][j])
		}
	}
	return m
}

// retainColumns copies the leading k columns of a loadings matrix, or returns nil
// when none are retained. A gonum matrix cannot have zero columns, and the
// intercept-only model is a baseline worth supporting rather than an error.
func retainColumns(loadings *mat.Dense, k int) *mat.Dense {
	if k == 0 {
		return nil
	}
	rows, _ := loadings.Dims()
	out := mat.NewDense(rows, k, nil)
	for i := 0; i < rows; i++ {
		for j := 0; j < k; j++ {
			out.Set(i, j, loadings.At(i, j))
		}
	}
	return out
}

// resolveMaxComponents determines how many components may be retained.
//
// The binding constraint during cross-validation is the smallest training
// partition, not the full dataset: a candidate count that cannot be fitted in
// every fold cannot be evaluated. Callers get an explicit ceiling rather than a
// fold that quietly fails partway through a sweep.
func resolveMaxComponents(data types.Matrix, labelled []int, config types.PCRConfig) (int, error) {
	nVars := len(data[0])

	// Centring removes one degree of freedom, and the intercept in score space
	// removes another from the regression.
	limit := len(labelled) - 2
	if nVars < limit {
		limit = nVars
	}

	if config.Selection.Mode == "cv" {
		// A fold count of zero means one fold per group, so the effective count
		// has to be resolved before it can bound anything. Skipping that case
		// would leave leave-one-out estimating its ceiling from the full row
		// count rather than from a training partition that is one row shorter.
		folds := config.Selection.CV.Folds
		if folds == 0 {
			folds = countGroups(labelled, config.Selection.CV.Groups)
		}
		if folds > 1 {
			// The largest test fold takes ceil(n/folds) rows, so the smallest
			// training partition keeps the rest.
			//
			// With uneven groups the largest fold can exceed that average, so this
			// is an estimate rather than a guarantee. It exists to fail early and
			// clearly on an impossible request; the binding check is per fold, in
			// evaluateFold, which caps each fold at its own numerical rank and
			// reports the smallest ceiling any fold could honour.
			largestTest := (len(labelled) + folds - 1) / folds
			foldLimit := len(labelled) - largestTest - 2
			if foldLimit < limit {
				limit = foldLimit
			}
		}
	}

	if limit < 1 {
		return 0, fmt.Errorf(
			"not enough rows with an observed response to fit any component: "+
				"%d labelled rows across the chosen validation design leaves no usable training partition",
			len(labelled))
	}

	requested := config.PCA.Components
	if requested > 0 && requested < limit {
		limit = requested
	}
	if config.Selection.Mode == "fixed" && config.Selection.Fixed > limit {
		return 0, fmt.Errorf("cannot retain %d components: at most %d are available for %d labelled rows and %d variables",
			config.Selection.Fixed, limit, len(labelled), nVars)
	}
	return limit, nil
}

// validatePCRInput rejects configurations PCR cannot honour, with messages that
// say what to do instead.
func validatePCRInput(data types.Matrix, y []float64, config types.PCRConfig) error {
	if len(data) == 0 || len(data[0]) == 0 {
		return fmt.Errorf("empty data matrix")
	}
	if len(y) != len(data) {
		return fmt.Errorf("response has %d values but the data has %d rows", len(y), len(data))
	}

	switch config.PCA.Method {
	case "kernel":
		return fmt.Errorf("principal component regression is not available for kernel PCA: " +
			"projecting a new sample onto kernel components needs the original training data and the " +
			"kernel function, so a fitted model cannot predict from variables alone. " +
			"Use --method svd or --method nipals")
	case "temporal":
		return fmt.Errorf("principal component regression is not available for temporal PCA: " +
			"its loadings describe a lagged embedding rather than the input variables, so a new " +
			"sample cannot be projected without re-embedding it. " +
			"Use --method svd or --method nipals")
	case "svd", "nipals", "":
		// Supported.
	default:
		return fmt.Errorf("unknown PCA method %q: expected svd or nipals", config.PCA.Method)
	}

	// Uncentred predictors are refused rather than quietly accepted.
	//
	// The fit succeeds either way and looks entirely normal -- on the Tecator
	// spectra the training error differs in the fifth decimal -- which is what
	// makes it worth refusing. Without centring the first component absorbs the
	// mean of the data: its share of the retained eigenvalues there rises from
	// 98.61% to 99.96%, so a component is spent describing where the samples sit
	// rather than how they vary, while the intercept accounts for that offset at
	// no cost. See Gallagher, O'Sullivan & Palacios (2020), The Effect of Data
	// Centering on PCA Models, on why uncentred eigenvalues conflate the mean
	// with the variance (#981).
	//
	// Uncentred PCA remains available for exploration, where it is a defensible
	// choice; it is regression, with a response and an intercept, that leaves it
	// no purpose.
	//
	// The wording names neither a flag nor a checkbox. The engine has two callers
	// that spell their controls differently, and a remedy written here would be
	// wrong for one of them (#973).
	if !config.PCA.MeanCenter || config.PCA.ScaleOnly {
		return fmt.Errorf("principal component regression requires mean-centered predictors: " +
			"without centering the first component absorbs the mean of the data, so one " +
			"retained component describes where the samples sit rather than how they vary, " +
			"and the intercept already accounts for that offset. Turn mean centering on")
	}

	switch config.Selection.Mode {
	case "fixed":
		if config.Selection.Fixed < 0 {
			return fmt.Errorf("component count must not be negative, got %d", config.Selection.Fixed)
		}
	case "cv":
		if config.Selection.CV.GroupBy != "" && config.Selection.CV.Groups == nil {
			return fmt.Errorf("validation is grouped by %q but no group assignment was supplied: "+
				"the caller must resolve the column into per-row group identifiers",
				config.Selection.CV.GroupBy)
		}
		if config.Selection.CV.Groups != nil && len(config.Selection.CV.Groups) != len(data) {
			return fmt.Errorf("group assignment has %d entries but the data has %d rows",
				len(config.Selection.CV.Groups), len(data))
		}
	default:
		return fmt.Errorf("unknown selection mode %q: expected \"fixed\" or \"cv\"", config.Selection.Mode)
	}

	for i, v := range y {
		if math.IsInf(v, 0) {
			return fmt.Errorf("response value at row %d is infinite; "+
				"use an empty cell or NA to mark an unobserved response", i)
		}
	}

	if err := requireCompletePredictors(data, config); err != nil {
		return err
	}

	return nil
}

// requireCompletePredictors refuses missing predictor values, which PCR cannot
// resolve for itself without either leaking or silently changing the analysis.
//
// Missing *responses* are fine and expected: those rows simply leave the
// regression. Missing *predictors* are different. Filling them by column mean or
// median estimates a statistic from the data, which makes imputation a learned
// step, and a learned step applied before cross-validation lets held-out rows
// influence the values the model trains on. Imputing once up front would make
// every reported error optimistic by an amount nothing in the output would reveal.
//
// The caller therefore resolves missing predictors before fitting, exactly as the
// analyze path already does. Dropping incomplete rows and substituting a constant
// are both safe because neither estimates anything from the data; mean and median
// imputation are not, and supporting them properly means refitting the imputation
// inside every fold.
func requireCompletePredictors(data types.Matrix, config types.PCRConfig) error {
	// NIPALS with native handling works on incomplete data by design, so it is the
	// one method that may be handed missing values directly.
	if config.PCA.Method == "nipals" && config.PCA.MissingStrategy == types.MissingNative {
		return nil
	}

	for i := range data {
		for j, v := range data[i] {
			if !isFinite(v) {
				return fmt.Errorf(
					"predictor value missing at row %d, column %d: "+
						"principal component regression needs complete predictors. "+
						"Drop the incomplete rows or substitute a constant before fitting, "+
						"or use --method nipals with native missing-value handling. "+
						"Note that mean or median imputation must not be applied before "+
						"cross-validation: it estimates values from the data and would let "+
						"the held-out rows influence the model", i, j)
			}
		}
	}
	return nil
}

// buildSplitter turns a validation design into a splitter.
func buildSplitter(cv types.CVConfig, seedOffset int64) (crossval.Splitter, error) {
	switch cv.Scheme {
	case types.CVForwardChaining:
		splits := cv.Folds
		if splits < 1 {
			return nil, fmt.Errorf("forward-chaining validation needs an explicit number of splits")
		}
		return &crossval.ForwardChaining{Splits: splits}, nil

	case types.CVRandom, types.CVContiguous, "":
		return &crossval.GroupKFold{
			K:       cv.Folds,
			Groups:  cv.Groups,
			Shuffle: cv.Scheme == types.CVRandom || cv.Scheme == "",
			Seed:    cv.Seed + seedOffset,
		}, nil

	default:
		return nil, fmt.Errorf("unknown validation scheme %q: expected %q, %q or %q",
			cv.Scheme, types.CVRandom, types.CVContiguous, types.CVForwardChaining)
	}
}
