# Makefile for gopca - A professional-grade PCA toolkit
# This Makefile provides common development tasks for building, testing, and running the PCA toolkit

# Variables
BINARY_NAME := pca
DESKTOP_NAME := GoPCA
CSV_NAME := GoCSV
BUILD_DIR := build
CLI_PATH := cmd/gopca-cli/main.go
DESKTOP_PATH := cmd/gopca-desktop
CSV_PATH := cmd/gocsv
COVERAGE_FILE := coverage.out

# Shortcuts for pca CLI builds
cli: build
cli-all: build-all

# Shortcuts for GoPCA Desktop builds  
desktop: pca-build
desktop-dev: pca-dev
pca: pca-build

# Shortcuts for GoCSV Desktop builds
csv: csv-build

# Cross-platform build variables
GOOS ?= $(shell go env GOOS)
GOARCH ?= $(shell go env GOARCH)

# Binary extension (for Windows)
ifeq ($(GOOS),windows)
	EXT := .exe
else
	EXT :=
endif

# Go commands
GOCMD := go
GOBUILD := $(GOCMD) build
GOTEST := $(GOCMD) test
GOFMT := $(GOCMD) fmt
GOMOD := $(GOCMD) mod
GOGET := $(GOCMD) get

# Version information
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

# Build flags
LDFLAGS := -ldflags="-s -w \
	-X github.com/bitjungle/gopca/internal/version.Version=$(VERSION) \
	-X github.com/bitjungle/gopca/internal/version.GitCommit=$(GIT_COMMIT) \
	-X github.com/bitjungle/gopca/internal/version.BuildDate=$(BUILD_DATE)"

# GoPCA build flags (for Wails)
DESKTOP_LDFLAGS := -ldflags "-s -w \
	-X github.com/bitjungle/gopca/internal/version.Version=$(VERSION) \
	-X github.com/bitjungle/gopca/internal/version.GitCommit=$(GIT_COMMIT) \
	-X github.com/bitjungle/gopca/internal/version.BuildDate=$(BUILD_DATE)"

# Check if golangci-lint is installed
GOLINT := $(shell which golangci-lint 2> /dev/null)

# Check if wails is installed - check in PATH and common locations
WAILS := $(shell which wails 2> /dev/null || echo "$${HOME}/go/bin/wails")
# Derived from go.mod rather than written out, so the CLI a developer is told
# to install cannot drift from the library the project builds against. That
# mismatch is what #822 was: the CLI rewrites go.mod to match itself.
WAILS_VERSION := $(shell grep 'wailsapp/wails/v2 v' go.mod | awk '{print $$2}')

# Default target
.DEFAULT_GOAL := all

# Phony targets
.PHONY: sync-schemas check-schemas all build cli cli-all build-cross build-darwin-amd64 build-darwin-arm64 build-linux-amd64 build-linux-arm64 build-windows-amd64 build-all pca-dev pca-build pca-build-all pca-run pca-deps csv-dev csv-build csv-build-all csv-run csv-deps build-everything test test-verbose test-coverage test-integration test-platforms test-e2e test-parity test-regression fmt lint typecheck build-ui run-pca-iris clean clean-cross install deps deps-all install-hooks sign sign-cli sign-pca sign-csv sign-windows windows-installer windows-installer-signed windows-installer-all notarize notarize-cli notarize-pca notarize-csv sign-and-notarize help

## all: Build all applications for current platform and run tests
all: build pca-build csv-build test

## build: Build the pca CLI binary
build:
	@echo "Building $(BINARY_NAME) for $(GOOS)/$(GOARCH)..."
	@mkdir -p $(BUILD_DIR)
	GOOS=$(GOOS) GOARCH=$(GOARCH) $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)$(EXT) $(CLI_PATH)
	@echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)$(EXT)"

## build-cross: Generic cross-platform build (use with GOOS and GOARCH)
build-cross:
	@echo "Building $(BINARY_NAME) for $(GOOS)/$(GOARCH)..."
	@mkdir -p $(BUILD_DIR)
	@if [ "$(GOOS)" = "windows" ]; then \
		GOOS=$(GOOS) GOARCH=$(GOARCH) $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-$(GOOS)-$(GOARCH).exe $(CLI_PATH); \
		echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)-$(GOOS)-$(GOARCH).exe"; \
	else \
		GOOS=$(GOOS) GOARCH=$(GOARCH) $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-$(GOOS)-$(GOARCH) $(CLI_PATH); \
		echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)-$(GOOS)-$(GOARCH)"; \
	fi

## build-darwin-amd64: Build for macOS Intel
build-darwin-amd64:
	@$(MAKE) build-cross GOOS=darwin GOARCH=amd64

## build-darwin-arm64: Build for macOS Apple Silicon
build-darwin-arm64:
	@$(MAKE) build-cross GOOS=darwin GOARCH=arm64

## build-linux-amd64: Build for Linux x64
build-linux-amd64:
	@$(MAKE) build-cross GOOS=linux GOARCH=amd64

## build-linux-arm64: Build for Linux ARM64
build-linux-arm64:
	@$(MAKE) build-cross GOOS=linux GOARCH=arm64

## build-windows-amd64: Build for Windows x64
build-windows-amd64:
	@$(MAKE) build-cross GOOS=windows GOARCH=amd64

