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

	"github.com/bitjungle/gopca/pkg/types"
)

// SetRowNamesCommand promotes a column to be the row-name column.
//
// The operation is a swap, not a move: whatever was serving as row names comes
// back as column 0, carrying the header it was read with. Nothing is discarded,
// which is what makes the menu item safe to try -- correcting a bad guess by
// the loader is the reason it exists, and an irreversible correction is not
// much of one. It is the same principle applied to one-hot encoding in #854.
type SetRowNamesCommand struct {
	app      *App
	colIndex int

	// Everything needed to put the world back.
	prevRowNames       []string
	prevRowNamesHeader string
	promotedHeader     string
	promotedValues     []string
	promotedType       string
	promotedCategories []string
	promotedTargets    []types.JSONFloat64
	demotedHeader      string // "" when there were no previous row names
}

// NewSetRowNamesCommand captures the pre-state. It returns an error rather than
// a nil command so the caller can report why.
func NewSetRowNamesCommand(app *App, data *FileData, colIndex int) (*SetRowNamesCommand, error) {
	if data == nil || colIndex < 0 || colIndex >= len(data.Headers) {
		return nil, fmt.Errorf("invalid column index: %d", colIndex)
	}

	values := columnValues(data, colIndex)
	if check := checkRowNameCandidate(values); !check.OK {
		return nil, fmt.Errorf("column %q cannot be used as row names: %s",
			data.Headers[colIndex], check.Reason)
	}

	header := data.Headers[colIndex]
	cmd := &SetRowNamesCommand{
		app:                app,
		colIndex:           colIndex,
		prevRowNames:       append([]string(nil), data.RowNames...),
		prevRowNamesHeader: data.RowNamesHeader,
		promotedHeader:     header,
		promotedValues:     values,
		promotedType:       data.ColumnTypes[header],
	}
	if categories, ok := data.CategoricalColumns[header]; ok {
		cmd.promotedCategories = append([]string(nil), categories...)
	}
	if targets, ok := data.NumericTargetColumns[header]; ok {
		cmd.promotedTargets = append([]types.JSONFloat64(nil), targets...)
	}
	return cmd, nil
}

// Execute promotes the column and demotes the previous row names.
func (c *SetRowNamesCommand) Execute(data *FileData) error {
	if c.colIndex >= len(data.Headers) {
		return fmt.Errorf("invalid column index: %d", c.colIndex)
	}

	// Take the column out first, so the index still refers to what it did when
	// the command was built. Inserting the demoted column beforehand would
	// shift everything right by one.
	removeColumnAt(data, c.colIndex)
	delete(data.ColumnTypes, c.promotedHeader)
	delete(data.CategoricalColumns, c.promotedHeader)
	delete(data.NumericTargetColumns, c.promotedHeader)

	data.RowNames = append([]string(nil), c.promotedValues...)
	data.RowNamesHeader = c.promotedHeader

	// The previous row names become column 0 -- where they came from, and where
	// they would be written on export.
	if len(c.prevRowNames) > 0 {
		c.demotedHeader = uniqueHeader(data.Headers, defaultRowNameHeader(c.prevRowNamesHeader))
		insertColumnAt(data, 0, c.demotedHeader, c.prevRowNames)
		classifyColumn(data, c.demotedHeader, c.prevRowNames)
	} else {
		c.demotedHeader = ""
	}

	data.Columns = len(data.Headers)
	return nil
}

