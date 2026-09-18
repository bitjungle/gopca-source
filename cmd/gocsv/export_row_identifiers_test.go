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
	"bytes"
	"encoding/csv"
	"strings"
	"testing"
)

// Issue #966: every way out of GoCSV must carry a column of row identifiers.
//
// The failure these tests exist to catch is not that the rule is wrong but that
// it holds on one export path and silently not on the others -- which is the
// state the code was in before, where each of the three paths decided for itself
// and used a different header while doing it.

func fileWithoutRowNames() *FileData {
	return &FileData{
		Headers: []string{"Si", "Fe"},
		Data: [][]string{
			{"0.5", "0.2"},
			{"0.6", "0.3"},
			{"0.7", "0.4"},
		},
		Rows:    3,
		Columns: 2,
	}
}

func TestExportRowIdentifiersPrefersWhatTheFileAlreadyHas(t *testing.T) {
	data := fileWithoutRowNames()
	data.RowNames = []string{"P1", "P2", "P3"}
	data.RowNamesHeader = "Prove"

	header, names, synthesized := exportRowIdentifiers(data)
	if synthesized {
		t.Error("invented identifiers for a file that already had them")
	}
	if header != "Prove" {
		t.Errorf("header = %q, want %q", header, "Prove")
	}
	if strings.Join(names, ",") != "P1,P2,P3" {
		t.Errorf("names = %v, want P1,P2,P3", names)
	}
}

func TestExportRowIdentifiersInventsNumbersWhenThereAreNone(t *testing.T) {
	header, names, synthesized := exportRowIdentifiers(fileWithoutRowNames())
	if !synthesized {
		t.Fatal("no identifiers were invented for a file that has none")
	}
	if header != "Sample_ID" {
		t.Errorf("header = %q, want Sample_ID", header)
	}
	if strings.Join(names, ",") != "1,2,3" {
		t.Errorf("names = %v, want 1,2,3", names)
	}
}

// A column already called Sample_ID would collide with the invented one, and two
// columns of that name in the output is a worse outcome than no identifiers.
func TestExportRowIdentifiersAvoidsAHeaderCollision(t *testing.T) {
	data := fileWithoutRowNames()
	data.Headers = []string{"Sample_ID", "Fe"}

	header, _, _ := exportRowIdentifiers(data)
	if header != "Sample_ID_2" {
		t.Errorf("header = %q, want Sample_ID_2", header)
	}
}

func TestExportRowIdentifiersLeavesAnEmptyFileAlone(t *testing.T) {
	_, names, synthesized := exportRowIdentifiers(&FileData{Headers: []string{"Si"}})
	if synthesized || len(names) != 0 {
		t.Errorf("invented %d identifiers for a file with no rows", len(names))
	}
}

// The invented column is written, never stored. Nothing the user sees should
// change because they exported: no new column in the grid, no undo entry, no
// dirty flag. An assertion on the document after the call is the only thing that
// would fail if the implementation drifted towards mutating it.
func TestExportRowIdentifiersDoesNotModifyTheDocument(t *testing.T) {
	data := fileWithoutRowNames()
	for _, name := range []string{"csv", "excel", "gopca"} {
		switch name {
		case "csv":
			_, _ = writeCSVExport(&bytes.Buffer{}, data)
		case "excel":
			f, _, err := buildExcelExport(data)
			if err == nil {
				_ = f.Close()
			}
		case "gopca":
			_ = writeGoPCAExport(&bytes.Buffer{}, data)
		}
		if len(data.RowNames) != 0 || data.RowNamesHeader != "" {
			t.Fatalf("%s export wrote row names back into the document: %v / %q",
				name, data.RowNames, data.RowNamesHeader)
		}
		if len(data.Headers) != 2 {
			t.Fatalf("%s export added a column to the document: %v", name, data.Headers)
		}
	}
}

// firstColumn returns the header and values of column 1 as each export path
// actually wrote them.
func firstColumn(t *testing.T, path string, data *FileData) (string, []string) {
	t.Helper()

	var records [][]string
	switch path {
	case "csv":
		var buf bytes.Buffer
		if _, err := writeCSVExport(&buf, data); err != nil {
			t.Fatalf("writeCSVExport: %v", err)
		}
		parsed, err := csv.NewReader(&buf).ReadAll()
		if err != nil {
			t.Fatalf("re-reading the CSV export: %v", err)
		}
		records = parsed
	case "gopca":
		var buf bytes.Buffer
		if err := writeGoPCAExport(&buf, data); err != nil {
			t.Fatalf("writeGoPCAExport: %v", err)
		}
		parsed, err := csv.NewReader(&buf).ReadAll()
		if err != nil {
			t.Fatalf("re-reading the GoPCA export: %v", err)
		}
		records = parsed
	case "excel":
		f, _, err := buildExcelExport(data)
		if err != nil {
			t.Fatalf("buildExcelExport: %v", err)
		}
		defer f.Close()
		rows, err := f.GetRows("Sheet1")
		if err != nil {
			t.Fatalf("reading back the workbook: %v", err)
		}
		records = rows
	default:
		t.Fatalf("unknown export path %q", path)
	}

	if len(records) == 0 {
		t.Fatalf("%s export wrote nothing", path)
	}
	values := make([]string, 0, len(records)-1)
	for _, record := range records[1:] {
		if len(record) == 0 {
			t.Fatalf("%s export wrote an empty row", path)
		}
		values = append(values, record[0])
	}
	return records[0][0], values
}