## build-all: Build pca CLI for all supported platforms
build-all: build-darwin-amd64 build-darwin-arm64 build-linux-amd64 build-linux-arm64 build-windows-amd64
	@echo "All pca CLI platform builds complete!"

## build-all-parallel: Build pca CLI for all platforms in parallel
build-all-parallel:
	@echo "Building pca CLI for all platforms in parallel..."
	@$(MAKE) -j5 build-darwin-amd64 build-darwin-arm64 build-linux-amd64 build-linux-arm64 build-windows-amd64
	@echo "All parallel pca CLI builds complete!"

## sync-docs: Synchronize documentation files to frontend directories
sync-docs:
	@bash scripts/sync-docs.sh

## sync-datasets: Compress source CSVs into internal/datasets/*.csv.gz (embedded at build time)
sync-datasets:
	@bash scripts/sync-datasets.sh

## build-ui: Build the shared UI components package
##
## packages/ui-components is compiled: both desktop applications import it from
## dist/, which is gitignored. So a fresh clone has no dist at all, and a stale
## one is invisible -- the app builds and runs, showing the previous version of
## every shared component. Every target that builds or runs an app depends on
## this, so that cannot happen silently.
build-ui:
	@echo "Building shared UI components..."
	@npm run build -w @gopca/ui-components

## pca-dev: Run GoPCA Desktop in development mode with hot reload
pca-dev: build-ui sync-docs sync-datasets
	@if [ -x "$(WAILS)" ]; then \
		echo "Starting GoPCA Desktop in development mode..."; \
		cd $(DESKTOP_PATH) && $(WAILS) dev; \
	else \
		echo "Wails not found. Install it with:"; \
		echo "  go install github.com/wailsapp/wails/v2/cmd/wails@$(WAILS_VERSION)"; \
		exit 1; \
	fi

## pca-build: Build GoPCA Desktop for production
pca-build: build-ui sync-docs sync-datasets
	@if [ -x "$(WAILS)" ]; then \
		echo "Building GoPCA Desktop..."; \
		cd $(DESKTOP_PATH) && $(WAILS) build $(DESKTOP_LDFLAGS); \
		echo "GoPCA Desktop build complete. Check $(DESKTOP_PATH)/build/bin/"; \
	else \
		echo "Wails not found. Install it with:"; \
		echo "  go install github.com/wailsapp/wails/v2/cmd/wails@$(WAILS_VERSION)"; \
		exit 1; \
	fi

## pca-run: Run the built GoPCA Desktop
pca-run:
	@if [ -f "$(DESKTOP_PATH)/build/bin/GoPCA.app/Contents/MacOS/GoPCA" ]; then \
		echo "Running GoPCA Desktop..."; \
		open $(DESKTOP_PATH)/build/bin/GoPCA.app; \
	elif [ -f "$(DESKTOP_PATH)/build/bin/gopca-desktop" ]; then \
		echo "Running GoPCA Desktop..."; \
		$(DESKTOP_PATH)/build/bin/gopca-desktop; \
	else \
		echo "GoPCA Desktop not found. Build it first with 'make pca-build'"; \
		exit 1; \
	fi

## pca-deps: Install frontend dependencies for GoPCA Desktop
pca-deps:
	@echo "Installing GoPCA Desktop frontend dependencies..."
	@cd $(DESKTOP_PATH)/frontend && npm install
	@echo "GoPCA Desktop dependencies installed"

## csv-dev: Run GoCSV Desktop in development mode with hot reload
csv-dev: build-ui sync-docs
	@if [ -x "$(WAILS)" ]; then \
		echo "Starting CSV editor in development mode..."; \
		cd $(CSV_PATH) && $(WAILS) dev; \
	else \
		echo "Wails not found. Install it with:"; \
		echo "  go install github.com/wailsapp/wails/v2/cmd/wails@$(WAILS_VERSION)"; \
		exit 1; \
	fi

## csv-build: Build GoCSV Desktop for production
csv-build: build-ui sync-docs
	@if [ -x "$(WAILS)" ]; then \
		echo "Building CSV editor application..."; \
		cd $(CSV_PATH) && $(WAILS) build $(DESKTOP_LDFLAGS); \
		echo "CSV editor build complete. Check $(CSV_PATH)/build/bin/"; \
	else \
		echo "Wails not found. Install it with:"; \
		echo "  go install github.com/wailsapp/wails/v2/cmd/wails@$(WAILS_VERSION)"; \
		exit 1; \
	fi

## csv-run: Run the built GoCSV Desktop
csv-run:
	@if [ -f "$(CSV_PATH)/build/bin/gocsv.app/Contents/MacOS/gocsv" ]; then \
		echo "Running CSV editor application..."; \
		open $(CSV_PATH)/build/bin/gocsv.app; \
	elif [ -f "$(CSV_PATH)/build/bin/gocsv" ]; then \
		echo "Running CSV editor application..."; \
		$(CSV_PATH)/build/bin/gocsv; \
	else \
		echo "CSV editor application not found. Build it first with 'make csv-build'"; \
		exit 1; \
	fi

## build-everything-parallel: Build all apps and platforms in parallel
build-everything-parallel:
	@echo "Building all applications in parallel..."
	@$(MAKE) -j3 build-all-parallel pca-build csv-build
	@echo "All parallel builds complete!"

## test-parallel: Run tests in parallel
test-parallel:
	@echo "Running tests in parallel..."
	@$(GOCMD) test -parallel 4 ./...
	@echo "Parallel tests complete!"

