// GoPCA Suite
//
// Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
//
// This file is part of GoPCA Suite.
//
// See LICENSE for the full license terms.

package main

import (
	"fmt"
	"math"
	"sort"
)

// Advising on whether to standardize, from more than the spread alone.
//
// The panel used to report one number -- the ratio of the largest to the
// smallest column standard deviation -- and always draw the same conclusion from
// it. On the al_alloy dataset that read "21494x difference, consider
// standardization", which is arithmetically right and points at a transformation
// that destroys the result (#1014).
//
// The ratio measures spread. Standardization turns on *commensurability*: whether
// the units are arbitrary, so equalising the variables is the fairer default.
// Esbensen et al. (2002), Multivariate Data Analysis in Practice, states the
// criterion as differing units of measurement, and separately warns that scaling
// amplifies the influence of very-small-variance variables disproportionately.
// Those are two different situations and they pull opposite ways.
//
// Nothing here can prove commensurability -- a column's unit is not in the data.
// These signals say "the usual advice is probably wrong here" and show their
// working, so the reader can judge. The warning still fires on exactly the
// datasets it fired on before; only what it says has changed.

const (
	// Ratios at which the panel speaks, unchanged from before #1014 so the same
	// datasets warn as did previously.
	scaleRatioNotable = 10.0
	scaleRatioStrong  = 100.0

	// A composition's parts sum to a constant. Judged by the spread of the row
	// sums relative to their median: every row must land within this fraction of
	// the same total. Measured across the shipped datasets, al_alloy scores
	// 0.0055 and the nearest non-composition (CSTR) 0.344, so the threshold sits
	// about sixty times below the first false positive.
	closedSumTolerance = 0.01

	// Above this share of zeros, a column's small standard deviation is a
	// statement about how often the element is present, not about its unit.
	mostlyZeroFraction = 0.9
)

// columnStat is one variable's contribution to the scale question.
type columnStat struct {
	name string
	sd   float64
	// zeroFraction and maxZ describe what standardizing this column would do:
	// a column that is nearly always zero has its few non-zero rows thrown to
	// the edge of the model.
	zeroFraction float64
	maxZ         float64
}

// describeScale returns the standard-deviation ratio and the sentence to show
// beside it, or an empty sentence when there is nothing worth saying.
//
// labels may be shorter than the data is wide -- the caller sends the analysed
// columns and their names, and a mismatch means one of them is stale. Rather
// than name the wrong variable, the advice falls back to the unnamed wording.
func describeScale(data [][]float64, labels []string, standardized, robust bool) (float64, string) {
	stats := columnStats(data, labels)
	if len(stats) < 2 {
		return 1.0, ""
	}

	lo, hi := stats[0], stats[0]
	for _, s := range stats {
		if s.sd < lo.sd {
			lo = s
		}
		if s.sd > hi.sd {
			hi = s
		}
	}
	if lo.sd <= 0 {
		return 1.0, ""
	}

	ratio := hi.sd / lo.sd
	if standardized || robust || ratio <= scaleRatioNotable {
		return ratio, ""
	}

	// The two wordings carry the severity and predate #1014; keep them, and add
	// the names rather than replacing them. Without the names the sentence
	// cannot be acted on -- deciding whether to standardize means looking at the
	// two columns that produced the number, and nothing said which they were.
	severity := "Variables have very different scales"
	if ratio <= scaleRatioStrong {
		severity = "Variables have different scales"
	}
	named := hi.name != "" && lo.name != ""
	lead := fmt.Sprintf("%s (%.0fx difference).", severity, ratio)
	if named {
		lead = fmt.Sprintf("%s: '%s' varies %.0fx more than '%s'.",
			severity, hi.name, ratio, lo.name)
	}

	// Closure first: it is a statement about the variables themselves, and it
	// holds whatever the sparsity of any one column.
	if total, ok := closedSum(data); ok {
		return ratio, lead + fmt.Sprintf(
			" But the variables sum to a constant (%.4g per row), so they are parts of one whole"+
				" and their relative sizes are meaningful. Standardization is usually wrong here."+
				" The recognised treatment is a log-ratio transform (GoCSV: Data Transform ->"+
				" CLR), which needs strictly positive values.", total)
	}

	if lo.zeroFraction >= mostlyZeroFraction {
		// Named only when the labels describe the analysed columns. Naming the
		// wrong variable is worse than naming none, and an empty quoted name
		// would be worse than either.
		subject := "the least-varying variable"
		if named {
			subject = fmt.Sprintf("'%s'", lo.name)
		}
		detail := fmt.Sprintf(
			" But %s is zero in %.0f%% of rows, so the difference is about how often it is"+
				" present rather than about units.", subject, lo.zeroFraction*100)
		if lo.maxZ > 0 {
			detail += fmt.Sprintf(" Standardizing would move its largest value to z = %.0f.", lo.maxZ)
		}
		return ratio, lead + detail + " Consider whether it belongs in the analysis."
	}

	return ratio, lead + " Consider standardization unless the variables share a unit."
}

