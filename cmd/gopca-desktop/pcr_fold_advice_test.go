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
	if !strings.Contains(message, "Choose 5 folds") {
		t.Errorf("advice does not offer the 5 folds that are available: %s", message)
	}
	// The CLI's vocabulary has no place in a window with no command line.
	for _, banned := range []string{"--cv", "loo"} {
		if strings.Contains(message, banned) {
			t.Errorf("advice uses CLI syntax (%q) in the desktop: %s", banned, message)
		}
	}
}

// The advice must name a setting the Folds menu can actually express.
//
// The first version of this test only tried Available values that happened to be
// menu entries (5, 10, 20) -- the three cases where any reasonable implementation
// passes. It was written so it could not fail, and it did not: the code it was
// guarding said "choose N folds or fewer" with N straight from the engine, which
// with 3 groups recommends 3 when the smallest number on the menu is 5. The
// values between and below the options are the whole of the test.
func TestFoldAdviceNamesASettingTheMenuOffers(t *testing.T) {
	for _, tt := range []struct {
		name      string
		available int
		want      string
	}{
		{"exactly a menu entry", 5, "Choose 5 folds"},
		{"between two entries", 8, "Choose 5 folds"},
		{"just below the largest", 19, "Choose 10 folds"},
		{"above every entry", 40, "Choose 20 folds"},
		{"below the smallest entry", 4, "only available setting"},
		{"the fewest groups that can be split", 2, "only available setting"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			message := foldAdvice(&crossval.TooManyFolds{
				Requested: 100, Available: tt.available, Grouped: true,
			})
			if !strings.Contains(message, tt.want) {
				t.Errorf("advice for %d groups does not contain %q: %s",
					tt.available, tt.want, message)
			}
			// Whatever number it names must be on the menu.
			for _, option := range []int{1, 2, 3, 4, 6, 7, 8, 9, 11, 19, 40} {
				unreachable := fmt.Sprintf("Choose %d folds", option)
				if strings.Contains(message, unreachable) {
					t.Errorf("advice names %d folds, which the menu cannot select: %s",
						option, message)
				}
			}
			// And it must never recommend more folds than can be honoured.
			if selectable := largestSelectableFolds(tt.available); selectable > tt.available {
				t.Errorf("largestSelectableFolds(%d) = %d, more than is available",
					tt.available, selectable)
			}
		})
	}
}

// "Leave one out" is always a way through, because one fold per group is always
// honourable once there are at least two groups. The advice must therefore offer
// it in every case, including the ones where a number is also available.
func TestFoldAdviceAlwaysOffersLeaveOneOut(t *testing.T) {
	for _, available := range []int{2, 4, 5, 8, 19, 40} {
		message := foldAdvice(&crossval.TooManyFolds{
			Requested: 100, Available: available, Grouped: true,
		})
		if !strings.Contains(message, `"Leave one out"`) {
			t.Errorf("advice for %d groups does not offer Leave one out: %s",
				available, message)
		}
	}
}

func TestFoldAdviceLeavesOtherErrorsAlone(t *testing.T) {
	original := fmt.Errorf("decomposition failed: matrix is singular")
	if got := foldAdvice(original); got != original.Error() {
		t.Errorf("an unrelated error was rewritten: %s", got)
	}
}
