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
	"strings"

	"github.com/bitjungle/gopca/pkg/types"
)

// describePreprocessing renders what was done to the data before the
// decomposition, in the order it was applied.
//
// The reports named the method and nothing else, so two runs that transformed
// the data completely differently produced output distinguishable only by its
// digits (#982). That matters here more than it would elsewhere: preprocessing
// is frequently the largest single decision in the analysis. On the Tecator
// spectra SNV takes the model from 15 components to 5; on the aluminium alloy
// data standardisation moves PC1 from 59% of the variance to 10%. A figure
// pasted into a report was not reproducible from itself.
//
// The order is the order of application -- row-wise corrections, then
// Savitzky-Golay along the variable axis, then the column statistics -- so the
// line says what happened as well as which options were set.
//
// Savitzky-Golay carries its settings rather than its name alone, because a
// second derivative over a window of 11 and one over a window of 31 are
// different transforms.
func describePreprocessing(config types.PCAConfig) string {
	var steps []string

	// Row-wise first: each divides a row by a statistic of that row, before any
	// column is looked at.
	if config.SNV {
		steps = append(steps, "SNV")
	}
	if config.VectorNorm {
		steps = append(steps, "vector normalisation")
	}

	if config.SavGolWindow > 0 {
		steps = append(steps, fmt.Sprintf("Savitzky-Golay (window %d, order %d, derivative %d)",
			config.SavGolWindow, config.SavGolPolyOrder, config.SavGolDeriv))
	}

	// Column statistics last. ScaleOnly is scaling without centring, so it is
	// reported as one step rather than as a scaling plus a silent absence.
	switch {
	case config.ScaleOnly:
		steps = append(steps, "variance scaling without centring")
	case config.MeanCenter && config.StandardScale:
		steps = append(steps, "mean centring", "standard scaling")
	case config.MeanCenter && config.RobustScale:
		steps = append(steps, "mean centring", "robust scaling (median/MAD)")
	case config.MeanCenter:
		steps = append(steps, "mean centring")
	case config.StandardScale:
		steps = append(steps, "standard scaling without centring")
	case config.RobustScale:
		steps = append(steps, "robust scaling without centring")
	}

	if len(steps) == 0 {
		// Said explicitly rather than left blank: "none" is a result, and a blank
		// line reads as a bug or as an omission rather than as an answer.
		return "none"
	}
	return strings.Join(steps, ", ")
}
