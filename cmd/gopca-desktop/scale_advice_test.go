package main

import (
	"math"
	"strings"
	"testing"
)

// The advice beside the scale ratio, from #1014.
//
// The ratio measures spread; standardization turns on whether the units are
// arbitrary. These are different questions, and on al_alloy the old sentence
// answered the second with the first -- "21494x difference, consider
// standardization" on 24 weight fractions of one whole, where standardizing
// destroys the result.

// composition builds rows that sum to exactly 1, shaped like al_alloy: one
// dominant part that varies most, two minor parts, and a trace part that is
// almost always absent.
//
// The remainder is split evenly between the two minor columns so each varies
// half as much as the dominant one. Splitting matters: with a single minor part
// it would mirror the dominant one exactly and share its standard deviation,
// and the fixture would not test what it claims to.
func composition(rows int) [][]float64 {
	data := make([][]float64, rows)
	for i := range data {
		trace := 0.0
		if i < 2 {
			trace = 0.00004
		}
		al := 0.78 + float64(i%50)*0.004
		rest := (1 - al - trace) / 2
		data[i] = []float64{al, rest, rest, trace}
	}
	return data
}

func TestClosedCompositionArguesAgainstStandardizing(t *testing.T) {
	ratio, msg := describeScale(composition(200), []string{"Al", "Mg", "Si", "Be"}, false, false)

	if ratio <= scaleRatioStrong {
		t.Fatalf("fixture should trigger the strong warning, ratio = %.1f", ratio)
	}
	for _, want := range []string{"'Al'", "'Be'", "sum to a constant", "parts of one whole", "CLR"} {
		if !strings.Contains(msg, want) {
			t.Errorf("message does not mention %s:\n  %s", want, msg)
		}
	}
	// The whole point: it must not tell the reader to standardize.
	if strings.Contains(msg, "Consider standardization") {
		t.Errorf("recommends standardization on closed data:\n  %s", msg)
	}
	if !strings.Contains(msg, "usually wrong") {
		t.Errorf("does not say standardization is usually wrong here:\n  %s", msg)
	}
}

// Mixed units with no closure and no sparsity: the original advice, which is
// right and must survive.
func TestUnrelatedUnitsStillRecommendStandardizing(t *testing.T) {
	// Two dense columns, one a thousand times the other, rows summing to
	// anything but a constant.
	data := make([][]float64, 100)
	for i := range data {
		data[i] = []float64{float64(i%13) + 1, 1000 * (float64(i%29) + 1)}
	}
	_, msg := describeScale(data, []string{"grams", "millimetres"}, false, false)

	if !strings.Contains(msg, "Consider standardization") {
		t.Errorf("should still recommend standardization here:\n  %s", msg)
	}
	if strings.Contains(msg, "sum to a constant") {
		t.Errorf("claimed closure on data that has none:\n  %s", msg)
	}
	if !strings.Contains(msg, "'millimetres'") || !strings.Contains(msg, "'grams'") {
		t.Errorf("does not name the two columns:\n  %s", msg)
	}
}

// A tiny standard deviation caused by absence rather than by units.
func TestMostlyZeroColumnIsDescribedAsPresenceNotScale(t *testing.T) {
	// Rows deliberately do not sum to a constant, so closure cannot claim it
	// first and this branch is the one under test.
	data := make([][]float64, 200)
	for i := range data {
		trace := 0.0
		if i < 4 {
			trace = 0.001
		}
		data[i] = []float64{float64(i%50) + 10, trace}
	}
	_, msg := describeScale(data, []string{"bulk", "Be"}, false, false)

	if !strings.Contains(msg, "zero in 98% of rows") {
		t.Errorf("does not report how often the column is absent:\n  %s", msg)
	}
	if !strings.Contains(msg, "z = ") {
		t.Errorf("does not say what standardizing would do to it:\n  %s", msg)
	}
	if strings.Contains(msg, "Consider standardization") {
		t.Errorf("recommends standardization for a presence/absence column:\n  %s", msg)
	}
}

// Naming the wrong variable is worse than naming none. OriginalData and
// VariableLabels reach the metrics call from different places, so they can
// disagree in width; the advice must notice rather than index blindly.
func TestMismatchedLabelsAreNotUsed(t *testing.T) {
	data := make([][]float64, 50)
	for i := range data {
		data[i] = []float64{float64(i%13) + 1, 1000 * (float64(i%29) + 1), float64(i%7) + 1}
	}
	_, msg := describeScale(data, []string{"only", "two"}, false, false)

	if strings.Contains(msg, "'only'") || strings.Contains(msg, "'two'") {
		t.Errorf("used labels that describe a different set of columns:\n  %s", msg)
	}
	if !strings.Contains(msg, "different scales") {
		t.Errorf("should still warn, just without names:\n  %s", msg)
	}
}

