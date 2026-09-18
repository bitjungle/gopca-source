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
	"strings"

	pkgcsv "github.com/bitjungle/gopca/pkg/csv"
)

// ParseCSV parses CSV content and returns data matrix and headers.
//
// The first column is taken as row names, which is what every caller wants for
// a file that has an identifier column and what the CLI does by default. For a
// file that does not, see parseCSVContent and the --no-index equivalent it
// serves (#969).
func (a *App) ParseCSV(content string) (*FileDataJSON, error) {
	return a.parseCSVContent(content, true)
}

// parseCSVContent parses CSV content, taking the first column as row names only
// when hasRowNames says to.
//
// Nothing about a column's contents distinguishes an identifier from a
// measurement: a measurement can be unique, and Sample_ID is 1, 2, 3. So the
// reader does not guess -- it takes the first column, reports which one it took,
// and this parameter is how the user says otherwise. The CLI has said it with
// --no-index all along; GoPCA Desktop had no way to (#969).
func (a *App) parseCSVContent(content string, hasRowNames bool) (result *FileDataJSON, err error) {
	// Recover from any panic to prevent app crash
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("unexpected error while parsing file: %v", r)
			result = nil
		}
	}()

	// Validate input
	if content == "" {
		return nil, fmt.Errorf("empty file content")
	}

	// Try multiple formats
	formats := []pkgcsv.Options{
		pkgcsv.DefaultOptions(),      // Comma with dot decimal
		pkgcsv.EuropeanOptions(),     // Semicolon with comma decimal
		pkgcsv.TabDelimitedOptions(), // Tab delimited
	}

	var csvData *pkgcsv.Data
	var lastErr error

	for _, opts := range formats {
		// Use ParseMixedWithTargets mode to detect all column types
		opts.ParseMode = pkgcsv.ParseMixedWithTargets
		opts.HasRowNames = hasRowNames

		reader := pkgcsv.NewReader(opts)
		data, err := reader.Read(strings.NewReader(content))
		if err == nil && data != nil && data.Columns > 0 {
			csvData = data
			break
		}
		if err != nil {
			lastErr = err
		}
	}

	if csvData == nil {
		if lastErr != nil {
			return nil, fmt.Errorf("invalid file format: %w", lastErr)
		}
		return nil, fmt.Errorf("no numeric data columns found in file")
	}

	fileResult := &FileData{
		Headers:        csvData.Headers,
		RowNames:       csvData.RowNames,
		RowNamesHeader: csvData.RowNamesHeader,
		Data:           csvData.Matrix,
		MissingMask:    csvData.MissingMask,
	}

	// Add categorical columns if there are any
	if len(csvData.CategoricalColumns) > 0 {
		fileResult.CategoricalColumns = csvData.CategoricalColumns
	}

	// Add numeric target columns if there are any
	if len(csvData.NumericTargetColumns) > 0 {
		fileResult.NumericTargetColumns = csvData.NumericTargetColumns
	}

	return fileResult.ToJSONSafe(), nil
}
