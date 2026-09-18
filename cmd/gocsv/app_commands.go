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

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// UndoRedoState represents the current state of undo/redo
type UndoRedoState struct {
	CanUndo    bool     `json:"canUndo"`
	CanRedo    bool     `json:"canRedo"`
	History    []string `json:"history"`
	CurrentPos int      `json:"currentPos"`
}

// GetUndoRedoState returns the current undo/redo state
func (a *App) GetUndoRedoState() *UndoRedoState {
	history, current := a.history.GetHistory()
	return &UndoRedoState{
		CanUndo:    a.history.CanUndo(),
		CanRedo:    a.history.CanRedo(),
		History:    history,
		CurrentPos: current,
	}
}

// Undo performs an undo operation
func (a *App) Undo(data *FileData) (*FileData, error) {
	if err := a.history.Undo(data); err != nil {
		return nil, err
	}
	a.markDirty()
	if a.ctx != nil {
		wailsruntime.EventsEmit(a.ctx, "undo-redo-state-changed", a.GetUndoRedoState())
	}
	return data, nil
}

// Redo performs a redo operation
func (a *App) Redo(data *FileData) (*FileData, error) {
	if err := a.history.Redo(data); err != nil {
		return nil, err
	}
	a.markDirty()
	if a.ctx != nil {
		wailsruntime.EventsEmit(a.ctx, "undo-redo-state-changed", a.GetUndoRedoState())
	}
	return data, nil
}

// ClearHistory clears the command history
func (a *App) ClearHistory() {
	a.history.Clear()
	if a.ctx != nil {
		wailsruntime.EventsEmit(a.ctx, "undo-redo-state-changed", a.GetUndoRedoState())
	}
}

// Command Execution Methods
// ========================
// The following Execute* methods provide undo/redo support for all data operations.
// They follow a consistent pattern:
// 1. Create a command object with the current state
// 2. Execute the command through the history manager
// 3. Update the current data reference
// 4. Emit state change event for UI updates
//
// All methods return the updated FileData to ensure the frontend stays synchronized.

// executeCommand is a helper that executes a command and handles common operations
func (a *App) executeCommand(cmd Command, data *FileData, operation string) (*FileData, error) {
	if err := a.history.Execute(cmd, data); err != nil {
		return nil, fmt.Errorf("%s: %w", operation, err)
	}
	a.currentData = data // Store the current data
	a.markDirty()

	if a.ctx != nil {
		wailsruntime.EventsEmit(a.ctx, "undo-redo-state-changed", a.GetUndoRedoState())
	}
	return data, nil
}

// ExecuteCellEdit executes a cell edit command
func (a *App) ExecuteCellEdit(data *FileData, row, col int, oldValue, newValue string) (*FileData, error) {
	cmd := NewCellEditCommand(row, col, oldValue, newValue)
	return a.executeCommand(cmd, data, "edit cell")
}

// ExecuteHeaderEdit executes a header edit command
func (a *App) ExecuteHeaderEdit(data *FileData, col int, oldValue, newValue string) (*FileData, error) {
	cmd := NewHeaderEditCommand(col, oldValue, newValue)
	return a.executeCommand(cmd, data, "edit header")
}

// ExecuteFillMissingValues executes a fill missing values command
func (a *App) ExecuteFillMissingValues(data *FileData, strategy, column, customValue string) (*FileData, error) {
	cmd := NewFillMissingValuesCommand(a, data, strategy, column, customValue)
	return a.executeCommand(cmd, data, "fill missing values")
}

// ExecuteDeleteRows deletes multiple rows with undo support
func (a *App) ExecuteDeleteRows(data *FileData, rowIndices []int) (*FileData, error) {
	cmd := NewDeleteRowsCommand(data, rowIndices)
	return a.executeCommand(cmd, data, "delete rows")
}

// ExecuteDeleteColumns deletes multiple columns with undo support
func (a *App) ExecuteDeleteColumns(data *FileData, colIndices []int) (*FileData, error) {
	cmd := NewDeleteColumnsCommand(a, data, colIndices)
	return a.executeCommand(cmd, data, "delete columns")
}

// ExecuteInsertRow inserts a new row with undo support
func (a *App) ExecuteInsertRow(data *FileData, index int) (*FileData, error) {
	cmd := NewInsertRowCommand(a, data, index)
	return a.executeCommand(cmd, data, "insert row")
}

// ExecuteInsertColumn inserts a new column with undo support
func (a *App) ExecuteInsertColumn(data *FileData, index int, name string) (*FileData, error) {
	cmd := NewInsertColumnCommand(a, data, index, name)
	return a.executeCommand(cmd, data, "insert column")
}