var exportPaths = []string{"csv", "excel", "gopca"}

func TestEveryExportPathCarriesInventedIdentifiers(t *testing.T) {
	for _, path := range exportPaths {
		t.Run(path, func(t *testing.T) {
			header, values := firstColumn(t, path, fileWithoutRowNames())
			if header != "Sample_ID" {
				t.Errorf("first header = %q, want Sample_ID", header)
			}
			if strings.Join(values, ",") != "1,2,3" {
				t.Errorf("first column = %v, want 1,2,3", values)
			}
		})
	}
}

func TestEveryExportPathKeepsTheFilesOwnIdentifiers(t *testing.T) {
	for _, path := range exportPaths {
		t.Run(path, func(t *testing.T) {
			data := fileWithoutRowNames()
			data.RowNames = []string{"P1", "P2", "P3"}
			data.RowNamesHeader = "Prove"

			header, values := firstColumn(t, path, data)
			if header != "Prove" {
				t.Errorf("first header = %q, want Prove", header)
			}
			if strings.Join(values, ",") != "P1,P2,P3" {
				t.Errorf("first column = %v, want P1,P2,P3", values)
			}
		})
	}
}

// #859 made the blank row-name header a deliberate round-trip property of the
// CSV export, and every dataset in testdata/ relies on it. Inventing identifiers
// must not quietly start naming a column that was blank on the way in.
func TestCSVExportKeepsTheBlankRowNameHeaderConvention(t *testing.T) {
	data := fileWithoutRowNames()
	data.RowNames = []string{"P1", "P2", "P3"}
	data.RowNamesHeader = ""

	header, values := firstColumn(t, "csv", data)
	if header != "" {
		t.Errorf("first header = %q, want it left blank", header)
	}
	if strings.Join(values, ",") != "P1,P2,P3" {
		t.Errorf("first column = %v, want P1,P2,P3", values)
	}
}

// The identifiers have to survive the whole way out and back: written by the
// export, read by the loader, and recognised there as row names rather than as a
// numeric data column that would enter the PCA. Asserting on the written bytes
// alone would not catch a column the loader declines to take (#904).
func TestExportedIdentifiersComeBackAsRowNames(t *testing.T) {
	var buf bytes.Buffer
	result, err := writeCSVExport(&buf, fileWithoutRowNames())
	if err != nil {
		t.Fatalf("writeCSVExport: %v", err)
	}
	if result.SyntheticRowIDHeader != "Sample_ID" {
		t.Errorf("SyntheticRowIDHeader = %q, want Sample_ID", result.SyntheticRowIDHeader)
	}

	reloaded, err := (&App{}).parseCSVContent(buf.String(), ".csv")
	if err != nil {
		t.Fatalf("re-importing the export: %v", err)
	}
	if strings.Join(reloaded.RowNames, ",") != "1,2,3" {
		t.Errorf("RowNames after re-import = %v, want 1,2,3", reloaded.RowNames)
	}
	if reloaded.RowNamesHeader != "Sample_ID" {
		t.Errorf("RowNamesHeader after re-import = %q, want Sample_ID", reloaded.RowNamesHeader)
	}
	if len(reloaded.Headers) != 2 {
		t.Errorf("the identifier column entered the table as data: %v", reloaded.Headers)
	}

	// Exporting the re-imported file again must not invent a second column.
	second, err := writeCSVExport(&bytes.Buffer{}, reloaded)
	if err != nil {
		t.Fatalf("second export: %v", err)
	}
	if second.SyntheticRowIDHeader != "" {
		t.Errorf("second export invented %q on top of the first", second.SyntheticRowIDHeader)
	}
}

// A file the user gave identifiers by hand must report nothing invented, so the
// frontend does not announce a column it did not add.
func TestExportReportsNothingInventedWhenTheFileHasNames(t *testing.T) {
	data := fileWithoutRowNames()
	data.RowNames = []string{"P1", "P2", "P3"}
	data.RowNamesHeader = "Prove"

	result, err := writeCSVExport(&bytes.Buffer{}, data)
	if err != nil {
		t.Fatalf("writeCSVExport: %v", err)
	}
	if result.SyntheticRowIDHeader != "" {
		t.Errorf("SyntheticRowIDHeader = %q, want empty", result.SyntheticRowIDHeader)
	}
}