// Undo restores the column and the previous row names.
func (c *SetRowNamesCommand) Undo(data *FileData) error {
	if c.demotedHeader != "" {
		removeColumnAt(data, 0)
		delete(data.ColumnTypes, c.demotedHeader)
		delete(data.CategoricalColumns, c.demotedHeader)
	}

	insertColumnAt(data, c.colIndex, c.promotedHeader, c.promotedValues)
	if c.promotedType != "" {
		data.ColumnTypes[c.promotedHeader] = c.promotedType
	}
	if c.promotedCategories != nil {
		if data.CategoricalColumns == nil {
			data.CategoricalColumns = map[string][]string{}
		}
		data.CategoricalColumns[c.promotedHeader] = c.promotedCategories
	}
	if c.promotedTargets != nil {
		if data.NumericTargetColumns == nil {
			data.NumericTargetColumns = map[string][]types.JSONFloat64{}
		}
		data.NumericTargetColumns[c.promotedHeader] = c.promotedTargets
	}

	data.RowNames = append([]string(nil), c.prevRowNames...)
	data.RowNamesHeader = c.prevRowNamesHeader
	data.Columns = len(data.Headers)
	return nil
}

// GetDescription implements Command.
func (c *SetRowNamesCommand) GetDescription() string {
	return fmt.Sprintf("Use '%s' as row names", c.promotedHeader)
}

// MoveRowNamesIntoTableCommand turns the row-name column back into an ordinary
// column, leaving the table without row names.
type MoveRowNamesIntoTableCommand struct {
	app *App

	prevRowNames       []string
	prevRowNamesHeader string
	insertedHeader     string
}

// NewMoveRowNamesIntoTableCommand captures the pre-state.
func NewMoveRowNamesIntoTableCommand(app *App, data *FileData) (*MoveRowNamesIntoTableCommand, error) {
	if data == nil || len(data.RowNames) == 0 {
		return nil, fmt.Errorf("this file has no row names")
	}
	return &MoveRowNamesIntoTableCommand{
		app:                app,
		prevRowNames:       append([]string(nil), data.RowNames...),
		prevRowNamesHeader: data.RowNamesHeader,
	}, nil
}

// Execute moves the row names into column 0.
//
// Numeric row names get a #category marker, because they are identifiers and
// must not become a variable. Row numbers 1..n have variance enormously larger
// than any real measurement -- on a file of weight fractions they take 100% of
// PC1 and annihilate every element -- so a user who numbers the rows and then
// moves them into the table would silently destroy the analysis (#942).
//
// The marker is used rather than the in-memory column type because it is the
// only form that survives export: the hazard is a CSV that is wrong when it is
// opened somewhere else, and a type held on FileData does not travel with the
// file. It also says what the values are rather than merely hiding them, and one
// click on Remove Category Flag reverses it if the user disagrees.
//
// Text row names need nothing: they are already categorical.
func (c *MoveRowNamesIntoTableCommand) Execute(data *FileData) error {
	base := defaultRowNameHeader(c.prevRowNamesHeader)
	numeric := allNumeric(c.prevRowNames)
	if numeric {
		c.insertedHeader = uniqueMarkedHeader(data.Headers, stripMarkers(base), "#category")
	} else {
		c.insertedHeader = uniqueHeader(data.Headers, base)
	}
	insertColumnAt(data, 0, c.insertedHeader, c.prevRowNames)

	if numeric {
		// Both maps, for the reason ToggleCategoryColumnCommand documents: a
		// column categorical in one and absent from the other is half converted,
		// and the encoders will not see it. classifyColumn is deliberately not
		// used here -- it reads the values, and the values are numbers.
		if data.ColumnTypes == nil {
			data.ColumnTypes = map[string]string{}
		}
		data.ColumnTypes[c.insertedHeader] = "categorical"
		if data.CategoricalColumns == nil {
			data.CategoricalColumns = map[string][]string{}
		}
		data.CategoricalColumns[c.insertedHeader] = append([]string(nil), c.prevRowNames...)
	} else {
		classifyColumn(data, c.insertedHeader, c.prevRowNames)
	}

	data.RowNames = nil
	data.RowNamesHeader = ""
	data.Columns = len(data.Headers)
	return nil
}

// Undo puts the row names back.
func (c *MoveRowNamesIntoTableCommand) Undo(data *FileData) error {
	removeColumnAt(data, 0)
	delete(data.ColumnTypes, c.insertedHeader)
	delete(data.CategoricalColumns, c.insertedHeader)

	data.RowNames = append([]string(nil), c.prevRowNames...)
	data.RowNamesHeader = c.prevRowNamesHeader
	data.Columns = len(data.Headers)
	return nil
}