## sign: Sign all macOS binaries (requires Apple Developer ID)
sign:
	@echo "Signing macOS binaries..."
	@./scripts/sign-macos.sh

## sign-cli: Sign only the pca CLI binary
sign-cli:
	@echo "Signing pca CLI binary..."
	@./scripts/sign-macos.sh | grep -A 3 "CLI"

## sign-pca: Sign only GoPCA Desktop
sign-pca:
	@echo "Signing GoPCA Desktop..."
	@if [ -d "$(DESKTOP_PATH)/build/bin/GoPCA.app" ]; then \
		codesign --force --deep --sign "$${APPLE_DEVELOPER_ID:-Developer ID Application: Rune Mathisen (LV599Q54BU)}" \
			--options runtime --timestamp \
			"$(DESKTOP_PATH)/build/bin/GoPCA.app" && \
		codesign --verify --verbose "$(DESKTOP_PATH)/build/bin/GoPCA.app"; \
	else \
		echo "GoPCA Desktop not found. Build it first with 'make pca-build'"; \
		exit 1; \
	fi

## sign-csv: Sign only GoCSV Desktop
sign-csv:
	@echo "Signing GoCSV Desktop..."
	@if [ -d "$(CSV_PATH)/build/bin/GoCSV.app" ]; then \
		codesign --force --deep --sign "$${APPLE_DEVELOPER_ID:-Developer ID Application: Rune Mathisen (LV599Q54BU)}" \
			--options runtime --timestamp \
			"$(CSV_PATH)/build/bin/GoCSV.app" && \
		codesign --verify --verbose "$(CSV_PATH)/build/bin/GoCSV.app"; \
	else \
		echo "GoCSV Desktop not found. Build it first with 'make csv-build'"; \
		exit 1; \
	fi

