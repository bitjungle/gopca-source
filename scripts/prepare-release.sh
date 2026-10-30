#!/bin/bash

# Script to prepare a new release of GoPCA
# Usage: ./scripts/prepare-release.sh <version>
# Example: ./scripts/prepare-release.sh v0.9.0

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

# Get version without 'v' prefix for build/config.yml
VERSION_NO_V=${VERSION:1}

echo -e "${GREEN}Preparing release for version ${VERSION}${NC}"

# 1. Check that we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}Warning: Not on main branch (currently on $CURRENT_BRANCH)${NC}"
    echo "Fetching latest main..."
    git fetch origin main
else
    echo "✓ On main branch"
    git pull origin main
fi

# 2. Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}Error: You have uncommitted changes${NC}"
    echo "Please commit or stash your changes before preparing a release"
    exit 1
fi
echo "✓ No uncommitted changes"

# 3. Run tests
echo -e "${YELLOW}Running tests...${NC}"
if ! make test; then
    echo -e "${RED}Error: Tests failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ All tests passed${NC}"

# 4. Run linter
echo -e "${YELLOW}Running linter...${NC}"
if ! make lint; then
    echo -e "${RED}Error: Linter failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Linter passed${NC}"

# 5. Create release branch
RELEASE_BRANCH="release-${VERSION}"
echo -e "${YELLOW}Creating release branch: ${RELEASE_BRANCH}${NC}"
git checkout -b "$RELEASE_BRANCH"

# 6. Update version in each app's build/config.yml, then re-render the build
# assets that carry it (Info.plist, Info.dev.plist, windows/info.json and the
# Windows manifest). Wails v3 copies those files verbatim at build time, so the
# version is baked into them here rather than substituted during the build.
echo -e "${YELLOW}Updating version to ${VERSION_NO_V} in build/config.yml files${NC}"
for app in cmd/gopca-desktop cmd/gocsv; do
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/^  version: \".*\"/  version: \"${VERSION_NO_V}\"/" "$app/build/config.yml"
    else
        sed -i "s/^  version: \".*\"/  version: \"${VERSION_NO_V}\"/" "$app/build/config.yml"
    fi
    grep -q "^  version: \"${VERSION_NO_V}\"" "$app/build/config.yml" || { echo -e "${RED}Version not updated in $app/build/config.yml${NC}"; exit 1; }
    (cd "$app" && wails3 task common:update:build-assets)
done

# 7. Commit version changes
git add cmd/gopca-desktop/build/config.yml cmd/gopca-desktop/build/darwin/Info.plist cmd/gopca-desktop/build/darwin/Info.dev.plist cmd/gopca-desktop/build/windows/info.json cmd/gopca-desktop/build/windows/wails.exe.manifest
git add cmd/gocsv/build/config.yml cmd/gocsv/build/darwin/Info.plist cmd/gocsv/build/darwin/Info.dev.plist cmd/gocsv/build/windows/info.json cmd/gocsv/build/windows/wails.exe.manifest
git commit -m "chore: bump version to ${VERSION}

Preparing for release ${VERSION}
- Update GoPCA Desktop version
- Update GoCSV version"

echo -e "${GREEN}✓ Release preparation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Push the branch: git push -u origin ${RELEASE_BRANCH}"
echo "2. Create a PR to main using: gh pr create --title \"Release ${VERSION}\" --body \"Preparing release ${VERSION}\""
echo "3. After PR is merged, run: ./scripts/release.sh ${VERSION}"