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
	"os"
	"path/filepath"
	"strings"
	"testing"

	pkgcsv "github.com/bitjungle/gopca/pkg/csv"
	"github.com/bitjungle/gopca/pkg/types"
)

// captureStdout runs fn with stdout redirected, returning what it printed.
//
// The command prints its report directly, which is the behaviour under test as
// much as the numbers are: a user reading the output must be able to tell RMSEC
// from RMSECV. Capturing also keeps the test log readable.
func captureStdout(t *testing.T, fn func() error) (string, error) {
	t.Helper()

	original := os.Stdout
	read, write, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	os.Stdout = write

	done := make(chan string, 1)
	go func() {
		var builder strings.Builder
		buffer := make([]byte, 4096)
		for {
			n, err := read.Read(buffer)
			if n > 0 {
				builder.Write(buffer[:n])
			}
			if err != nil {
				break
			}
		}
		done <- builder.String()
	}()

	runErr := fn()

	if err := write.Close(); err != nil {
		t.Fatalf("closing the pipe: %v", err)
	}
	os.Stdout = original
	return <-done, runErr
}

func cornOptions() *RegressOptions {
	return &RegressOptions{
		Response:        "Moisture#target",
		Components:      5,
		MaxComponents:   20,
		CV:              "10",
		CVScheme:        "random",
		CVSeed:          42,
		Select:          "one-se",
		Metric:          "rmse",
		Method:          "svd",
		Scale:           "standard",
		MissingStrategy: "error",
		Delimiter:       ",",
		NAValues:        ",NA,N/A,nan,NaN,null,NULL,m",
		OutputFormat:    "table",
		WoldR:           1.0,
	}
}

func cornPath() string {
	return filepath.Join("..", "..", "testdata", "corn", "corn.csv")
}

func skipWithoutCorn(t *testing.T) {
	t.Helper()
	if _, err := os.Stat(cornPath()); err != nil {
		t.Skip("corn dataset unavailable")
	}
}

// TestRegressEndToEndReportsDistinctErrorFigures runs the command as a user would
// and checks the report distinguishes the three error figures.
//
// The names are load-bearing rather than cosmetic. RMSEC is the smallest and most
// flattering of the three on any well-fitted model, and a reader who takes it for
// a performance estimate will overstate what the model can do.
func TestRegressEndToEndReportsDistinctErrorFigures(t *testing.T) {
	skipWithoutCorn(t)

	output, err := captureStdout(t, func() error {
		return runRegress(cornOptions(), cornPath())
	})
	if err != nil {
		t.Fatalf("runRegress: %v", err)
	}

	for _, expected := range []string{
		"Principal Component Regression: Moisture#target",
		"RMSEC",
		"training residuals",
		"RMSEP is not reported",
		"Regression coefficients",
		"Predicted against measured",
	} {
		if !strings.Contains(output, expected) {
			t.Errorf("the report does not mention %q", expected)
		}
	}
}

// TestRegressEndToEndCrossValidated exercises the selection path and checks the
// curve is shown, since the curve is the evidence for the component count.
func TestRegressEndToEndCrossValidated(t *testing.T) {
	skipWithoutCorn(t)

	opts := cornOptions()
	opts.Components = 0
	opts.MaxComponents = 6

	output, err := captureStdout(t, func() error {
		return runRegress(opts, cornPath())
	})
	if err != nil {
		t.Fatalf("runRegress: %v", err)
	}

	for _, expected := range []string{
		"RMSECV",
		"held out",
		"Cross-validated error by component count",
		"<- selected",
		"intercept-only baseline",
	} {
		if !strings.Contains(output, expected) {
			t.Errorf("the report does not mention %q", expected)
		}
	}
}

// TestRegressEndToEndWritesUsableModel checks that the files land and that the
// exported model is one pca transform can actually read.
func TestRegressEndToEndWritesUsableModel(t *testing.T) {
	skipWithoutCorn(t)

	dir := t.TempDir()
	opts := cornOptions()
	opts.OutputDir = dir

	if _, err := captureStdout(t, func() error {
		return runRegress(opts, cornPath())
	}); err != nil {
		t.Fatalf("runRegress: %v", err)
	}

	for _, name := range []string{
		"pcr_predictions.csv", "pcr_coefficients.csv", "pcr_model.json",
	} {
		if _, err := os.Stat(filepath.Join(dir, name)); err != nil {
			t.Errorf("expected %s to be written: %v", name, err)
		}
	}

	raw, err := os.ReadFile(filepath.Join(dir, "pcr_model.json"))
	if err != nil {
		t.Fatalf("reading the model: %v", err)
	}
	var model map[string]interface{}
	if err := json.Unmarshal(raw, &model); err != nil {
		t.Fatalf("the model is not valid JSON: %v", err)
	}
	regression, ok := model["regression"].(map[string]interface{})
	if !ok {
		t.Fatal("the exported model carries no regression block")
	}
	if regression["response"] != "Moisture#target" {
		t.Errorf("response = %v, want Moisture#target", regression["response"])
	}
	if regression["original_scale_valid"] != true {
		t.Error("expected the collapsed original-scale form to be available")
	}
}

// TestRegressEndToEndListResponses covers the discovery path a user reaches for
// first.
func TestRegressEndToEndListResponses(t *testing.T) {
	skipWithoutCorn(t)

	opts := cornOptions()
	opts.ListResponses = true
	opts.Response = ""

	output, err := captureStdout(t, func() error {
		return runRegress(opts, cornPath())
	})
	if err != nil {
		t.Fatalf("runRegress: %v", err)
	}

	for _, name := range []string{
		"Moisture#target", "Oil#target", "Protein#target", "Starch#target",
	} {
		if !strings.Contains(output, name) {
			t.Errorf("the listing omits %s", name)
		}
	}

	// The listing must be ordered, not in map iteration order, or scripted use
	// would see it reshuffle between runs.
	moisture := strings.Index(output, "Moisture#target")
	oil := strings.Index(output, "Oil#target")
	if moisture < 0 || oil < 0 || moisture > oil {
		t.Error("responses are not listed in a stable sorted order")
	}
}

