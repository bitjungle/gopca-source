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
	"strings"
	"testing"

	"github.com/bitjungle/gopca/internal/crossval"
)

// Issue #973. The Folds control in this window is a menu reading 5, 10, 20 and
// "Leave one out". The engine's old message advised "use 0", which is the value
// behind that last entry and is never shown -- so a user was told to type a
// number the interface does not display.

func TestFoldAdviceSpeaksTheFoldsMenusLanguage(t *testing.T) {
	message := foldAdvice(&crossval.TooManyFolds{Requested: 20, Available: 5, Grouped: true})

	if !strings.Contains(message, "Leave one out") {
		t.Errorf("advice does not name the menu entry a user can actually see: %s", message)
	}
	if !strings.Contains(message, "5 folds or fewer") {
		t.Errorf("advice does not offer the 5 folds that are available: %s", message)
	}
	// The CLI's vocabulary has no place in a window with no command line.
	for _, banned := range []string{"--cv", "loo"} {
		if strings.Contains(message, banned) {
			t.Errorf("advice uses CLI syntax (%q) in the desktop: %s", banned, message)
		}
	}
}

// Every fold count the menu offers must still be reachable. A message that
// advised a value not on the menu is the defect restated.
func TestFoldAdviceOffersACountTheMenuContains(t *testing.T) {
	// The options in RegressionConfigSection.tsx, with 0 standing for "Leave one out".
	menu := []int{5, 10, 20, 0}

	for _, available := range []int{5, 10, 20} {
		message := foldAdvice(&crossval.TooManyFolds{
			Requested: 40, Available: available, Grouped: true,
		})
		wanted := fmt.Sprintf("%d folds or fewer", available)
		if !strings.Contains(message, wanted) {
			t.Errorf("advice for %d available folds does not say %q: %s",
				available, wanted, message)
			continue
		}
		reachable := false
		for _, option := range menu {
			if option != 0 && option <= available {
				reachable = true
			}
		}
		if !reachable {
			t.Errorf("advice offers %d folds or fewer, but the menu has no such "+
				"option -- only Leave one out would work: %s", available, message)
		}
	}
}

func TestFoldAdviceLeavesOtherErrorsAlone(t *testing.T) {
	original := fmt.Errorf("decomposition failed: matrix is singular")
	if got := foldAdvice(original); got != original.Error() {
		t.Errorf("an unrelated error was rewritten: %s", got)
	}
}
