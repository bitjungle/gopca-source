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
	"math"
	"testing"

	pkgcsv "github.com/bitjungle/gopca/pkg/csv"
	"github.com/bitjungle/gopca/pkg/types"
)

// Issue #978. `pca transform` reported a prediction and nothing about whether the
// model had any basis for it.

// A two-variable model with one component along x, so the second variable is
// entirely residual. That makes T² and Q separable by construction: moving along
// x raises T² alone, moving along y raises Q alone.
func oneComponentModel() (loadings types.Matrix, eigenvalues []float64) {
	return types.Matrix{{1}, {0}}, []float64{4}
}

func TestSampleFitsSeparateDistanceAlongFromDistanceOff(t *testing.T) {
	loadings, eigenvalues := oneComponentModel()
	preprocessed := types.Matrix{
		{2, 0}, // along the component only
		{0, 3}, // off it only
		{0, 0}, // at the centre
	}
	scores := types.Matrix{{2}, {0}, {0}}

	fits := computeSampleFits(preprocessed, scores, loadings, eigenvalues, modelLimits{})

	// T² = t²/λ = 4/4 = 1, and nothing left over.
	if math.Abs(fits[0].T2-1) > 1e-12 || fits[0].RSS > 1e-12 {
		t.Errorf("along the component: T² %v RSS %v, want 1 and 0", fits[0].T2, fits[0].RSS)
	}
	// Off the component: no score, and the whole 3 units is residual.
	if fits[1].T2 > 1e-12 || math.Abs(fits[1].RSS-9) > 1e-12 {
		t.Errorf("off the component: T² %v RSS %v, want 0 and 9", fits[1].T2, fits[1].RSS)
	}
	if fits[2].T2 > 1e-12 || fits[2].RSS > 1e-12 {
		t.Errorf("at the centre: T² %v RSS %v, want both 0", fits[2].T2, fits[2].RSS)
	}
}

// A sample can be ordinary on one statistic and extreme on the other, which is
// why both are reported. A verdict reading only T² would pass the first case
// below and miss the second entirely.
func TestSampleFitsFlagEitherStatisticAlone(t *testing.T) {
	loadings, eigenvalues := oneComponentModel()
	limits := modelLimits{T2: 1, RSS: 1, HasT2: true, HasRSS: true}

	fits := computeSampleFits(
		types.Matrix{{4, 0}, {0, 4}, {0.2, 0.2}},
		types.Matrix{{4}, {0}, {0.2}},
		loadings, eigenvalues, limits)

	if !fits[0].T2Exceeded || fits[0].RSSExceeded {
		t.Errorf("far along the component: got T2Exceeded=%v RSSExceeded=%v, want true/false",
			fits[0].T2Exceeded, fits[0].RSSExceeded)
	}
	if fits[1].T2Exceeded || !fits[1].RSSExceeded {
		t.Errorf("far off the component: got T2Exceeded=%v RSSExceeded=%v, want false/true",
			fits[1].T2Exceeded, fits[1].RSSExceeded)
	}
	for i := 0; i < 2; i++ {
		if !fits[i].Outside() {
			t.Errorf("sample %d exceeded a limit but Outside() is false", i)
		}
	}
	if fits[2].Outside() {
		t.Error("an ordinary sample was reported as outside the model")
	}
}

// Absence of a limit and being within one are opposite conclusions, and the
// difference decides whether silence in the report means anything.
func TestSampleFitsDistinguishNoLimitFromWithinLimit(t *testing.T) {
	loadings, eigenvalues := oneComponentModel()
	preprocessed := types.Matrix{{100, 100}}
	scores := types.Matrix{{100}}

	none := computeSampleFits(preprocessed, scores, loadings, eigenvalues, modelLimits{})[0]
	if none.Known {
		t.Error("a model with no limits reported a known verdict")
	}
	if none.Outside() {
		t.Error("a sample was reported outside limits that do not exist")
	}
	if none.T2 <= 0 || none.RSS <= 0 {
		t.Error("the statistics should still be computed when there is nothing to compare them to")
	}

	// A zero limit is absence, not a limit everything exceeds.
	zero := limitsFrom(types.DiagnosticLimits{})
	if zero.HasT2 || zero.HasRSS {
		t.Error("zero limits were treated as present")
	}
}

