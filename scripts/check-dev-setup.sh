#!/bin/bash
#
# check-dev-setup.sh - Check if development environment is properly set up
#

echo "Checking GoPCA development setup..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Go version
echo "→ Checking Go version..."
if command -v go &> /dev/null; then
    GO_VERSION=$(go version | grep -oE '[0-9]+\.[0-9]+' | head -1)
    GO_MAJOR=$(echo $GO_VERSION | cut -d. -f1)
    GO_MINOR=$(echo $GO_VERSION | cut -d. -f2)
    
    if [ "$GO_MAJOR" -gt 1 ] || ([ "$GO_MAJOR" -eq 1 ] && [ "$GO_MINOR" -ge 21 ]); then
        echo -e "${GREEN}✓${NC} Go $GO_VERSION installed"
    else
        echo -e "${RED}✗${NC} Go version $GO_VERSION is too old. Need 1.21+"
    fi
else
    echo -e "${RED}✗${NC} Go not installed"
fi

# Check Node.js (for GUI development)
echo ""
echo "→ Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | grep -oE '[0-9]+' | head -1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✓${NC} Node.js $(node --version) installed"
    else
        echo -e "${YELLOW}⚠${NC} Node.js version $(node --version) is old. Recommend 18+"
    fi
else
    echo -e "${YELLOW}⚠${NC} Node.js not installed (only needed for GUI development)"
fi

# Check if Git hooks are installed
echo ""
echo "→ Checking Git hooks..."
if [ -f ".git/hooks/pre-commit" ]; then
    echo -e "${GREEN}✓${NC} Pre-commit hook installed"
else
    echo -e "${RED}✗${NC} Pre-commit hook not installed. Run: make install-hooks"
fi

# Check if dependencies are installed
echo ""
echo "→ Checking Go dependencies..."
if [ -f "go.sum" ] && [ -s "go.sum" ]; then
    echo -e "${GREEN}✓${NC} Go dependencies downloaded"
else
    echo -e "${YELLOW}⚠${NC} Go dependencies not downloaded. Run: make deps"
fi

# Check if golangci-lint is installed
echo ""
echo "→ Checking optional tools..."
if command -v golangci-lint &> /dev/null; then
    echo -e "${GREEN}✓${NC} golangci-lint installed"
else
    echo -e "${YELLOW}⚠${NC} golangci-lint not installed (optional but recommended)"
fi

# Check if wails is installed (for GUI development)
if command -v wails3 &> /dev/null || [ -f "$HOME/go/bin/wails3" ]; then
    echo -e "${GREEN}✓${NC} Wails v3 CLI (wails3) installed (for GUI development)"
else
    echo -e "${YELLOW}⚠${NC} wails3 not installed (only needed for GUI development)"
fi

# Summary
echo ""
echo "================================"
echo "Summary:"
echo ""

ISSUES=0

if ! command -v go &> /dev/null || [ "$GO_MAJOR" -lt 1 ] || ([ "$GO_MAJOR" -eq 1 ] && [ "$GO_MINOR" -lt 21 ]); then
    echo -e "${RED}!${NC} Install Go 1.21+ from https://golang.org/dl/"
    ISSUES=$((ISSUES + 1))
fi

if [ ! -f ".git/hooks/pre-commit" ]; then
    echo -e "${RED}!${NC} Run 'make install-hooks' to install Git hooks"
    ISSUES=$((ISSUES + 1))
fi

if [ ! -f "go.sum" ] || [ ! -s "go.sum" ]; then
    echo -e "${YELLOW}!${NC} Run 'make deps' to download dependencies"
    ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ Your development environment is properly set up!${NC}"
else
    echo -e "${YELLOW}⚠ Please address the above issues before contributing.${NC}"
fi