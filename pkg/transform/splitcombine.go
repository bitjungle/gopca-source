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
	"fmt"
	"strconv"
	"strings"
)

// maxSplitParts caps how many columns one split may create.
//
// A delimiter chosen by mistake -- a space, on a column of free text -- would
// otherwise turn one column into dozens and leave the user to delete them by
// hand. The cap is generous enough that no realistic structured identifier
// reaches it.
const maxSplitParts = 20

// applySplit divides each named column on a delimiter, adding one new column
// per part.
//
// The number of new columns is the largest part count in the data, so a column
// of "B3_S12_r1" gives three and a ragged one gives as many as its longest row
// needs. Rows with fewer parts leave the trailing columns empty rather than
// shifting their values left, which would put a replicate number under a batch
// heading.
//
// The source column is kept unless opts.RemoveOriginal is set, as with the
// encoders (#854).
func applySplit(data [][]string, columnTypes map[string]string, catCols map[string][]string, headers *[]string, opts Options, result *Result) error {
	if opts.Delimiter == "" {
		return fmt.Errorf("a delimiter is required to split a column")
	}

	for _, colName := range opts.Columns {
		colIndex := findColumn(*headers, colName)
		if colIndex == -1 {
			result.Messages = append(result.Messages, fmt.Sprintf("Column '%s' not found", colName))
			continue
		}

		// Split every row first, so the column count is known before any
		// column is added. Deciding it per row would leave earlier rows short.
		parts := make([][]string, len(data))
		widest := 0
		for i := range data {
			value := ""
			if colIndex < len(data[i]) {
				value = data[i][colIndex]
			}
			if strings.TrimSpace(value) == "" {
				// An empty cell has no parts. Splitting "" yields one empty
				// string, which would make a blank look like a value.
				parts[i] = nil
				continue
			}
			parts[i] = strings.Split(value, opts.Delimiter)
			if len(parts[i]) > widest {
				widest = len(parts[i])
			}
		}

		if widest == 0 {
			result.Messages = append(result.Messages, fmt.Sprintf(
				"Column '%s' has no values to split", colName))
			continue
		}
		if widest == 1 {
			result.Messages = append(result.Messages, fmt.Sprintf(
				"Column '%s' left unchanged: no value contains %q",
				colName, opts.Delimiter))
			continue
		}
		if widest > maxSplitParts {
			result.Messages = append(result.Messages, fmt.Sprintf(
				"Column '%s' left unchanged: splitting on %q would make %d columns, "+
					"which is more than the %d allowed. Check the delimiter.",
				colName, opts.Delimiter, widest, maxSplitParts))
			continue
		}

		newColumns := make([]string, 0, widest)
		for part := 0; part < widest; part++ {
			newColName := uniqueColumnName(*headers, fmt.Sprintf("%s_%d", derivedColumnBase(colName), part+1))
			*headers = append(*headers, newColName)
			newColumns = append(newColumns, newColName)

			values := make([]string, len(data))
			for i := range data {
				value := ""
				if part < len(parts[i]) {
					value = parts[i][part]
				}
				values[i] = value
				data[i] = append(data[i], value)
			}
			classifyNewColumn(columnTypes, catCols, newColName, values)
		}

		if opts.RemoveOriginal {
			removeColumn(data, columnTypes, catCols, headers, colName, colIndex)
		}

		result.TransformedColumns = append(result.TransformedColumns, colName)
		result.NewColumns = append(result.NewColumns, newColumns...)
		result.Messages = append(result.Messages, fmt.Sprintf(
			"Split column '%s' on %q into %d columns: %s",
			colName, opts.Delimiter, len(newColumns), strings.Join(newColumns, ", ")))
	}

	return nil
}