## sign-windows: Sign Windows binaries locally (requires signtool or osslsigncode)
sign-windows:
	@echo "Signing Windows binaries..."
	@echo "=========================================="
	@# Check for ALL required binaries first
	@echo "Checking for required binaries..."
	@if [ ! -f "$(BUILD_DIR)/pca-windows-amd64.exe" ]; then \
		echo "❌ ERROR: pca CLI binary not found at $(BUILD_DIR)/pca-windows-amd64.exe"; \
		echo ""; \
		echo "To fix: Run 'make build-windows-amd64'"; \
		echo ""; \
		exit 1; \
	fi
	@echo "✅ Found: pca-windows-amd64.exe"
	@# Check for both possible filenames (with and without -amd64 suffix)
	@if [ -f "$(DESKTOP_PATH)/build/bin/GoPCA-amd64.exe" ]; then \
		echo "✅ Found: GoPCA-amd64.exe"; \
	elif [ -f "$(DESKTOP_PATH)/build/bin/GoPCA.exe" ]; then \
		echo "✅ Found: GoPCA.exe"; \
	else \
		echo "❌ ERROR: GoPCA Desktop not found"; \
		echo "  Searched: $(DESKTOP_PATH)/build/bin/GoPCA-amd64.exe"; \
		echo "  Searched: $(DESKTOP_PATH)/build/bin/GoPCA.exe"; \
		echo ""; \
		echo "To fix: Build on Windows with 'make pca-build'"; \
		echo ""; \
		exit 1; \
	fi
	@# Check for both possible filenames (with and without -amd64 suffix)
	@if [ -f "$(CSV_PATH)/build/bin/GoCSV-amd64.exe" ]; then \
		echo "✅ Found: GoCSV-amd64.exe"; \
	elif [ -f "$(CSV_PATH)/build/bin/GoCSV.exe" ]; then \
		echo "✅ Found: GoCSV.exe"; \
	else \
		echo "❌ ERROR: GoCSV not found"; \
		echo "  Searched: $(CSV_PATH)/build/bin/GoCSV-amd64.exe"; \
		echo "  Searched: $(CSV_PATH)/build/bin/GoCSV.exe"; \
		echo ""; \
		echo "To fix: Build on Windows with 'make csv-build'"; \
		echo ""; \
		exit 1; \
	fi
	@echo ""
	@# Load environment variables from .env if it exists
	@if [ -f .env ]; then \
		export $$(grep -v '^#' .env | xargs); \
	fi; \
	# Set default certificate location if not specified
	WINDOWS_CERT_FILE="$${WINDOWS_CERT_FILE:-.certs/test-cert.p12}"; \
	WINDOWS_CERT_PASSWORD="$${WINDOWS_CERT_PASSWORD:-test-password}"; \
	\
	if command -v signtool >/dev/null 2>&1 && signtool sign /? >/dev/null 2>&1; then \
		echo "Found signtool, signing binaries..."; \
		signtool sign /a /t http://timestamp.digicert.com "$(BUILD_DIR)/pca-windows-amd64.exe"; \
		signtool sign /a /t http://timestamp.digicert.com "$(DESKTOP_PATH)/build/bin/GoPCA.exe"; \
		signtool sign /a /t http://timestamp.digicert.com "$(CSV_PATH)/build/bin/GoCSV.exe"; \
		echo "✅ All binaries signed with signtool"; \
	elif command -v osslsigncode >/dev/null 2>&1; then \
		echo "Found osslsigncode"; \
		if [ ! -f "$${WINDOWS_CERT_FILE}" ]; then \
			echo ""; \
			echo "❌ Certificate file not found: $${WINDOWS_CERT_FILE}"; \
			echo ""; \
			echo "To generate a test certificate, run:"; \
			echo "  ./scripts/generate-test-cert.sh"; \
			echo ""; \
			echo "Or configure your own certificate in .env:"; \
			echo "  WINDOWS_CERT_FILE=path/to/your/cert.p12"; \
			echo "  WINDOWS_CERT_PASSWORD=your-password"; \
			echo ""; \
			echo "⚠️  Note: Self-signed certificates are for testing only!"; \
			exit 1; \
		fi; \
		echo "Using certificate: $${WINDOWS_CERT_FILE}"; \
		echo ""; \
		echo "Signing binaries..."; \
		osslsigncode sign -pkcs12 "$${WINDOWS_CERT_FILE}" -pass "$${WINDOWS_CERT_PASSWORD}" \
			-t http://timestamp.digicert.com -in "$(BUILD_DIR)/pca-windows-amd64.exe" \
			-out "$(BUILD_DIR)/pca-windows-amd64-signed.exe" && \
		mv "$(BUILD_DIR)/pca-windows-amd64-signed.exe" "$(BUILD_DIR)/pca-windows-amd64.exe" && \
		echo "  ✅ Signed: pca-windows-amd64.exe"; \
		if [ -f "$(DESKTOP_PATH)/build/bin/GoPCA-amd64.exe" ]; then \
			osslsigncode sign -pkcs12 "$${WINDOWS_CERT_FILE}" -pass "$${WINDOWS_CERT_PASSWORD}" \
				-t http://timestamp.digicert.com -in "$(DESKTOP_PATH)/build/bin/GoPCA-amd64.exe" \
				-out "$(DESKTOP_PATH)/build/bin/GoPCA-amd64-signed.exe" && \
			mv "$(DESKTOP_PATH)/build/bin/GoPCA-amd64-signed.exe" "$(DESKTOP_PATH)/build/bin/GoPCA-amd64.exe" && \
			echo "  ✅ Signed: GoPCA-amd64.exe"; \
		else \
			osslsigncode sign -pkcs12 "$${WINDOWS_CERT_FILE}" -pass "$${WINDOWS_CERT_PASSWORD}" \
				-t http://timestamp.digicert.com -in "$(DESKTOP_PATH)/build/bin/GoPCA.exe" \
				-out "$(DESKTOP_PATH)/build/bin/GoPCA-signed.exe" && \
			mv "$(DESKTOP_PATH)/build/bin/GoPCA-signed.exe" "$(DESKTOP_PATH)/build/bin/GoPCA.exe" && \
			echo "  ✅ Signed: GoPCA.exe"; \
		fi; \
		if [ -f "$(CSV_PATH)/build/bin/GoCSV-amd64.exe" ]; then \
			osslsigncode sign -pkcs12 "$${WINDOWS_CERT_FILE}" -pass "$${WINDOWS_CERT_PASSWORD}" \
				-t http://timestamp.digicert.com -in "$(CSV_PATH)/build/bin/GoCSV-amd64.exe" \
				-out "$(CSV_PATH)/build/bin/GoCSV-amd64-signed.exe" && \
			mv "$(CSV_PATH)/build/bin/GoCSV-amd64-signed.exe" "$(CSV_PATH)/build/bin/GoCSV-amd64.exe" && \
			echo "  ✅ Signed: GoCSV-amd64.exe"; \
		else \
			osslsigncode sign -pkcs12 "$${WINDOWS_CERT_FILE}" -pass "$${WINDOWS_CERT_PASSWORD}" \
				-t http://timestamp.digicert.com -in "$(CSV_PATH)/build/bin/GoCSV.exe" \
				-out "$(CSV_PATH)/build/bin/GoCSV-signed.exe" && \
			mv "$(CSV_PATH)/build/bin/GoCSV-signed.exe" "$(CSV_PATH)/build/bin/GoCSV.exe" && \
			echo "  ✅ Signed: GoCSV.exe"; \
		fi; \
		echo ""; \
		echo "✅ All Windows binaries signed successfully!"; \
		echo "⚠️  Note: Self-signed certificates will trigger Windows security warnings"; \
		echo "=========================================="; \
	else \
		echo "signtool or osslsigncode not found."; \
		echo "On Windows, install Windows SDK for signtool."; \
		echo "On macOS/Linux, install osslsigncode via package manager."; \
		exit 1; \
	fi

