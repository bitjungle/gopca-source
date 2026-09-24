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

package transform

import (
	"math"
	"sort"
	"strconv"
	"strings"
)

// sortCategoryValues orders category levels in place: numerically when every
// value is a number, lexicographically otherwise.
//
// Category codes are very often numbers kept as labels -- processing types 1 to
// 11, Likert responses 1 to 5, dose levels. Sorting those as text gives
// 1, 10, 11, 2, 3, which is merely untidy for one-hot column order but wrong for
// an ordinal encode, where the order IS the assigned code: level 10 would
// receive a lower code than level 2 (#996).
//
// The check is all-or-nothing. A set such as {"1", "2", "unknown"} sorts as text,
// because there is no defensible place to put the non-numeric value in a numeric
// ordering, and inventing one would be worse than the tidy answer.
//
// Equal numeric values keep a deterministic order by falling back to a text
// comparison, so "1" and "1.0" do not swap between runs.
//
// "NaN" is excluded from the numeric path even though strconv.ParseFloat accepts
// it, because NaN compares false against every value including itself. A set
// containing one therefore has no strict ordering at all, and sort.SliceStable is
// entitled to return anything: {"10", "2", "NaN", "1", "3"} came back as
// {"2", "10", "NaN", "1", "3"}, with the plain numbers out of order. "NaN" is a
// common missing-data marker in an exported CSV, and this function decides the
// assigned ordinal code, so that is real. It falls to the text sort, which is what
// the all-or-nothing rule already prescribes for a value that is not a number.
// +Inf and -Inf are kept: they order consistently against everything.
//
// This is the transform-package counterpart of the row-name fix in #963, where
// identifiers ran 1, 10, 100, 1000 rather than 1, 2, 3.
//
// A deliberate divergence from scikit-learn. LabelEncoder sorts its classes_ with
// Python's default ordering, so a column read from CSV as the strings "1", "2",
// "10" encodes them in text order. TestApply_Ordinal_MatchesSklearnLabelEncoderByDefault
// still holds, because it uses text categories and those are unaffected -- but on
// all-numeric levels GoCSV now gives a different answer from LabelEncoder, on
// purpose. A user who typed 1..11 into a column means the numbers, and CSV has no
// type to record that they were numbers; matching a text sort here would be
// faithful to sklearn and wrong for the user.
func sortCategoryValues(values []string) {
	// The label and its numeric value travel together, so each value is parsed
	// once and the comparator reads the pair by index. Sorting the strings alone
	// and re-parsing inside the comparator also works, but only because the
	// parse is repeated on every comparison.
	type level struct {
		label  string
		number float64
	}

	levels := make([]level, len(values))
	for i, v := range values {
		n, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
		if err != nil || math.IsNaN(n) {
			sort.Strings(values)
			return
		}
		levels[i] = level{label: v, number: n}
	}

	sort.SliceStable(levels, func(a, b int) bool {
		if levels[a].number != levels[b].number {
			return levels[a].number < levels[b].number
		}
		return levels[a].label < levels[b].label
	})

	for i, l := range levels {
		values[i] = l.label
	}
}
