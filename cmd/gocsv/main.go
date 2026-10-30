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
	"embed"
	"log"
	"sync/atomic"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/linux/icon.png
var icon []byte

func main() {
	// The App struct is registered as a Wails service: its exported methods are
	// what the frontend calls. It is created first and attached to the Wails
	// application afterwards, so the constructor stays usable in headless tests.
	svc := NewApp()

	app := application.New(application.Options{
		Name:        "GoCSV",
		Description: "Data Editor for GoPCA",
		Services: []application.Service{
			application.NewService(svc),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		Linux: application.LinuxOptions{
			ProgramName: "GoCSV",
		},
	})
	svc.attach(app)

	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "gocsv",
		Width:            1024,
		Height:           768,
		StartState:       application.WindowStateNormal,
		BackgroundColour: application.NewRGB(27, 38, 54),
		// Files dragged from the OS are delivered to Go as WindowFilesDropped;
		// the handler below forwards the paths to the frontend as an event.
		EnableFileDrop: true,
		Mac: application.MacWindow{
			TitleBar: application.MacTitleBarDefault,
		},
		Linux: application.LinuxWindow{
			Icon:             icon,
			WebviewGpuPolicy: application.WebviewGpuPolicyAlways,
		},
	})

	window.OnWindowEvent(events.Common.WindowFilesDropped, func(e *application.WindowEvent) {
		svc.emit(eventFilesDropped, e.Context().DroppedFiles())
	})

	// Veto closing while there are unsaved changes (v2's OnBeforeClose).
	//
	// The hook cancels the close before asking, then re-issues it from a
	// goroutine once the user confirms. Re-issuing from outside the hook's own
	// call stack keeps this correct whether the dialog blocks or not, which
	// differs by platform, and avoids re-entering the closing event while it
	// is still being dispatched.
	var closeConfirmed atomic.Bool
	window.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		if closeConfirmed.Load() || !svc.HasUnsavedChanges() {
			return
		}
		e.Cancel()

		dialog := app.Dialog.Question().
			SetTitle("Unsaved Changes").
			SetMessage("You have unsaved changes. Close anyway?")
		closeAnyway := dialog.AddButton("Close anyway")
		cancel := dialog.AddButton("Cancel")
		dialog.SetDefaultButton(cancel).SetCancelButton(cancel)
		closeAnyway.OnClick(func() {
			closeConfirmed.Store(true)
			go window.Close()
		})
		dialog.Show()
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
