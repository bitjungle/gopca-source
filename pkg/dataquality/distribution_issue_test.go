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

package dataquality

import (
	"math"
	"strings"
	"testing"
)

// skewedCol returns a numeric column the shape heuristic will not call normal.
func skewedCol(name string) ColumnAnalysis {
	return ColumnAnalysis{
		Name:         name,
		Type:         "numeric",
		Distribution: DistributionInfo{IsNormal: false},
	}
}

func distributionIssue(t *testing.T, cols ...ColumnAnalysis) (QualityIssue, bool) {
	t.Helper()
	report := &DataQualityReport{ColumnAnalysis: cols}
	for _, issue := range generateQualityIssues(report, nil, nil, nil) {
		if issue.Category == "distribution" {
			return issue, true
		}
	}
	return QualityIssue{}, false
}

// TestDistributionIssueDoesNotClaimPCAAssumesNormality guards the correction in
// #929.
//
// The report used to tell users "PCA assumes normality; consider data
// transformations". PCA assumes nothing of the sort, and both end-user guides
// say so in as many words -- docs/intro_to_pca.md and docs/intro_to_data_prep.md
// -- so the application contradicted the documentation shipped beside it.
//
// Asserting the current wording verbatim would pass for any rephrasing,
// including a reintroduction of the claim in different words. This asserts the
// property that was wrong: the message must not tell the reader that PCA
// requires, assumes or expects a distribution.
func TestDistributionIssueDoesNotClaimPCAAssumesNormality(t *testing.T) {
	issue, found := distributionIssue(t, skewedCol("a"))
	if !found {
		t.Fatal("no distribution issue was raised for a skewed column")
	}

	text := strings.ToLower(issue.Description + " " + issue.Impact)
	for _, claim := range []string{
		"assumes normality",
		"assumes normal",
		"requires normal",
		"expects normal",
		"pca assumes a",
	} {
		if strings.Contains(text, claim) {
			t.Errorf("distribution issue claims PCA assumes a distribution (%q): %q", claim, text)
		}
	}

	// "normal" may still appear, but only in a sentence denying the assumption.
	// Catch the bare noun phrase the old message used.
	if strings.Contains(text, "non-normal") {
		t.Errorf("issue reports non-normality, which is not what IsNormal measures: %q", text)
	}
}

// TestDistributionIssueNamesWhatWasMeasured checks the message describes the
// heuristic that produced it. IsNormal is |skewness| < 0.5 && |kurtosis| < 1.0,
// a shape test, so the finding is about skew and tails.
func TestDistributionIssueNamesWhatWasMeasured(t *testing.T) {
	issue, found := distributionIssue(t, skewedCol("a"), skewedCol("b"))
	if !found {
		t.Fatal("no distribution issue was raised for skewed columns")
	}

	text := strings.ToLower(issue.Description)
	if !strings.Contains(text, "skew") && !strings.Contains(text, "tail") {
		t.Errorf("description names neither skew nor tails: %q", issue.Description)
	}
	// The heuristic is |excess kurtosis| < 1.0, which fails in both directions,
	// so the finding cannot be described as a long or heavy tail. See
	// TestLightTailedColumnIsFlaggedToo for the column that proves it.
	for _, overclaim := range []string{"heavy-tail", "heavy tail", "long tail", "long-tail"} {
		if strings.Contains(text, overclaim) {
			t.Errorf("description claims %q, which |excess kurtosis| < 1.0 does not establish: %q",
				overclaim, issue.Description)
		}
	}
	if !strings.Contains(issue.Description, "2") {
		t.Errorf("description does not report the column count: %q", issue.Description)
	}
	if issue.Severity != "info" {
		t.Errorf("severity = %q, want info: a skewed column is not a defect", issue.Severity)
	}
}

// TestNoDistributionIssueWhenNothingIsSkewed keeps the two tests above honest:
// without it they would pass against a function that raises the issue
// unconditionally.
func TestNoDistributionIssueWhenNothingIsSkewed(t *testing.T) {
	normal := ColumnAnalysis{
		Name:         "a",
		Type:         "numeric",
		Distribution: DistributionInfo{IsNormal: true},
	}
	if issue, found := distributionIssue(t, normal); found {
		t.Errorf("distribution issue raised for an unskewed column: %q", issue.Description)
	}
}

