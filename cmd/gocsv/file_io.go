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
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	pkgcsv "github.com/bitjungle/gopca/pkg/csv"

	"github.com/bitjungle/gopca/pkg/integration"
	"github.com/bitjungle/gopca/pkg/types"
	parquet "github.com/parquet-go/parquet-go"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"github.com/xuri/excelize/v2"
)

// ValidationResult represents the result of GoPCA validation
type ValidationResult struct {
	IsValid  bool     `json:"isValid"`
	Messages []string `json:"messages"`
}

// LoadCSV loads a CSV file and returns its data
func (a *App) LoadCSV(filePath string) (*FileData, error) {
	// If no filepath provided, show file dialog
	if filePath == "" {
		selection, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
			Title: "Select CSV File",
			Filters: []wailsruntime.FileFilter{
				{
					DisplayName: "Supported Files (*.csv,*.xlsx,*.xls,*.tsv,*.parquet)",
					Pattern:     "*.csv;*.xlsx;*.xls;*.tsv;*.parquet",
				},
				{
					DisplayName: "CSV Files (*.csv)",
					Pattern:     "*.csv",
				},
				{
					DisplayName: "Excel Files (*.xlsx,*.xls)",
					Pattern:     "*.xlsx;*.xls",
				},
				{
					DisplayName: "TSV Files (*.tsv)",
					Pattern:     "*.tsv",
				},
				{
					DisplayName: "Parquet Files (*.parquet)",
					Pattern:     "*.parquet",
				},
				{
					DisplayName: "All Files (*.*)",
					Pattern:     "*.*",
				},
			},
		})
		if err != nil {
			return nil, fmt.Errorf("error showing file dialog: %w", err)
		}
		if selection == "" {
			return nil, fmt.Errorf("no file selected")
		}
		filePath = selection
	}

	// If filePath is a remote URL, fetch it to a temp file first.
	// The temp file is named with the detected extension so the switch below routes correctly.
	if strings.HasPrefix(filePath, "https://") || strings.HasPrefix(filePath, "http://") {
		a.logInfo(fmt.Sprintf("Fetching remote file: %s", filePath))
		tmpPath, err := fetchRemoteFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch remote file: %w", err)
		}
		defer os.Remove(tmpPath)
		filePath = tmpPath
	}

	// Check file extension
	ext := filepath.Ext(filePath)
	var fileData *FileData

	switch ext {
	case ".xlsx", ".xls":
		// Handle Excel files
		var err error
		fileData, err = a.loadExcel(filePath)
		if err != nil {
			// Remember the path so the frontend can ask whether the import
			// wizard could read this sheet (#799).
			a.lastFailedLoad = filePath
			return nil, fmt.Errorf("error loading Excel file: %w", err)
		}
		a.lastFailedLoad = ""
	case ".parquet":
		// Handle Parquet files
		var err error
		fileData, err = a.loadParquet(filePath)
		if err != nil {
			return nil, fmt.Errorf("error loading Parquet file: %w", err)
		}
	case ".tsv", ".csv", "":
		// Handle CSV/TSV files
		content, err := os.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("error reading file: %w", err)
		}

		// Check file size
		if len(content) > 100*1024*1024 { // 100MB
			a.logWarning(fmt.Sprintf("Large file detected: %d MB", len(content)/1024/1024))
		}

		// Parse using GoPCA's parser with format detection
		fileData, err = a.parseCSVContent(string(content), ext)
		if err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported file format: %s", ext)
	}

	// Store the filename for display
	if a.ctx != nil {
		wailsruntime.EventsEmit(a.ctx, "file-loaded", filepath.Base(filePath))
	}

	// Store the current data reference for undo/redo operations
	a.currentData = fileData
	// Clear history when loading new file
	a.history.Clear()
	a.markClean()
	if a.ctx != nil {
		wailsruntime.EventsEmit(a.ctx, "undo-redo-state-changed", a.GetUndoRedoState())
	}

	return fileData, nil
}

// writeCSVRow writes a single row of cells to b in RFC 4180 CSV format.
func writeCSVRow(b *strings.Builder, cells []string) {
	for i, cell := range cells {
		if i > 0 {
			b.WriteString(",")
		}
		if strings.ContainsAny(cell, ",\"\n\r") {
			b.WriteString("\"")
			b.WriteString(strings.ReplaceAll(cell, "\"", "\"\""))
			b.WriteString("\"")
		} else {
			b.WriteString(cell)
		}
	}
	b.WriteString("\n")
}

