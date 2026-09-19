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
	"math"
	"strings"

	pkgcsv "github.com/bitjungle/gopca/pkg/csv"

	"github.com/bitjungle/gopca/pkg/types"
)

// sampleFit is what one projected sample says about how well the model accounts
// for it.
//
// Two numbers, because they describe different failures. T² is distance *along*
// the components -- an ordinary sample in an unusual place. Q is distance *off*
// them -- a sample with structure the model has no direction for. A sample can be
// unremarkable on one and extreme on the other.
type sampleFit struct {
	// T2 is Hotelling's statistic, the squared distance from the centre of the
	// model in score units.
	T2 float64
	// RSS is the squared length of the part of the sample the model could not
	// reconstruct. The chemometric literature calls this Q, or the squared
	// prediction error; the model schema calls the same quantity rss in
	// results.samples.metrics, and this field keeps that name so the project does
	// not acquire a third word for one idea.
	RSS float64
	// T2Exceeded and RSSExceeded are set when the value is above the model's 95%
	// limit. Both are false when the model carries no limit to compare against,
	// which is not the same as being within it -- see Known.
	T2Exceeded  bool
	RSSExceeded bool
	// Known reports whether a comparison was possible at all.
	Known bool
}

// Outside reports whether either statistic exceeded its limit.
//
// Deliberately not called "is an outlier". The model file uses is_outlier for
// training rows, where the limit was fitted on data including the sample being
// judged; here the limit comes from a model the sample had no part in. The same
// word for two different claims would invite the reader to compare figures that
// are not comparable.
func (f sampleFit) Outside() bool {
	return f.Known && (f.T2Exceeded || f.RSSExceeded)
}

// modelLimits is the comparison a model file can supply.
type modelLimits struct {
	T2  float64
	RSS float64
	// HasT2 and HasRSS are separate because a Q limit is legitimately absent when
	// every component was retained and no residual space remains, while a T²
	// limit is available whenever there were more rows than components. Absence
	// and zero are different, and a zero limit would mean everything exceeds it.
	HasT2  bool
	HasRSS bool
}

func limitsFrom(d types.DiagnosticLimits) modelLimits {
	return modelLimits{
		T2:     d.T2Limit95,
		RSS:    d.QLimit95,
		HasT2:  d.T2Limit95 > 0,
		HasRSS: d.QLimit95 > 0,
	}
}

// computeSampleFits measures each projected sample against the model it was
// projected onto.
//
//	T²ᵢ = Σₐ tᵢₐ² / λₐ      distance along the retained components
//	Qᵢ  = ‖xᵢ − tᵢPᵀ‖²      what the reconstruction left behind
//
// preprocessed is the matrix the projection was computed from, in the same space
// as the reconstruction; passing the raw data instead would make Q the distance
// to an unrelated point. eigenvalues are the training score variances, so a
// component that varied little in calibration counts for more here -- which is
// the whole point of dividing by them.
func computeSampleFits(preprocessed, scores, loadings types.Matrix,
	eigenvalues []float64, limits modelLimits) []sampleFit {

	fits := make([]sampleFit, len(scores))
	for i := range scores {
		fit := sampleFit{Known: limits.HasT2 || limits.HasRSS}

		for a, t := range scores[i] {
			if a < len(eigenvalues) && eigenvalues[a] > 0 {
				fit.T2 += t * t / eigenvalues[a]
			}
		}

		if i < len(preprocessed) {
			for j, x := range preprocessed[i] {
				reconstructed := 0.0
				if j < len(loadings) {
					for a, t := range scores[i] {
						if a < len(loadings[j]) {
							reconstructed += t * loadings[j][a]
						}
					}
				}
				residual := x - reconstructed
				fit.RSS += residual * residual
			}
		}

		fit.T2Exceeded = limits.HasT2 && fit.T2 > limits.T2
		fit.RSSExceeded = limits.HasRSS && fit.RSS > limits.RSS
		fits[i] = fit
	}
	return fits
}

// countOutside returns how many samples fell outside the model's limits.
func countOutside(fits []sampleFit) int {
	n := 0
	for _, f := range fits {
		if f.Outside() {
			n++
		}
	}
	return n
}

// describeLimits renders the comparison a reader is being held to, or says that
// there is none.
func describeLimits(limits modelLimits) string {
	switch {
	case limits.HasT2 && limits.HasRSS:
		return fmt.Sprintf("T² %.4g, Q %.4g", limits.T2, limits.RSS)
	case limits.HasT2:
		return fmt.Sprintf("T² %.4g; the model carries no Q limit", limits.T2)
	case limits.HasRSS:
		return fmt.Sprintf("Q %.4g; the model carries no T² limit", limits.RSS)
	default:
		return ""
	}
}

// predictionScore is how well a set of predictions matched measured values.
type predictionScore struct {
	N     int
	RMSEP float64
	Bias  float64
	SEP   float64
	R2    float64
}

