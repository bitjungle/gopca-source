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

package crossval

import (
	"strings"
	"testing"
)

// Issue #973. The fold-count error used to end with "Use at most N folds, or 0
// for leave-one-out". Zero is the engine's own spelling of leave-one-out and
// nobody else's: the CLI refuses --cv 0, and GoPCA Desktop's Folds menu shows
// "Leave one out" and never a number. An engine that writes the remedy has to
// pick one vocabulary and be wrong in the others.

func tooManyFoldsFor(t *testing.T, k, groups int, grouped bool) error {
	t.Helper()
	// One row per group in the grouped case, so the two arrangements differ only
	// in whether an explicit grouping was supplied -- which is exactly what
	// decides the wording.
	indices := make([]int, groups)
	for i := range indices {
		indices[i] = i
	}
	g := &GroupKFold{K: k}
	if grouped {
		g.Groups = append([]int(nil), indices...)
	}
	if _, err := g.Split(indices); err != nil {
		return err
	}
	t.Fatalf("K=%d over %d %s was accepted", k, groups,
		map[bool]string{true: "groups", false: "rows"}[grouped])
	return nil
}

// The message must describe the constraint and stop there. Any flag syntax here
// is a vocabulary leaking out of the engine into interfaces that do not share
// it, which is the whole of #973.
func TestTooManyFoldsProposesNoRemedy(t *testing.T) {
	for _, tt := range []struct {
		name    string
		grouped bool
	}{
		{"grouped", true},
		{"ungrouped", false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			msg := tooManyFoldsFor(t, 10, 5, tt.grouped).Error()
			for _, banned := range []string{"--cv", "Use ", "use ", "loo", "Leave one out"} {
				if strings.Contains(msg, banned) {
					t.Errorf("message proposes a remedy (%q), which only a caller "+
						"can phrase correctly: %s", banned, msg)
				}
			}
		})
	}
}

// The explanation exists to separate two counts that differ. Ungrouped they are
// the same thing, and the sentence used to read "the effective sample size is
// the number of rows, not the number of rows" (#973).
func TestTooManyFoldsDoesNotExplainRowsAreNotRows(t *testing.T) {
	msg := tooManyFoldsFor(t, 300, 240, false).Error()
	if strings.Contains(msg, "not the number of rows") {
		t.Errorf("ungrouped message contains the tautology: %s", msg)
	}
	if !strings.Contains(msg, "cannot make 300 folds from 240 rows") {
		t.Errorf("ungrouped message lost the constraint: %s", msg)
	}
}

func TestTooManyFoldsExplainsTheGroupedCase(t *testing.T) {
	msg := tooManyFoldsFor(t, 10, 5, true).Error()
	for _, want := range []string{
		"cannot make 10 folds from 5 groups",
		"the effective sample size is the number of groups, not the number of rows",
	} {
		if !strings.Contains(msg, want) {
			t.Errorf("message is missing %q: %s", want, msg)
		}
	}
}

// Callers phrase their own remedy, so they need the numbers rather than the
// sentence.
func TestTooManyFoldsCarriesTheNumbersCallersNeed(t *testing.T) {
	var tooMany *TooManyFolds
	err := tooManyFoldsFor(t, 10, 5, true)
	tooMany, ok := err.(*TooManyFolds)
	if !ok {
		t.Fatalf("error is %T, not *TooManyFolds -- callers cannot inspect it", err)
	}
	if tooMany.Requested != 10 || tooMany.Available != 5 || !tooMany.Grouped {
		t.Errorf("got %+v, want Requested 10, Available 5, Grouped true", *tooMany)
	}
	if tooMany.Unit() != "groups" {
		t.Errorf("Unit() = %q, want groups", tooMany.Unit())
	}
	ungrouped := tooManyFoldsFor(t, 300, 240, false).(*TooManyFolds)
	if ungrouped.Unit() != "rows" {
		t.Errorf("ungrouped Unit() = %q, want rows", ungrouped.Unit())
	}
}