// GetDescription implements Command.
func (c *MoveRowNamesIntoTableCommand) GetDescription() string {
	return "Move row names into the table"
}

// defaultRowNameHeader supplies a name for a row-name column that never had
// one. A blank header is the common CSV convention, but a blank *column* header
// in the grid is not addressable -- it cannot be referred to in a transform
// dialog or a validation message.
func defaultRowNameHeader(header string) string {
	if strings.TrimSpace(header) == "" {
		return "RowName"
	}
	return header
}

// uniqueHeader returns name, suffixed until it collides with nothing in taken.
func uniqueHeader(taken []string, name string) string {
	inUse := make(map[string]bool, len(taken))
	for _, header := range taken {
		inUse[header] = true
	}
	candidate := name
	for i := 2; inUse[candidate]; i++ {
		candidate = fmt.Sprintf("%s_%d", name, i)
	}
	return candidate
}

// uniqueMarkedHeader returns a header that ends in marker and collides with
// nothing in taken, putting the uniqueness suffix before the marker.
//
// uniqueHeader appends its suffix at the end, which is fine for a plain name
// and wrong for a marked one: asked for "Sample_ID#category" against a file that
// already has that column, it returns "Sample_ID#category_2". A marker is
// recognised by its suffix, so that header reads back as an ordinary numeric
// column -- and since the marker is there to survive export, the collision
// would quietly restore the very hazard it prevents (#942).
func uniqueMarkedHeader(taken []string, base, marker string) string {
	inUse := make(map[string]bool, len(taken))
	for _, header := range taken {
		inUse[header] = true
	}
	candidate := base + marker
	for i := 2; inUse[candidate]; i++ {
		candidate = fmt.Sprintf("%s_%d%s", base, i, marker)
	}
	return candidate
}

// insertColumnAt inserts a column with the given header and values at index.
func insertColumnAt(data *FileData, index int, header string, values []string) {
	if index < 0 {
		index = 0
	}
	if index > len(data.Headers) {
		index = len(data.Headers)
	}

	headers := make([]string, 0, len(data.Headers)+1)
	headers = append(headers, data.Headers[:index]...)
	headers = append(headers, header)
	headers = append(headers, data.Headers[index:]...)
	data.Headers = headers

	for i := range data.Data {
		value := ""
		if i < len(values) {
			value = values[i]
		}
		at := index
		if at > len(data.Data[i]) {
			at = len(data.Data[i])
		}
		row := make([]string, 0, len(data.Data[i])+1)
		row = append(row, data.Data[i][:at]...)
		row = append(row, value)
		row = append(row, data.Data[i][at:]...)
		data.Data[i] = row
	}
	data.Columns = len(data.Headers)
}

// removeColumnAt drops the column at index from the headers and every row.
//
// Columns is maintained here rather than left to the caller. Every existing
// caller happened to set it afterwards, so the obligation was invisible until a
// new one did not: the grid then reported a column count that no longer matched
// the headers.
func removeColumnAt(data *FileData, index int) {
	if index < 0 || index >= len(data.Headers) {
		return
	}
	data.Headers = append(data.Headers[:index:index], data.Headers[index+1:]...)
	for i := range data.Data {
		if index < len(data.Data[i]) {
			data.Data[i] = append(data.Data[i][:index:index], data.Data[i][index+1:]...)
		}
	}
	data.Columns = len(data.Headers)
}

// allNumeric reports whether every non-blank value parses as a number.
//
// A column has to contain at least one number to qualify, for the reason
// classifyColumn gives: starting from true and skipping blanks would call an
// all-empty column numeric, because it never meets a value that fails to parse.
func allNumeric(values []string) bool {
	numeric := false
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, err := strconv.ParseFloat(trimmed, 64); err != nil {
			return false
		}
		numeric = true
	}
	return numeric
}

