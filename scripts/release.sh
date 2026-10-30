#!/bin/bash

# Script to create a release after the release PR has been merged
# This only creates and pushes the tag - GitHub Actions handles the rest
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh v0.9.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if version argument is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Version argument is required${NC}"
    echo "Usage: $0 <version>"
    echo "Example: $0 v0.9.0"
    exit 1
fi

VERSION=$1

# Validate version format (should be vX.Y.Z)
if ! [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid version format${NC}"
    echo "Version should be in format vX.Y.Z (e.g., v0.9.0)"
    exit 1
fi

echo -e "${GREEN}Creating release ${VERSION}${NC}"

# 1. Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${RED}Error: Must be on main branch to create a release${NC}"
    echo "Current branch: $CURRENT_BRANCH"
    exit 1
fi
echo "✓ On main branch"

# 2. Pull latest changes
echo -e "${YELLOW}Pulling latest changes...${NC}"
git pull origin main

# 3. Check that the version in each app's build/config.yml matches
VERSION_NO_V=${VERSION:1}
WAILS_VERSION=$(grep '^  version:' cmd/gopca-desktop/build/config.yml | sed 's/.*version: "\(.*\)".*/\1/')
GOCSV_VERSION=$(grep '^  version:' cmd/gocsv/build/config.yml | sed 's/.*version: "\(.*\)".*/\1/')

if [ "$WAILS_VERSION" != "$VERSION_NO_V" ] || [ "$GOCSV_VERSION" != "$VERSION_NO_V" ]; then
    echo -e "${RED}Error: Version mismatch${NC}"
    echo "Expected version: $VERSION_NO_V"
    echo "GoPCA Desktop version: $WAILS_VERSION"
    echo "GoCSV version: $GOCSV_VERSION"
    echo "Did you forget to merge the release PR?"
    exit 1
fi
echo "✓ Version in build/config.yml files matches"

# 4. Check if tag already exists
if git rev-parse "$VERSION" >/dev/null 2>&1; then
    echo -e "${RED}Error: Tag $VERSION already exists${NC}"
    exit 1
fi

# 5. Create and push tag
echo -e "${YELLOW}Creating tag ${VERSION}...${NC}"
git tag -a "$VERSION" -m "Release $VERSION"
git push origin "$VERSION"
echo -e "${GREEN}✓ Tag created and pushed${NC}"

echo ""
echo -e "${GREEN}✓ Release tag ${VERSION} pushed successfully!${NC}"
echo ""
echo "The automated release workflow will now:"
echo "1. Build all binaries for all platforms"
echo "2. Sign and notarize macOS applications"
echo "3. Create the GitHub release with all artifacts"
echo "4. Generate release notes automatically"
echo ""
echo "Monitor progress at: https://github.com/bitjungle/gopca/actions"
echo "Or run: gh run watch"
echo ""
echo "The release will be available at: https://github.com/bitjungle/gopca/releases/tag/${VERSION}"