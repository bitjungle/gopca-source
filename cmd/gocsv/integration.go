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
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/bitjungle/gopca/pkg/integration"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// GoPCAStatus represents the installation status of GoPCA
type GoPCAStatus struct {
	Installed bool   `json:"installed"`
	Path      string `json:"path"`
	Version   string `json:"version"`
	Error     string `json:"error,omitempty"`
}

// CheckGoPCAStatus checks if GoPCA Desktop is installed and available
func (a *App) CheckGoPCAStatus() *GoPCAStatus {
	// Use shared integration package to detect GoPCA
	integrationConfig := integration.AppConfig{
		Name:        "gopca-desktop",
		CommonPaths: getGoPCAPathsWithDev(),
		DisplayName: "GoPCA Desktop",
	}

	appStatus := integration.CheckApp(integrationConfig)

	status := &GoPCAStatus{
		Installed: appStatus.Installed,
		Path:      appStatus.Path,
		Error:     appStatus.Error,
	}

	// If found, try to get version
	if status.Installed && status.Path != "" {
		cmd := exec.Command(status.Path, "--version")
		output, err := cmd.Output()
		if err == nil {
			status.Version = strings.TrimSpace(string(output))
		}
	}

	return status
}

// getGoPCAPathsWithDev returns common paths plus development paths for GoPCA
func getGoPCAPathsWithDev() []string {
	// Start with common installation paths
	paths := integration.GetCommonPaths("gopca-desktop")

	// Add development-specific paths
	execPath, _ := os.Executable()
	execDir := filepath.Dir(execPath)
	cwd, _ := os.Getwd()

	devPaths := []string{
		// When running from cmd/gocsv with make csv-dev
		filepath.Join(execDir, "../../build/bin/gopca-desktop"),
		filepath.Join(execDir, "../../build/bin/gopca-desktop.exe"),
		// When running from build output directory
		filepath.Join(execDir, "../gopca-desktop"),
		filepath.Join(execDir, "../gopca-desktop.exe"),
		// macOS app bundle in development
		filepath.Join(execDir, "../../build/bin/GoPCA Desktop.app/Contents/MacOS/gopca-desktop"),
		// When running with wails dev from cmd/gocsv directory
		filepath.Join(cwd, "../../build/bin/gopca-desktop"),
		filepath.Join(cwd, "../../build/bin/gopca-desktop.exe"),
		filepath.Join(cwd, "../gopca-desktop/build/bin/gopca-desktop.app/Contents/MacOS/gopca-desktop"),
		// Direct path to GoPCA Desktop build output
		filepath.Join(cwd, "../../cmd/gopca-desktop/build/bin/gopca-desktop.app/Contents/MacOS/gopca-desktop"),
	}

	paths = append(paths, devPaths...)
	return paths
}

// OpenInGoPCA saves the current data to a temporary file and opens it in GoPCA Desktop
func (a *App) OpenInGoPCA(data *FileData) error {
	if data == nil || len(data.Data) == 0 {
		return fmt.Errorf("no data to export")
	}

	// Check if GoPCA is installed
	status := a.CheckGoPCAStatus()
	if !status.Installed {
		return fmt.Errorf("GoPCA Desktop not found: %s", status.Error)
	}

	// Create a temporary file
	tempDir := os.TempDir()
	timestamp := time.Now().Format("20060102_150405")
	tempFile := filepath.Join(tempDir, fmt.Sprintf("gocsv_export_%s.csv", timestamp))

	// Write data to temp file
	file, err := os.Create(tempFile)
	if err != nil {
		return fmt.Errorf("failed to create temporary file: %w", err)
	}
	defer file.Close()

	if err := writeGoPCAExport(file, data); err != nil {
		return err
	}

	// Launch GoPCA with the file using the shared integration package
	if err := integration.LaunchWithFile(status.Path, tempFile); err != nil {
		return fmt.Errorf("failed to launch GoPCA Desktop: %w", err)
	}

	// Log the temporary file location
	a.logInfo(fmt.Sprintf("Exported data to: %s", tempFile))
	a.logInfo(fmt.Sprintf("Launched GoPCA Desktop: %s", status.Path))

	// Schedule cleanup of temp file after a delay
	go func() {
		time.Sleep(10 * time.Second) // Give GoPCA time to load the file
		os.Remove(tempFile)
	}()

	return nil
}

// writeGoPCAExport writes the handoff file GoPCA Desktop is launched with.
//
// This is the path that matters most for row identifiers: they are what labels
// the points in a scores plot, so a handoff without them produces a plot whose
// points cannot be told apart. exportRowIdentifiers supplies numbers when the
// file carries nothing that can serve (#966).
//
// Split out of OpenInGoPCA so it can be tested -- OpenInGoPCA itself launches
// another application and cannot be.
func writeGoPCAExport(out io.Writer, data *FileData) error {
	writer := csv.NewWriter(out)

	// Write headers with row name column if present
	rowNameHeader, rowIDs, _ := exportRowIdentifiers(data)
	headers := data.Headers
	if len(rowIDs) > 0 {
		// Carry the row-name column's own header through to GoPCA. "Row" stays
		// the fallback for files that had no name there, which is the common
		// convention and what every dataset in testdata/ uses (#859). An
		// invented column is never blank, so that fallback now applies only to
		// a file's own names.
		if rowNameHeader == "" {
			rowNameHeader = "Row"
		}
		headers = append([]string{rowNameHeader}, headers...)
	}
	if err := writer.Write(headers); err != nil {
		return fmt.Errorf("failed to write headers: %w", err)
	}

	// Write data rows
	for i, row := range data.Data {
		rowData := row
		if i < len(rowIDs) {
			rowData = append([]string{rowIDs[i]}, row...)
		}
		if err := writer.Write(rowData); err != nil {
			return fmt.Errorf("failed to write row %d: %w", i+1, err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return fmt.Errorf("failed to flush CSV writer: %w", err)
	}
	return nil
}

// DownloadGoPCA opens the GoPCA download page in the default browser
func (a *App) DownloadGoPCA() error {
	url := "https://github.com/bitjungle/gopca/releases"
	wailsruntime.BrowserOpenURL(a.ctx, url)
	return nil
}