// ExecuteToggleTargetColumn toggles the #target suffix on a column with undo support
func (a *App) ExecuteToggleTargetColumn(data *FileData, colIndex int) (*FileData, error) {
	// Validate bounds
	if colIndex < 0 || colIndex >= len(data.Headers) {
		return nil, fmt.Errorf("toggle target column: invalid column index: %d", colIndex)
	}

	cmd := NewToggleTargetColumnCommand(a, data, colIndex)
	if cmd == nil {
		return nil, fmt.Errorf("toggle target column: invalid column index: %d", colIndex)
	}

	return a.executeCommand(cmd, data, "toggle target column")
}

// ExecuteToggleCategoryColumn adds or removes the #category marker on a column,
// with undo support.
//
// Marking a column says its values are labels rather than measurements, which is
// the one thing the parser cannot work out for itself: a processing code holding
// 1..11 parses as numeric and would otherwise enter the PCA as a quantity.
func (a *App) ExecuteToggleCategoryColumn(data *FileData, colIndex int) (*FileData, error) {
	if colIndex < 0 || colIndex >= len(data.Headers) {
		return nil, fmt.Errorf("toggle category column: invalid column index: %d", colIndex)
	}

	cmd := NewToggleCategoryColumnCommand(a, data, colIndex)
	if cmd == nil {
		return nil, fmt.Errorf("toggle category column: invalid column index: %d", colIndex)
	}

	return a.executeCommand(cmd, data, "toggle category column")
}

// ExecuteSetRowNames makes a column the row-name column, with undo support.
//
// The uniqueness requirement is enforced here rather than only in the dialog,
// so it holds for any caller. The frontend disables the menu item with the same
// reason via CanUseAsRowNames, but that is a courtesy, not the guard.
func (a *App) ExecuteSetRowNames(data *FileData, colIndex int) (*FileData, error) {
	cmd, err := NewSetRowNamesCommand(a, data, colIndex)
	if err != nil {
		return nil, fmt.Errorf("set row names: %w", err)
	}
	return a.executeCommand(cmd, data, "set row names")
}

// ExecuteAddRowNumbers numbers the rows from start in steps of increment, with
// undo support. start = 1 and increment = 1 give the plain sequence 1..n.
//
// For datasets where nothing can serve as an identifier: every column repeats,
// and no combination of them is unique either.
func (a *App) ExecuteAddRowNumbers(data *FileData, start, increment int) (*FileData, error) {
	cmd, err := NewAddRowNumbersCommand(a, data, start, increment)
	if err != nil {
		return nil, fmt.Errorf("add row numbers: %w", err)
	}
	return a.executeCommand(cmd, data, "add row numbers")
}

// ExecuteMoveRowNamesIntoTable turns the row-name column back into an ordinary
// column, with undo support.
func (a *App) ExecuteMoveRowNamesIntoTable(data *FileData) (*FileData, error) {
	cmd, err := NewMoveRowNamesIntoTableCommand(a, data)
	if err != nil {
		return nil, fmt.Errorf("move row names into table: %w", err)
	}
	return a.executeCommand(cmd, data, "move row names into table")
}

// ExecuteTranspose exchanges rows and columns, with undo support.
func (a *App) ExecuteTranspose(data *FileData) (*FileData, error) {
	cmd, err := NewTransposeCommand(a, data)
	if err != nil {
		return nil, fmt.Errorf("transpose: %w", err)
	}
	return a.executeCommand(cmd, data, "transpose")
}

// ExecuteFilterRows keeps or removes the rows a condition selects, with undo
// support.
func (a *App) ExecuteFilterRows(data *FileData, condition FilterCondition) (*FileData, error) {
	cmd, err := NewFilterRowsCommand(a, data, condition)
	if err != nil {
		return nil, fmt.Errorf("filter rows: %w", err)
	}
	return a.executeCommand(cmd, data, "filter rows")
}

// ExecuteAggregateRows collapses each group of rows to one, with undo support.
func (a *App) ExecuteAggregateRows(data *FileData, options AggregateOptions) (*FileData, error) {
	cmd, err := NewAggregateRowsCommand(a, data, options)
	if err != nil {
		return nil, fmt.Errorf("aggregate rows: %w", err)
	}
	return a.executeCommand(cmd, data, "aggregate rows")
}

// ExecuteReorderColumns rearranges the columns, with undo support.
//
// order[i] is the index, in the columns as they are now, of the column that
// should end up at position i.
func (a *App) ExecuteReorderColumns(data *FileData, order []int) (*FileData, error) {
	cmd, err := NewReorderColumnsCommand(a, data, order)
	if err != nil {
		return nil, fmt.Errorf("reorder columns: %w", err)
	}
	return a.executeCommand(cmd, data, "reorder columns")
}

// ExecuteDuplicateRows duplicates selected rows with undo support
func (a *App) ExecuteDuplicateRows(data *FileData, rowIndices []int) (*FileData, error) {
	if len(rowIndices) == 0 {
		return nil, fmt.Errorf("duplicate rows: no rows selected for duplication")
	}

	cmd := NewDuplicateRowCommand(a, data, rowIndices)
	return a.executeCommand(cmd, data, "duplicate rows")
}
