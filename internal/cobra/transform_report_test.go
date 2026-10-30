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

package cobra

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/bitjungle/gopca/internal/core"
	pkgcsv "github.com/bitjungle/gopca/pkg/csv"
	"github.com/bitjungle/gopca/pkg/types"
)

// Three report defects found by re-measuring the tecator beta plan, each about
// what the report says rather than what it computes:
//
//   - #1036: a repeated cross-validation design printed exactly like a single
//     run, so the two were told apart only by their digits.
//   - #1037: the JSON written by `pca transform` carried everything but the
//     predicted response, and -o wrote nothing at all in the default format.
//   - #1038: with no sample inside the model's limits the report printed
//     "RMSEP 0 on the 0 samples within", a figure over an empty set.

// TestRegressReportNamesRepeats (#1036). The negative case matters as much: a
// single-repeat design must not grow a "1 repeats" that reads as if repeating
// were on.
func TestRegressReportNamesRepeats(t *testing.T) {
	for _, tc := range []struct {
		repeats int
		want    string
		forbid  string
	}{
		{3, "10-fold by row (shuffled), 3 repeats, seed 42", "1 repeats"},
		{1, "10-fold by row (shuffled), seed 42", "repeats"},
		{0, "10-fold by row (shuffled), seed 42", "repeats"},
	} {
		t.Run(fmt.Sprintf("repeats=%d", tc.repeats), func(t *testing.T) {
			result, data := minimalPCRResult()
			result.CV.Repeats = tc.repeats
			opts := cornOptions()
			opts.OutputDir = ""

			output, err := captureStdout(t, func() error {
				return outputRegressTable(result, data, opts, types.PCAConfig{MeanCenter: true})
			})
			if err != nil {
				t.Fatalf("outputRegressTable: %v", err)
			}
			if !strings.Contains(output, tc.want) {
				t.Errorf("design line should read %q; got:\n%s", tc.want, designLine(output))
			}
			if strings.Contains(output, tc.forbid) {
				t.Errorf("design line must not contain %q; got:\n%s", tc.forbid, designLine(output))
			}
		})
	}
}