// columnStats summarises each column, skipping NaN as the rest of the metrics do.
// Columns that do not vary are left out: they cannot set the ratio, and a
// constant column has no scale to compare.
func columnStats(data [][]float64, labels []string) []columnStat {
	if len(data) < 2 {
		return nil
	}
	cols := len(data[0])
	// Names are used only when they describe the same columns that were
	// analysed. A shorter or longer list means the two travelled separately and
	// the indices no longer line up.
	useLabels := len(labels) == cols

	out := make([]columnStat, 0, cols)
	for j := 0; j < cols; j++ {
		var sum, n, zeros float64
		var maxVal float64
		first := true
		for i := range data {
			if j >= len(data[i]) {
				continue
			}
			v := data[i][j]
			if math.IsNaN(v) {
				continue
			}
			sum += v
			n++
			if v == 0 {
				zeros++
			}
			if first || v > maxVal {
				maxVal, first = v, false
			}
		}
		if n < 2 {
			continue
		}
		mean := sum / n
		var ss float64
		for i := range data {
			if j >= len(data[i]) {
				continue
			}
			v := data[i][j]
			if math.IsNaN(v) {
				continue
			}
			ss += (v - mean) * (v - mean)
		}
		sd := math.Sqrt(ss / (n - 1))
		if sd <= 0 {
			continue
		}
		s := columnStat{sd: sd, zeroFraction: zeros / n, maxZ: (maxVal - mean) / sd}
		if useLabels {
			s.name = labels[j]
		}
		out = append(out, s)
	}
	return out
}

// closedSum reports whether every row sums to the same constant, and what that
// constant is.
//
// The statistic is (max - min) / median of the row sums: a hard bound rather
// than a moment, so a handful of odd rows cannot be averaged away. al_alloy
// scores 0.0055 rather than 0 because deleting a redundant column during
// preparation left seven rows short by exactly the part that went (#1012), and
// reporting that honestly is preferable to hiding it.
//
// Negative values disqualify the data: a composition's parts are non-negative by
// definition, and requiring that also keeps already-centred data -- whose rows
// sum to approximately zero -- from being read as a composition.
//
// A block of one-hot indicators also sums to a constant, and in the encoded
// al_alloy file the 24 element fractions and the 10 indicators together sum to
// exactly 2. Arithmetically that is closure; chemically it is not a composition,
// and proposing a log-ratio transform over measurements and binary flags would
// be advice nobody can follow. A column taking only the values 0 and 1 is the
// signature, and no element column in the real data is 0/1-valued -- the two
// closest, B and Cd, take 0 or 0.0001 and 0 or 0.002.
func closedSum(data [][]float64) (float64, bool) {
	if len(data) < 2 {
		return 0, false
	}
	if hasBinaryColumn(data) {
		return 0, false
	}

	sums := make([]float64, 0, len(data))
	for _, row := range data {
		var s float64
		var any bool
		for _, v := range row {
			if math.IsNaN(v) {
				continue
			}
			if v < 0 {
				return 0, false
			}
			s += v
			any = true
		}
		if !any {
			continue
		}
		sums = append(sums, s)
	}
	if len(sums) < 2 {
		return 0, false
	}

	sorted := append([]float64(nil), sums...)
	sort.Float64s(sorted)
	median := sorted[len(sorted)/2]
	if median <= 0 {
		return 0, false
	}
	spread := (sorted[len(sorted)-1] - sorted[0]) / median
	if spread >= closedSumTolerance {
		return 0, false
	}
	return median, true
}

// hasBinaryColumn reports whether any column takes only the values 0 and 1,
// which marks a block of indicators rather than parts of a whole.
func hasBinaryColumn(data [][]float64) bool {
	if len(data) == 0 {
		return false
	}
	for j := 0; j < len(data[0]); j++ {
		onlyZeroOne, sawOne := true, false
		for i := range data {
			if j >= len(data[i]) {
				continue
			}
			v := data[i][j]
			if math.IsNaN(v) {
				continue
			}
			if v == 1 {
				sawOne = true
				continue
			}
			if v != 0 {
				onlyZeroOne = false
				break
			}
		}
		// A column of all zeros is not an indicator; requiring a 1 keeps an
		// absent trace element from suppressing the composition finding.
		if onlyZeroOne && sawOne {
			return true
		}
	}
	return false
}
