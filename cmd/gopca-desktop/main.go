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
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/bitjungle/gopca/internal/version"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/linux/icon.png
var icon []byte

func main() {
	// Parse command-line flags
	openFile := flag.String("open", "", "CSV file to open on startup")
	showVersion := flag.Bool("version", false, "Show version information")
	tutorialDataset := flag.String("tutorial", "", "Open a tutorial window for a sample dataset (iris|wine|corn|swiss_roll|stocks)")
	flag.Parse()

	// Handle version flag
	if *showVersion {
		fmt.Println(version.Get().Short())
		os.Exit(0)
	}

	// The same App struct serves both the main window and tutorial windows.
	// In tutorial mode, SetTutorialDataset() is called so that GetAppMode()
	// returns the correct mode to the frontend. A tutorial window is a separate
	// process started by OpenTutorial() with --tutorial <dataset>.
	svc := NewApp()
	title, programName, width, height := "GoPCA Desktop", "GoPCA", 1200, 800
	if *tutorialDataset != "" {
		svc.SetTutorialDataset(*tutorialDataset)
		title = fmt.Sprintf("GoPCA Tutorial — %s", *tutorialDataset)
		programName = "GoPCA Tutorial"
		width, height = 900, 750
	} else if *openFile != "" {
		svc.SetFileToOpen(*openFile)
	}

	// The App struct is registered as a Wails service: its exported methods are
	// what the frontend calls. It is created first and attached to the Wails
	// application afterwards, so the constructor stays usable in headless tests.
	app := application.New(application.Options{
		Name:        "GoPCA",
		Description: "Professional PCA Analysis Tool",
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
			ProgramName: programName,
		},
	})
	svc.attach(app)

	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            title,
		Width:            width,
		Height:           height,
		StartState:       application.WindowStateNormal,
		BackgroundColour: application.NewRGB(27, 38, 54),
		Mac: application.MacWindow{
			TitleBar: application.MacTitleBarDefault,
		},
		Linux: application.LinuxWindow{
			Icon:             icon,
			WebviewGpuPolicy: application.WebviewGpuPolicyAlways,
		},
	})

	// A file given with --open is handed to the frontend once its runtime has
	// signalled it is ready, which is the moment its event listeners exist.
	// (v2 slept 500 ms and hoped; the window event removes the race.)
	window.OnWindowEvent(events.Common.WindowRuntimeReady, func(e *application.WindowEvent) {
		if path := svc.fileToOpen; path != "" {
			svc.logInfo(fmt.Sprintf("Emitting %s with file: %s", eventLoadFileOnStartup, path))
			svc.emit(eventLoadFileOnStartup, path)
		}
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
