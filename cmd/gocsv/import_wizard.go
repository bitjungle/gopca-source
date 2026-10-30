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
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	pkgcsv "github.com/bitjungle/gopca/pkg/csv"

	"github.com/bitjungle/gopca/pkg/types"
	"github.com/xuri/excelize/v2"
)

// ImportFileInfo represents information about a file to be imported
type ImportFileInfo struct {
	FileName   string   `json:"fileName"`
	FilePath   string   `json:"filePath"`
	FileSize   int64    `json:"fileSize"`
	FileFormat string   `json:"fileFormat"` // "csv", "tsv", "excel"
	Encoding   string   `json:"encoding"`
	Sheets     []string `json:"sheets,omitempty"` // For Excel files
	Error      string   `json:"error,omitempty"`
}

// ImportOptions represents options for importing a file
type ImportOptions struct {
	Format          string `json:"format"`
	Delimiter       string `json:"delimiter,omitempty"` // For CSV/TSV
	HasHeaders      bool   `json:"hasHeaders"`
	HeaderRow       int    `json:"headerRow"`                 // 0-based
	Sheet           string `json:"sheet,omitempty"`           // For Excel
	RowNameColumn   int    `json:"rowNameColumn"`             // -1 if none, 0-based
	SkipRows        int    `json:"skipRows"`                  // Number of rows to skip from top
	MaxRows         int    `json:"maxRows"`                   // 0 for all rows
	SelectedColumns []int  `json:"selectedColumns,omitempty"` // Indices of columns to import
}

// FilePreview represents a preview of file contents
type FilePreview struct {
	Headers     []string   `json:"headers"`
	Data        [][]string `json:"data"`        // First N rows
	ColumnTypes []string   `json:"columnTypes"` // Detected types
	Delimiter   string     `json:"delimiter"`   // Detected delimiter
	TotalRows   int        `json:"totalRows"`
	TotalCols   int        `json:"totalCols"`
	Issues      []string   `json:"issues,omitempty"`
}

// GetFileInfo gets information about a file for the import wizard
func (a *App) GetFileInfo(filePath string) (*ImportFileInfo, error) {
	info := &ImportFileInfo{
		FilePath: filePath,
		FileName: filepath.Base(filePath),
	}

	// Get file size
	stat, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get file info: %w", err)
	}
	info.FileSize = stat.Size()

	// Detect file format
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".csv":
		info.FileFormat = "csv"
		info.Encoding = "UTF-8" // TODO: Detect encoding
	case ".tsv":
		info.FileFormat = "tsv"
		info.Encoding = "UTF-8"
	case ".xlsx", ".xls":
		info.FileFormat = "excel"
		// Get sheet names
		sheets, err := a.getExcelSheets(filePath)
		if err != nil {
			info.Error = fmt.Sprintf("Failed to read Excel sheets: %v", err)
		} else {
			info.Sheets = sheets
		}
	case ".json":
		// JSON import is not supported. Reject explicitly rather than letting a
		// .json file fall through to content-based detection (where it would be
		// misclassified as CSV). See #719.
		return nil, fmt.Errorf("JSON files are not supported by GoCSV")
	default:
		// Try to detect format by content
		info.FileFormat = a.detectFileFormat(filePath)
		info.Encoding = "UTF-8"
	}

	return info, nil
}

// PreviewFile generates a preview of the file with the given options
func (a *App) PreviewFile(filePath string, options ImportOptions) (*FilePreview, error) {
	preview := &FilePreview{
		Issues: []string{},
	}

	switch options.Format {
	case "csv", "tsv":
		return a.previewCSV(filePath, options, preview)
	case "excel":
		return a.previewExcel(filePath, options, preview)
	default:
		return nil, fmt.Errorf("unsupported format: %s", options.Format)
	}
}

// ImportFile imports a file with the given options
func (a *App) ImportFile(filePath string, options ImportOptions) (*FileData, error) {
	switch options.Format {
	case "csv", "tsv":
		return a.importCSVWithOptions(filePath, options)
	case "excel":
		return a.importExcelWithOptions(filePath, options)
	default:
		return nil, fmt.Errorf("unsupported format: %s", options.Format)
	}
}

