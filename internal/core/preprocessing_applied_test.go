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

// Issue #987: the exported preprocessing block recorded the flags as requested
// rather than the transformation applied. Transform takes one of three branches
// in precedence order, so three of the five reachable combinations described a
// pipeline the training run had not used -- claiming a centering that never
// happened, or denying one that did.
//
// The test that matters here is the one that could have gone red. Feeding the
// recorded flags back into another Preprocessor would NOT have done: the same
// precedence would swallow the same wrong flags and produce the same numbers, so
// it would have passed on the broken code. That is why applyFlagsLiterally below
// is written as a consumer reads the file -- each true flag applied, no
// precedence anywhere -- and not as a copy of Transform.

// applyFlagsLiterally does what someone reading the artifact does: takes each
// recorded boolean at face value and applies it. It deliberately encodes no
// precedence. A version of this that mirrored Transform would agree with
// Transform no matter what the flags said, and could never fail.
func applyFlagsLiterally(flags AppliedColumnStats, p *Preprocessor, data types.Matrix) types.Matrix {
	out := make(types.Matrix, len(data))
	for i := range data {
		out[i] = make([]float64, len(data[i]))
		for j := range data[i] {
			val := data[i][j]
			if flags.MeanCenter {
				val -= p.mean[j]
			}
			if flags.StandardScale {
				val /= p.scale[j]
			}
			if flags.RobustScale {
				val = (val - p.median[j]) / p.mad[j]
			}
			if flags.ScaleOnly {
				val /= p.scale[j]
			}
			out[i][j] = val
		}
	}
	return out
}

func appliedFixture() types.Matrix {
	// Column means, medians, spreads all different, so every branch produces a
	// visibly different answer. A symmetric fixture would let a wrong branch pass.
	return types.Matrix{
		{1.0, 20.0, 300.0},
		{2.0, 25.0, 700.0},
		{4.0, 27.0, 100.0},
		{8.0, 31.0, 900.0},
		{16.0, 44.0, 500.0},
	}
}

// The property: applying the recorded flags exactly as written, with no
// knowledge of GoPCA's internal precedence, reproduces what the data actually
// got. This is the promise the artifact makes to any consumer.
func TestRecordedFlagsReproduceTheTransformation(t *testing.T) {
	for _, tt := range []struct {
		name                                              string
		meanCenter, standardScale, robustScale, scaleOnly bool
	}{
		{"mean centering only", true, false, false, false},
		{"standard scaling", true, true, false, false},
		{"standard scaling without centering", false, true, false, false},
		{"scale-only", true, false, false, true},
		{"scale-only, centering not requested", false, false, false, true},
		{"robust", true, false, true, false},
		{"robust, centering not requested", false, false, true, false},
		{"nothing", false, false, false, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			data := appliedFixture()

			p := NewPreprocessorWithScaleOnly(tt.meanCenter, tt.standardScale,
				tt.robustScale, tt.scaleOnly, false, false)
			want, err := p.FitTransform(data)
			if err != nil {
				t.Fatalf("FitTransform: %v", err)
			}

			got := applyFlagsLiterally(p.AppliedColumnStatistics(), p, appliedFixture())

			for i := range want {
				for j := range want[i] {
					if math.Abs(want[i][j]-got[i][j]) > 1e-12 {
						flags := p.AppliedColumnStatistics()
						t.Fatalf("row %d col %d: the data became %v, but a reader "+
							"following the recorded flags %+v gets %v",
							i, j, want[i][j], flags, got[i][j])
					}
				}
			}
		})
	}
}