// loadExcel loads data from an Excel file
func (a *App) loadExcel(filePath string) (*FileData, error) {
	a.logInfo(fmt.Sprintf("Loading Excel file: %s", filePath))

	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open Excel file: %w", err)
	}
	defer f.Close()

	// Get list of sheets
	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("no sheets found in Excel file")
	}

	// A workbook with more than one sheet has no defensible default. Loading
	// the first one silently discards the rest, and the only trace was a log
	// line in a terminal the user is not reading. Hand the file to the import
	// wizard instead, which has had a sheet selector all along -- refusing here
	// is what routes it there, because LoadCSV records the path on error and
	// the frontend then asks SuggestImportForFailedLoad what to do (#905).
	//
	// Hidden sheets do not count. Tools emit them for their own bookkeeping,
	// and prompting for a choice the user cannot see would be noise.
	candidates := candidateSheets(f, sheets)
	if len(candidates) > 1 {
		return nil, fmt.Errorf("this workbook has %d sheets to choose from (%s), so there is no single obvious one to open",
			len(candidates), strings.Join(candidates, ", "))
	}
	selectedSheet := candidates[0]
	if len(sheets) > 1 {
		a.logInfo(fmt.Sprintf("Using sheet: %s", selectedSheet))
	}

	// Get all rows from the selected sheet
	rows, err := f.GetRows(selectedSheet)
	if err != nil {
		return nil, fmt.Errorf("failed to read sheet %s: %w", selectedSheet, err)
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("no data found in sheet %s", selectedSheet)
	}

	// Convert Excel data to CSV format for parsing.
	//
	// GetRows trims trailing empty cells, so it returns rows of differing
	// lengths: a sheet with a narrow title block above a wide table comes back
	// ragged. encoding/csv fixes its expected field count from the first record
	// and rejects every row that disagrees, so normalise to the widest row
	// before serialising (#799).
	width := 0
	for _, row := range rows {
		if len(row) > width {
			width = len(row)
		}
	}
	if width == 0 {
		return nil, fmt.Errorf("no data found in sheet %s", selectedSheet)
	}

	var csvContent strings.Builder
	padded := make([]string, width)
	for _, row := range rows {
		copy(padded, row)
		for i := len(row); i < width; i++ {
			padded[i] = ""
		}
		writeCSVRow(&csvContent, padded)
	}

	// Parse the CSV content using GoPCA's parser
	a.logInfo(fmt.Sprintf("Excel data converted to CSV, %d bytes", csvContent.Len()))
	fileData, err := a.parseCSVContent(csvContent.String(), ".csv")
	if err == nil && hasNumericColumn(fileData) {
		return fileData, nil
	}

	// A sheet whose table sits below a title block parses into nothing usable:
	// the preamble becomes the header and the first data rows, so no column
	// reads as a consistent type. Deciding where the real table starts is the
	// import wizard's job — it has SkipRows and HeaderRow, and guessing here
	// risks silently discarding a genuine header row that happens to be
	// narrower than the data. Say what was found and point at the tool that can
	// express the answer (#799).
	//
	// The condition above is what keeps that diagnosis working now that a
	// text-only file is a valid load (#801). This check used to run only when
	// parseCSVContent failed, which is exactly what a title block used to
	// cause; since such a sheet now parses "successfully" into an all-text grid
	// headed by the title, waiting for a failure would mean never reporting it.
	//
	// Requiring a numeric column *here* rather than in parseCSVContent is
	// deliberate. It is not a claim that spreadsheets must be numeric — a
	// text-only sheet with no preamble falls through and loads. It is the
	// discriminator between the two ways a sheet ends up all-text: because it
	// genuinely is, or because a title block is being read as the header.
	if preamble := leadingNarrowRows(rows, width); preamble > 0 {
		return nil, fmt.Errorf("this sheet has %d row(s) above the table, so the data starts at row %d; "+
			"use Import with Wizard to set the rows to skip", preamble, preamble+1)
	}
	if err != nil {
		return nil, err
	}
	return fileData, nil
}