// getExcelSheets returns the sheet names in an Excel file
func (a *App) getExcelSheets(filePath string) ([]string, error) {
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return f.GetSheetList(), nil
}

// detectFileFormat tries to detect the file format by content
func (a *App) detectFileFormat(filePath string) string {
	// Read first few bytes
	file, err := os.Open(filePath)
	if err != nil {
		return "unknown"
	}
	defer file.Close()

	// Read first 512 bytes
	buf := make([]byte, 512)
	n, _ := file.Read(buf)
	buf = buf[:n]

	// Check for Excel magic bytes
	if len(buf) >= 8 {
		if buf[0] == 0xD0 && buf[1] == 0xCF && buf[2] == 0x11 && buf[3] == 0xE0 {
			return "excel" // Old Excel format
		}
		if buf[0] == 0x50 && buf[1] == 0x4B && buf[2] == 0x03 && buf[3] == 0x04 {
			return "excel" // New Excel format (ZIP)
		}
	}

	content := string(buf)
	content = strings.TrimSpace(content)

	// JSON content is recognized but is NOT an importable format (see #719).
	// Returning "json" routes it to a clean "unsupported format" rejection instead
	// of misparsing it as CSV.
	if strings.HasPrefix(content, "{") || strings.HasPrefix(content, "[") {
		return "json"
	}

	// Check for TSV (more tabs than commas)
	tabCount := strings.Count(content, "\t")
	commaCount := strings.Count(content, ",")
	if tabCount > commaCount*2 {
		return "tsv"
	}

	// Default to CSV
	return "csv"
}

// previewCSV generates a preview of a CSV/TSV file
func (a *App) previewCSV(filePath string, options ImportOptions, preview *FilePreview) (*FilePreview, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)

	// Set delimiter
	if options.Format == "tsv" || options.Delimiter == "\t" {
		reader.Comma = '\t'
	} else if options.Delimiter != "" && len(options.Delimiter) == 1 {
		reader.Comma = rune(options.Delimiter[0])
	}

	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	// Skip rows if specified
	for i := 0; i < options.SkipRows; i++ {
		_, err := reader.Read()
		if err != nil {
			preview.Issues = append(preview.Issues, fmt.Sprintf("Failed to skip row %d: %v", i+1, err))
		}
	}

	// Read all data for analysis
	allData, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV: %w", err)
	}

	if len(allData) == 0 {
		return nil, fmt.Errorf("no data found in file")
	}

	preview.TotalRows = len(allData)
	preview.TotalCols = len(allData[0])

	// Extract headers
	if options.HasHeaders && options.HeaderRow < len(allData) {
		preview.Headers = allData[options.HeaderRow]
		// Remove header row from data
		allData = append(allData[:options.HeaderRow], allData[options.HeaderRow+1:]...)
	} else {
		// Generate default headers
		preview.Headers = make([]string, preview.TotalCols)
		for i := 0; i < preview.TotalCols; i++ {
			preview.Headers[i] = fmt.Sprintf("Column_%d", i+1)
		}
	}

	// Get preview data (first 100 rows or less)
	previewRows := 100
	if options.MaxRows > 0 && options.MaxRows < previewRows {
		previewRows = options.MaxRows
	}
	if len(allData) < previewRows {
		previewRows = len(allData)
	}

	preview.Data = allData[:previewRows]

	// Detect column types
	preview.ColumnTypes = make([]string, preview.TotalCols)
	for i := 0; i < preview.TotalCols; i++ {
		preview.ColumnTypes[i] = pkgcsv.DetectColumnType(allData, i)
	}

	// Detect delimiter if not specified
	if options.Delimiter == "" {
		if options.Format == "tsv" {
			preview.Delimiter = "\\t"
		} else {
			preview.Delimiter = ","
		}
	} else {
		preview.Delimiter = options.Delimiter
	}

	return preview, nil
}