## windows-installer: Build Windows installer with current binaries
windows-installer:
	@echo "Building Windows installer..."
	@echo "=========================================="
	@# Check if makensis is available
	@if ! command -v makensis >/dev/null 2>&1; then \
		echo "❌ ERROR: makensis not found. Please install NSIS:"; \
		echo "  macOS: brew install nsis"; \
		echo "  Ubuntu/Debian: sudo apt-get install nsis"; \
		echo "  Windows: Download from https://nsis.sourceforge.io"; \
		exit 1; \
	fi
	@# Create installer build directory
	@mkdir -p build/windows-installer
	@# Check for ALL required executables - fail if any are missing
	@echo "Checking for required components..."
	@if [ ! -f "$(BUILD_DIR)/pca-windows-amd64.exe" ]; then \
		echo "❌ ERROR: pca CLI binary not found at $(BUILD_DIR)/pca-windows-amd64.exe"; \
		echo ""; \
		echo "To fix: Run 'make build-windows-amd64'"; \
		echo ""; \
		exit 1; \
	fi
	@echo "✅ Found: pca-windows-amd64.exe"
	@# Check for both possible filenames (with and without -amd64 suffix)
	@if [ -f "$(DESKTOP_PATH)/build/bin/GoPCA-amd64.exe" ]; then \
		echo "✅ Found: GoPCA-amd64.exe"; \
	elif [ -f "$(DESKTOP_PATH)/build/bin/GoPCA.exe" ]; then \
		echo "✅ Found: GoPCA.exe"; \
	else \
		echo "❌ ERROR: GoPCA Desktop not found"; \
		echo "  Searched: $(DESKTOP_PATH)/build/bin/GoPCA-amd64.exe"; \
		echo "  Searched: $(DESKTOP_PATH)/build/bin/GoPCA.exe"; \
		echo ""; \
		echo "To fix: Build with 'make pca-build' or cross-compile with Wails"; \
		echo ""; \
		exit 1; \
	fi
	@# Check for both possible filenames (with and without -amd64 suffix)
	@if [ -f "$(CSV_PATH)/build/bin/GoCSV-amd64.exe" ]; then \
		echo "✅ Found: GoCSV-amd64.exe"; \
	elif [ -f "$(CSV_PATH)/build/bin/GoCSV.exe" ]; then \
		echo "✅ Found: GoCSV.exe"; \
	else \
		echo "❌ ERROR: GoCSV not found"; \
		echo "  Searched: $(CSV_PATH)/build/bin/GoCSV-amd64.exe"; \
		echo "  Searched: $(CSV_PATH)/build/bin/GoCSV.exe"; \
		echo ""; \
		echo "To fix: Build with 'make csv-build' or cross-compile with Wails"; \
		echo ""; \
		exit 1; \
	fi
	@# Copy all executables to installer directory
	@echo ""
	@echo "Copying executables to installer directory..."
	@cp -f "$(BUILD_DIR)/pca-windows-amd64.exe" build/windows-installer/
	@# Copy GoPCA (handle both possible filenames)
	@if [ -f "$(DESKTOP_PATH)/build/bin/GoPCA-amd64.exe" ]; then \
		cp -f "$(DESKTOP_PATH)/build/bin/GoPCA-amd64.exe" build/windows-installer/GoPCA.exe; \
	else \
		cp -f "$(DESKTOP_PATH)/build/bin/GoPCA.exe" build/windows-installer/; \
	fi
	@# Copy GoCSV (handle both possible filenames)
	@if [ -f "$(CSV_PATH)/build/bin/GoCSV-amd64.exe" ]; then \
		cp -f "$(CSV_PATH)/build/bin/GoCSV-amd64.exe" build/windows-installer/GoCSV.exe; \
	else \
		cp -f "$(CSV_PATH)/build/bin/GoCSV.exe" build/windows-installer/; \
	fi
	@echo "✅ All components copied"
	@# Build installer
	@echo ""
	@echo "Creating installer package..."
	@cd scripts/windows && makensis -V2 -DVERSION=$(VERSION) installer.nsi
	@echo ""
	@echo "✅ Windows installer created: build/windows-installer/GoPCA-Setup-v$(VERSION).exe"
	@echo "=========================================="

## windows-installer-signed: Build Windows installer with signed binaries
windows-installer-signed: sign-windows windows-installer
	@echo "✅ Windows installer with signed binaries created"

## windows-installer-all: Build all Windows binaries and create installer
windows-installer-all: build-windows-amd64
	@echo "Note: Desktop applications (GoPCA Desktop, GoCSV Desktop) must be built on Windows"
	@echo "Building available components..."
	@$(MAKE) windows-installer

## notarize: Notarize all macOS binaries (requires .env with APPLE_APP_SPECIFIC_PASSWORD)
notarize:
	@echo "Notarizing macOS binaries..."
	@if [ -f .env ]; then \
		export $$(grep -v '^#' .env | xargs) && ./scripts/notarize-macos.sh; \
	else \
		./scripts/notarize-macos.sh; \
	fi

## notarize-cli: Notarize only the pca CLI binary
notarize-cli:
	@echo "Notarizing CLI binary..."
	@if [ ! -f "$(BUILD_DIR)/$(BINARY_NAME)" ]; then \
		echo "CLI binary not found. Build it first with 'make build'"; \
		exit 1; \
	fi
	@if [ -f .env ]; then \
		export $$(grep -v '^#' .env | xargs); \
	fi; \
	APPLE_ID="$${APPLE_ID:-mathrune@icloud.com}" \
	APPLE_TEAM_ID="$${APPLE_TEAM_ID:-LV599Q54BU}" \
	./scripts/notarize-macos.sh cli-only

## notarize-pca: Notarize only GoPCA Desktop
notarize-pca:
	@echo "Notarizing GoPCA app..."
	@if [ ! -d "$(DESKTOP_PATH)/build/bin/GoPCA.app" ]; then \
		echo "GoPCA Desktop not found. Build it first with 'make pca-build'"; \
		exit 1; \
	fi
	@if [ -f .env ]; then \
		export $$(grep -v '^#' .env | xargs); \
	fi; \
	APPLE_ID="$${APPLE_ID:-mathrune@icloud.com}" \
	APPLE_TEAM_ID="$${APPLE_TEAM_ID:-LV599Q54BU}" \
	./scripts/notarize-macos.sh desktop-only

