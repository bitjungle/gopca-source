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
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Issue #969: GoPCA Desktop had no way to say "my first column is data".
//
// The CLI has had --no-index on analyze, regress, transform and validate all
// along. Desktop took the first column as row names with no switch and no
// report, so a file without an identifier column was analysed one variable
// short and nothing on screen said so.

const fileWithNoIdentifierColumn = "Si,Fe,Cu\n0.51,0.2,0.1\n0.62,0.3,0.2\n0.73,0.4,0.3\n"

func TestParseCSVNamesTheColumnItTookAsRowNames(t *testing.T) {
	data, err := (&App{}).ParseCSV(fileWithNoIdentifierColumn)
	if err != nil {
		t.Fatalf("ParseCSV: %v", err)
	}
	if data.RowNamesHeader != "Si" {
		t.Errorf("RowNamesHeader = %q, want Si -- the UI cannot name the "+
			"consumed column without it", data.RowNamesHeader)
	}
	if strings.Join(data.Headers, ",") != "Fe,Cu" {
		t.Errorf("headers = %v, want [Fe Cu]", data.Headers)
	}
}

// The defect and its remedy, side by side. A three-variable file must be able to
// arrive as three variables.
func TestFirstColumnCanBeKeptAsData(t *testing.T) {
	data, err := (&App{}).parseCSVContent(fileWithNoIdentifierColumn, false)
	if err != nil {
		t.Fatalf("parseCSVContent: %v", err)
	}
	if strings.Join(data.Headers, ",") != "Si,Fe,Cu" {
		t.Errorf("headers = %v, want all three variables", data.Headers)
	}
	if len(data.RowNames) != 0 {
		t.Errorf("got %d row names, want none", len(data.RowNames))
	}
	if data.RowNamesHeader != "" {
		t.Errorf("RowNamesHeader = %q, want empty", data.RowNamesHeader)
	}
	// Every row must still be present, and with all three values.
	if len(data.Data) != 3 || len(data.Data[0]) != 3 {
		t.Errorf("matrix is %dx%d, want 3x3", len(data.Data), len(data.Data[0]))
	}
}

// ReloadCSVFile is what the checkbox calls. It reads from disk rather than from
// kept content, so it has to be exercised through a real file.
func TestReloadCSVFileHonoursTheSwitch(t *testing.T) {
	path := filepath.Join(t.TempDir(), "measurements.csv")
	if err := os.WriteFile(path, []byte(fileWithNoIdentifierColumn), 0o600); err != nil {
		t.Fatalf("writing the fixture: %v", err)
	}
	app := &App{}

	asData, err := app.ReloadCSVFile(path, true)
	if err != nil {
		t.Fatalf("ReloadCSVFile(firstColumnIsData=true): %v", err)
	}
	if strings.Join(asData.Headers, ",") != "Si,Fe,Cu" {
		t.Errorf("headers = %v, want all three variables", asData.Headers)
	}

	asLabels, err := app.ReloadCSVFile(path, false)
	if err != nil {
		t.Fatalf("ReloadCSVFile(firstColumnIsData=false): %v", err)
	}
	if strings.Join(asLabels.Headers, ",") != "Fe,Cu" {
		t.Errorf("headers = %v, want Si taken as row names", asLabels.Headers)
	}
	if asLabels.RowNamesHeader != "Si" {
		t.Errorf("RowNamesHeader = %q, want Si", asLabels.RowNamesHeader)
	}
}

func TestReloadCSVFileReportsAMissingFile(t *testing.T) {
	if _, err := (&App{}).ReloadCSVFile(filepath.Join(t.TempDir(), "absent.csv"), true); err == nil {
		t.Error("a missing file was accepted")
	}
}

// A file that genuinely has an identifier column must be unaffected by all of
// this: Sample_ID is numeric, so any rule keyed on numeric-ness would break the
// column GoCSV now writes on every export (#966).
func TestAGenuineIdentifierColumnIsStillTakenAsRowNames(t *testing.T) {
	data, err := (&App{}).ParseCSV("Sample_ID,Si,Fe\n1,0.5,0.2\n2,0.6,0.3\n3,0.7,0.4\n")
	if err != nil {
		t.Fatalf("ParseCSV: %v", err)
	}
	if data.RowNamesHeader != "Sample_ID" {
		t.Errorf("RowNamesHeader = %q, want Sample_ID", data.RowNamesHeader)
	}
	if strings.Join(data.RowNames, ",") != "1,2,3" {
		t.Errorf("row names = %v, want 1,2,3", data.RowNames)
	}
	if strings.Join(data.Headers, ",") != "Si,Fe" {
		t.Errorf("headers = %v, want [Si Fe]", data.Headers)
	}
}