// previewExcel generates a preview of an Excel file
func (a *App) previewExcel(filePath string, options ImportOptions, preview *FilePreview) (*FilePreview, error) {
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// Use specified sheet or first sheet
	sheet := options.Sheet
	if sheet == "" {
		sheets := f.GetSheetList()
		if len(sheets) == 0 {
			return nil, fmt.Errorf("no sheets found in Excel file")
		}
		sheet = sheets[0]
	}

	// Get all rows
	rows, err := f.GetRows(sheet)
	if err != nil {
		return nil, fmt.Errorf("failed to read sheet %s: %w", sheet, err)
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("no data found in sheet %s", sheet)
	}

	// Skip rows if specified
	if options.SkipRows > 0 && options.SkipRows < len(rows) {
		rows = rows[options.SkipRows:]
	}

	preview.TotalRows = len(rows)
	if len(rows) > 0 {
		preview.TotalCols = len(rows[0])
	}

	// Extract headers
	if options.HasHeaders && options.HeaderRow < len(rows) {
		preview.Headers = rows[options.HeaderRow]
		// Remove header row from data
		rows = append(rows[:options.HeaderRow], rows[options.HeaderRow+1:]...)
	} else {
		// Generate default headers
		preview.Headers = make([]string, preview.TotalCols)
		for i := 0; i < preview.TotalCols; i++ {
			preview.Headers[i] = fmt.Sprintf("Column_%d", i+1)
		}
	}

	// Get preview data
	previewRows := 100
	if options.MaxRows > 0 && options.MaxRows < previewRows {
		previewRows = options.MaxRows
	}
	if len(rows) < previewRows {
		previewRows = len(rows)
	}

	preview.Data = rows[:previewRows]

	// Detect column types
	preview.ColumnTypes = make([]string, preview.TotalCols)
	for i := 0; i < preview.TotalCols; i++ {
		preview.ColumnTypes[i] = pkgcsv.DetectColumnType(rows, i)
	}

	return preview, nil
}

// importCSVWithOptions imports a CSV file with specific options
func (a *App) importCSVWithOptions(filePath string, options ImportOptions) (*FileData, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)

	// Set delimiter
	if options.Format == "tsv" || options.Delimiter == "\t" {
		reader.Comma = '\t'
	} else if options.Delimiter != "" && len(options.Delimiter) == 1 {
		reader.Comma = rune(options.Delimiter[0])
	}

	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	// Skip rows if specified
	for i := 0; i < options.SkipRows; i++ {
		_, err := reader.Read()
		if err != nil {
			return nil, fmt.Errorf("failed to skip row %d: %w", i+1, err)
		}
	}

	// Read all data
	allData, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV: %w", err)
	}

	if len(allData) == 0 {
		return nil, fmt.Errorf("no data found in file")
	}

	fileData := &FileData{
		CategoricalColumns:   make(map[string][]string),
		NumericTargetColumns: make(map[string][]types.JSONFloat64),
		ColumnTypes:          make(map[string]string),
	}

	// Extract headers
	if options.HasHeaders && options.HeaderRow < len(allData) {
		fileData.Headers = allData[options.HeaderRow]
		// Remove header row from data
		allData = append(allData[:options.HeaderRow], allData[options.HeaderRow+1:]...)
	} else {
		// Generate default headers
		fileData.Headers = make([]string, len(allData[0]))
		for i := 0; i < len(allData[0]); i++ {
			fileData.Headers[i] = fmt.Sprintf("Column_%d", i+1)
		}
	}

	// Extract row names if specified
	allData = extractRowNameColumn(fileData, allData, options.RowNameColumn)

	// Apply column selection if specified
	if len(options.SelectedColumns) > 0 {
		// Filter headers
		newHeaders := make([]string, len(options.SelectedColumns))
		for i, colIdx := range options.SelectedColumns {
			if colIdx < len(fileData.Headers) {
				newHeaders[i] = fileData.Headers[colIdx]
			}
		}
		fileData.Headers = newHeaders

		// Filter data
		newData := make([][]string, len(allData))
		for i, row := range allData {
			newRow := make([]string, len(options.SelectedColumns))
			for j, colIdx := range options.SelectedColumns {
				if colIdx < len(row) {
					newRow[j] = row[colIdx]
				}
			}
			newData[i] = newRow
		}
		allData = newData
	}

	// Apply max rows if specified
	if options.MaxRows > 0 && len(allData) > options.MaxRows {
		allData = allData[:options.MaxRows]
		if fileData.RowNames != nil && len(fileData.RowNames) > options.MaxRows {
			fileData.RowNames = fileData.RowNames[:options.MaxRows]
		}
	}

	fileData.Data = allData
	fileData.Rows = len(allData)
	fileData.Columns = len(fileData.Headers)

	// Detect column types and process data
	for i, header := range fileData.Headers {
		colType := pkgcsv.DetectColumnType(allData, i)
		fileData.ColumnTypes[header] = colType

		if strings.HasSuffix(header, "#target") {
			// Skip numeric target columns for now to avoid NaN JSON serialization issues
			// These columns are stored in the regular Data array and can be used for visualization
			continue
		} else if colType == "categorical" {
			// Categorical column
			values := make([]string, len(allData))
			for j, row := range allData {
				if i < len(row) {
					values[j] = row[i]
				}
			}
			fileData.CategoricalColumns[header] = values
		}
	}

	// Emit file loaded event
	a.emit(eventFileLoaded, filepath.Base(filePath))

	// Clear command history for new file
	a.ClearHistory()

	return fileData, nil
}