## notarize-csv: Notarize only GoCSV Desktop
notarize-csv:
	@echo "Notarizing GoCSV Desktop..."
	@if [ ! -d "$(CSV_PATH)/build/bin/GoCSV.app" ]; then \
		echo "GoCSV Desktop not found. Build it first with 'make csv-build'"; \
		exit 1; \
	fi
	@if [ -f .env ]; then \
		export $$(grep -v '^#' .env | xargs); \
	fi; \
	APPLE_ID="$${APPLE_ID:-mathrune@icloud.com}" \
	APPLE_TEAM_ID="$${APPLE_TEAM_ID:-LV599Q54BU}" \
	./scripts/notarize-macos.sh csv-only

## sign-and-notarize: Sign and notarize all macOS binaries
sign-and-notarize: sign notarize
	@echo "All binaries signed and notarized!"

## csv-deps: Install frontend dependencies for GoCSV Desktop
csv-deps:
	@echo "Installing CSV editor frontend dependencies..."
	@cd $(CSV_PATH)/frontend && npm install
	@echo "CSV editor dependencies installed"

## appimage-tool: Download appimagetool for building AppImages
appimage-tool:
	@if [ ! -f "$(BUILD_DIR)/appimagetool-x86_64.AppImage" ]; then \
		echo "Downloading appimagetool..."; \
		curl -L -o "$(BUILD_DIR)/appimagetool-x86_64.AppImage" \
			https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage; \
		chmod +x "$(BUILD_DIR)/appimagetool-x86_64.AppImage"; \
		echo "appimagetool downloaded successfully"; \
	else \
		echo "appimagetool already exists"; \
	fi

## appimage-gopca: Build GoPCA Desktop AppImage (Linux only)
appimage-gopca: appimage-tool
	@echo "Building GoPCA AppImage..."
	@if [ ! -f "$(DESKTOP_PATH)/build/bin/GoPCA" ]; then \
		echo "Error: GoPCA binary not found. Build it first with 'make pca-build' on Linux"; \
		exit 1; \
	fi
	@# Copy binary to appdir
	@cp "$(DESKTOP_PATH)/build/bin/GoPCA" "$(DESKTOP_PATH)/appdir/usr/bin/GoPCA"
	@# Build AppImage
	@cd $(DESKTOP_PATH) && \
		../$(BUILD_DIR)/appimagetool-x86_64.AppImage appdir ../$(BUILD_DIR)/GoPCA-x86_64.AppImage
	@echo "GoPCA AppImage created: $(BUILD_DIR)/GoPCA-x86_64.AppImage"

## appimage-gocsv: Build GoCSV Desktop AppImage (Linux only)
appimage-gocsv: appimage-tool
	@echo "Building GoCSV AppImage..."
	@if [ ! -f "$(CSV_PATH)/build/bin/GoCSV" ]; then \
		echo "Error: GoCSV binary not found. Build it first with 'make csv-build' on Linux"; \
		exit 1; \
	fi
	@# Copy binary to appdir
	@cp "$(CSV_PATH)/build/bin/GoCSV" "$(CSV_PATH)/appdir/usr/bin/GoCSV"
	@# Build AppImage
	@cd $(CSV_PATH) && \
		../$(BUILD_DIR)/appimagetool-x86_64.AppImage appdir ../$(BUILD_DIR)/GoCSV-x86_64.AppImage
	@echo "GoCSV AppImage created: $(BUILD_DIR)/GoCSV-x86_64.AppImage"

## appimage-all: Build both GoPCA Desktop and GoCSV Desktop AppImages (Linux only)
appimage-all: appimage-gopca appimage-gocsv
	@echo "All AppImages built successfully!"

## sync-schemas: Copy every published schema version over its embedded copy
sync-schemas:
	@./scripts/sync-schemas.sh

## check-schemas: Verify the embedded schema copy matches schemas/ (used by CI)
check-schemas:
	@./scripts/sync-schemas.sh --check

## test: Run all tests with coverage
test:
	@echo "Running tests with coverage..."
	$(GOTEST) -cover ./...

## test-verbose: Run tests with detailed output
test-verbose:
	@echo "Running tests with verbose output..."
	$(GOTEST) -v -cover ./...

## test-coverage: Run tests and generate detailed coverage report
test-coverage:
	@echo "Generating coverage report..."
	$(GOTEST) -coverprofile=$(COVERAGE_FILE) ./...
	$(GOCMD) tool cover -html=$(COVERAGE_FILE) -o coverage.html
	@echo "Coverage report generated: coverage.html"

## test-integration: Run comprehensive integration tests
test-integration:
	@echo "Running integration tests..."
	@./scripts/ci/test-integration.sh

## test-platforms: Run platform-specific tests
test-platforms:
	@echo "Running platform-specific tests..."
	@./scripts/ci/test-platforms.sh

## test-e2e: Run end-to-end tests only
test-e2e:
	@echo "Running end-to-end tests..."
	$(GOTEST) -v -run TestE2E ./internal/integration/...

## test-parity: Run pca CLI/GoPCA Desktop parity tests
test-parity:
	@echo "Running parity tests..."
	$(GOTEST) -v -run TestParity ./internal/integration/...

