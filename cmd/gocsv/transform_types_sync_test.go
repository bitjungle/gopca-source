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
	"os"
	"path/filepath"
	"regexp"

	"testing"
)

// A transformation type is declared in three places, and only one pair of them
// is checked by a compiler:
//
//	pkg/transform/types.go        the engine's Type constants
//	cmd/gocsv/transforms.go       the Wails-facing TransformationType constants
//	DataTransformDialog.tsx       the dialog's list of offered transformations
//
// The dialog's TransformationType union is derived from the enum that
// `wails3 generate bindings` emits from cmd/gocsv/transforms.go, so a dialog
// entry naming a type the Wails layer does not declare fails `tsc`. The two
// other directions are silent: add a transformation to the engine, forget the
// Wails constant or the dialog entry, and it builds, tests clean, and is simply
// unreachable -- a capability the software has and never offers. That is the
// failure this test exists for, so it is written to fail on a type present in
// the engine and absent from either of the other two.

var (
	goTypePattern    = regexp.MustCompile(`(?m)^\s*(\w+)\s+Type\s+=\s+"([a-z]+)"`)
	gocsvTypePattern = regexp.MustCompile(`(?m)^\s*Transform\w+\s+TransformationType\s+=\s+"([a-z]+)"`)
	tsEntryPattern   = regexp.MustCompile(`type:\s*'([a-z]+)'`)
)

func TestTransformationTypesAgreeAcrossLayers(t *testing.T) {
	engine := matchSet(t, "engine Type constants",
		readRepoFile(t, "..", "..", "pkg", "transform", "types.go"), goTypePattern, 2)

	wails := matchSet(t, "TransformationType constants",
		readRepoFile(t, "transforms.go"), gocsvTypePattern, 1)

	dialogSource := readRepoFile(t, "frontend", "src", "components", "DataTransformDialog.tsx")

	// The union is a type. Being in it does not put a transformation in the
	// dialog's list, which is what the user actually picks from.
	offered := matchSet(t, "dialog transform entries", dialogSource, tsEntryPattern, 1)

	for name := range engine {
		if !wails[name] {
			t.Errorf("pkg/transform declares %q but cmd/gocsv/transforms.go has no "+
				"TransformationType for it, so the Wails layer cannot name it", name)
		}
		if !offered[name] {
			t.Errorf("pkg/transform declares %q but no entry in DataTransformDialog.tsx "+
				"offers it, so the transformation exists and no user can reach it", name)
		}
	}

	for name := range wails {
		if !engine[name] {
			t.Errorf("cmd/gocsv declares TransformationType %q, which pkg/transform does "+
				"not implement; Apply would reject it at runtime", name)
		}
	}

	for name := range offered {
		if !engine[name] {
			t.Errorf("the dialog offers %q, which pkg/transform does not implement; "+
				"choosing it would fail at runtime", name)
		}
	}
}

// matchSet collects capture group n from every match, failing if there are none.
func matchSet(t *testing.T, what, source string, pattern *regexp.Regexp, group int) map[string]bool {
	t.Helper()

	matches := pattern.FindAllStringSubmatch(source, -1)
	if len(matches) == 0 {
		t.Fatalf("no %s matched %s; this test is passing by not looking, check the "+
			"pattern against the source", what, pattern)
	}

	found := map[string]bool{}
	for _, m := range matches {
		found[m[group]] = true
	}
	return found
}

func readRepoFile(t *testing.T, parts ...string) string {
	t.Helper()
	path := filepath.Join(parts...)
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading %s: %v", path, err)
	}
	return string(content)
}
