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
	"strings"
	"testing"

	"github.com/bitjungle/gopca/pkg/types"
)

// Issue #982: the reports named the method and not what was done to the data, so
// two runs that transformed it completely differently produced output
// distinguishable only by its digits.

func TestDescribePreprocessing(t *testing.T) {
	tests := []struct {
		name   string
		config types.PCAConfig
		want   string
	}{
		{"default", types.PCAConfig{MeanCenter: true}, "mean centering"},
		{
			"standardized",
			types.PCAConfig{MeanCenter: true, StandardScale: true},
			"mean centering, standard scaling",
		},
		{
			// Robust scaling centres on the median in its own branch, so "mean
			// centering" would be wrong here even though the flag is set.
			"robust with centering nominally on",
			types.PCAConfig{MeanCenter: true, RobustScale: true},
			"robust scaling (centered on the median, divided by the MAD)",
		},
		{
			// And the data is still centered -- on the median -- with the flag off.
			// Reporting "without centering" here would be the same error inverted.
			"robust with centering nominally off",
			types.PCAConfig{RobustScale: true},
			"robust scaling (centered on the median, divided by the MAD)",
		},
		{
			"scale only is one step, not a scaling plus a silent absence",
			types.PCAConfig{ScaleOnly: true},
			"variance scaling without centering",
		},
		{
			"SNV comes first because it is applied first",
			types.PCAConfig{MeanCenter: true, SNV: true},
			"SNV, mean centering",
		},
		{
			"vector norm",
			types.PCAConfig{MeanCenter: true, VectorNorm: true},
			"vector normalization, mean centering",
		},
		{
			"Savitzky-Golay carries its settings",
			types.PCAConfig{MeanCenter: true, SavGolWindow: 11, SavGolPolyOrder: 2, SavGolDeriv: 2},
			"Savitzky-Golay (window 11, order 2, derivative 2), mean centering",
		},
		{
			"the full pipeline, in application order",
			types.PCAConfig{
				MeanCenter: true, StandardScale: true, SNV: true,
				SavGolWindow: 7, SavGolPolyOrder: 3, SavGolDeriv: 1,
			},
			"SNV, Savitzky-Golay (window 7, order 3, derivative 1), mean centering, standard scaling",
		},
		{
			// Said explicitly. A blank reads as an omission rather than an answer.
			"nothing at all",
			types.PCAConfig{},
			"none",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := describePreprocessing(tt.config); got != tt.want {
				t.Errorf("describePreprocessing() = %q, want %q", got, tt.want)
			}
		})
	}
}

// The point of the line is that two materially different runs are distinguishable
// from their reports. A describer that collapsed distinctions would pass every
// case above individually and still fail the property.
func TestDescribePreprocessingDistinguishesEveryOption(t *testing.T) {
	configs := map[string]types.PCAConfig{
		"plain":       {MeanCenter: true},
		"standard":    {MeanCenter: true, StandardScale: true},
		"robust":      {MeanCenter: true, RobustScale: true},
		"scale only":  {ScaleOnly: true},
		"snv":         {MeanCenter: true, SNV: true},
		"vector norm": {MeanCenter: true, VectorNorm: true},
		"savgol 11":   {MeanCenter: true, SavGolWindow: 11, SavGolPolyOrder: 2, SavGolDeriv: 2},
		"savgol 31":   {MeanCenter: true, SavGolWindow: 31, SavGolPolyOrder: 2, SavGolDeriv: 2},
		"none":        {},
	}

	// Robust scaling appears once: with the flag on or off the branch taken is
	// identical, so one description is correct rather than a collapsed distinction.
	seen := make(map[string]string, len(configs))
	for name, config := range configs {
		description := describePreprocessing(config)
		if other, clash := seen[description]; clash {
			t.Errorf("%q and %q both describe as %q, so their reports would be "+
				"indistinguishable", name, other, description)
		}
		seen[description] = name
	}
}

// A reader should be able to tell a derivative apart from a smooth, and one
// window from another, since they are different transforms.
func TestDescribePreprocessingNamesSavitzkyGolaySettings(t *testing.T) {
	got := describePreprocessing(types.PCAConfig{
		MeanCenter: true, SavGolWindow: 31, SavGolPolyOrder: 3, SavGolDeriv: 0,
	})
	for _, want := range []string{"31", "order 3", "derivative 0"} {
		if !strings.Contains(got, want) {
			t.Errorf("description %q omits %q", got, want)
		}
	}
}
