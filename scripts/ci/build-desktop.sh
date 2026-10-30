#!/bin/bash
#
# build-desktop.sh - Build GoPCA desktop application
#
# This script ensures all prerequisites are met before building the desktop app
# and provides clear error messages when something is missing.

set -e

echo "=== Building GoPCA Desktop Application ==="

# Check for required tools
echo "Checking prerequisites..."

if ! command -v go &> /dev/null; then
    echo "ERROR: Go is not installed"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    exit 1
fi

if ! command -v wails3 &> /dev/null; then
    echo "WARNING: Wails CLI not found in PATH, checking GOPATH..."
    # Try to find wails3 in GOPATH
    WAILS_BIN="$(go env GOPATH)/bin/wails3"
    if [ -x "$WAILS_BIN" ]; then
        echo "Found wails3 at: $WAILS_BIN"
        # Add GOPATH/bin to PATH for this script
        export PATH="$PATH:$(go env GOPATH)/bin"
    else
        echo "ERROR: Wails CLI is not installed"
        echo "Install with: go install github.com/wailsapp/wails/v3/cmd/wails3@$(grep 'wailsapp/wails/v3 v' go.mod | awk '{print $2}')"
        exit 1
    fi
fi

# Show versions
echo ""
echo "Tool versions:"
echo "- Go: $(go version)"
echo "- Node: $(node --version)"
echo "- Wails: $(wails3 version 2>/dev/null || echo 'version unknown')"

# Change to desktop directory
cd cmd/gopca-desktop

# Skip installing dependencies - they're installed at the root in CI
echo ""
echo "Skipping frontend dependency installation (handled by CI)"

# Build the desktop app
echo ""
echo "Building desktop application..."

# Detect platform if not set
if [ -z "$PLATFORM" ]; then
    case "$(uname -s)" in
        Linux*)   PLATFORM=linux ;;
        Darwin*)  PLATFORM=darwin ;;
        MINGW*|MSYS*|CYGWIN*)   PLATFORM=windows ;;
        *)        
            echo "WARNING: Unknown platform $(uname -s), defaulting to linux"
            PLATFORM=linux ;;
    esac
fi

echo "Building for platform: $PLATFORM"

# Build with wails3 (the Taskfile generates bindings, builds the frontend and
# compiles for the host OS; PLATFORM is informational). VERSION reaches
# internal/version through the Taskfile; a darwin build also packages the .app,
# which is what the signing and notarization steps that follow expect.
TASK=build
[ "$PLATFORM" = darwin ] && TASK=darwin:package
if wails3 task "$TASK" VERSION="${VERSION:-dev}"; then
    echo ""
    echo "=== Desktop application built successfully ==="
    echo "Binary location: build/bin/"
    ls -la build/bin/ 2>/dev/null || true
    # The mcp build tag compiles a control server into the app (bound to
    # loopback, driving the UI and bound methods). It is a development aid and
    # must never ship; `wails3 build` only adds it when WAILS_MCP is set, and
    # this makes a leak fail the build rather than pass a privacy audit that
    # never looked at the binary.
    for bin in build/bin/GoPCA build/bin/GoPCA.exe; do
        if [ -f "$bin" ] && go version -m "$bin" 2>/dev/null | grep -qE 'tags=.*\bmcp\b'; then
            echo "ERROR: $bin was built with the mcp tag"
            exit 1
        fi
    done
else
    echo ""
    echo "ERROR: Desktop build failed"
    exit 1
fi