// TestPredictionErrorWithNoSampleInside (#1038). Every sample outside the
// limits: the inside figure is undefined and must not print as 0, while the
// outside figure, the pooled figure and their counts stay as they were.
func TestPredictionErrorWithNoSampleInside(t *testing.T) {
	// Every error is exactly 4, so each RMSEP that is defined is exactly 4 and
	// the assertions need no tolerance.
	predicted := []float64{14, 14, 14}
	measured := []float64{10, 10, 10}
	fits := []sampleFit{
		{Known: true, T2Exceeded: true},
		{Known: true, T2Exceeded: true},
		{Known: true, T2Exceeded: true},
	}
	limits := modelLimits{HasT2: true, T2: 1}

	output, err := captureStdout(t, func() error {
		printPredictionError(predicted, measured, fits, limits)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	for _, line := range strings.Split(output, "\n") {
		if strings.Contains(line, "within the model's limits") {
			if !strings.Contains(line, "n/a") || !strings.Contains(line, "no sample is within") {
				t.Errorf("the inside line should say there is no such sample; got %q", line)
			}
			if strings.Contains(line, " 0 ") {
				t.Errorf("the inside line still prints a figure over an empty set: %q", line)
			}
		}
	}
	if !strings.Contains(output, "RMSEP           4   on the 3 outside") {
		t.Errorf("the outside figure should be unchanged, 4 over 3 samples; got:\n%s", output)
	}
	if !strings.Contains(output, "over all 3") {
		t.Errorf("the pooled line should still count every sample; got:\n%s", output)
	}

	// And with one sample inside, the figure is real and printed as before.
	fits[0] = sampleFit{Known: true}
	output, _ = captureStdout(t, func() error {
		printPredictionError(predicted, measured, fits, limits)
		return nil
	})
	if !strings.Contains(output, "RMSEP           4   on the 1 samples within") {
		t.Errorf("with one sample inside the figure should be its error, 4; got:\n%s", output)
	}
	if !strings.Contains(output, "on the 2 outside") {
		t.Errorf("the outside count should drop to 2; got:\n%s", output)
	}
}

// TestTransformJSONCarriesThePrediction (#1037). The one number a regression
// model exists to produce must be in the file, named by its response; and a
// model without a regression block must write the same file it always did, so
// nothing downstream of a plain PCA model sees a new key.
func TestTransformJSONCarriesThePrediction(t *testing.T) {
	result := &types.PCAResult{
		Scores:          types.Matrix{{1, 2}, {3, 4}},
		ComponentLabels: []string{"PC1", "PC2"},
	}
	data := &pkgcsv.Data{RowNames: []string{"r1", "r2"}}
	fits := []sampleFit{{Known: true}, {Known: true, T2Exceeded: true}}
	limits := modelLimits{HasT2: true, T2: 1}
	dir := t.TempDir()

	read := func(name string) map[string]any {
		t.Helper()
		raw, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			t.Fatalf("read: %v", err)
		}
		var doc map[string]any
		if err := json.Unmarshal(raw, &doc); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		return doc
	}

	prediction := &transformPrediction{Response: "Fat#target", Values: []float64{48.5, 61.1}}
	if _, err := captureStdout(t, func() error {
		return outputTransformJSON(result, data, "with.csv", dir, fits, limits, prediction)
	}); err != nil {
		t.Fatalf("outputTransformJSON: %v", err)
	}
	doc := read("with_transformed.json")
	if doc["response"] != "Fat#target" {
		t.Errorf("response = %v, want the model's response", doc["response"])
	}
	samples := doc["samples"].([]any)
	for i, want := range prediction.Values {
		sample := samples[i].(map[string]any)
		if got, ok := sample["predicted"].(float64); !ok || got != want {
			t.Errorf("sample %d predicted = %v, want %v", i, sample["predicted"], want)
		}
		// The verdict is still there alongside it: a prediction without its
		// "outside the model" flag is the overstatement #978 removed.
		if _, ok := sample["outside_model"].(bool); !ok {
			t.Errorf("sample %d lost its outside_model verdict", i)
		}
	}

	if _, err := captureStdout(t, func() error {
		return outputTransformJSON(result, data, "without.csv", dir, fits, limits, nil)
	}); err != nil {
		t.Fatalf("outputTransformJSON: %v", err)
	}
	doc = read("without_transformed.json")
	if _, present := doc["response"]; present {
		t.Error("a plain PCA model's file gained a response key")
	}
	for i, s := range doc["samples"].([]any) {
		if _, present := s.(map[string]any)["predicted"]; present {
			t.Errorf("sample %d of a plain PCA model's file gained a predicted key", i)
		}
	}
}

// TestTransformOutputDirWritesInTableMode (#1037), end to end: fit a PCR model,
// save it, run the command in its default format with -o, and expect the JSON
// file -- with the prediction -- to exist. Before the fix the directory was
// created and left empty, with no message.
func TestTransformOutputDirWritesInTableMode(t *testing.T) {
	modelFile, inputFile := fittedPCRModelOnDisk(t)
	outDir := filepath.Join(t.TempDir(), "results")

	opts := &TransformOptions{OutputFormat: "table", OutputDir: outDir, Delimiter: ",",
		NAValues: "NA"}
	output, err := captureStdout(t, func() error {
		return runTransform(opts, modelFile, inputFile)
	})
	if err != nil {
		t.Fatalf("runTransform: %v", err)
	}
	if !strings.Contains(output, "Transformed Scores:") {
		t.Error("the default format should still print its table")
	}
	if !strings.Contains(output, "Results saved to:") {
		t.Error("the report does not say the file was written")
	}

	raw, err := os.ReadFile(filepath.Join(outDir, "new_transformed.json"))
	if err != nil {
		t.Fatalf("-o in table mode wrote nothing: %v", err)
	}
	var doc struct {
		Response string `json:"response"`
		Samples  []struct {
			Predicted *float64 `json:"predicted"`
		} `json:"samples"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if doc.Response != "y#target" || len(doc.Samples) == 0 || doc.Samples[0].Predicted == nil {
		t.Errorf("the file does not carry the prediction: %s", strings.TrimSpace(string(raw[:min(len(raw), 200)])))
	}
}

// fittedPCRModelOnDisk fits a small PCR model on synthetic latent-structure data
// and writes it and a fresh input CSV (with the response) to a temp dir.
func fittedPCRModelOnDisk(t *testing.T) (modelFile, inputFile string) {
	t.Helper()
	const n, p, latent = 40, 6, 2
	r := rand.New(rand.NewPCG(7, 11))

	loadings := make([][]float64, latent)
	for i := range loadings {
		loadings[i] = make([]float64, p)
		for j := range loadings[i] {
			loadings[i][j] = r.NormFloat64()
		}
	}
	headers := make([]string, p)
	for j := range headers {
		headers[j] = string(rune('A' + j))
	}
	sample := func(rows int) (types.Matrix, []float64) {
		matrix := make(types.Matrix, rows)
		y := make([]float64, rows)
		for i := range matrix {
			matrix[i] = make([]float64, p)
			s0, s1 := r.NormFloat64(), r.NormFloat64()
			for j := 0; j < p; j++ {
				matrix[i][j] = s0*loadings[0][j] + s1*loadings[1][j] + 0.05*r.NormFloat64()
			}
			y[i] = 3*s0 - 2*s1
		}
		return matrix, y
	}
	matrix, y := sample(n)

	rowNames := make([]string, n)
	for i := range rowNames {
		rowNames[i] = fmt.Sprintf("S%d", i+1)
	}
	data := &pkgcsv.Data{Matrix: matrix, Headers: headers, RowNames: rowNames, Rows: n, Columns: p}
	// The exported model is validated against the schema on load, as the real
	// command's output is, so the config has to be as complete as regress makes it.
	pcaConfig := types.PCAConfig{Components: 3, MeanCenter: true, Method: "svd", MissingStrategy: "error"}
	config := types.PCRConfig{
		PCA: pcaConfig, Response: "y#target",
		Selection: types.SelectionConfig{Mode: "fixed", Fixed: 2, Metric: "rmse"},
	}
	engine := core.NewPCREngine()
	result, err := engine.Fit(matrix, y, config)
	if err != nil {
		t.Fatalf("Fit: %v", err)
	}
	impl := engine.(*core.PCRImpl)
	exported := pkgcsv.ConvertToPCROutputData(result, data, false, pcaConfig,
		impl.Preprocessor(), nil, map[string][]float64{"y#target": y}, nil)
	encoded, err := json.Marshal(exported)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	dir := t.TempDir()
	modelFile = filepath.Join(dir, "pcr_model.json")
	if err := os.WriteFile(modelFile, encoded, 0600); err != nil {
		t.Fatal(err)
	}

	newRows, newY := sample(5)
	var csvText strings.Builder
	csvText.WriteString("Sample_ID," + strings.Join(headers, ",") + ",y#target\n")
	for i := range newRows {
		fields := []string{fmt.Sprintf("N%d", i+1)}
		for _, v := range newRows[i] {
			fields = append(fields, fmt.Sprintf("%g", v))
		}
		fields = append(fields, fmt.Sprintf("%g", newY[i]))
		csvText.WriteString(strings.Join(fields, ",") + "\n")
	}
	inputFile = filepath.Join(dir, "new.csv")
	if err := os.WriteFile(inputFile, []byte(csvText.String()), 0600); err != nil {
		t.Fatal(err)
	}
	return modelFile, inputFile
}

// minimalPCRResult is the constructed report the metric-disagreement test uses,
// shared so the design-line test does not repeat forty lines of fixture.
func minimalPCRResult() (*types.PCRResult, *pkgcsv.Data) {
	report := &types.CVReport{
		Design:     "10-fold by row (shuffled)",
		Seed:       42,
		Candidates: []int{0, 1, 2},
		RMSECV:     []float64{1.0, 0.5, 0.4},
		RMSECVMean: []float64{1.0, 0.5, 0.4},
		RMSECVSE:   []float64{0.1, 0.1, 0.1},
		Bias:       []float64{0, 0, 0},
		SEP:        []float64{1.0, 0.5, 0.4},
		MAE:        []float64{0.8, 0.4, 0.3},
		MAESE:      []float64{0.05, 0.05, 0.05},
		Q2:         []float64{0, 0.75, 0.84},
		Selected:   2,
		Rule:       types.SelectOneSE,
		Metric:     types.MetricRMSE,
		OutOfFold:  []float64{1, 2, 3},
	}
	report.SelectedByAlternateMetric = report.Selected
	result := &types.PCRResult{
		PCA:                &types.PCAResult{Loadings: types.Matrix{{1}, {1}}, Method: "svd"},
		Response:           "y#target",
		Components:         2,
		ScoreCoefficients:  []float64{1, 2},
		Coefficients:       []float64{0.5, 0.25},
		OriginalScaleValid: true,
		Fitted:             []float64{1, 2, 3},
		Residuals:          []float64{0.1, -0.1, 0},
		LabelledRows:       []int{0, 1, 2},
		CV:                 report,
	}
	data := &pkgcsv.Data{Headers: []string{"a", "b"}, RowNames: []string{"r1", "r2", "r3"}}
	return result, data
}

func designLine(output string) string {
	for _, line := range strings.Split(output, "\n") {
		if strings.Contains(line, "Design") {
			return line
		}
	}
	return "(no Design line)"
}
