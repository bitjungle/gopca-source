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
	"strconv"
	"testing"
)

// Issue #996: category levels were ordered with sort.Strings, so numeric codes
// came out 1, 10, 11, 2, 3. For one-hot column order that is untidy; for an
// ordinal encode it is wrong, because the order IS the code each level receives.

func TestSortCategoryValues(t *testing.T) {
	for _, tt := range []struct {
		name  string
		input []string
		want  []string
	}{
		{"numeric codes sort as numbers",
			[]string{"10", "2", "1", "11", "9"},
			[]string{"1", "2", "9", "10", "11"}},
		{"the al_alloy processing codes",
			[]string{"1", "10", "11", "2", "3", "4", "5", "7", "8", "9"},
			[]string{"1", "2", "3", "4", "5", "7", "8", "9", "10", "11"}},
		{"decimals and negatives",
			[]string{"2.5", "-1", "10", "0"},
			[]string{"-1", "0", "2.5", "10"}},
		{"one non-numeric value sends the whole set back to text order",
			[]string{"10", "2", "unknown"},
			[]string{"10", "2", "unknown"}},
		{"text categories are untouched, as sklearn LabelEncoder expects",
			[]string{"paris", "tokyo", "amsterdam"},
			[]string{"amsterdam", "paris", "tokyo"}},
		{"equal numbers keep a deterministic order",
			[]string{"1.0", "1", "0"},
			[]string{"0", "1", "1.0"}},
		{"padded codes",
			[]string{"03", "1", "20"},
			[]string{"1", "03", "20"}},
		{"NaN is not treated as a number, because it cannot be ordered",
			[]string{"10", "2", "NaN", "1", "3"},
			[]string{"1", "10", "2", "3", "NaN"}},
		{"nor in any other spelling",
			[]string{"10", "2", "nan"},
			[]string{"10", "2", "nan"}},
		{"infinities do order, and are kept numeric",
			[]string{"10", "-Inf", "2", "Inf"},
			[]string{"-Inf", "2", "10", "Inf"}},
		{"empty", nil, nil},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got := append([]string(nil), tt.input...)
			sortCategoryValues(got)
			if len(got) != len(tt.want) {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
			for i := range tt.want {
				if got[i] != tt.want[i] {
					t.Fatalf("got %v, want %v", got, tt.want)
				}
			}
		})
	}
}

// The check that matters: the ordinal encoder assigns codes in the order the
// values are sorted, so a wrong order silently produces wrong numbers. Asserting
// the suggestion list alone would not catch this path, because ordinal.go sorts
// the remaining values itself.
func TestApply_Ordinal_NumericLevelsGetCodesInNumericOrder(t *testing.T) {
	in := ordinalInput("10", "2", "1", "11")

	res, err := Apply(in, Options{Type: Ordinal, Columns: []string{"Cat"}})
	if err != nil {
		t.Fatalf("Apply ordinal: %v", err)
	}

	got := codeColumn(t, res, "Cat_code")
	codeOf := map[string]string{"10": got[0], "2": got[1], "1": got[2], "11": got[3]}

	for _, pair := range [][2]string{{"1", "2"}, {"2", "10"}, {"10", "11"}} {
		lo, _ := strconv.Atoi(codeOf[pair[0]])
		hi, _ := strconv.Atoi(codeOf[pair[1]])
		if lo >= hi {
			t.Errorf("level %q got code %d and level %q got code %d: "+
				"a higher level received a lower or equal code, so the encoding "+
				"does not preserve the numeric order of the labels",
				pair[0], lo, pair[1], hi)
		}
	}
}

// One-hot column order. Cosmetic rather than wrong, but it is what a reader sees
// in the column list, in validation output and on a loadings axis.
func TestApply_OneHot_NumericLevelsProduceColumnsInNumericOrder(t *testing.T) {
	in := ordinalInput("10", "2", "1", "11")

	res, err := Apply(in, Options{Type: OneHot, Columns: []string{"Cat"}})
	if err != nil {
		t.Fatalf("Apply onehot: %v", err)
	}

	want := []string{"Cat_1", "Cat_2", "Cat_10", "Cat_11"}
	var got []string
	for _, h := range res.Headers {
		if h != "Cat" {
			got = append(got, h)
		}
	}
	if len(got) != len(want) {
		t.Fatalf("got columns %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got columns %v, want %v", got, want)
		}
	}
}

// The dialog pre-fills its ordering from here, so a wrong suggestion is what a
// user is most likely to accept without checking.
func TestSuggestCategoryOrder_NumericLevels(t *testing.T) {
	got := SuggestCategoryOrder([]string{"10", "2", "1", "11", "2"})
	want := []string{"1", "2", "10", "11"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
}

// Before NaN was excluded, this was not merely non-deterministic: the plain
// numbers came out unsorted. NaN compares false against everything including
// itself, so {"10", "2", "NaN", "1", "3"} has no strict ordering and
// sort.SliceStable returned {"2", "10", "NaN", "1", "3"}.
//
// Ordering is asserted from several starting permutations rather than one,
// because a comparator that violates strict weak ordering can still look correct
// on whichever arrangement it was first tried with.
func TestSortCategoryValues_OrderingHoldsFromAnyStartingPermutation(t *testing.T) {
	for _, start := range [][]string{
		{"10", "2", "NaN", "1", "3"},
		{"NaN", "10", "2", "1", "3"},
		{"1", "2", "3", "10", "NaN"},
		{"3", "NaN", "1", "10", "2"},
		{"2", "3", "NaN", "10", "1"},
	} {
		got := append([]string(nil), start...)
		sortCategoryValues(got)

		// Text order, since "NaN" is not a number: "1" < "10" < "2" < "3" < "NaN".
		want := []string{"1", "10", "2", "3", "NaN"}
		for i := range want {
			if got[i] != want[i] {
				t.Fatalf("from %v: got %v, want %v", start, got, want)
			}
		}
	}
}

// The numeric path must be equally indifferent to where it starts.
func TestSortCategoryValues_NumericOrderIndependentOfInputOrder(t *testing.T) {
	for _, start := range [][]string{
		{"10", "2", "1", "11", "9"},
		{"1", "2", "9", "10", "11"},
		{"11", "10", "9", "2", "1"},
		{"9", "11", "1", "2", "10"},
	} {
		got := append([]string(nil), start...)
		sortCategoryValues(got)

		want := []string{"1", "2", "9", "10", "11"}
		for i := range want {
			if got[i] != want[i] {
				t.Fatalf("from %v: got %v, want %v", start, got, want)
			}
		}
	}
}