// scorePredictions compares predictions against measured values.
//
// Reported separately from RMSEC and RMSECV rather than folded in with them,
// because it answers a different question: those two describe the calibration
// set, and `pca regress --help` says outright that RMSEP is "not produced here".
// This is where it can be, because the data being transformed sometimes carries
// the response already and until now that column was read and ignored.
//
// R² is computed against the mean of the *measured* values supplied here, not
// the training mean, so it says how much of this data's variation the model
// accounted for. It can be negative, which is meaningful: a model doing worse
// than predicting this data's own average.
func scorePredictions(predicted, measured []float64, include func(int) bool) predictionScore {
	var n int
	var sumErr, sumSq, sumMeasured float64
	for i := range predicted {
		if i >= len(measured) || (include != nil && !include(i)) {
			continue
		}
		err := predicted[i] - measured[i]
		sumErr += err
		sumSq += err * err
		sumMeasured += measured[i]
		n++
	}
	if n == 0 {
		return predictionScore{}
	}

	score := predictionScore{N: n}
	score.RMSEP = sqrt(sumSq / float64(n))
	score.Bias = sumErr / float64(n)

	// SEP is the spread of the errors about their own mean: a model can be
	// precise and biased, and the two failures want different remedies.
	mean := sumMeasured / float64(n)
	var sumVar, sumTotal float64
	for i := range predicted {
		if i >= len(measured) || (include != nil && !include(i)) {
			continue
		}
		deviation := (predicted[i] - measured[i]) - score.Bias
		sumVar += deviation * deviation
		sumTotal += (measured[i] - mean) * (measured[i] - mean)
	}
	if n > 1 {
		score.SEP = sqrt(sumVar / float64(n-1))
	}
	if sumTotal > 0 {
		score.R2 = 1 - sumSq/sumTotal
	}
	return score
}

func sqrt(v float64) float64 {
	if v <= 0 {
		return 0
	}
	return math.Sqrt(v)
}

// measuredResponseFrom finds the model's response among the columns the file
// carried, if it carried it.
//
// The parse separates #target columns from the predictors, so the values are
// already to hand and no second read is needed. Both spellings are tried because
// the marker is part of the column's name in the file and part of the model's
// record of which column it predicted, and nothing guarantees a caller kept it.
func measuredResponseFrom(data *pkgcsv.Data, response string) ([]float64, bool) {
	if data == nil || len(data.NumericTargetColumns) == 0 || response == "" {
		return nil, false
	}
	if values, ok := data.NumericTargetColumns[response]; ok {
		return values, true
	}
	bare := strings.TrimSuffix(strings.TrimSpace(response), "#target")
	for name, values := range data.NumericTargetColumns {
		if strings.TrimSuffix(strings.TrimSpace(name), "#target") == bare {
			return values, true
		}
	}
	return nil, false
}

// printPredictionError reports how well the predictions matched, and splits the
// figure by whether the model recognised the sample.
//
// The split is the point. A single RMSEP averages over samples the model handles
// and samples it has never seen the like of, and describes neither. Measured on
// the Tecator extrapolation subsets, the two halves came out at 2.07 and 6.50
// against a pooled 3.48.
func printPredictionError(predicted, measured []float64, fits []sampleFit, limits modelLimits) {
	overall := scorePredictions(predicted, measured, nil)
	if overall.N == 0 {
		return
	}

	fmt.Println("\nPrediction error against the measured response")
	fmt.Println("──────────────────────────────────────────────────────────────")

	hasLimits := limits.HasT2 || limits.HasRSS
	inside := func(i int) bool { return i >= len(fits) || !fits[i].Outside() }
	outside := func(i int) bool { return i < len(fits) && fits[i].Outside() }

	if hasLimits && countOutside(fits) > 0 {
		within := scorePredictions(predicted, measured, inside)
		beyond := scorePredictions(predicted, measured, outside)
		fmt.Printf("  RMSEP  %10.6g   on the %d samples within the model's limits\n",
			within.RMSEP, within.N)
		fmt.Printf("  RMSEP  %10.6g   on the %d outside\n", beyond.RMSEP, beyond.N)
		fmt.Printf("  RMSEP  %10.6g   over all %d, which describes neither group\n",
			overall.RMSEP, overall.N)
	} else {
		fmt.Printf("  RMSEP  %10.6g   on %d samples\n", overall.RMSEP, overall.N)
	}

	fmt.Printf("  bias   %10.6g   mean signed error\n", overall.Bias)
	fmt.Printf("  SEP    %10.6g   spread of the errors about that bias\n", overall.SEP)
	fmt.Printf("  R2P    %10.6g   against the mean of these measured values\n", overall.R2)
	fmt.Println("\n  This is RMSEP: an independent figure only if the data above was kept")
	fmt.Println("  out of model development entirely. GoPCA cannot tell whether it was.")
}
