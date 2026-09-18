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

package main

import (
	"strconv"
	"strings"
	"testing"
)

// Some datasets carry nothing that can identify a row. #923.

func numberlessFixture(rows int) *FileData {
	d := &FileData{
		Headers:     []string{"A", "B"},
		ColumnTypes: map[string]string{"A": "numeric", "B": "numeric"},
		Columns:     2,
		Rows:        rows,
	}
	for i := 0; i < rows; i++ {
		d.Data = append(d.Data, []string{strconv.Itoa(i), strconv.Itoa(i * 2)})
	}
	return d
}

func TestAddRowNumbersGivesEveryRowAUniqueName(t *testing.T) {
	data := numberlessFixture(5)
	cmd, err := NewAddRowNumbersCommand(&App{}, data, 1, 1)
	if err != nil {
		t.Fatalf("NewAddRowNumbersCommand: %v", err)
	}
	if err := cmd.Execute(data); err != nil {
		t.Fatalf("Execute: %v", err)
	}

	if len(data.RowNames) != 5 {
		t.Fatalf("got %d row names, want 5", len(data.RowNames))
	}
	if data.RowNames[0] != "1" || data.RowNames[4] != "5" {
		t.Errorf("names = %v, want 1..5", data.RowNames)
	}
	if data.RowNamesHeader != "Sample_ID" {
		t.Errorf("header = %q, want Sample_ID", data.RowNamesHeader)
	}

	// The point of the exercise: they must satisfy the rule that rejected every
	// column in the file.
	if check := checkRowNameCandidate(data.RowNames); !check.OK {
		t.Errorf("generated names do not qualify as row names: %s", check.Reason)
	}
}

func TestAddRowNumbersAddsNoColumn(t *testing.T) {
	// Row names are not a column. Inserting one would put a numeric sequence in
	// the table, where it would enter the PCA -- and dominate it.
	data := numberlessFixture(4)
	cmd, _ := NewAddRowNumbersCommand(&App{}, data, 1, 1)
	if err := cmd.Execute(data); err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if len(data.Headers) != 2 {
		t.Errorf("headers = %v, want the original two", data.Headers)
	}
	for _, row := range data.Data {
		if len(row) != 2 {
			t.Fatalf("row widened to %d cells", len(row))
		}
	}
}

func TestAddRowNumbersRefusesWhenRowNamesExist(t *testing.T) {
	// The control. Overwriting identifiers that mean something, in exchange for
	// ordinals that do not, is not something to do quietly.
	data := numberlessFixture(3)
	data.RowNames = []string{"alpha", "beta", "gamma"}
	data.RowNamesHeader = "SampleName"

	_, err := NewAddRowNumbersCommand(&App{}, data, 1, 1)
	if err == nil {
		t.Fatal("accepted a file that already has row names")
	}
	if !strings.Contains(err.Error(), "SampleName") {
		t.Errorf("error should name the existing row-name column, got: %v", err)
	}
	if !strings.Contains(err.Error(), "Move Row Names into Table") {
		t.Errorf("error should say how to proceed, got: %v", err)
	}
}

func TestAddRowNumbersAvoidsAHeaderCollision(t *testing.T) {
	data := numberlessFixture(3)
	data.Headers = []string{"Sample_ID", "B"}
	cmd, err := NewAddRowNumbersCommand(&App{}, data, 1, 1)
	if err != nil {
		t.Fatalf("NewAddRowNumbersCommand: %v", err)
	}
	if cmd.header == "Sample_ID" {
		t.Error("reused a header the table already has; export would produce two Sample_ID columns")
	}
}

func TestAddRowNumbersUndo(t *testing.T) {
	data := numberlessFixture(3)
	cmd, _ := NewAddRowNumbersCommand(&App{}, data, 1, 1)
	if err := cmd.Execute(data); err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if err := cmd.Undo(data); err != nil {
		t.Fatalf("Undo: %v", err)
	}
	if len(data.RowNames) != 0 || data.RowNamesHeader != "" {
		t.Errorf("undo left names=%v header=%q", data.RowNames, data.RowNamesHeader)
	}
}

func TestAddRowNumbersRefusesAnEmptyFile(t *testing.T) {
	if _, err := NewAddRowNumbersCommand(&App{}, &FileData{}, 1, 1); err == nil {
		t.Error("accepted a file with no rows")
	}
}

// Issue #967: the numbering is the user's to choose.
//
// The defaults reproduce the plain sequence, which is what every test above
// checks. These cover the cases an export cannot guess for itself and which are
// therefore the reason the command still exists at all after #966.

func TestAddRowNumbersHonoursStartAndIncrement(t *testing.T) {
	tests := []struct {
		name      string
		start     int
		increment int
		want      string
	}{
		{"defaults reproduce the plain sequence", 1, 1, "1,2,3,4"},
		{"a run that starts at 101", 101, 1, "101,102,103,104"},
		{"every second number", 1, 2, "1,3,5,7"},
		{"both at once", 200, 5, "200,205,210,215"},
		{"counting down", 10, -1, "10,9,8,7"},
		{"starting below zero", -2, 1, "-2,-1,0,1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data := numberlessFixture(4)
			cmd, err := NewAddRowNumbersCommand(&App{}, data, tt.start, tt.increment)
			if err != nil {
				t.Fatalf("NewAddRowNumbersCommand: %v", err)
			}
			if err := cmd.Execute(data); err != nil {
				t.Fatalf("Execute: %v", err)
			}
			if got := strings.Join(data.RowNames, ","); got != tt.want {
				t.Errorf("row names = %s, want %s", got, tt.want)
			}
		})
	}
}

// An increment of zero would give every row the same name. Row names exist to
// tell rows apart, and checkRowNameCandidate rejects repeats everywhere else, so
// the command must not be the one place that produces them.
func TestAddRowNumbersRefusesAZeroIncrement(t *testing.T) {
	data := numberlessFixture(4)
	_, err := NewAddRowNumbersCommand(&App{}, data, 1, 0)
	if err == nil {
		t.Fatal("a zero increment was accepted")
	}
	if !strings.Contains(err.Error(), "increment") {
		t.Errorf("error does not say what was wrong: %v", err)
	}
}

// Whatever start and increment are chosen, the result still has to satisfy the
// rule that governs every other row-name column in the application. Asserting
// the strings alone would not check that -- this runs the real gate.
func TestAddRowNumbersAlwaysProducesUsableRowNames(t *testing.T) {
	for _, pair := range [][2]int{{1, 1}, {101, 1}, {1, 2}, {10, -1}, {-5, 3}} {
		data := numberlessFixture(6)
		cmd, err := NewAddRowNumbersCommand(&App{}, data, pair[0], pair[1])
		if err != nil {
			t.Fatalf("start=%d increment=%d: %v", pair[0], pair[1], err)
		}
		if err := cmd.Execute(data); err != nil {
			t.Fatalf("Execute: %v", err)
		}
		if check := checkRowNameCandidate(data.RowNames); !check.OK {
			t.Errorf("start=%d increment=%d produced unusable row names: %s",
				pair[0], pair[1], check.Reason)
		}
	}
}