// importExcelWithOptions imports an Excel file with specific options
func (a *App) importExcelWithOptions(filePath string, options ImportOptions) (*FileData, error) {
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// Use specified sheet or first sheet
	sheet := options.Sheet
	if sheet == "" {
		sheets := f.GetSheetList()
		if len(sheets) == 0 {
			return nil, fmt.Errorf("no sheets found in Excel file")
		}
		sheet = sheets[0]
	}

	// Get all rows
	rows, err := f.GetRows(sheet)
	if err != nil {
		return nil, fmt.Errorf("failed to read sheet %s: %w", sheet, err)
	}

	// Process similar to CSV
	// Skip rows if specified
	if options.SkipRows > 0 && options.SkipRows < len(rows) {
		rows = rows[options.SkipRows:]
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("no data found in sheet %s", sheet)
	}

	fileData := &FileData{
		CategoricalColumns:   make(map[string][]string),
		NumericTargetColumns: make(map[string][]types.JSONFloat64),
		ColumnTypes:          make(map[string]string),
	}

	// Extract headers
	if options.HasHeaders && options.HeaderRow < len(rows) {
		fileData.Headers = rows[options.HeaderRow]
		// Remove header row from data
		rows = append(rows[:options.HeaderRow], rows[options.HeaderRow+1:]...)
	} else {
		// Generate default headers
		if len(rows) > 0 {
			fileData.Headers = make([]string, len(rows[0]))
			for i := 0; i < len(rows[0]); i++ {
				fileData.Headers[i] = fmt.Sprintf("Column_%d", i+1)
			}
		}
	}

	// Extract row names if specified
	rows = extractRowNameColumn(fileData, rows, options.RowNameColumn)

	// Apply column selection if specified
	if len(options.SelectedColumns) > 0 {
		// Filter headers
		newHeaders := make([]string, len(options.SelectedColumns))
		for i, colIdx := range options.SelectedColumns {
			if colIdx < len(fileData.Headers) {
				newHeaders[i] = fileData.Headers[colIdx]
			}
		}
		fileData.Headers = newHeaders

		// Filter data
		newRows := make([][]string, len(rows))
		for i, row := range rows {
			newRow := make([]string, len(options.SelectedColumns))
			for j, colIdx := range options.SelectedColumns {
				if colIdx < len(row) {
					newRow[j] = row[colIdx]
				}
			}
			newRows[i] = newRow
		}
		rows = newRows
	}

	// Apply max rows if specified
	if options.MaxRows > 0 && len(rows) > options.MaxRows {
		rows = rows[:options.MaxRows]
		if fileData.RowNames != nil && len(fileData.RowNames) > options.MaxRows {
			fileData.RowNames = fileData.RowNames[:options.MaxRows]
		}
	}

	fileData.Data = rows
	fileData.Rows = len(rows)
	fileData.Columns = len(fileData.Headers)

	// Detect column types
	for i, header := range fileData.Headers {
		colType := pkgcsv.DetectColumnType(rows, i)
		fileData.ColumnTypes[header] = colType

		if strings.HasSuffix(header, "#target") {
			// Skip numeric target columns for now to avoid NaN JSON serialization issues
			// These columns are stored in the regular Data array and can be used for visualization
			continue
		} else if colType == "categorical" {
			// Categorical column
			values := make([]string, len(rows))
			for j, row := range rows {
				if i < len(row) {
					values[j] = row[i]
				}
			}
			fileData.CategoricalColumns[header] = values
		}
	}

	// Emit file loaded event
	a.emit(eventFileLoaded, filepath.Base(filePath))

	// Clear command history for new file
	a.ClearHistory()

	return fileData, nil
}