// hasNumericColumn reports whether any column was detected as numeric.
//
// Target columns count: they hold numbers and are only separated out by the
// "#target" suffix convention.
func hasNumericColumn(data *FileData) bool {
	if data == nil {
		return false
	}
	for _, columnType := range data.ColumnTypes {
		if columnType == "numeric" || columnType == "target" {
			return true
		}
	}
	return false
}

// ExcelImportSuggestion describes a spreadsheet the plain open path cannot read
// on its own, together with the wizard settings that make it readable. It exists
// so the frontend can offer the handoff from structured data rather than by
// matching on an error string.
type ExcelImportSuggestion struct {
	NeedsWizard bool   `json:"needsWizard"`
	SkipRows    int    `json:"skipRows"`
	HeaderRow   int    `json:"headerRow"`
	Sheet       string `json:"sheet,omitempty"`
	DataRow     int    `json:"dataRow"`  // 1-based sheet row the table starts on
	FilePath    string `json:"filePath"` // the file the suggestion is about
}

// candidateSheets returns the sheets the user might plausibly have meant.
//
// Hidden sheets are excluded, because tools emit them for their own bookkeeping
// and a choice the user cannot see is noise. Visibility is metadata, so this
// reads no rows. A sheet whose visibility cannot be determined counts as a
// candidate: the question is "might the user have meant this one", and the safe
// answer when we do not know is yes.
//
// If that leaves nothing -- every sheet hidden, which a file generated by a tool
// can be -- the filter has removed the entire question rather than answered it,
// so every sheet becomes a candidate again. Returning an empty set instead would
// have let a workbook of several hidden sheets fall through to an arbitrary
// first-sheet default, which is the guess this whole change exists to remove.
func candidateSheets(f *excelize.File, sheets []string) []string {
	out := make([]string, 0, len(sheets))
	for _, sheet := range sheets {
		shown, err := f.GetSheetVisible(sheet)
		if err != nil || shown {
			out = append(out, sheet)
		}
	}
	if len(out) == 0 {
		return sheets
	}
	return out
}

// suggestExcelImport inspects a spreadsheet that failed to open and reports
// whether the import wizard could read it, and with what settings. A title block
// above the table is the case it detects: those rows are narrower than the table,
// so the number of leading narrow rows is exactly the number the wizard must skip.
//
// Returns NeedsWizard false when the sheet has no such preamble, in which case
// the load failed for some other reason and the wizard would not help.
// SuggestImportForFailedLoad reports whether the import wizard could read the
// file whose load just failed. The frontend cannot pass the path because LoadCSV
// opens the file dialog in the backend, so the path is recorded at the point of
// failure and consulted here.
func (a *App) SuggestImportForFailedLoad() (*ExcelImportSuggestion, error) {
	if a.lastFailedLoad == "" {
		return &ExcelImportSuggestion{}, nil
	}
	suggestion, err := suggestExcelImport(a.lastFailedLoad)
	if err != nil {
		return nil, err
	}
	if suggestion.NeedsWizard {
		suggestion.FilePath = a.lastFailedLoad
	}
	return suggestion, nil
}

func suggestExcelImport(filePath string) (*ExcelImportSuggestion, error) {
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open Excel file: %w", err)
	}
	defer func() { _ = f.Close() }()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("no sheets found in Excel file")
	}
	candidates := candidateSheets(f, sheets)
	multiSheet := len(candidates) > 1
	sheet := candidates[0]

	rows, err := f.GetRows(sheet)
	if err != nil {
		return nil, fmt.Errorf("failed to read sheet %s: %w", sheet, err)
	}

	width := 0
	for _, row := range rows {
		if len(row) > width {
			width = len(row)
		}
	}
	preamble := 0
	if width > 0 {
		preamble = leadingNarrowRows(rows, width)
	}
	// Two reasons to send the file to the wizard, and they compose: a title
	// block means the parser needs telling where the table starts, and several
	// sheets mean the user needs to say which one they meant. Either alone is
	// enough; neither means the sheet is unambiguous and loads directly.
	if preamble == 0 && !multiSheet {
		return &ExcelImportSuggestion{}, nil
	}
	return &ExcelImportSuggestion{
		NeedsWizard: true,
		SkipRows:    preamble,
		HeaderRow:   0,
		Sheet:       sheet,
		DataRow:     preamble + 1,
	}, nil
}

