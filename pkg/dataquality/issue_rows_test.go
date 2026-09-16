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
	"strconv"
	"strings"
	"testing"
)

func issueOfCategory(issues []QualityIssue, category string) (QualityIssue, bool) {
	for _, issue := range issues {
		if issue.Category == category {
			return issue, true
		}
	}
	return QualityIssue{}, false
}

// TestSparseRowIssueCarriesTheRowsItNames is the property the grid depends on:
// the numbers a user reads in the description are the numbers handed to the
// selection, so clicking the finding lands on the row it talked about.
//
// Asserting them separately would let the two drift apart, which is the whole
// failure this is guarding -- a description saying 41 and a selection landing
// on 40 looks like a working feature.
func TestSparseRowIssueCarriesTheRowsItNames(t *testing.T) {
	report := &DataQualityReport{}
	issues := generateQualityIssues(report, nil, []int{41}, nil)

	issue, found := issueOfCategory(issues, "structure")
	if !found {
		t.Fatal("no structure issue raised for a sparse row")
	}
	if len(issue.Rows) != 1 || issue.Rows[0] != 41 {
		t.Fatalf("issue.Rows = %v, want [41]", issue.Rows)
	}
	if !strings.Contains(issue.Description, "41") {
		t.Fatalf("description does not name row 41: %q", issue.Description)
	}
	for _, row := range issue.Rows {
		if !strings.Contains(issue.Description, strconv.Itoa(row)) {
			t.Errorf("Rows contains %d but the description never mentions it: %q",
				row, issue.Description)
		}
	}
}

// TestOutlierIssueRowsAreOneBased guards the conversion.
//
// detectOutliers records a zero-based RowIndex while findSparseRows counts from
// one, so the two halves of the analysis disagree. Every outlier row number
// must come out one greater than the index it was stored under; without this
// test the off-by-one is invisible, because a selection one row above the real
// outlier still looks like a selection.
func TestOutlierIssueRowsAreOneBased(t *testing.T) {
	// A thousand values with three beyond the fence: 0.3%, few enough to be
	// outliers and so few enough to be reported (#933).
	count := 1000
	outliers := make([]OutlierInfo, 0, 3)
	for _, idx := range []int{0, 5, 9} {
		outliers = append(outliers, OutlierInfo{RowIndex: idx, Method: "magnitude"})
	}

	report := &DataQualityReport{ColumnAnalysis: []ColumnAnalysis{{
		Name:     "Zn",
		Type:     "numeric",
		Stats:    ColumnStatistics{Count: count},
		Outliers: outliers,
	}}}

	issue, found := issueOfCategory(generateQualityIssues(report, nil, nil, nil), "outlier")
	if !found {
		t.Fatal("no outlier issue raised for 3 extreme values in 1000")
	}

	want := []int{1, 6, 10}
	if len(issue.Rows) != len(want) {
		t.Fatalf("issue.Rows = %v, want %v", issue.Rows, want)
	}
	for i, row := range issue.Rows {
		if row != want[i] {
			t.Errorf("issue.Rows[%d] = %d, want %d (RowIndex %d is zero-based)",
				i, row, want[i], outliers[i].RowIndex)
		}
	}

	// The first row of the file is 1, never 0. A zero here means the conversion
	// was dropped somewhere and the grid would select the row above every time.
	for _, row := range issue.Rows {
		if row < 1 {
			t.Errorf("row number %d is below 1, so the rows are still zero-based", row)
		}
	}
}

// TestColumnOnlyIssuesCarryNoRows keeps the two tests above honest: without it
// they would pass against a function that attached rows to everything.
func TestColumnOnlyIssuesCarryNoRows(t *testing.T) {
	report := &DataQualityReport{ColumnAnalysis: []ColumnAnalysis{
		{Name: "a", Type: "numeric", Distribution: DistributionInfo{IsNormal: false, DistType: "right-skewed"}},
	}}
	issue, found := issueOfCategory(generateQualityIssues(report, nil, nil, nil), "distribution")
	if !found {
		t.Fatal("no distribution issue raised")
	}
	if len(issue.Rows) != 0 {
		t.Errorf("a column-scoped finding carries rows %v", issue.Rows)
	}
}