// classifyColumn records the type of a column newly added to the table.
//
// Values that all parse as numbers are numeric; anything else is categorical,
// and categorical columns additionally live in their own map. This mirrors what
// the loader decides for the same values, so a column demoted out of the
// row-name slot is typed as it would have been had it been read as data.
func classifyColumn(data *FileData, header string, values []string) {
	if data.ColumnTypes == nil {
		data.ColumnTypes = map[string]string{}
	}

	// A column has to contain at least one number to be called numeric. Starting
	// from true and skipping blanks would type an all-empty column as numeric --
	// it never meets a value that fails to parse -- and PCA would then be
	// offered a variable with nothing in it.
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
		data.ColumnTypes[header] = "numeric"
		return
	}

	data.ColumnTypes[header] = "categorical"
	if data.CategoricalColumns == nil {
		data.CategoricalColumns = map[string][]string{}
	}
	data.CategoricalColumns[header] = append([]string(nil), values...)
}

// AddRowNumbersCommand gives a file row names when nothing in it can serve.
//
// Row names label the points in a scores plot, and they have to identify rows:
// present, and distinct. Some datasets carry nothing that qualifies -- every
// column repeats, and no combination of them is unique either. Until now there
// was no way to give such a file identifiers from inside GoCSV, because Insert
// Column adds an empty column and nothing fills one with a sequence.
//
// Row names are not a column: they are RowNames and RowNamesHeader on FileData,
// held out of the analysis by construction. So this does not insert anything --
// it populates those two fields directly, which is both simpler and avoids
// creating a numeric column that would enter the PCA if it were ever moved back
// into the table.
//
// Since #966 an export invents 1..n by itself when the file has nothing, so the
// plain case no longer needs a command at all. What is left for this one is the
// numbering an export cannot guess: a run that starts at 101, or steps by
// something other than 1 (#967).
type AddRowNumbersCommand struct {
	app    *App
	names  []string
	header string
}

// NewAddRowNumbersCommand refuses when the file already has row names.
//
// Overwriting existing identifiers is destructive in a way undo does not excuse:
// the user would lose labels that mean something in exchange for ordinals that
// do not. Move Row Names into Table first if that is genuinely what is wanted.
//
// start is the number given to the first row and increment the step between
// consecutive ones; 1 and 1 reproduce the plain sequence. An increment of zero
// is refused because it would give every row the same name, and row names must
// be distinct -- the rule checkRowNameCandidate enforces everywhere else. A
// negative increment is allowed: it counts down, and the names stay distinct.
func NewAddRowNumbersCommand(app *App, data *FileData, start, increment int) (*AddRowNumbersCommand, error) {
	if data == nil || len(data.Data) == 0 {
		return nil, fmt.Errorf("this file has no rows")
	}
	if len(data.RowNames) > 0 {
		return nil, fmt.Errorf("this file already has row names (%q). Use Move Row Names "+
			"into Table first if you want to replace them", defaultRowNameHeader(data.RowNamesHeader))
	}
	if increment == 0 {
		return nil, fmt.Errorf("the increment cannot be 0: every row would get the same " +
			"number, and row names have to tell the rows apart")
	}

	names := make([]string, len(data.Data))
	for i := range data.Data {
		names[i] = strconv.Itoa(start + i*increment)
	}
	return &AddRowNumbersCommand{
		app:    app,
		names:  names,
		header: uniqueHeader(data.Headers, syntheticRowIDHeader),
	}, nil
}

// Execute sets the generated names.
func (c *AddRowNumbersCommand) Execute(data *FileData) error {
	data.RowNames = append([]string(nil), c.names...)
	data.RowNamesHeader = c.header
	return nil
}

// Undo removes them again, returning the file to having none.
func (c *AddRowNumbersCommand) Undo(data *FileData) error {
	data.RowNames = nil
	data.RowNamesHeader = ""
	return nil
}

// GetDescription implements Command.
func (c *AddRowNumbersCommand) GetDescription() string {
	return fmt.Sprintf("Number the rows as '%s'", c.header)
}
