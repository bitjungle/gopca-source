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
	"sort"
	"strconv"
	"strings"
)

// applyOrdinal encodes categorical columns as a single integer column each.
//
// Codes are assigned by position in the effective order for the column: the
// first category becomes 0, the second 1, and so on. The source column is kept
// unless opts.RemoveOriginal is set.
//
// Empty cells stay empty. They are not a category, and giving them a code would
// place them at one end of the scale -- alphabetically, code 0 -- which is a
// value PCA would then treat as real.
func applyOrdinal(data [][]string, columnTypes map[string]string, catCols map[string][]string, headers *[]string, opts Options, result *Result) error {
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

		present := uniqueValues(data, colIndex)
		if len(present) == 0 {
			result.Messages = append(result.Messages, fmt.Sprintf("Column '%s' has no values", colName))
			continue
		}

		order := effectiveOrder(present, opts.CategoryOrder[colName])

		codes := make(map[string]int, len(order))
		for i, value := range order {
			codes[value] = i
		}

		newColName := uniqueColumnName(*headers, derivedColumnBase(colName)+"_code")

		*headers = append(*headers, newColName)
		columnTypes[newColName] = "numeric"

		for i := range data {
			value := ""
			if colIndex < len(data[i]) {
				value = strings.TrimSpace(data[i][colIndex])
			}
			if value == "" {
				data[i] = append(data[i], "")
				continue
			}
			data[i] = append(data[i], strconv.Itoa(codes[value]))
		}

		if opts.RemoveOriginal {
			removeColumn(data, columnTypes, catCols, headers, colName, colIndex)
		}

		result.TransformedColumns = append(result.TransformedColumns, colName)
		result.NewColumns = append(result.NewColumns, newColName)
		result.Messages = append(result.Messages, fmt.Sprintf(
			"Ordinal encoded column '%s' into '%s' (%s)",
			colName, newColName, describeCodes(order)))
	}

	return nil
}

// effectiveOrder resolves the order codes are assigned in.
//
// The requested order is honoured for the values it names and that are actually
// present; anything left over is appended alphabetically. Both halves of that
// matter. Dropping a requested value that is absent from the data keeps the
// codes contiguous, so a column encoded after some rows were filtered out does
// not acquire gaps. Appending the unrequested ones means a stale or partial
// order still encodes every row rather than silently mapping some to 0.
func effectiveOrder(present map[string]bool, requested []string) []string {
	order := make([]string, 0, len(present))
	placed := make(map[string]bool, len(present))

	for _, value := range requested {
		if present[value] && !placed[value] {
			order = append(order, value)
			placed[value] = true
		}
	}

	remaining := make([]string, 0, len(present))
	for value := range present {
		if !placed[value] {
			remaining = append(remaining, value)
		}
	}
	sort.Strings(remaining)

	return append(order, remaining...)
}

// uniqueValues collects the distinct non-empty values in a column.
func uniqueValues(data [][]string, colIndex int) map[string]bool {
	values := make(map[string]bool)
	for i := range data {
		if colIndex >= len(data[i]) {
			continue
		}
		if v := strings.TrimSpace(data[i][colIndex]); v != "" {
			values[v] = true
		}
	}
	return values
}

// describeCodes renders the mapping for the result message, so the user can see
// which order was actually used rather than having to infer it from the data.
func describeCodes(order []string) string {
	const maxShown = 6

	parts := make([]string, 0, maxShown+1)
	for i, value := range order {
		if i == maxShown {
			parts = append(parts, fmt.Sprintf("... %d more", len(order)-maxShown))
			break
		}
		parts = append(parts, fmt.Sprintf("%s=%d", value, i))
	}
	return strings.Join(parts, ", ")
}
