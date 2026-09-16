package main

import "testing"

// metricsFor builds the request shape CalculateModelMetrics expects: one
// loadings row per variable, and one explained-variance entry per component.
func metricsFor(numVariables int, explainedVariance []float64) ModelMetricsRequest {
	loadings := make([][]float64, numVariables)
	labels := make([]string, numVariables)
	for i := range loadings {
		loadings[i] = make([]float64, len(explainedVariance))
		loadings[i][0] = 0.5
		labels[i] = string(rune('A' + i%26))
	}
	return ModelMetricsRequest{
		Loadings:          loadings,
		VariableLabels:    labels,
		ExplainedVariance: explainedVariance,
		StandardScale:     true,
	}
}

// The case from the aluminium alloy dataset: 24 standardized variables, 5
// components computed, and every one of those five eigenvalues above 1. Kaiser
// had not finished selecting -- it counts 10 on the full spectrum -- so the
// panel must not report agreement (#956).
func TestKaiserIsCensoredWhenEveryComputedEigenvalueExceedsOne(t *testing.T) {
	// Percentages of 24 variables: 2.440, 2.069, 1.994, 1.834, 1.625 as eigenvalues.
	ev := []float64{10.17, 8.62, 8.31, 7.64, 6.77}
	got := (&App{}).CalculateModelMetrics(metricsFor(24, ev))

	if !got.Success {
		t.Fatalf("metrics failed: %s", got.Error)
	}
	if !got.KaiserCensored {
		t.Errorf("KaiserCensored = false, but all %d computed eigenvalues exceed 1 so the criterion never chose a number", len(ev))
	}
	if got.KaiserComponents != len(ev) {
		t.Errorf("KaiserComponents = %d, want %d (the floor the model size imposes)", got.KaiserComponents, len(ev))
	}
	// The bug was that this equality was then read as agreement.
	if got.KaiserComponents != got.RecommendedComponents {
		t.Logf("note: recommendation %d differs from the censored count %d",
			got.RecommendedComponents, got.KaiserComponents)
	}
}

// When an eigenvalue below 1 is present, the criterion has genuinely chosen and
// the count means what it says.
func TestKaiserIsNotCensoredWhenItSelectsWithinTheComputedComponents(t *testing.T) {
	// Of 10 variables: 5.0, 3.0, 0.9, 0.6, 0.5 as eigenvalues -- the third stops it.
	ev := []float64{50.0, 30.0, 9.0, 6.0, 5.0}
	got := (&App{}).CalculateModelMetrics(metricsFor(10, ev))

	if got.KaiserCensored {
		t.Errorf("KaiserCensored = true, but eigenvalue 3 is below 1 so the criterion chose")
	}
	if got.KaiserComponents != 2 {
		t.Errorf("KaiserComponents = %d, want 2", got.KaiserComponents)
	}
}

// Mean-centred data gets no Kaiser verdict at all, so there is nothing to censor.
func TestKaiserIsNotCensoredWhenNotApplicable(t *testing.T) {
	req := metricsFor(24, []float64{59.36, 22.06, 10.32, 4.41, 2.49})
	req.StandardScale = false
	got := (&App{}).CalculateModelMetrics(req)

	if got.KaiserComponents != -1 {
		t.Errorf("KaiserComponents = %d, want -1 for non-standardized data", got.KaiserComponents)
	}
	if got.KaiserCensored {
		t.Errorf("KaiserCensored = true where the criterion does not apply")
	}
}

// When the whole spectrum has been computed there is nothing left to censor,
// even though every eigenvalue exceeds 1.
//
// A decomposition yields at most min(variables, samples-1) components. Where
// variables outnumber samples -- routine for spectroscopy, and the shape of
// testdata/corn -- the full spectrum is short and can sit entirely above 1.
// Advising "try more components" there sends the user after components that do
// not exist (review on #958).
func TestKaiserIsNotCensoredWhenTheWholeSpectrumWasComputed(t *testing.T) {
	// 100 variables, 20 samples: rank is 19, so 19 components is everything.
	const numVariables, numSamples, computed = 100, 20, 19

	ev := make([]float64, computed)
	for i := range ev {
		ev[i] = 100.0 / computed // each eigenvalue = 100/19 = 5.26, all above 1
	}
	req := metricsFor(numVariables, ev)
	req.OriginalData = make([][]float64, numSamples)
	for i := range req.OriginalData {
		req.OriginalData[i] = make([]float64, numVariables)
	}

	got := (&App{}).CalculateModelMetrics(req)

	if got.KaiserCensored {
		t.Errorf("KaiserCensored = true, but all %d available components were computed -- there are no more to ask for", computed)
	}
	if got.KaiserComponents != computed {
		t.Errorf("KaiserComponents = %d, want %d", got.KaiserComponents, computed)
	}
}

// The ordinary case still censors: far fewer components computed than exist.
func TestKaiserIsCensoredWhenComponentsRemainUncomputed(t *testing.T) {
	req := metricsFor(24, []float64{10.17, 8.62, 8.31, 7.64, 6.77})
	req.OriginalData = make([][]float64, 1057)
	for i := range req.OriginalData {
		req.OriginalData[i] = make([]float64, 24)
	}

	if got := (&App{}).CalculateModelMetrics(req); !got.KaiserCensored {
		t.Errorf("KaiserCensored = false, but only 5 of 24 possible components were computed")
	}
}