// leadingNarrowRows counts the rows at the top of a sheet that are narrower than
// the widest row. A title block above a table produces a run of such rows, which
// is what makes the sheet unreadable without telling the parser where the table
// begins. Returns 0 when the first row is already full width, i.e. the ordinary
// case of a sheet that is nothing but its table.
func leadingNarrowRows(rows [][]string, width int) int {
	for i, row := range rows {
		if len(row) == width {
			return i
		}
	}
	return 0
}

// loadParquet loads data from a Parquet file and converts it to a FileData struct.
func (a *App) loadParquet(filePath string) (*FileData, error) {
	a.logInfo(fmt.Sprintf("Loading Parquet file: %s", filePath))

	f, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open Parquet file: %w", err)
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to stat Parquet file: %w", err)
	}

	pf, err := parquet.OpenFile(f, stat.Size())
	if err != nil {
		return nil, fmt.Errorf("failed to parse Parquet file: %w", err)
	}

	// Build headers, prepending Sample_ID, and mark string columns #category.
	//
	// These used to be marked "#target", on the stated grounds that it "makes
	// GoPCA treat them as group labels for coloring the scores plot". It did
	// not: the suffix is only consulted for numeric columns, and a text column
	// is classified categorical from its values alone. So the marker was inert
	// while claiming the strongest term in the vocabulary for a column that is
	// not a response to anything.
	//
	// Dropping it entirely would not do either. Type detection runs on the
	// values after the sheet is converted to CSV, so a Parquet string column
	// holding "001", "002" -- a zero-padded code, a year, an identifier -- is
	// detected as numeric and would enter the PCA as a measurement. Parquet
	// records that the column is text, and #category is how that knowledge
	// survives the conversion (#914).
	//
	// Sample_ID provides a unique integer row identifier, since string columns
	// like "country" are not unique (the same country appears once per year).
	fields := pf.Schema().Fields()
	headers := make([]string, 0, len(fields)+1)
	headers = append(headers, "Sample_ID")
	for _, field := range fields {
		name := field.Name()
		if field.Type().Kind() == parquet.ByteArray || field.Type().Kind() == parquet.FixedLenByteArray {
			name += "#category"
		}
		headers = append(headers, name)
	}

	// Build CSV: header row followed by data rows
	var csvContent strings.Builder
	writeCSVRow(&csvContent, headers)

	rowNum := 0
	buf := make([]parquet.Row, 128)
	for _, rg := range pf.RowGroups() {
		rows := rg.Rows()
		for {
			n, readErr := rows.ReadRows(buf)
			for i := 0; i < n; i++ {
				rowNum++
				row := buf[i]
				cells := make([]string, len(fields)+1)
				cells[0] = strconv.Itoa(rowNum)
				for j, val := range row {
					if j < len(fields) {
						cells[j+1] = parquetValueToString(val)
					}
				}
				writeCSVRow(&csvContent, cells)
			}
			if readErr == io.EOF {
				break
			}
			if readErr != nil {
				rows.Close()
				return nil, fmt.Errorf("error reading Parquet rows: %w", readErr)
			}
		}
		rows.Close()
	}

	a.logInfo(fmt.Sprintf("Parquet data converted to CSV, %d bytes", csvContent.Len()))
	return a.parseCSVContent(csvContent.String(), ".csv")
}

// parquetValueToString converts a parquet.Value to its string representation.
// Null values become empty strings (GoCSV's convention for missing values).
func parquetValueToString(v parquet.Value) string {
	if v.IsNull() {
		return ""
	}
	switch v.Kind() {
	case parquet.Boolean:
		if v.Boolean() {
			return "true"
		}
		return "false"
	case parquet.Int32:
		return strconv.FormatInt(int64(v.Int32()), 10)
	case parquet.Int64:
		return strconv.FormatInt(v.Int64(), 10)
	case parquet.Float:
		return strconv.FormatFloat(float64(v.Float()), 'f', -1, 32)
	case parquet.Double:
		return strconv.FormatFloat(v.Double(), 'f', -1, 64)
	case parquet.ByteArray, parquet.FixedLenByteArray:
		return string(v.ByteArray())
	default:
		return fmt.Sprintf("%v", v)
	}
}

