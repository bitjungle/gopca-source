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
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"

	"github.com/bitjungle/gopca/internal/crossval"
)

// Issue #973: the fold-count error advised "use 0 for leave-one-out", and
// --cv 0 is refused by parseFolds. The advice and the parser disagreed about
// the same command's own flag.
//
// The test that matters here is therefore not that the wording is nice. It is
// that every --cv value the message recommends is a value this command accepts.

var cvSuggestion = regexp.MustCompile(`--cv (\S+?)[ ,.]`)

// suggestedFoldValues pulls every "--cv X" out of an error message.
func suggestedFoldValues(message string) []string {
	var values []string
	for _, match := range cvSuggestion.FindAllStringSubmatch(message+" ", -1) {
		values = append(values, match[1])
	}
	return values
}

// The round trip. Whatever the message tells the user to type, parseFolds must
// accept -- otherwise following the advice produces a second error, which is
// exactly what #973 was.
func TestFoldAdviceRecommendsOnlyValuesThisCommandAccepts(t *testing.T) {
	for _, tt := range []struct {
		name      string
		requested int
		available int
		grouped   bool
	}{
		{"grouped, 10 folds over 5 groups", 10, 5, true},
		{"ungrouped, 300 folds over 240 rows", 300, 240, false},
		{"grouped, only 2 groups", 10, 2, true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			err := withFoldAdvice(&crossval.TooManyFolds{
				Requested: tt.requested,
				Available: tt.available,
				Grouped:   tt.grouped,
			})
			message := err.Error()

			suggestions := suggestedFoldValues(message)
			if len(suggestions) == 0 {
				t.Fatalf("the message names no --cv remedy, so a user is told a "+
					"constraint and no way out: %s", message)
			}
			for _, value := range suggestions {
				if _, err := parseFolds(value); err != nil {
					t.Errorf("the message recommends --cv %s, which this command "+
						"then refuses (%v): %s", value, err, message)
				}
			}
		})
	}
}

// The largest honourable fold count has to be the one offered, not one more.
func TestFoldAdviceOffersTheAvailableCount(t *testing.T) {
	err := withFoldAdvice(&crossval.TooManyFolds{Requested: 10, Available: 5, Grouped: true})
	if !strings.Contains(err.Error(), "--cv 5 or fewer") {
		t.Errorf("advice does not offer the 5 folds that are available: %s", err)
	}
	if _, parseErr := parseFolds("5"); parseErr != nil {
		t.Errorf("parseFolds rejects the offered count: %v", parseErr)
	}
}

// The constraint the engine stated must survive; the advice is added to it, not
// substituted for it.
func TestFoldAdviceKeepsTheEnginesExplanation(t *testing.T) {
	inner := &crossval.TooManyFolds{Requested: 10, Available: 5, Grouped: true}
	err := withFoldAdvice(inner)
	if !strings.Contains(err.Error(), inner.Error()) {
		t.Errorf("the engine's explanation was dropped: %s", err)
	}
	var recovered *crossval.TooManyFolds
	if !errors.As(err, &recovered) {
		t.Error("the typed error is no longer unwrappable, so nothing further up can inspect it")
	}
}

// Everything else is none of this function's business.
func TestFoldAdviceLeavesOtherErrorsAlone(t *testing.T) {
	original := fmt.Errorf("decomposition failed: matrix is singular")
	if got := withFoldAdvice(original); got != original {
		t.Errorf("an unrelated error was rewritten: %v", got)
	}
	if withFoldAdvice(nil) != nil {
		t.Error("nil was turned into an error")
	}
}
