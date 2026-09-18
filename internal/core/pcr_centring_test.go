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
	"strings"
	"testing"

	"github.com/bitjungle/gopca/pkg/types"
)

// centringFixture is deliberately far from the origin on every column, since
// that is the condition under which an uncentred first component is dominated by
// the mean -- the case this refusal exists for.
func centringFixture() (types.Matrix, []float64) {
	const rows, cols = 40, 8
	data := make(types.Matrix, rows)
	y := make([]float64, rows)
	for i := 0; i < rows; i++ {
		data[i] = make([]float64, cols)
		drift := float64(i) / float64(rows)
		for j := 0; j < cols; j++ {
			data[i][j] = 100 + math.Sin(float64(j+1)*drift) + 0.01*float64((i*j)%5)
		}
		y[i] = 3*drift + 0.1
	}
	return data, y
}

// Issue #981. PCR accepted uncentred predictors and produced a model that was
// coherent, plausible and quietly different -- on the Tecator spectra the
// training error moved in the fifth decimal while the first component silently
// absorbed the mean.

func pcrConfigWith(mutate func(*types.PCRConfig)) types.PCRConfig {
	config := types.PCRConfig{
		PCA:       types.PCAConfig{Components: 3, MeanCenter: true, Method: "svd"},
		Response:  "y",
		Selection: types.SelectionConfig{Mode: "fixed", Fixed: 3},
	}
	mutate(&config)
	return config
}

func TestPCRRefusesUncentredPredictors(t *testing.T) {
	data, y := centringFixture()

	for _, tt := range []struct {
		name   string
		mutate func(*types.PCRConfig)
	}{
		{"mean centring off", func(c *types.PCRConfig) { c.PCA.MeanCenter = false }},
		{"scale only", func(c *types.PCRConfig) { c.PCA.ScaleOnly = true }},
		{"both", func(c *types.PCRConfig) { c.PCA.MeanCenter = false; c.PCA.ScaleOnly = true }},
	} {
		t.Run(tt.name, func(t *testing.T) {
			_, err := (&PCRImpl{}).Fit(data, y, pcrConfigWith(tt.mutate))
			if err == nil {
				t.Fatal("uncentred predictors were accepted")
			}
			if !strings.Contains(err.Error(), "mean-centred predictors") {
				t.Errorf("the refusal does not say what is wrong: %v", err)
			}
		})
	}
}

// The engine has two callers that spell their controls differently -- a flag on
// the command line, a checkbox in the desktop. A remedy written here would be
// wrong for one of them, which is the defect #973 was about.
func TestPCRCentringRefusalNamesNoInterface(t *testing.T) {
	data, y := centringFixture()
	_, err := (&PCRImpl{}).Fit(data, y, pcrConfigWith(func(c *types.PCRConfig) {
		c.PCA.MeanCenter = false
	}))
	if err == nil {
		t.Fatal("uncentred predictors were accepted")
	}
	for _, banned := range []string{"--", "flag", "checkbox", "tick", "untick"} {
		if strings.Contains(err.Error(), banned) {
			t.Errorf("the message names an interface (%q), which only a caller can "+
				"do correctly: %v", banned, err)
		}
	}
}

// Centring must still be the default, and the refusal must not fire on it.
func TestPCRAcceptsCentredPredictors(t *testing.T) {
	data, y := centringFixture()
	for _, tt := range []struct {
		name   string
		mutate func(*types.PCRConfig)
	}{
		{"centred", func(c *types.PCRConfig) {}},
		{"centred and standardised", func(c *types.PCRConfig) { c.PCA.StandardScale = true }},
		{"centred with SNV", func(c *types.PCRConfig) { c.PCA.SNV = true }},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := (&PCRImpl{}).Fit(data, y, pcrConfigWith(tt.mutate)); err != nil {
				t.Errorf("a centred configuration was refused: %v", err)
			}
		})
	}
}
