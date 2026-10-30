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

import "github.com/wailsapp/wails/v3/pkg/application"

// Names of the events GoPCA Desktop emits to its frontend. Registering them
// with a payload type makes 'wails3 generate bindings' emit typed constants for
// the frontend, so both ends share one definition and a renamed event fails
// the type check instead of silently never arriving.
const (
	// eventLoadFileOnStartup carries the path given with --open, once the
	// frontend runtime is ready to receive it.
	eventLoadFileOnStartup = "load-file-on-startup"
)

func init() {
	application.RegisterEvent[string](eventLoadFileOnStartup)
}