// The mismatch guard has to hold on every branch, not just the one the first
// test happened to reach. With a dense smallest column the advice falls to the
// default wording; with a sparse one it takes the presence/absence branch, which
// quoted the name unconditionally and printed "But ” is zero in 99% of rows".
func TestMismatchedLabelsAreNotUsedOnTheSparseBranch(t *testing.T) {
	data := make([][]float64, 200)
	for i := range data {
		trace := 0.0
		if i < 4 {
			trace = 0.001
		}
		data[i] = []float64{float64(i%50) + 10, trace, float64(i%7) + 1}
	}
	_, msg := describeScale(data, []string{"only", "two"}, false, false)

	if strings.Contains(msg, "''") {
		t.Errorf("emitted an empty quoted name:\n  %s", msg)
	}
	if strings.Contains(msg, "'only'") || strings.Contains(msg, "'two'") {
		t.Errorf("used labels describing a different set of columns:\n  %s", msg)
	}
	if !strings.Contains(msg, "zero in 98% of rows") {
		t.Errorf("should still report the sparsity, just unnamed:\n  %s", msg)
	}
}

func TestStandardizedRunsSayNothing(t *testing.T) {
	for _, tc := range []struct{ std, robust bool }{{true, false}, {false, true}} {
		if _, msg := describeScale(composition(200), []string{"Al", "Mg", "Si", "Be"}, tc.std, tc.robust); msg != "" {
			t.Errorf("standardized=%v robust=%v still warned: %s", tc.std, tc.robust, msg)
		}
	}
}

func TestClosedSum(t *testing.T) {
	for _, tc := range []struct {
		name  string
		data  [][]float64
		want  bool
		total float64
	}{
		{"parts of one", composition(50), true, 1},
		{"percentages", [][]float64{{40, 60}, {55, 45}, {10, 90}}, true, 100},
		{
			// The al_alloy case after a redundant part was deleted: a few rows
			// fall short, and the bound still holds (#1012).
			"a few rows short by less than the tolerance",
			[][]float64{{0.5, 0.5}, {0.5, 0.5}, {0.499, 0.5}, {0.5, 0.5}},
			true, 1,
		},
		{
			"short by more than the tolerance",
			[][]float64{{0.5, 0.5}, {0.5, 0.5}, {0.4, 0.5}, {0.5, 0.5}},
			false, 0,
		},
		{"not closed", [][]float64{{1, 2}, {3, 4}, {5, 6}}, false, 0},
		{
			// Already-centred data sums to about zero per row, caught by the
			// median test.
			"centred data", [][]float64{{-0.5, 0.5}, {0.25, -0.25}, {0.1, -0.1}}, false, 0,
		},
		{
			// Constant row sums, positive median, but containing negatives. Only
			// the non-negative requirement rejects this one, and it must: a
			// composition's parts are non-negative by definition, and proposing
			// a log-ratio transform for data with negative values would be
			// advice that cannot be followed.
			"constant sums but negative parts",
			[][]float64{{2, -1}, {3, -2}, {1.5, -0.5}}, false, 0,
		},
		{"single row", [][]float64{{0.5, 0.5}}, false, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			total, ok := closedSum(tc.data)
			if ok != tc.want {
				t.Fatalf("closedSum ok = %v, want %v", ok, tc.want)
			}
			if ok && math.Abs(total-tc.total) > 1e-9 {
				t.Errorf("total = %v, want %v", total, tc.total)
			}
		})
	}
}

// A one-hot block sums to a constant too, and proposing a log-ratio transform
// over binary flags would be advice nobody can follow. Listed as a limitation
// when #1014 was filed; closing it turned out to be a two-line test.
func TestIndicatorBlockIsNotTreatedAsAComposition(t *testing.T) {
	onehot := [][]float64{{1, 0, 0}, {0, 1, 0}, {0, 0, 1}, {1, 0, 0}}
	if _, ok := closedSum(onehot); ok {
		t.Error("a block of indicators was read as parts of a whole")
	}

	// The encoded al_alloy shape: real fractions summing to 1, plus indicators
	// summing to 1, so the whole row sums to a constant 2.
	mixed := [][]float64{
		{0.97, 0.03, 1, 0},
		{0.96, 0.04, 0, 1},
		{0.98, 0.02, 1, 0},
	}
	if _, ok := closedSum(mixed); ok {
		t.Error("measurements mixed with indicators were read as a composition")
	}
}

// The guard must not fire on a real composition. No element column in al_alloy
// is 0/1-valued, and a column that is entirely absent must not suppress the
// finding either.
func TestCompositionWithAnAbsentPartIsStillClosed(t *testing.T) {
	data := [][]float64{
		{0.97, 0.03, 0},
		{0.96, 0.04, 0},
		{0.98, 0.02, 0},
	}
	if _, ok := closedSum(data); !ok {
		t.Error("an all-zero trace part suppressed the composition finding")
	}
}