func TestRegressEndToEndErrors(t *testing.T) {
	skipWithoutCorn(t)

	tests := []struct {
		name    string
		mutate  func(*RegressOptions)
		wantMsg string
	}{
		{"no response given", func(o *RegressOptions) { o.Response = "" }, "no response selected"},
		{"unknown response", func(o *RegressOptions) { o.Response = "Nope" }, "unknown response"},
		{"kernel is refused", func(o *RegressOptions) { o.Method = "kernel" }, "kernel"},
		{"unknown output format", func(o *RegressOptions) { o.OutputFormat = "yaml" }, "unknown output format"},
		{"invalid scale", func(o *RegressOptions) { o.Scale = "sideways" }, "invalid scale"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			opts := cornOptions()
			tt.mutate(opts)
			_, err := captureStdout(t, func() error {
				return runRegress(opts, cornPath())
			})
			if err == nil {
				t.Fatalf("expected an error mentioning %q", tt.wantMsg)
			}
			if !strings.Contains(err.Error(), tt.wantMsg) {
				t.Errorf("error %q does not mention %q", err.Error(), tt.wantMsg)
			}
		})
	}
}

// TestRegressReportsMetricDisagreement exercises the branch that warns when the
// two error measures would choose different component counts.
//
// The branch is driven by data that rarely produces disagreement, so it is tested
// against a constructed report rather than by hunting for a dataset. What matters
// is that the message names the other measure correctly, which depends on which
// one was primary: naming MAE when MAE was the selection metric would be exactly
// backwards.
func TestRegressReportsMetricDisagreement(t *testing.T) {
	report := &types.CVReport{
		Design:                    "5-fold by row (shuffled)",
		Candidates:                []int{0, 1, 2},
		RMSECV:                    []float64{1.0, 0.5, 0.4},
		RMSECVMean:                []float64{1.0, 0.5, 0.4},
		RMSECVSE:                  []float64{0.1, 0.1, 0.1},
		Bias:                      []float64{0, 0, 0},
		SEP:                       []float64{1.0, 0.5, 0.4},
		MAE:                       []float64{0.8, 0.4, 0.3},
		MAESE:                     []float64{0.05, 0.05, 0.05},
		Q2:                        []float64{0, 0.75, 0.84},
		Selected:                  2,
		SelectedByAlternateMetric: 1,
		Rule:                      types.SelectOneSE,
		OutOfFold:                 []float64{1, 2, 3},
	}
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

	// The metric is read from the report, not from the flags. A model loaded from
	// disk carries no RegressOptions, and the report is the only record of which
	// curve the rule was applied to; taking it from opts would also let the two
	// disagree, printing a table headed by one metric and a note naming the other.
	for _, tc := range []struct {
		metric      string
		expectNamed string
		wantColumn  string
	}{
		{types.MetricRMSE, "scoring by MAE", "RMSECV"},
		{types.MetricMAE, "scoring by RMSE", "MAE"},
	} {
		t.Run(tc.metric, func(t *testing.T) {
			report.Metric = tc.metric
			opts := cornOptions()
			opts.Metric = tc.metric
			opts.OutputDir = ""

			output, err := captureStdout(t, func() error {
				return outputRegressTable(result, data, opts, types.PCAConfig{MeanCenter: true})
			})
			if err != nil {
				t.Fatalf("outputRegressTable: %v", err)
			}
			if !strings.Contains(output, tc.expectNamed) {
				t.Errorf("with metric %q the note should read %q; got:\n%s",
					tc.metric, tc.expectNamed, output)
			}
			if !strings.Contains(output, "would have chosen 1 components rather than 2") {
				t.Error("the note does not report both counts")
			}

			// Exactly one of the two held-out figures may claim to have chosen
			// the count, and it has to be the one named by Metric. Both lines are
			// printed, so asserting only that the right one carries the phrase
			// would still pass if the other carried it too.
			for _, line := range strings.Split(output, "\n") {
				if !strings.Contains(line, "this is what chose the component count") {
					continue
				}
				if !strings.HasPrefix(strings.TrimSpace(line), tc.wantColumn+" ") {
					t.Errorf("with metric %q the selection is credited to the wrong figure: %q",
						tc.metric, strings.TrimSpace(line))
				}
			}

			// The curve table has to show the column the rule read, or the
			// "<- selected" marker sits beside a number that took no part in
			// choosing it. RMSECV and MAE differ at every candidate above, so
			// the wrong column cannot pass this by coincidence.
			header := ""
			for _, line := range strings.Split(output, "\n") {
				if strings.HasPrefix(strings.TrimSpace(line), "k ") {
					header = line
					break
				}
			}
			if !strings.Contains(header, tc.wantColumn) {
				t.Errorf("with metric %q the curve table should be headed %q; got header %q in:\n%s",
					tc.metric, tc.wantColumn, header, output)
			}
			wantSelectedValue := "0.4"
			if tc.metric == types.MetricMAE {
				wantSelectedValue = "0.3"
			}
			if !strings.Contains(output, wantSelectedValue+"       0.8400  <- selected") {
				t.Errorf("with metric %q the selected row should show %s from the %s curve; got:\n%s",
					tc.metric, wantSelectedValue, tc.wantColumn, output)
			}
		})
	}
}