// SelectFileForImport opens a file dialog and returns the selected file path
func (a *App) SelectFileForImport() (string, error) {
	if a.app == nil {
		return "", errNoUI
	}

	filePath, err := a.app.Dialog.OpenFile().
		SetTitle("Select file to import").
		AddFilter("All Supported Files", "*.csv;*.tsv;*.xlsx;*.xls").
		AddFilter("CSV Files", "*.csv").
		AddFilter("TSV Files", "*.tsv").
		AddFilter("Excel Files", "*.xlsx;*.xls").
		PromptForSingleSelection()
	if err != nil {
		return "", err
	}

	if filePath == "" {
		return "", fmt.Errorf("no file selected")
	}

	return filePath, nil
}

// extractRowNameColumn moves one column out of the table and into the row
// names, returning the remaining data.
//
// Both import paths did this with near-identical inline code. It lives here
// instead because the two length checks it has to get right are easy to
// conflate, and because neither import function can be called from a test --
// both end by emitting a Wails event, which is fatal without a live runtime.
//
// The two lengths: the data rows say whether the column exists, and the headers
// say whether it has a name. They disagree on a ragged sheet -- excelize's
// GetRows trims trailing empty cells, so a short header row leaves fewer
// headers than data columns -- and indexing the headers by a column number
// validated against the data then panics.
func extractRowNameColumn(fileData *FileData, data [][]string, rowNameColumn int) [][]string {
	// The column has to exist in *some* row, not specifically the first.
	// excelize's GetRows trims trailing empty cells per row, so on a ragged
	// sheet the first row can be shorter than later ones -- and testing only
	// data[0] would silently ignore a row-name column that is genuinely there.
	if fileData == nil || rowNameColumn < 0 || len(data) == 0 || rowNameColumn >= widestRow(data) {
		return data
	}

	fileData.RowNames = make([]string, len(data))
	for i, row := range data {
		if rowNameColumn < len(row) {
			fileData.RowNames[i] = row[rowNameColumn]
		}
	}

	// Keep the column's own name so the file writes back as it was read, and so
	// promoting a column to row names can be undone (#859).
	if rowNameColumn < len(fileData.Headers) {
		fileData.RowNamesHeader = fileData.Headers[rowNameColumn]
		fileData.Headers = append(fileData.Headers[:rowNameColumn:rowNameColumn],
			fileData.Headers[rowNameColumn+1:]...)
	}

	for i := range data {
		if rowNameColumn < len(data[i]) {
			data[i] = append(data[i][:rowNameColumn:rowNameColumn], data[i][rowNameColumn+1:]...)
		}
	}
	return data
}

// widestRow returns the length of the longest row.
func widestRow(data [][]string) int {
	widest := 0
	for _, row := range data {
		if len(row) > widest {
			widest = len(row)
		}
	}
	return widest
}