// TestLightTailedColumnIsFlaggedToo is the measurement behind the wording.
//
// IsNormal requires |excess kurtosis| < 1.0 on the Fisher definition, so it
// fails for light tails as well as heavy ones. A uniform column is the clearest
// case: perfectly symmetric, excess kurtosis about -1.20, and flagged. Any
// wording that calls the flagged columns heavy-tailed is therefore false for
// this column, which is why the assertions above forbid it.
//
// Without this test the prohibition above looks like a style preference rather
// than a statement about what the heuristic can establish.
func TestLightTailedColumnIsFlaggedToo(t *testing.T) {
	values := make([]float64, 1000)
	for i := range values {
		values[i] = float64(i) / 999.0
	}
	mean := calculateMean(values)
	stdDev := calculateStdDev(values, mean)
	skewness := calculateSkewness(values, mean, stdDev)
	kurtosis := calculateKurtosis(values, mean, stdDev)

	if kurtosis >= -1.0 {
		t.Fatalf("uniform excess kurtosis = %.4f, want below -1.0; this test no longer "+
			"exercises the light-tailed case", kurtosis)
	}
	if math.Abs(skewness) >= 0.5 {
		t.Fatalf("uniform skewness = %.4f, want near zero; the column must be flagged "+
			"on tail weight alone, not on skew", skewness)
	}

	if isNormalShape(skewness, kurtosis) {
		t.Fatal("a uniform column is not flagged, so the heuristic no longer fails on light tails")
	}
}

// A count the reader cannot resolve to columns is not actionable: a tester shown
// "24 numeric columns are skewed" had no way to find out which 24 (#951).
func TestDistributionIssueNamesItsColumns(t *testing.T) {
	report := &DataQualityReport{ColumnAnalysis: []ColumnAnalysis{
		skewedCol("Be"),
		{Name: "Zn", Type: "numeric", Distribution: DistributionInfo{IsNormal: true}},
		skewedCol("Cr"),
		{Name: "Source", Type: "categorical", Distribution: DistributionInfo{IsNormal: false}},
	}}

	issue := findDistributionIssue(t, generateQualityIssues(report, nil, nil, nil))

	if len(issue.Affected) == 0 {
		t.Fatalf("distribution issue names no columns, so the count cannot be acted on: %q", issue.Description)
	}
	want := []string{"Be", "Cr"}
	if len(issue.Affected) != len(want) {
		t.Fatalf("Affected = %v, want %v", issue.Affected, want)
	}
	for i, name := range want {
		if issue.Affected[i] != name {
			t.Errorf("Affected[%d] = %q, want %q", i, issue.Affected[i], name)
		}
	}
	// The named columns must be the ones counted, or the text and the list
	// describe different sets.
	if !strings.Contains(issue.Description, "2 numeric columns") {
		t.Errorf("description counts a different set than it names: %q vs %v", issue.Description, issue.Affected)
	}
}

// The impact line answers "what do I do with this", which was the question the
// bare count provoked. It must not send the reader to the Recommendations tab:
// that entry fires on |skewness| > 1.0 while this issue fires on !IsNormal, so
// it can be absent when this is present.
func TestDistributionIssueStatesItsOwnAction(t *testing.T) {
	report := &DataQualityReport{ColumnAnalysis: []ColumnAnalysis{skewedCol("Be")}}
	issue := findDistributionIssue(t, generateQualityIssues(report, nil, nil, nil))

	if !strings.Contains(issue.Impact, "no action on its own") {
		t.Errorf("impact does not say whether action is needed: %q", issue.Impact)
	}
	if strings.Contains(issue.Impact, "Recommendations") {
		t.Errorf("impact points at a tab whose matching entry may not exist: %q", issue.Impact)
	}
}

func findDistributionIssue(t *testing.T, issues []QualityIssue) QualityIssue {
	t.Helper()
	for _, issue := range issues {
		if issue.Category == "distribution" {
			return issue
		}
	}
	t.Fatal("no distribution issue was generated")
	return QualityIssue{}
}