func TestScorePredictionsSplitsByVerdict(t *testing.T) {
	predicted := []float64{1, 2, 3, 40}
	measured := []float64{1, 2, 3, 10}
	fits := []sampleFit{
		{Known: true}, {Known: true}, {Known: true},
		{Known: true, T2Exceeded: true},
	}

	inside := scorePredictions(predicted, measured, func(i int) bool { return !fits[i].Outside() })
	outside := scorePredictions(predicted, measured, func(i int) bool { return fits[i].Outside() })
	overall := scorePredictions(predicted, measured, nil)

	if inside.N != 3 || inside.RMSEP > 1e-12 {
		t.Errorf("within the limits: n=%d RMSEP=%v, want 3 and 0", inside.N, inside.RMSEP)
	}
	if outside.N != 1 || math.Abs(outside.RMSEP-30) > 1e-12 {
		t.Errorf("outside the limits: n=%d RMSEP=%v, want 1 and 30", outside.N, outside.RMSEP)
	}
	// The property the split exists for: the pooled figure describes neither.
	if overall.RMSEP <= inside.RMSEP || overall.RMSEP >= outside.RMSEP {
		t.Errorf("pooled RMSEP %v does not sit between %v and %v, so the split says nothing",
			overall.RMSEP, inside.RMSEP, outside.RMSEP)
	}
}

// R² is against the mean of the values supplied, so a model worse than that mean
// scores below zero. Clamping it would hide the one case worth noticing.
func TestScorePredictionsAllowsNegativeR2(t *testing.T) {
	score := scorePredictions([]float64{10, 10, 10}, []float64{1, 2, 3}, nil)
	if score.R2 >= 0 {
		t.Errorf("R² = %v for predictions worse than the mean; want negative", score.R2)
	}
}

func TestMeasuredResponseFromToleratesTheMarker(t *testing.T) {
	data := &pkgcsv.Data{NumericTargetColumns: map[string][]float64{"Fat#target": {1, 2}}}

	for _, response := range []string{"Fat#target", "Fat"} {
		if _, ok := measuredResponseFrom(data, response); !ok {
			t.Errorf("response %q was not found", response)
		}
	}
	if _, ok := measuredResponseFrom(data, "Moisture"); ok {
		t.Error("a response the file does not carry was reported as found")
	}
	if _, ok := measuredResponseFrom(nil, "Fat#target"); ok {
		t.Error("a nil dataset reported a response")
	}
}

// The marker is documented in two spellings, "Response#target" and
// "Response #target". Trimming the suffix without trimming the space it may
// leave behind made the second one miss, and missing was silent: predictions
// printed, error figures never computed, nothing saying why.
func TestMeasuredResponseFromMatchesTheSpacedMarker(t *testing.T) {
	for _, header := range []string{"Fat#target", "Fat #target", " Fat#target "} {
		data := &pkgcsv.Data{NumericTargetColumns: map[string][]float64{header: {1, 2}}}
		for _, response := range []string{"Fat", "Fat#target", "Fat #target"} {
			if _, ok := measuredResponseFrom(data, response); !ok {
				t.Errorf("header %q did not match response %q", header, response)
			}
		}
	}
}

// And a response the file genuinely lacks must still miss, or the matching is
// too loose to be worth anything.
func TestMeasuredResponseFromRejectsADifferentColumn(t *testing.T) {
	data := &pkgcsv.Data{NumericTargetColumns: map[string][]float64{"Fat #target": {1, 2}}}
	for _, response := range []string{"Moisture", "Moisture#target", "Fatty"} {
		if _, ok := measuredResponseFrom(data, response); ok {
			t.Errorf("response %q matched a file carrying only Fat", response)
		}
	}
}
