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
	"fmt"
	"strconv"
	"strings"
)

// RowNameCheck reports whether a column can serve as the row-name column, and
// says why not when it cannot.
//
// The frontend uses this to disable the menu item with a reason, so the user
// learns why before clicking rather than after. The check is also enforced in
// ExecuteSetRowNames, because a rule that lives only in the UI is not a rule --
// any other caller would bypass it.
type RowNameCheck struct {
	OK     bool   `json:"ok"`
	Reason string `json:"reason,omitempty"`
}

// checkRowNameCandidate applies the requirement that row names identify rows.
//
// Row names are read in one place that matters: they label the points in a
// GoPCA scores plot. Two rows sharing a name are indistinguishable there, and a
// row with no name is unlabelled, so the test is "every entry non-empty and
// distinct" rather than merely "distinct".
//
// Comparison is on the trimmed value, so "P1" and "P1 " collide -- they render
// identically as a label, and calling them distinct would defeat the purpose.
// Case is significant: "P1" and "p1" are different identifiers, which is the
// normal convention for IDs and the safer assumption, since treating them as
// equal would reject data that is in fact well-formed.
func checkRowNameCandidate(values []string) RowNameCheck {
	if len(values) == 0 {
		return RowNameCheck{Reason: "the column has no rows"}
	}

	seen := make(map[string]int, len(values))
	blanks := 0
	duplicates := 0
	var firstDuplicate string

	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			blanks++
			continue
		}
		seen[trimmed]++
		if seen[trimmed] == 2 {
			duplicates++
			if firstDuplicate == "" {
				firstDuplicate = trimmed
			}
		}
	}

	switch {
	case blanks > 0 && duplicates > 0:
		return RowNameCheck{Reason: fmt.Sprintf(
			"row names must be unique and complete: %s and %s",
			pluralBlanks(blanks), pluralDuplicates(duplicates, firstDuplicate))}
	case blanks > 0:
		return RowNameCheck{Reason: fmt.Sprintf(
			"row names must be complete: %s", pluralBlanks(blanks))}
	case duplicates > 0:
		return RowNameCheck{Reason: fmt.Sprintf(
			"row names must be unique: %s", pluralDuplicates(duplicates, firstDuplicate))}
	}

	return RowNameCheck{OK: true}
}

func pluralBlanks(n int) string {
	if n == 1 {
		return "1 cell is empty"
	}
	return fmt.Sprintf("%d cells are empty", n)
}

func pluralDuplicates(n int, example string) string {
	if n == 1 {
		return fmt.Sprintf("%q appears more than once", example)
	}
	return fmt.Sprintf("%d values repeat, including %q", n, example)
}

// columnValues returns the cells of one column, padding short rows with "".
//
// Short rows are padded rather than skipped: a missing cell is an empty row
// name, which is exactly the thing checkRowNameCandidate must reject. Skipping
// them would let a ragged column pass by not looking at its gaps.
func columnValues(data *FileData, colIndex int) []string {
	values := make([]string, len(data.Data))
	for i, row := range data.Data {
		if colIndex < len(row) {
			values[i] = row[colIndex]
		}
	}
	return values
}

// demoteNonIdentifyingRowNames puts the row-name column back in the table when
// it does not identify rows, and reports whether it did.
//
// The loader takes the first column as row names unconditionally:
// types.DefaultCSVFormat sets HasRowNames, and parseCSVContent builds every
// candidate format from it. Nothing checks whether that column can actually
// serve. So a file whose first column repeats -- a source title, a batch name,
// a category -- silently acquires row names that cannot tell its rows apart,
// and the user only learns this from the GoPCA validation panel afterwards.
//
// The rule for what may be a row-name column already exists in
// checkRowNameCandidate, and ExecuteSetRowNames enforces it when a user picks a
// column by hand. Applying it here closes the gap that comment describes: the
// import was the other caller bypassing the rule, and it made a choice the same
// user would have been refused (#904).
//
// Demotion is deliberately the same operation as the manual "Move Row Names
// into Table", helpers included, so an automatic demotion and a hand-made one
// leave the file in the same state.
func demoteNonIdentifyingRowNames(data *FileData) bool {
	if data == nil || len(data.RowNames) == 0 {
		return false
	}
	if checkRowNameCandidate(data.RowNames).OK {
		return false
	}

	header := uniqueHeader(data.Headers, defaultRowNameHeader(data.RowNamesHeader))
	insertColumnAt(data, 0, header, data.RowNames)
	classifyColumn(data, header, data.RowNames)

	data.RowNames = nil
	data.RowNamesHeader = ""
	data.Columns = len(data.Headers)
	return true
}

// CanUseAsRowNames reports whether the given column could become the row-name
// column. Bound for the frontend so the menu can explain itself.
func (a *App) CanUseAsRowNames(data *FileData, colIndex int) RowNameCheck {
	if data == nil || colIndex < 0 || colIndex >= len(data.Headers) {
		return RowNameCheck{Reason: "no such column"}
	}
	return checkRowNameCandidate(columnValues(data, colIndex))
}

// syntheticRowIDHeader names the identifier column GoCSV invents for a file that
// has none. It is shared with AddRowNumbersCommand so a column the user asked
// for by hand and one an export supplied by itself are called the same thing.
const syntheticRowIDHeader = "Sample_ID"

// ExportResult reports what an export did beyond writing the rows out.
type ExportResult struct {
	// SyntheticRowIDHeader names the identifier column the export invented
	// because the file carried none, and is empty when the file supplied its
	// own. The frontend says so when it is set: adding a column to someone's
	// file is not a thing to do quietly.
	SyntheticRowIDHeader string `json:"syntheticRowIDHeader"`
}

// exportRowIdentifiers returns the row-identifier column an export should write.
//
// Row names label the points in a GoPCA scores plot, so a file that leaves GoCSV
// without them produces an unlabelled plot -- and the user finds that out only
// after the analysis has run. Three sources can supply them, in order of
// preference: what the loader found in the file, what the user assigned with Use
// as Row Names or Number the Rows, and failing both, numbers invented here.
//
// The third source is why this function exists. It applies only when the file
// has no row names at all, which after #904 means nothing in the file could
// serve as them.
//
// Nothing is written back into data. Every write in GoCSV is an export -- there
// is no in-place Save -- so an invented column belongs in the output, not in the
// document being edited: no undo entry, no dirty flag, and the grid does not
// move under the user. Re-importing an exported file takes the column straight
// back as row names, so the round trip is stable.
//
// header comes back empty when the file's own row names carried no header of
// their own. That is the blank-header convention #859 preserved deliberately,
// and each export path keeps its own substitute for it; only the invented column
// is named the same everywhere.
func exportRowIdentifiers(data *FileData) (header string, names []string, synthesized bool) {
	if data == nil {
		return "", nil, false
	}
	if len(data.RowNames) > 0 {
		return data.RowNamesHeader, data.RowNames, false
	}
	if len(data.Data) == 0 {
		return "", nil, false
	}

	names = make([]string, len(data.Data))
	for i := range names {
		names[i] = strconv.Itoa(i + 1)
	}
	return uniqueHeader(data.Headers, syntheticRowIDHeader), names, true
}
