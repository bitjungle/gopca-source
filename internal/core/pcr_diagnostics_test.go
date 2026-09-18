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
	"math"
	"testing"

	"github.com/bitjungle/gopca/pkg/types"
)

// Issue #977: a PCR model exported "diagnostics": {} while `pca analyze` filled
// all four limits from the same data. The cause was a missing call, and every
// field is omitempty, so four zeros serialised as an empty object rather than as
// anything a reader would notice.
//
// The test is differential rather than a value check. Both commands reach one
// conversion function, so a disagreement means a caller skipped a step -- which
// is exactly what happened. Asserting on either path alone would have passed.

func regressionFixture(t *testing.T) (types.Matrix, []float64) {
	t.Helper()
	// Enough rows and columns that a truncated model leaves a residual space,
	// so the Q limits are computable and the check is not vacuous.
	const rows, cols = 60, 12
	data := make(types.Matrix, rows)
	y := make([]float64, rows)
	for i := 0; i < rows; i++ {
		data[i] = make([]float64, cols)
		drift := float64(i) / float64(rows)
		for j := 0; j < cols; j++ {
			angle := float64(j+1) * drift
			data[i][j] = math.Sin(angle) + 0.1*math.Cos(3*angle) + 0.01*float64((i*j)%7)
		}
		y[i] = 2*drift + 0.05*math.Cos(drift)
	}
	return data, y
}

// The property: on identical data and an identical component count, the limits a
// PCR fit carries must be the ones a plain PCA fit carries.
func TestPCRCarriesTheSameDiagnosticLimitsAsPCA(t *testing.T) {
	data, y := regressionFixture(t)
	const components = 4

	pcaResult, err := RunPCAWithDiagnostics(data, types.PCAConfig{
		Components: components,
		MeanCenter: true,
		Method:     "svd",
	})
	if err != nil {
		t.Fatalf("PCA: %v", err)
	}

	pcrResult, err := (&PCRImpl{}).Fit(data, y, types.PCRConfig{
		PCA:       types.PCAConfig{Components: components, MeanCenter: true, Method: "svd"},
		Response:  "y",
		Selection: types.SelectionConfig{Mode: "fixed", Fixed: components},
	})
	if err != nil {
		t.Fatalf("PCR: %v", err)
	}

	for _, tt := range []struct {
		name string
		pca  float64
		pcr  float64
	}{
		{"T² 95%", pcaResult.T2Limit95, pcrResult.PCA.T2Limit95},
		{"T² 99%", pcaResult.T2Limit99, pcrResult.PCA.T2Limit99},
		{"Q 95%", pcaResult.QLimit95, pcrResult.PCA.QLimit95},
		{"Q 99%", pcaResult.QLimit99, pcrResult.PCA.QLimit99},
	} {
		if tt.pca != tt.pcr {
			t.Errorf("%s: PCA gives %v, PCR gives %v -- the two commands disagree "+
				"about the same data", tt.name, tt.pca, tt.pcr)
		}
	}
}

// A check that could not have been passed by the old code: the limits must
// actually be there. The differential test above would be satisfied by both
// sides returning zero.
func TestPCRDiagnosticLimitsAreNotAllZero(t *testing.T) {
	data, y := regressionFixture(t)
	result, err := (&PCRImpl{}).Fit(data, y, types.PCRConfig{
		PCA:       types.PCAConfig{Components: 4, MeanCenter: true, Method: "svd"},
		Response:  "y",
		Selection: types.SelectionConfig{Mode: "fixed", Fixed: 4},
	})
	if err != nil {
		t.Fatalf("PCR: %v", err)
	}
	if result.PCA.T2Limit95 <= 0 || result.PCA.T2Limit99 <= 0 {
		t.Errorf("T² limits are %v and %v; a model with more rows than components "+
			"always has them", result.PCA.T2Limit95, result.PCA.T2Limit99)
	}
	if result.PCA.QLimit95 <= 0 || result.PCA.QLimit99 <= 0 {
		t.Errorf("Q limits are %v and %v; this fixture retains 4 of 12 components, "+
			"so a residual space exists and they are computable",
			result.PCA.QLimit95, result.PCA.QLimit99)
	}
	if result.PCA.T2Limit99 <= result.PCA.T2Limit95 {
		t.Errorf("the 99%% T² limit (%v) is not above the 95%% limit (%v)",
			result.PCA.T2Limit99, result.PCA.T2Limit95)
	}
}