## test-regression: Run regression tests
test-regression:
	@echo "Running regression tests..."
	$(GOTEST) -v -run TestRegression ./internal/integration/...

## generate-sklearn-reference: Generate sklearn reference data for validation tests
generate-sklearn-reference:
	@echo "Generating sklearn reference data..."
	@if [ ! -d "testdata/.venv" ]; then \
		echo "Python virtual environment not found at testdata/.venv"; \
		echo "Please create it with:"; \
		echo "  cd testdata && python3 -m venv .venv && source .venv/bin/activate && pip install numpy pandas scikit-learn"; \
		exit 1; \
	fi
	@cd testdata && \
		. .venv/bin/activate && \
		cd validation && \
		python generate_reference_pca.py && \
		python generate_reference_pcr.py && \
		python generate_studentt_reference.py && \
		python generate_savgol_reference.py && \
		echo "Reference data generated in testdata/validation/reference_results/" && \
		echo "" && \
		echo "These are the generators whose output the Go tests actually read, so a" && \
		echo "local 'make ci-test' now runs the same validation a pull request will." && \
		echo "" && \
		echo "CI additionally runs generate_kernel_pca_reference.py and (off Windows)" && \
		echo "generate_temporal_pca_reference.py. They are omitted here on purpose:" && \
		echo "no Go test reads their output, so running them locally would write 28" && \
		echo "files nobody looks at. Tracked as issue #845."

## fmt: Format all Go code
fmt:
	@echo "Formatting Go code..."
	$(GOFMT) ./...
	@echo "Formatting complete"

## lint: Run golangci-lint (if available)
lint:
ifdef GOLINT
	@echo "Running golangci-lint..."
	golangci-lint run --timeout=5m ./cmd/... ./internal/... ./pkg/...
else
	@echo "golangci-lint not found. Install it with:"
	@echo "  go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"
	@echo "Skipping lint step..."
endif

## typecheck: Type-check every frontend (shared UI, GoPCA Desktop, GoCSV)
##
## Neither `make test` nor `make ci-test` compiles TypeScript, and eslint does
## not type-check -- so until #886 a type error could pass every check in a pull
## request and only appear when someone ran `make pca-dev`. This is the target
## that catches it, and CI runs this exact script, so a pass here means a pass
## there.
typecheck:
	@./scripts/ci/typecheck-frontend.sh

## run-pca-iris: Execute PCA analysis on iris dataset
run-pca-iris: build
	@echo "Running PCA analysis on iris dataset..."
	$(BUILD_DIR)/$(BINARY_NAME) analyze -f json --output-all --include-metrics internal/datasets/iris.csv


## clean: Remove build artifacts and generated files
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(BUILD_DIR)
	@rm -rf $(DESKTOP_PATH)/build/bin
	@rm -rf $(CSV_PATH)/build/bin
	@rm -f $(COVERAGE_FILE) coverage.html
	@echo "Clean complete"

## clean-cross: Remove cross-compiled binaries
clean-cross:
	@echo "Cleaning cross-compiled binaries..."
	@rm -f $(BUILD_DIR)/$(BINARY_NAME)-*
	@echo "Cross-compiled binaries removed"

## install: Install the binary to GOPATH/bin
install: build
	@echo "Installing $(BINARY_NAME) to GOPATH/bin..."
	$(GOCMD) install $(CLI_PATH)
	@echo "Installation complete"

## deps: Download and tidy module dependencies
deps:
	@echo "Downloading Go dependencies..."
	$(GOMOD) download
	$(GOMOD) tidy
	@echo "Go dependencies updated"

## deps-all: Install all dependencies (Go + npm for all apps)
deps-all: deps
	@echo "Installing all frontend dependencies..."
	@npm install
	@echo "All dependencies installed"

## install-hooks: Install git pre-commit hooks
install-hooks:
	@echo "Installing git hooks..."
	@./scripts/install-hooks.sh

## ci-test: Run tests for CI (excluding GoPCA GUI)
ci-test:
	@echo "Running CI tests (excluding GoPCA GUI)..."
	@./scripts/ci/test-core.sh

## ci-lint: Run linter for CI (excluding GoPCA GUI)
ci-lint:
	@echo "Running CI linter (excluding GoPCA GUI)..."
ifdef GOLINT
	golangci-lint run --timeout=5m ./internal/... ./pkg/... ./cmd/gopca-cli/...
else
	@echo "golangci-lint not found, using basic checks..."
	@echo "Checking code formatting..."
	@NEED_FORMAT=$$(gofmt -l internal pkg cmd/gopca-cli 2>/dev/null | grep -v vendor || true); \
	if [ -n "$$NEED_FORMAT" ]; then \
		echo "ERROR: The following files need formatting:"; \
		echo "$$NEED_FORMAT"; \
		exit 1; \
	fi
	@echo "Running go vet..."
	go vet ./internal/... ./pkg/... ./cmd/gopca-cli/...
endif

## ci-build-cli: Build CLI for all platforms in CI
ci-build-cli: build-all

## ci-build-gocsv: Build GoCSV app in CI
ci-build-gocsv:
	@echo "Building GoCSV app for CI..."
	@PLATFORM=$(GOOS) APPNAME=gocsv ./scripts/ci/build-gocsv.sh

## ci-test-all: Run all tests including Wails apps
ci-test-all:
	@echo "Running all tests..."
	@./scripts/ci/test-all.sh

