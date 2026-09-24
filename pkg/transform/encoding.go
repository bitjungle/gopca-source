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
	"strings"
)

// applyOneHot performs one-hot encoding on the specified categorical columns.
// For each column, K new binary columns are added, one per unique value. The
// source column is kept unless opts.RemoveOriginal is set, in which case it is
// removed and the column order in headers and data is updated accordingly.
//
// Columns with more than 20 unique non-missing values are skipped to avoid
// combinatorial explosion.
func applyOneHot(data [][]string, columnTypes map[string]string, catCols map[string][]string, headers *[]string, opts Options, result *Result) error {
	for _, colName := range opts.Columns {
		colIndex := findColumn(*headers, colName)
		if colIndex == -1 {
			result.Messages = append(result.Messages, fmt.Sprintf("Column '%s' not found", colName))
			continue
		}

		if columnTypes[colName] != "categorical" {
			result.Messages = append(result.Messages, fmt.Sprintf("Column '%s' is not categorical, skipping", colName))
			continue
		}

		uniqueSet := uniqueValues(data, colIndex)

		if len(uniqueSet) == 0 {
			result.Messages = append(result.Messages, fmt.Sprintf("Column '%s' has no values", colName))
			continue
		}

		if len(uniqueSet) > 20 {
			result.Messages = append(result.Messages, fmt.Sprintf("Column '%s' has too many unique values (%d), skipping one-hot encoding", colName, len(uniqueSet)))
			continue
		}

		sortedValues := make([]string, 0, len(uniqueSet))
		for v := range uniqueSet {
			sortedValues = append(sortedValues, v)
		}
		// Numeric-aware: category codes are usually numbers kept as labels, and
		// text order would give 1, 10, 11, 2, 3 (#996).
		sortCategoryValues(sortedValues)

		// Append one new column per unique value.
		newColumns := make([]string, 0, len(sortedValues))
		for _, val := range sortedValues {
			// uniqueColumnName as well as the stripped stem: unlike split and
			// ordinal, this appended its header unchecked, so a file already
			// holding the composed name ended up with two columns of it (#947).
			newColName := uniqueColumnName(*headers,
				fmt.Sprintf("%s_%s", derivedColumnBase(colName), val))
			*headers = append(*headers, newColName)
			columnTypes[newColName] = "numeric"
			newColumns = append(newColumns, newColName)

			for i := range data {
				if colIndex < len(data[i]) && strings.TrimSpace(data[i][colIndex]) == val {
					data[i] = append(data[i], "1")
				} else {
					data[i] = append(data[i], "0")
				}
			}
		}

		// The source column stays unless removal was asked for. Keeping it is
		// what lets GoPCA still colour plots by the category after encoding it.
		//
		// Guarded rather than skipped with continue: the bookkeeping below
		// records the transformation either way, and jumping past it would make
		// the encoding invisible to the caller in exactly the case that is now
		// the default.
		if opts.RemoveOriginal {
			removeColumn(data, columnTypes, catCols, headers, colName, colIndex)
		}

		result.TransformedColumns = append(result.TransformedColumns, colName)
		result.NewColumns = append(result.NewColumns, newColumns...)
		result.Messages = append(result.Messages, fmt.Sprintf("One-hot encoded column '%s' into %d new columns", colName, len(newColumns)))
	}

	return nil
}

// removeColumn drops a column from the headers, the metadata maps, and every
// row. Shared by the encoders, which both offer to discard their source.
//
// The row loop is the part that is easy to omit: a removal that updates the
// headers alone shifts every subsequent column by one, silently, and only in
// the data.
func removeColumn(data [][]string, columnTypes map[string]string, catCols map[string][]string, headers *[]string, colName string, colIndex int) {
	*headers = append((*headers)[:colIndex], (*headers)[colIndex+1:]...)
	delete(columnTypes, colName)
	delete(catCols, colName)

	for i := range data {
		if colIndex < len(data[i]) {
			data[i] = append(data[i][:colIndex], data[i][colIndex+1:]...)
		}
	}
}
