// GoPCA Suite
//
// Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
//
// This file is part of GoPCA Suite.
//
// See LICENSE for the full license terms.

package transform

import (
	"reflect"
	"strings"
	"testing"
)

// GoCSV's transform dialog decides what to tell the user from TransformedColumns:
// an empty list means "nothing changed, your data is unchanged" and a non-empty
// one means the grid moved (#1002). That reading is only safe while every
// transform reports what it did, so this holds the two halves of the contract
// together:
//
//	data changed  <=>  TransformedColumns is non-empty
//
// A transform that changed data without reporting it would make the dialog tell
// the user nothing happened when it had; one that reported without changing
// anything would reinstate the original bug. Neither shows up in a test of the
// transform's own arithmetic, because both sides of the implication are correct
// in isolation.
func TestTransformedColumnsReportWhatChanged(t *testing.T) {
	for _, tt := range []struct {
		name string
		opts Options
	}{
		{"log", Options{Type: Log, Columns: []string{"pos"}}},
		{"sqrt", Options{Type: Sqrt, Columns: []string{"pos"}}},
		{"square", Options{Type: Square, Columns: []string{"pos"}}},
		{"standardize", Options{Type: Standardize, Columns: []string{"pos"}}},
		{"minmax", Options{Type: MinMax, Columns: []string{"pos"}}},
		{"boxcox", Options{Type: BoxCox, Columns: []string{"pos"}}},
		{"yeojohnson", Options{Type: YeoJohnson, Columns: []string{"pos"}}},
		{"bin", Options{Type: Bin, Columns: []string{"pos"}, BinCount: 2}},
		{"onehot", Options{Type: OneHot, Columns: []string{"cat"}}},
		{"ordinal", Options{Type: Ordinal, Columns: []string{"cat"}}},
		{"clr", Options{Type: CLR, Columns: []string{"pos", "num"}}},
		{"split", Options{Type: Split, Columns: []string{"pair"}, Delimiter: "_"}},
		{"combine", Options{
			Type: Combine, Columns: []string{"pos", "num"},
			Separator: "-", NewColumnName: "joined",
		}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			in := transformContractInput()
			before := snapshot(in)

			res, err := Apply(in, tt.opts)
			if err != nil {
				t.Fatalf("Apply: %v", err)
			}

			changed := !reflect.DeepEqual(before, snapshot(Input{Headers: res.Headers, Data: res.Data}))
			reported := len(res.TransformedColumns) > 0

			if changed != reported {
				t.Fatalf("data changed = %v but TransformedColumns = %v (%d entries); "+
					"the dialog reads the second to describe the first",
					changed, res.TransformedColumns, len(res.TransformedColumns))
			}
			if !changed {
				t.Fatalf("transform made no difference to the fixture, so this case "+
					"cannot tell the contract holds; messages: %v", res.Messages)
			}
		})
	}
}

// The refusal that started #1002: Box-Cox is undefined at zero, and rather than
// transforming the positive values and leaving the rest -- which would put two
// scales in one column, the rule settled in #861 -- it declines the column whole.
// It returns no error, so the empty TransformedColumns is the only signal the
// dialog has that the grid is untouched.
func TestBoxCoxRefusalReportsNothingTransformed(t *testing.T) {
	in := makeInput(
		[][]string{{"0"}, {"1.5"}, {"0"}, {"3.0"}},
		[]string{"Zn"},
		map[string]string{"Zn": "numeric"},
	)
	before := snapshot(in)

	res, err := Apply(in, Options{Type: BoxCox, Columns: []string{"Zn"}})
	if err != nil {
		t.Fatalf("expected a refusal, not an error: %v", err)
	}
	if len(res.TransformedColumns) != 0 {
		t.Fatalf("refused column reported as transformed: %v", res.TransformedColumns)
	}
	if got := snapshot(Input{Headers: res.Headers, Data: res.Data}); !reflect.DeepEqual(before, got) {
		t.Fatalf("data changed despite the refusal:\n before %q\n after  %q", before, got)
	}
	if len(res.Messages) == 0 {
		t.Fatal("refused silently: no message explaining why the column was left alone")
	}
	// The message has to be actionable, or the amber panel has nothing to say.
	if joined := strings.Join(res.Messages, " "); !strings.Contains(joined, "Yeo-Johnson") {
		t.Errorf("refusal does not point at the alternative: %q", joined)
	}
}

// One numeric column of positive values, one of mixed magnitude, a categorical
// column, and a splittable one -- enough for every transform under test.
func transformContractInput() Input {
	return makeInput(
		[][]string{
			{"1", "4", "a", "x_1"},
			{"2", "5", "b", "y_2"},
			{"3", "6", "a", "x_3"},
			{"4", "7", "c", "y_4"},
		},
		[]string{"pos", "num", "cat", "pair"},
		map[string]string{
			"pos": "numeric", "num": "numeric",
			"cat": "categorical", "pair": "categorical",
		},
	)
}

func snapshot(in Input) string {
	rows := make([]string, 0, len(in.Data)+1)
	rows = append(rows, strings.Join(in.Headers, "\x1f"))
	for _, row := range in.Data {
		rows = append(rows, strings.Join(row, "\x1f"))
	}
	return strings.Join(rows, "\x1e")
}
