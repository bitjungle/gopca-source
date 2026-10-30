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

	"github.com/bitjungle/gopca/pkg/transform"
	"github.com/bitjungle/gopca/pkg/types"
)

// TransformationType represents the type of transformation
type TransformationType string

const (
	TransformLog         TransformationType = "log"
	TransformSqrt        TransformationType = "sqrt"
	TransformSquare      TransformationType = "square"
	TransformStandardize TransformationType = "standardize"
	TransformMinMax      TransformationType = "minmax"
	TransformBin         TransformationType = "bin"
	TransformOneHot      TransformationType = "onehot"
	TransformOrdinal     TransformationType = "ordinal"
	TransformSplit       TransformationType = "split"
	TransformCombine     TransformationType = "combine"
	TransformCLR         TransformationType = "clr"
	TransformBoxCox      TransformationType = "boxcox"
	TransformYeoJohnson  TransformationType = "yeojohnson"
)

// TransformOptions represents options for data transformation
type TransformOptions struct {
	Type     TransformationType `json:"type"`
	Columns  []string           `json:"columns"`
	BinCount int                `json:"binCount,omitempty"` // For binning
	MinValue float64            `json:"minValue,omitempty"` // For min-max scaling
	MaxValue float64            `json:"maxValue,omitempty"` // For min-max scaling

	// RemoveOriginal drops the source column after one-hot encoding it.
	// Absent from the JSON payload means false, i.e. the column is kept --
	// see transform.Options for why the flag is spelled this way round.
	RemoveOriginal bool `json:"removeOriginal,omitempty"` // For one-hot and ordinal encoding

	// CategoryOrder maps a column name to its category values in the order
	// their integer codes should follow. For ordinal encoding.
	CategoryOrder map[string][]string `json:"categoryOrder,omitempty"`

	// Delimiter is the literal string Split divides on.
	Delimiter string `json:"delimiter,omitempty"`
	// Separator joins the values Combine produces; empty is a valid choice.
	Separator string `json:"separator,omitempty"`
	// NewColumnName names Combine's result; empty means generate one.
	NewColumnName string `json:"newColumnName,omitempty"`
	// ZeroReplacement substitutes zeros before the CLR transform. Zero or
	// absent means refuse rather than substitute.
	ZeroReplacement float64 `json:"zeroReplacement,omitempty"`
	// Lambda fixes the power-transform parameter. Nil estimates it; zero is a
	// meaningful value (the logarithm), so a pointer is required.
	Lambda *float64 `json:"lambda,omitempty"`
}

// TransformationResult represents the result of a transformation
type TransformationResult struct {
	Success            bool      `json:"success"`
	TransformedColumns []string  `json:"transformedColumns"`
	NewColumns         []string  `json:"newColumns,omitempty"`
	Messages           []string  `json:"messages"`
	Data               *FileData `json:"data"`
}

// ApplyTransformation applies a transformation to the data with undo support
func (a *App) ApplyTransformation(data *FileData, options TransformOptions) (*TransformationResult, error) {
	// Use the command pattern for undo support
	cmd := NewTransformCommand(a, data, options)
	if err := a.history.Execute(cmd, data); err != nil {
		return nil, fmt.Errorf("apply transformation: %w", err)
	}
	a.currentData = data // Store the current data
	a.markDirty()
	a.emit(eventUndoRedoStateChanged, a.GetUndoRedoState())

	// Return the transformation result
	return cmd.result, nil
}

// applyTransformationInternal delegates to pkg/transform and maps the result
// back into the FileData-based TransformationResult expected by the Wails layer.
func (a *App) applyTransformationInternal(data *FileData, options TransformOptions) (*TransformationResult, error) {
	if data == nil || len(data.Data) == 0 {
		return nil, fmt.Errorf("no data to transform")
	}

	in := transform.Input{
		Data:               data.Data,
		Headers:            data.Headers,
		ColumnTypes:        data.ColumnTypes,
		CategoricalColumns: data.CategoricalColumns,
		Rows:               data.Rows,
		Columns:            data.Columns,
	}
	opts := transform.Options{
		Type:     transform.Type(options.Type),
		Columns:  options.Columns,
		BinCount: options.BinCount,
		MinValue: options.MinValue,
		MaxValue: options.MaxValue,

		RemoveOriginal: options.RemoveOriginal,
		CategoryOrder:  options.CategoryOrder,

		Delimiter:     options.Delimiter,
		Separator:     options.Separator,
		NewColumnName: options.NewColumnName,

		ZeroReplacement: options.ZeroReplacement,
		Lambda:          options.Lambda,
	}

	res, err := transform.Apply(in, opts)
	if err != nil {
		return nil, err
	}

	newData := &FileData{
		Headers:              res.Headers,
		Data:                 res.Data,
		Rows:                 data.Rows,
		Columns:              res.Columns,
		CategoricalColumns:   res.CategoricalColumns,
		NumericTargetColumns: make(map[string][]types.JSONFloat64),
		ColumnTypes:          res.ColumnTypes,
	}
	if data.RowNames != nil {
		newData.RowNames = make([]string, len(data.RowNames))
		copy(newData.RowNames, data.RowNames)
	}
	// Carry over any numeric target columns untouched.
	for k, v := range data.NumericTargetColumns {
		newData.NumericTargetColumns[k] = v
	}

	return &TransformationResult{
		Success:            true,
		TransformedColumns: res.TransformedColumns,
		NewColumns:         res.NewColumns,
		Messages:           res.Messages,
		Data:               newData,
	}, nil
}

// GetTransformableColumns returns columns eligible for the given transformation type.
func (a *App) GetTransformableColumns(data *FileData, transformType TransformationType) []string {
	in := transform.Input{
		Data:        data.Data,
		Headers:     data.Headers,
		ColumnTypes: data.ColumnTypes,
		Rows:        data.Rows,
		Columns:     data.Columns,
	}
	return transform.GetTransformableColumns(in, transform.Type(transformType))
}

// SuggestCategoryOrder returns the distinct values of a categorical column in
// the order the ordinal encoder should assign codes in.
//
// The dialog pre-fills its ordering control from this. Where the values form a
// recognised scale -- lav/middels/høy, low/medium/high, weekdays, months -- they
// come back in that scale's order; otherwise alphabetically, which is what
// scikit-learn's LabelEncoder uses. Either way the user can reorder them, so
// this is a starting point rather than a decision.
func (a *App) SuggestCategoryOrder(data *FileData, column string) []string {
	if data == nil {
		return []string{}
	}

	colIndex := -1
	for i, header := range data.Headers {
		if header == column {
			colIndex = i
			break
		}
	}
	if colIndex == -1 {
		return []string{}
	}

	values := make([]string, 0, len(data.Data))
	for _, row := range data.Data {
		if colIndex < len(row) {
			values = append(values, row[colIndex])
		}
	}

	suggestion := transform.SuggestCategoryOrder(values)
	if suggestion == nil {
		// Wails marshals a nil slice as null, which the dialog would have to
		// guard against; an empty list is the same thing without the special case.
		return []string{}
	}
	return suggestion
}
