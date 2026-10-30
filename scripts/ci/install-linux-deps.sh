#!/bin/bash
#
# install-linux-deps.sh - Robust installation of Linux dependencies for GoPCA
#
# This script handles the various webkit package versions across different Ubuntu releases
# and provides clear error messages when packages are not available.

set -e

echo "=== Installing Linux Dependencies for GoPCA ==="
echo "OS Info: $(lsb_release -d 2>/dev/null || echo 'Unknown')"

# Update package lists
echo "Updating package lists..."
sudo apt-get update

# Install common dependencies
echo "Installing dependencies for the Wails v3 default stack (GTK4 + WebKitGTK 6.0)..."
# ubuntu-latest (24.04) ships both. The GTK3/WebKit2GTK 4.1 stack that v2 used
# is a legacy `-tags gtk3` option in v3.0.x only and is removed in v3.1; the
# AppImage bundles WebKit and its helper processes, so older distributions can
# still run the published build.
sudo apt-get install -y \
    build-essential \
    pkg-config \
    libgtk-4-dev \
    libwebkitgtk-6.0-dev

echo ""
echo "=== Verification ==="
echo "Installed packages:"
dpkg -l | grep -E "(gtk-4|webkitgtk)" | grep -E "dev" || true

echo ""
echo "=== Linux dependencies successfully installed ==="