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
	"errors"

	"github.com/bitjungle/gopca/internal/version"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// App is the Wails service behind GoCSV: its exported methods are the
// frontend's API. It holds no runtime context; the Wails application is
// attached after construction (see main.go), and every method that needs it
// goes through the helpers below, which tolerate its absence so the struct
// stays usable in headless tests.
type App struct {
	app               *application.App
	history           *CommandHistory
	currentData       *FileData
	hasUnsavedChanges bool
	pendingZipPath    string // path to a downloaded ZIP awaiting entry selection
	lastFailedLoad    string // path of the last file that failed to open, for import suggestions
}

// errNoUI is returned by methods that need a window -- dialogs, the browser --
// when no Wails application is attached. Only reachable outside the running
// app, i.e. from tests; the frontend cannot call a service that has no window.
var errNoUI = errors.New("no application window attached")

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		history: NewCommandHistory(100), // Keep last 100 commands
	}
}

// attach connects the service to the running Wails application. Called once
// from main after application.New, before any window exists.
func (a *App) attach(app *application.App) {
	a.app = app
}

// emit sends a custom event to the frontend. A no-op before attach, so
// commands can run headless.
func (a *App) emit(name string, data any) {
	if a.app != nil {
		a.app.Event.Emit(name, data)
	}
}

// openURL opens url in the system browser.
func (a *App) openURL(url string) error {
	if a.app == nil {
		return errNoUI
	}
	return a.app.Browser.OpenURL(url)
}

func (a *App) logInfo(msg string) {
	if a.app != nil {
		a.app.Logger.Info(msg)
	}
}

func (a *App) logWarning(msg string) {
	if a.app != nil {
		a.app.Logger.Warn(msg)
	}
}

func (a *App) logError(msg string) {
	if a.app != nil {
		a.app.Logger.Error(msg)
	}
}

// markDirty marks the app as having unsaved changes and notifies the frontend.
// Only emits an event on the first transition to dirty to avoid noise.
func (a *App) markDirty() {
	if !a.hasUnsavedChanges {
		a.hasUnsavedChanges = true
		a.emit(eventUnsavedStateChanged, true)
	}
}

// markClean marks the app as having no unsaved changes and notifies the frontend.
// Called after a successful save or when a new file is loaded.
func (a *App) markClean() {
	if a.hasUnsavedChanges {
		a.hasUnsavedChanges = false
		a.emit(eventUnsavedStateChanged, false)
	}
}

// HasUnsavedChanges returns true if there are unsaved data changes.
// Used by OnBeforeClose to determine whether to prompt the user.
func (a *App) HasUnsavedChanges() bool {
	return a.hasUnsavedChanges
}

// GetVersion returns the application version
func (a *App) GetVersion() string {
	return version.Get().Short()
}