## pca-build-all: Build GoPCA for all platforms
pca-build-all:
	@if [ -x "$(WAILS)" ]; then \
		echo "Building GoPCA for all platforms..."; \
		cd $(DESKTOP_PATH) && $(WAILS) build -platform darwin/amd64,darwin/arm64,windows/amd64,linux/amd64 $(DESKTOP_LDFLAGS); \
		echo "GoPCA builds complete for all platforms"; \
	else \
		echo "Wails not found. Install it with:"; \
		echo "  go install github.com/wailsapp/wails/v2/cmd/wails@$(WAILS_VERSION)"; \
		exit 1; \
	fi

## csv-build-all: Build CSV editor for all platforms
csv-build-all:
	@if [ -x "$(WAILS)" ]; then \
		echo "Building CSV editor for all platforms..."; \
		cd $(CSV_PATH) && $(WAILS) build -platform darwin/amd64,darwin/arm64,windows/amd64,linux/amd64 $(DESKTOP_LDFLAGS); \
		echo "CSV editor builds complete for all platforms"; \
	else \
		echo "Wails not found. Install it with:"; \
		echo "  go install github.com/wailsapp/wails/v2/cmd/wails@$(WAILS_VERSION)"; \
		exit 1; \
	fi

## build-everything: Build all applications for all platforms
build-everything: sync-docs build-all pca-build-all csv-build-all
	@echo "All applications built for all platforms!"

## ci-build-desktop: Build GoPCA app in CI
ci-build-desktop:
	@echo "Building GoPCA app for CI..."
	@PLATFORM=$(GOOS) ./scripts/ci/build-desktop.sh

## ci-setup: Setup CI environment
ci-setup:
	@./scripts/ci/setup-environment.sh

## ci-install-deps: Install platform-specific dependencies
ci-install-deps:
ifeq ($(shell uname -s),Linux)
	@./scripts/ci/install-linux-deps.sh
else
	@echo "No special dependencies needed for $(shell uname -s)"
endif

## help: Display this help message
help:
	@echo "Available targets:"
	@echo ""
	@grep -E '^## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ": "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' | sed 's/^## //'
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Quick start:"
	@echo "  make deps-all         # Install all dependencies (first time)"
	@echo "  make                  # Build pca CLI and test (default)"
	@echo "  make pca-dev          # Run GoPCA Desktop in dev mode"
	@echo "  make csv-dev          # Run GoCSV Desktop in dev mode"
	@echo ""
	@echo "Building pca CLI:"
	@echo "  make build            # Build pca CLI for current platform"
	@echo "  make build-all        # Build pca CLI for all platforms"
	@echo "  make build-linux-amd64   # Build for Linux x64"
	@echo "  make build-darwin-arm64  # Build for macOS Apple Silicon"
	@echo ""
	@echo "Code Signing (macOS):"
	@echo "  make sign             # Sign all macOS binaries"
	@echo "  make sign-cli         # Sign pca CLI binary only"
	@echo "  make sign-pca         # Sign GoPCA Desktop only"
	@echo "  make sign-csv         # Sign GoCSV Desktop only"
	@echo "  make sign-windows     # Sign Windows binaries (requires signtool/osslsigncode)"
	@echo ""
	@echo "Windows Installer:"
	@echo "  make windows-installer        # Build installer with current binaries"
	@echo "  make windows-installer-signed # Build installer with signed binaries"
	@echo "  make windows-installer-all    # Build all binaries and create installer"
	@echo ""
	@echo "Notarization (macOS):"
	@echo "  make notarize         # Notarize all signed binaries"
	@echo "  make notarize-cli     # Notarize pca CLI only"
	@echo "  make notarize-pca     # Notarize GoPCA Desktop only"
	@echo "  make notarize-csv     # Notarize GoCSV Desktop only"
	@echo "  make sign-and-notarize # Sign and notarize everything"
	@echo "  make build-windows-amd64 # Build for Windows x64"
	@echo ""
	@echo "GoPCA application:"
	@echo "  make pca-deps         # Install dependencies"
	@echo "  make pca-dev          # Run in development mode"
	@echo "  make pca-build        # Build for current platform"
	@echo "  make pca-build-all    # Build for all platforms"
	@echo "  make pca-run          # Run the built application"
	@echo ""
	@echo "CSV editor application:"
	@echo "  make csv-deps         # Install dependencies"
	@echo "  make csv-dev          # Run in development mode"
	@echo "  make csv-build        # Build for current platform"
	@echo "  make csv-build-all    # Build for all platforms"
	@echo "  make csv-run          # Run the built application"
	@echo ""
	@echo "Build everything:"
	@echo "  make build-everything # Build all apps for all platforms"
	@echo ""
	@echo "Testing & quality:"
	@echo "  make test             # Run tests with coverage"
	@echo "  make test-verbose     # Run tests with detailed output"
	@echo "  make fmt              # Format all Go code"
	@echo "  make lint             # Run linter (if installed)"
	@echo "  make run-pca-iris     # Run PCA on example dataset"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean            # Clean all build artifacts"
	@echo "  make clean-cross      # Clean cross-compiled binaries"
	@echo "  make deps             # Update Go dependencies"
	@echo "  make deps-all         # Install all dependencies"
	@echo "  make install-hooks    # Install git pre-commit hooks"