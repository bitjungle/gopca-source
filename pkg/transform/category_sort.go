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
	numbers := make([]float64, len(values))
	for i, v := range values {
		n, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
		if err != nil {
			sort.Strings(values)
			return
		}
		numbers[i] = n
	}

	sort.SliceStable(values, func(a, b int) bool {
		// values and numbers are permuted together, so compare by re-parsing
		// rather than by index: the closure sees indices into the slice being
		// sorted, and numbers[] would go stale after the first swap.
		x, _ := strconv.ParseFloat(strings.TrimSpace(values[a]), 64)
		y, _ := strconv.ParseFloat(strings.TrimSpace(values[b]), 64)
		if x != y {
			return x < y
		}
		return values[a] < values[b]
	})
}