// applyCombine joins the named columns into one, in the order given.
//
// The sources are kept unless opts.RemoveOriginal is set. Order follows
// opts.Columns rather than the table, because "Site" then "Year" and "Year"
// then "Site" are different keys and the caller chose one.
func applyCombine(data [][]string, columnTypes map[string]string, catCols map[string][]string, headers *[]string, opts Options, result *Result) error {
	if len(opts.Columns) < 2 {
		return fmt.Errorf("combining needs at least two columns, got %d", len(opts.Columns))
	}

	// A repeated column is refused rather than quietly de-duplicated.
	//
	// Joining a column to itself produces nothing a user wants, and with
	// RemoveOriginal it destroys data: the same index is removed twice, and the
	// second removal takes whichever column has shifted into its place. Asking
	// for ["A", "A"] used to delete both A and its neighbour.
	seen := make(map[string]bool, len(opts.Columns))
	for _, colName := range opts.Columns {
		if seen[colName] {
			return fmt.Errorf("column %q is listed more than once; each column can "+
				"appear in a combination only once", colName)
		}
		seen[colName] = true
	}

	indices := make([]int, 0, len(opts.Columns))
	for _, colName := range opts.Columns {
		colIndex := findColumn(*headers, colName)
		if colIndex == -1 {
			return fmt.Errorf("column %q not found", colName)
		}
		indices = append(indices, colIndex)
	}

	name := strings.TrimSpace(opts.NewColumnName)
	if name == "" {
		name = strings.Join(opts.Columns, "_")
	}
	newColName := uniqueColumnName(*headers, name)

	values := make([]string, len(data))
	for i := range data {
		pieces := make([]string, 0, len(indices))
		for _, colIndex := range indices {
			if colIndex < len(data[i]) {
				pieces = append(pieces, data[i][colIndex])
			} else {
				pieces = append(pieces, "")
			}
		}
		values[i] = strings.Join(pieces, opts.Separator)
	}

	*headers = append(*headers, newColName)
	for i := range data {
		data[i] = append(data[i], values[i])
	}
	classifyNewColumn(columnTypes, catCols, newColName, values)

	// Removal happens after the join and from the highest index down, so the
	// indices gathered above stay valid while columns disappear beneath them.
	if opts.RemoveOriginal {
		sorted := append([]int(nil), indices...)
		for a := 0; a < len(sorted); a++ {
			for b := a + 1; b < len(sorted); b++ {
				if sorted[b] > sorted[a] {
					sorted[a], sorted[b] = sorted[b], sorted[a]
				}
			}
		}
		for _, colIndex := range sorted {
			removeColumn(data, columnTypes, catCols, headers, (*headers)[colIndex], colIndex)
		}
	}

	result.TransformedColumns = append(result.TransformedColumns, opts.Columns...)
	result.NewColumns = append(result.NewColumns, newColName)
	result.Messages = append(result.Messages, fmt.Sprintf(
		"Combined %s into '%s'", strings.Join(opts.Columns, ", "), newColName))

	return nil
}

// derivedColumnBase returns the stem that a derived column name is built on:
// the source column's name with any marker removed.
//
// A marker describes the column it is attached to. "#category" says that this
// column's numbers are labels rather than quantities, which is true of the
// source and false of anything derived from it -- the indicators one-hot
// encoding produces are genuine 0/1 features and are meant to enter the
// analysis. Carrying the marker across gave columns named
// "proc_num#category_7", which reads as a category column and is not one (#947).
//
// The source keeps its own marker, which is what lets a plot still be coloured
// by the category after it has been encoded.
func derivedColumnBase(name string) string {
	trimmed := strings.TrimSpace(name)
	for _, marker := range []string{"#category", "# category", "#target", "# target"} {
		if len(trimmed) >= len(marker) &&
			strings.EqualFold(trimmed[len(trimmed)-len(marker):], marker) {
			return strings.TrimSpace(trimmed[:len(trimmed)-len(marker)])
		}
	}
	return trimmed
}

// uniqueColumnName suffixes name until nothing in headers uses it.
func uniqueColumnName(headers []string, name string) string {
	inUse := make(map[string]bool, len(headers))
	for _, header := range headers {
		inUse[header] = true
	}
	candidate := name
	for i := 2; inUse[candidate]; i++ {
		candidate = fmt.Sprintf("%s_%d", name, i)
	}
	return candidate
}

// classifyNewColumn records the type of a column built from string values.
//
// A column is numeric only if it holds at least one value and every non-empty
// value parses. Starting from true and skipping blanks would type an all-empty
// column as numeric -- it never meets a value that fails -- and PCA would then
// be offered a variable with nothing in it (#859).
func classifyNewColumn(columnTypes map[string]string, catCols map[string][]string, name string, values []string) {
	numeric := false
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, err := strconv.ParseFloat(trimmed, 64); err != nil {
			numeric = false
			break
		}
		numeric = true
	}

	if numeric {
		columnTypes[name] = "numeric"
		return
	}
	columnTypes[name] = "categorical"
	catCols[name] = append([]string(nil), values...)
}
