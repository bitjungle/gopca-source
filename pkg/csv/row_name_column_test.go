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

package csv

import (
	"strings"
	"testing"
)

// Issue #969: the first column is taken as row names whatever it holds, so a
// file with no identifier column is analysed one variable short.
//
// Nothing about a column's contents can tell the two apart -- a measurement
// column can be unique, and Sample_ID is 1, 2, 3 -- so the reader is not being
// taught to guess. It is being taught to say which column it took, and to
// accept being told it was wrong.

const noIdentifierColumn = "Si,Fe,Cu\n0.51,0.2,0.1\n0.62,0.3,0.2\n0.73,0.4,0.3\n"
const withIdentifierColumn = "Sample_ID,Si,Fe\n1,0.5,0.2\n2,0.6,0.3\n3,0.7,0.4\n"

func readWith(t *testing.T, content string, hasRowNames bool, mode ParseMode) *Data {
	t.Helper()
	opts := DefaultOptions()
	opts.HasRowNames = hasRowNames
	opts.ParseMode = mode
	data, err := NewReader(opts).Read(strings.NewReader(content))
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	return data
}

// Each parse mode reaches a different function with its own header handling --
// two extract the header inline, two delegate to types.ParseCSVMixed* and copy
// the result across field by field. The fix has to be in all four, and the
// first attempt missed the two that delegate: the field was populated on the
// other side of the copy and simply not carried over. Naming every mode here is
// what caught that.
var readerModes = map[string]ParseMode{
	"numeric":            ParseNumeric,
	"string":             ParseString,
	"mixed":              ParseMixed,
	"mixed with targets": ParseMixedWithTargets,
}

func TestReaderNamesTheColumnItTookAsRowNames(t *testing.T) {
	for name, mode := range readerModes {
		t.Run(name, func(t *testing.T) {
			data := readWith(t, noIdentifierColumn, true, mode)
			if data.RowNamesHeader != "Si" {
				t.Errorf("RowNamesHeader = %q, want Si -- nothing downstream can "+
					"report which column was consumed", data.RowNamesHeader)
			}
		})
	}
}

func TestReaderNamesAGenuineIdentifierColumnToo(t *testing.T) {
	for name, mode := range readerModes {
		t.Run(name, func(t *testing.T) {
			data := readWith(t, withIdentifierColumn, true, mode)
			if data.RowNamesHeader != "Sample_ID" {
				t.Errorf("RowNamesHeader = %q, want Sample_ID", data.RowNamesHeader)
			}
		})
	}
}

// The blank-header convention: every dataset in testdata/ writes an empty first
// header cell, and that has to keep coming back empty rather than acquiring a
// name, because the writer puts RowNamesHeader straight back on export (#859).
func TestReaderKeepsABlankRowNameHeaderBlank(t *testing.T) {
	data := readWith(t, ",Si,Fe\nP1,0.5,0.2\nP2,0.6,0.3\n", true, ParseMixedWithTargets)
	if data.RowNamesHeader != "" {
		t.Errorf("RowNamesHeader = %q, want it left blank", data.RowNamesHeader)
	}
}

func TestReaderReportsNoRowNameHeaderWhenItTookNoColumn(t *testing.T) {
	for name, mode := range readerModes {
		t.Run(name, func(t *testing.T) {
			data := readWith(t, noIdentifierColumn, false, mode)
			if data.RowNamesHeader != "" {
				t.Errorf("RowNamesHeader = %q, want empty when HasRowNames is off",
					data.RowNamesHeader)
			}
		})
	}
}

// The defect itself, stated as a count. A three-variable file analysed on two
// variables is the whole of #969, and it is the assertion that would fail if
// the switch stopped working.
func TestTheFirstColumnIsAVariableOrALabelDependingOnTheSwitch(t *testing.T) {
	asLabels := readWith(t, noIdentifierColumn, true, ParseMixedWithTargets)
	if len(asLabels.Headers) != 2 || asLabels.Headers[0] != "Fe" {
		t.Errorf("with row names on, headers = %v, want [Fe Cu]", asLabels.Headers)
	}
	if len(asLabels.RowNames) != 3 {
		t.Errorf("with row names on, got %d row names, want 3", len(asLabels.RowNames))
	}

	asData := readWith(t, noIdentifierColumn, false, ParseMixedWithTargets)
	if len(asData.Headers) != 3 || asData.Headers[0] != "Si" {
		t.Errorf("with row names off, headers = %v, want [Si Fe Cu]", asData.Headers)
	}
	if len(asData.RowNames) != 0 {
		t.Errorf("with row names off, got %d row names, want none", len(asData.RowNames))
	}
}
