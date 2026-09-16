package main

import (
	"math"
	"strings"
	"testing"
)

// scaleRequest builds a two-variable dataset whose standard deviations differ
// by exactly wantRatio, so the reported figure can be checked against a known
// answer rather than against whatever the code happens to produce.
func scaleRequest(wantRatio float64) ModelMetricsRequest {
	// Column A is -1, +1 and column B is -r, +r, so B's standard deviation is
	// exactly r times A's whatever divisor is used. The absolute value is not
	// 1: CalculateModelMetrics uses the sample divisor, making it sqrt(2).
	data := [][]float64{{-1, -wantRatio}, {1, wantRatio}}
	return ModelMetricsRequest{
		Loadings:          [][]float64{{0.5}, {0.5}},
		VariableLabels:    []string{"A", "B"},
		ExplainedVariance: []float64{90.0, 10.0},
		OriginalData:      data,
	}
}

// The warning says "scales", so the number beside it must be a ratio of
// magnitudes. Reporting maxVar/minVar squared it, describing standard
// deviations 21,494x apart as differing by 462,008,282x (#957).
func TestScaleRatioIsAStandardDeviationRatio(t *testing.T) {
	const want = 21494.0
	got := (&App{}).CalculateModelMetrics(scaleRequest(want))

	if !got.Success {
		t.Fatalf("metrics failed: %s", got.Error)
	}
	if math.Abs(got.ScaleRatio-want) > 1.0 {
		t.Errorf("ScaleRatio = %.0f, want %.0f -- a variance ratio would be %.0f",
			got.ScaleRatio, want, want*want)
	}
	if !strings.Contains(got.ScaleWarning, "21494x") {
		t.Errorf("warning quotes a different figure than ScaleRatio: %q", got.ScaleWarning)
	}
}

// The thresholds move with the quantity, so the same datasets warn as before.
// Stated in standard deviations: below 10x silent, 10-100x the milder wording,
// above 100x the strong wording.
func TestScaleWarningFiresOnTheSameDatasetsAsBefore(t *testing.T) {
	for _, tc := range []struct {
		name      string
		ratio     float64
		wantWarn  bool
		wantPhras string
	}{
		{"well below threshold", 3, false, ""},
		{"just below threshold", 9, false, ""},
		{"just above threshold", 11, true, "different scales"},
		{"below the strong threshold", 99, true, "different scales"},
		{"above the strong threshold", 101, true, "very different scales"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := (&App{}).CalculateModelMetrics(scaleRequest(tc.ratio))
			if tc.wantWarn && got.ScaleWarning == "" {
				t.Fatalf("stddev ratio %.0fx produced no warning", tc.ratio)
			}
			if !tc.wantWarn && got.ScaleWarning != "" {
				t.Fatalf("stddev ratio %.0fx warned unexpectedly: %q", tc.ratio, got.ScaleWarning)
			}
			if tc.wantWarn && !strings.Contains(got.ScaleWarning, tc.wantPhras) {
				t.Errorf("stddev ratio %.0fx gave %q, want the %q wording", tc.ratio, got.ScaleWarning, tc.wantPhras)
			}
			// "very different" also contains "different", so check the strong
			// case is not silently matched by the mild assertion.
			if tc.wantPhras == "different scales" && strings.Contains(got.ScaleWarning, "very different") {
				t.Errorf("stddev ratio %.0fx used the strong wording: %q", tc.ratio, got.ScaleWarning)
			}
		})
	}
}

// Standardization removes the reason for the warning.
func TestScaleWarningIsSilentWhenDataIsScaled(t *testing.T) {
	req := scaleRequest(21494)
	req.StandardScale = true
	if got := (&App{}).CalculateModelMetrics(req); got.ScaleWarning != "" {
		t.Errorf("warned about scale on standardized data: %q", got.ScaleWarning)
	}
}

// The ratio must survive variances whose quotient is not representable.
//
// maxVar/minVar overflows to +Inf well before the ratio of standard deviations
// does, because the quotient is the square of the quantity actually wanted.
// Taking the square roots first keeps the result finite (review on #959).
func TestScaleRatioSurvivesVariancesWhoseQuotientOverflows(t *testing.T) {
	// Column A varies by ~1e150, column B by ~1e-150. The variances are then
	// ~2e300 and ~2e-300, whose quotient is ~1e600 -- beyond float64 -- while
	// the standard-deviation ratio, 1e300, is representable.
	data := [][]float64{{-1e150, -1e-150}, {1e150, 1e-150}}
	got := (&App{}).CalculateModelMetrics(ModelMetricsRequest{
		Loadings:          [][]float64{{0.5}, {0.5}},
		VariableLabels:    []string{"A", "B"},
		ExplainedVariance: []float64{90.0, 10.0},
		OriginalData:      data,
	})

	if !got.Success {
		t.Fatalf("metrics failed: %s", got.Error)
	}
	if math.IsInf(got.ScaleRatio, 0) || math.IsNaN(got.ScaleRatio) {
		t.Fatalf("ScaleRatio = %v; dividing before the square roots overflowed", got.ScaleRatio)
	}
	if got.ScaleRatio < 1e299 || got.ScaleRatio > 1e301 {
		t.Errorf("ScaleRatio = %g, want about 1e300", got.ScaleRatio)
	}
	if got.ScaleWarning == "" {
		t.Error("no scale warning for a 1e300x difference in standard deviation")
	}
}