// parseCSVContent parses CSV content using GoPCA's parser
func (a *App) parseCSVContent(content string, ext string) (*FileData, error) {
	// Configure format based on file extension
	defaultFormat := types.DefaultCSVFormat()
	formats := []types.CSVFormat{
		defaultFormat, // Standard CSV: comma with dot decimal
	}

	// Add TSV format if TSV file
	if ext == ".tsv" {
		formats = []types.CSVFormat{
			{
				FieldDelimiter:   '\t',
				DecimalSeparator: '.',
				HasHeaders:       true,
				HasRowNames:      true,
				NullValues:       defaultFormat.NullValues,
			},
		}
	} else {
		// Try multiple CSV formats
		formats = append(formats,
			types.CSVFormat{
				FieldDelimiter:   ';',
				DecimalSeparator: ',',
				HasHeaders:       true,
				HasRowNames:      true,
				NullValues:       defaultFormat.NullValues,
			},
		)
	}

	var csvData *types.CSVData
	var categoricalData map[string][]string
	var numericTargetData map[string][]float64
	var lastErr error
	var successfulFormat types.CSVFormat

	// Try each format until one works.
	//
	// The acceptance test counts every column the parse produced, not just the
	// numeric ones. Requiring a numeric column meant GoCSV -- a tool whose job is
	// preparing data -- refused to open any text-only CSV, and told the user the
	// file contained no data, which was untrue: the parser returns the text
	// columns as categorical without error (#801). Preparing data for PCA often
	// starts from a file that is not numeric yet, and with one-hot and ordinal
	// encoding available that is now a supported way in rather than a dead end.
	//
	// This check also doubles as the delimiter heuristic, which is why it is
	// relaxed rather than removed. A file read with the wrong delimiter either
	// fails on inconsistent field counts or collapses to a single column that is
	// then consumed as row names, leaving nothing behind -- so the loop still
	// falls through to the next format instead of settling for a bad parse.
	// TestParseCSVContentDelimiterFallback covers both shapes.
	for _, format := range formats {
		reader := strings.NewReader(content)
		data, catData, targetData, err := types.ParseCSVMixedWithTargets(reader, format, nil)
		if err == nil && data != nil && (data.Columns > 0 || len(catData) > 0 || len(targetData) > 0) {
			csvData = data
			categoricalData = catData
			numericTargetData = targetData
			successfulFormat = format
			break
		}
		if err != nil {
			lastErr = err
		}
	}

	if csvData == nil {
		if lastErr != nil {
			a.logError(fmt.Sprintf("Failed to parse CSV: %v", lastErr))
			return nil, fmt.Errorf("failed to parse CSV: %w", lastErr)
		}
		a.logError("No data found in file")
		return nil, fmt.Errorf("no data found in file")
	}

	// Convert numeric matrix to string matrix for display
	stringData := make([][]string, len(csvData.Matrix))
	for i, row := range csvData.Matrix {
		stringData[i] = make([]string, len(row))
		for j, val := range row {
			if csvData.MissingMask != nil && csvData.MissingMask[i][j] {
				stringData[i][j] = ""
			} else {
				stringData[i][j] = strconv.FormatFloat(val, 'g', -1, 64)
			}
		}
	}

	// Build column types map
	columnTypes := make(map[string]string)

	// Mark numeric columns
	for _, header := range csvData.Headers {
		columnTypes[header] = "numeric"
	}

	// Mark categorical columns
	for colName := range categoricalData {
		columnTypes[colName] = "categorical"
	}

	// Mark target columns
	for colName := range numericTargetData {
		columnTypes[colName] = "target"
	}

	// Create FileData with all information
	fileData := &FileData{
		Headers:              csvData.Headers,
		RowNames:             csvData.RowNames,
		RowNamesHeader:       csvData.RowNamesHeader,
		Data:                 stringData,
		Rows:                 csvData.Rows,
		Columns:              csvData.Columns,
		CategoricalColumns:   categoricalData,
		NumericTargetColumns: ConvertFloat64MapToJSON(numericTargetData),
		ColumnTypes:          columnTypes,
	}

	a.logInfo(fmt.Sprintf("Parsed data: %d rows, %d columns, %d headers", csvData.Rows, csvData.Columns, len(csvData.Headers)))

	// If we have categorical or target columns, we need to combine them with numeric data
	// for the full data display
	if len(categoricalData) > 0 || len(numericTargetData) > 0 {
		// Get all original headers to preserve column order, then merge all column types.
		allOriginalHeaders := pkgcsv.GetOriginalHeaders(content, successfulFormat)
		combined := pkgcsv.CombineColumns(csvData, categoricalData, numericTargetData, allOriginalHeaders)
		fileData = &FileData{
			Headers:              combined.Headers,
			RowNames:             combined.RowNames,
			RowNamesHeader:       csvData.RowNamesHeader,
			Data:                 combined.Data,
			Rows:                 combined.Rows,
			Columns:              combined.Columns,
			CategoricalColumns:   combined.CategoricalColumns,
			NumericTargetColumns: ConvertFloat64MapToJSON(combined.NumericTargetData),
			ColumnTypes:          combined.ColumnTypes,
		}
	}

	// The first column arrived here as row names whether or not it can serve as
	// them, because DefaultCSVFormat sets HasRowNames and nothing above checks.
	// Hand it back to the table when it cannot (#904).
	if demoteNonIdentifyingRowNames(fileData) {
		a.logInfo(fmt.Sprintf("First column %q kept as data: %s",
			fileData.Headers[0], checkRowNameCandidate(columnValues(fileData, 0)).Reason))
	}

	return fileData, nil
}