// A check that could not be satisfied by recording nothing at all: the flags
// must say something, and the three branches must be distinguishable from each
// other. Without this, AppliedColumnStatistics could return an empty struct and
// the test above would still pass for the "nothing" case only.
func TestAppliedColumnStatisticsNamesTheBranch(t *testing.T) {
	for _, tt := range []struct {
		name                                              string
		meanCenter, standardScale, robustScale, scaleOnly bool
		want                                              AppliedColumnStats
	}{
		{"scale-only suppresses the requested mean centering", true, false, false, true,
			AppliedColumnStats{ScaleOnly: true}},
		{"robust suppresses the requested mean centering", true, false, true, false,
			AppliedColumnStats{RobustScale: true}},
		{"robust outranks scale-only", true, false, true, true,
			AppliedColumnStats{RobustScale: true}},
		{"standard branch keeps both", true, true, false, false,
			AppliedColumnStats{MeanCenter: true, StandardScale: true}},
		{"standard scaling without centering is reachable", false, true, false, false,
			AppliedColumnStats{StandardScale: true}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			p := NewPreprocessorWithScaleOnly(tt.meanCenter, tt.standardScale,
				tt.robustScale, tt.scaleOnly, false, false)
			if got := p.AppliedColumnStatistics(); got != tt.want {
				t.Errorf("requested {mean:%v std:%v robust:%v scaleOnly:%v} -> "+
					"reported %+v, want %+v",
					tt.meanCenter, tt.standardScale, tt.robustScale, tt.scaleOnly,
					got, tt.want)
			}
		})
	}
}

// At most one of the scaling flags may be set, so a consumer never has to know
// which outranks which. This is the property that makes the flags independent,
// and it is the actual fix for #987 -- not the individual field values.
func TestRecordedScalingFlagsAreMutuallyExclusive(t *testing.T) {
	for _, requested := range []struct{ mean, std, robust, scaleOnly bool }{
		{true, true, true, true},
		{true, false, true, true},
		{false, true, true, false},
		{true, true, false, true},
	} {
		p := NewPreprocessorWithScaleOnly(requested.mean, requested.std,
			requested.robust, requested.scaleOnly, false, false)
		got := p.AppliedColumnStatistics()
		set := 0
		for _, on := range []bool{got.StandardScale, got.RobustScale, got.ScaleOnly} {
			if on {
				set++
			}
		}
		if set > 1 {
			t.Errorf("requested %+v -> reported %+v: %d scaling flags set, "+
				"a reader would have to know the precedence", requested, got, set)
		}
	}
}

// Models written before #987 carry the requested flags, and must keep loading
// identically. They do, for the same reason the bug was invisible: the flags
// that were wrong are exactly the ones the precedence ignores, so feeding an
// old file's flags back through Transform selects the same branch as the
// corrected ones.
//
// This is what makes the fix safe to ship without a schema version bump, so it
// is worth pinning rather than assuming.
func TestPreFixModelsTransformIdentically(t *testing.T) {
	for _, tt := range []struct {
		name               string
		oldFlags, newFlags AppliedColumnStats
	}{
		{"scale-only recorded with a spurious mean_center",
			AppliedColumnStats{MeanCenter: true, ScaleOnly: true},
			AppliedColumnStats{ScaleOnly: true}},
		{"robust recorded with a spurious mean_center",
			AppliedColumnStats{MeanCenter: true, RobustScale: true},
			AppliedColumnStats{RobustScale: true}},
		{"robust recorded with standard_scale as well",
			AppliedColumnStats{MeanCenter: true, StandardScale: true, RobustScale: true},
			AppliedColumnStats{RobustScale: true}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			data := appliedFixture()

			oldP := NewPreprocessorWithScaleOnly(tt.oldFlags.MeanCenter,
				tt.oldFlags.StandardScale, tt.oldFlags.RobustScale, tt.oldFlags.ScaleOnly,
				false, false)
			fromOld, err := oldP.FitTransform(appliedFixture())
			if err != nil {
				t.Fatalf("old flags: %v", err)
			}

			newP := NewPreprocessorWithScaleOnly(tt.newFlags.MeanCenter,
				tt.newFlags.StandardScale, tt.newFlags.RobustScale, tt.newFlags.ScaleOnly,
				false, false)
			fromNew, err := newP.FitTransform(data)
			if err != nil {
				t.Fatalf("new flags: %v", err)
			}

			for i := range fromOld {
				for j := range fromOld[i] {
					if math.Abs(fromOld[i][j]-fromNew[i][j]) > 1e-12 {
						t.Fatalf("row %d col %d: a pre-#987 model gives %v, the "+
							"corrected recording gives %v -- old files would not "+
							"reproduce", i, j, fromOld[i][j], fromNew[i][j])
					}
				}
			}
		})
	}
}