// ValidateForGoPCA validates that the CSV data is compatible with GoPCA.
func (a *App) ValidateForGoPCA(data *FileData) *ValidationResult {
	in := integration.ValidationInput{
		Headers:     data.Headers,
		Data:        data.Data,
		ColumnTypes: data.ColumnTypes,
		RowNames:    data.RowNames,
		Rows:        data.Rows,
		Columns:     data.Columns,
	}
	res := integration.ValidateForGoPCA(in)
	return &ValidationResult{IsValid: res.IsValid, Messages: res.Messages}
}

// SaveCSV saves the data to a CSV file
func (a *App) SaveCSV(data *FileData) (*ExportResult, error) {
	// Show save dialog
	selection, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:           "Save CSV File",
		DefaultFilename: "exported_data.csv",
		Filters: []wailsruntime.FileFilter{
			{
				DisplayName: "CSV Files (*.csv)",
				Pattern:     "*.csv",
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("error showing save dialog: %w", err)
	}
	if selection == "" {
		return nil, fmt.Errorf("no file selected")
	}

	file, err := os.Create(selection)
	if err != nil {
		return nil, fmt.Errorf("error writing CSV file: %w", err)
	}
	result, writeErr := writeCSVExport(file, data)
	closeErr := file.Close()
	if writeErr != nil {
		return nil, writeErr
	}
	if closeErr != nil {
		return nil, fmt.Errorf("error writing CSV file: %w", closeErr)
	}

	wailsruntime.EventsEmit(a.ctx, "file-saved", filepath.Base(selection))
	a.markClean()
	return result, nil
}

// writeCSVExport writes the export to w. It is separate from SaveCSV because
// SaveCSV opens a native dialog and so cannot be called from a test, which would
// leave the one behaviour worth testing here -- that the output carries row
// identifiers whether or not the file had any -- checked nowhere.
func writeCSVExport(w io.Writer, data *FileData) (*ExportResult, error) {
	header, rowIDs, synthesized := exportRowIdentifiers(data)

	// Convert FileData to pkg/csv.Data
	csvData := &pkgcsv.Data{
		Headers:        data.Headers,
		RowNames:       rowIDs,
		RowNamesHeader: header,
		StringData:     data.Data,
		Rows:           data.Rows,
		Columns:        data.Columns,
	}

	// Use pkg/csv writer with appropriate options
	opts := pkgcsv.DefaultOptions()
	opts.HasHeaders = true
	opts.HasRowNames = len(rowIDs) > 0

	// Write using the unified CSV writer
	if err := pkgcsv.Save(w, csvData, opts); err != nil {
		return nil, fmt.Errorf("error writing CSV file: %w", err)
	}

	result := &ExportResult{}
	if synthesized {
		result.SyntheticRowIDHeader = header
	}
	return result, nil
}

// SaveExcel saves data to an Excel file
func (a *App) SaveExcel(data *FileData) (*ExportResult, error) {
	// Show save dialog
	selection, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:           "Save Excel File",
		DefaultFilename: "exported_data.xlsx",
		Filters: []wailsruntime.FileFilter{
			{
				DisplayName: "Excel Files (*.xlsx)",
				Pattern:     "*.xlsx",
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("error showing save dialog: %w", err)
	}
	if selection == "" {
		return nil, fmt.Errorf("no file selected")
	}

	f, result, err := buildExcelExport(data)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// Save file
	if err := f.SaveAs(selection); err != nil {
		return nil, fmt.Errorf("failed to save Excel file: %w", err)
	}

	wailsruntime.EventsEmit(a.ctx, "file-saved", filepath.Base(selection))
	a.markClean()
	return result, nil
}

// buildExcelExport assembles the workbook. Split out of SaveExcel for the same
// reason as writeCSVExport: the dialog is untestable, and the row-identifier
// rule has to be checked on every export path or it silently holds on only one.
func buildExcelExport(data *FileData) (*excelize.File, *ExportResult, error) {
	// Create new Excel file
	f := excelize.NewFile()

	// Create a new sheet
	sheetName := "Sheet1"
	index, err := f.NewSheet(sheetName)
	if err != nil {
		_ = f.Close()
		return nil, nil, fmt.Errorf("failed to create sheet: %w", err)
	}

	// Write headers with row names if present
	rowNameHeader, rowIDs, synthesized := exportRowIdentifiers(data)
	headers := data.Headers
	if len(rowIDs) > 0 {
		// Carry the row-name column's own header through. "RowName" stays the
		// fallback for files that had no name there, so existing exports of the
		// blank-header convention are unchanged (#859). An invented column is
		// never blank, so that fallback now applies only to a file's own names.
		if rowNameHeader == "" {
			rowNameHeader = "RowName"
		}
		headers = append([]string{rowNameHeader}, headers...)
	}

	for i, header := range headers {
		cell, err := excelize.CoordinatesToCellName(i+1, 1)
		if err != nil {
			_ = f.Close()
			return nil, nil, fmt.Errorf("failed to get cell coordinate: %w", err)
		}
		f.SetCellValue(sheetName, cell, header)

		// Style headers
		style, err := f.NewStyle(&excelize.Style{
			Font: &excelize.Font{
				Bold: true,
			},
			Fill: excelize.Fill{
				Type:    "pattern",
				Pattern: 1,
				Color:   []string{"#E0E0E0"},
			},
		})
		if err == nil {
			f.SetCellStyle(sheetName, cell, cell, style)
		}
	}

	// Write data rows
	for rowIdx, row := range data.Data {
		excelRow := rowIdx + 2 // Excel rows are 1-indexed, plus header row

		// Write row name if present
		colOffset := 0
		if rowIdx < len(rowIDs) {
			cell, err := excelize.CoordinatesToCellName(1, excelRow)
			if err == nil {
				f.SetCellValue(sheetName, cell, rowIDs[rowIdx])
			}
			colOffset = 1
		}

		// Write data cells
		for colIdx, value := range row {
			cell, err := excelize.CoordinatesToCellName(colIdx+1+colOffset, excelRow)
			if err != nil {
				continue
			}

			// Try to convert to number if possible
			if num, err := strconv.ParseFloat(value, 64); err == nil && value != "" {
				f.SetCellValue(sheetName, cell, num)
			} else {
				f.SetCellValue(sheetName, cell, value)
			}

			// Apply column type styling
			if data.ColumnTypes != nil {
				header := data.Headers[colIdx]
				if colType, exists := data.ColumnTypes[header]; exists {
					var style int
					switch colType {
					case "target":
						// Light yellow background for target columns
						style, _ = f.NewStyle(&excelize.Style{
							Fill: excelize.Fill{
								Type:    "pattern",
								Pattern: 1,
								Color:   []string{"#FFFFCC"},
							},
						})
					case "categorical":
						// Light blue background for categorical columns
						style, _ = f.NewStyle(&excelize.Style{
							Fill: excelize.Fill{
								Type:    "pattern",
								Pattern: 1,
								Color:   []string{"#E6F3FF"},
							},
						})
					}
					if style > 0 {
						f.SetCellStyle(sheetName, cell, cell, style)
					}
				}
			}
		}
	}

	// Auto-fit columns
	for i := 0; i < len(headers); i++ {
		col, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(sheetName, col, col, 12)
	}

	// Set active sheet
	f.SetActiveSheet(index)

	result := &ExportResult{}
	if synthesized {
		result.SyntheticRowIDHeader = rowNameHeader
	}
	return f, result, nil
}
