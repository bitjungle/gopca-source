#!/bin/bash
# GoPCA Suite
#
# Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
# See LICENSE for the full license terms.
#
# sync-schemas.sh - Mirror schemas/ onto the embedded copy in pkg/validation/
#
# schemas/ is the source of truth: it is the directory the $id URLs in every
# model file name, and the copy published to the public distribution repo. The
# copy under pkg/validation/schemas/ exists only because //go:embed cannot
# reach outside its own package.
#
# The two drifted once before (a missing enum value in v1), which nothing
# caught, because syncing was a manual Make target with no check behind it.
# --check is what closes that: it reports drift without modifying anything and
# exits non-zero, so CI can fail on it.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

SOURCE_DIR="schemas"
EMBED_DIR="pkg/validation/schemas"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

CHECK_ONLY=false
[ "${1:-}" = "--check" ] && CHECK_ONLY=true

if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}✗ $SOURCE_DIR does not exist${NC}" >&2
    exit 1
fi

drift=0
synced=0
removed=0

# Every version directory under schemas/ must have an identical embedded copy.
for version_path in "$SOURCE_DIR"/v*/; do
    [ -d "$version_path" ] || continue
    version=$(basename "$version_path")
    target_dir="$EMBED_DIR/$version"

    for source_file in "$version_path"*.json; do
        [ -f "$source_file" ] || continue
        name=$(basename "$source_file")
        target_file="$target_dir/$name"

        if [ -f "$target_file" ] && cmp -s "$source_file" "$target_file"; then
            continue
        fi

        if $CHECK_ONLY; then
            if [ -f "$target_file" ]; then
                echo -e "${RED}✗ out of sync:${NC} $target_file"
            else
                echo -e "${RED}✗ missing:${NC}    $target_file"
            fi
            drift=$((drift + 1))
        else
            mkdir -p "$target_dir"
            cp -p "$source_file" "$target_file"
            echo -e "${GREEN}✓ synced:${NC}     $target_file"
            synced=$((synced + 1))
        fi
    done
done

# An embedded file with no counterpart in schemas/ is drift in the other
# direction: it would be validated against but is not the published schema.
# In --check mode that is reported; otherwise it is deleted, because syncing
# has to be able to fix everything the check complains about. Reporting it here
# but not removing it would leave --check failing while telling the user to run
# a sync that cannot resolve it.
for embed_path in "$EMBED_DIR"/v*/; do
    [ -d "$embed_path" ] || continue
    version=$(basename "$embed_path")
    for embed_file in "$embed_path"*.json; do
        [ -f "$embed_file" ] || continue
        name=$(basename "$embed_file")
        if [ ! -f "$SOURCE_DIR/$version/$name" ]; then
            if $CHECK_ONLY; then
                echo -e "${RED}✗ orphaned:${NC}   $embed_file has no counterpart in $SOURCE_DIR/$version/"
                drift=$((drift + 1))
            else
                rm "$embed_file"
                echo -e "${GREEN}✓ removed:${NC}    $embed_file (no counterpart in $SOURCE_DIR/$version/)"
                removed=$((removed + 1))
            fi
        fi
    done
    # A whole version directory can be orphaned, not just files within one.
    if [ -d "$embed_path" ] && [ -z "$(ls -A "$embed_path")" ]; then
        if $CHECK_ONLY; then
            echo -e "${RED}✗ orphaned:${NC}   $embed_path is empty and has no counterpart"
            drift=$((drift + 1))
        else
            rmdir "$embed_path"
            echo -e "${GREEN}✓ removed:${NC}    $embed_path (empty)"
            removed=$((removed + 1))
        fi
    fi
done

if $CHECK_ONLY; then
    if [ "$drift" -gt 0 ]; then
        echo ""
        echo -e "${RED}$drift schema file(s) out of sync.${NC}"
        echo "Run 'make sync-schemas' and commit the result."
        echo ""
        echo "schemas/ is the source. It is what the \$id URLs in every model"
        echo "file name, so it is never the copy that gets corrected."
        exit 1
    fi
    echo -e "${GREEN}✓ schemas/ and $EMBED_DIR/ are identical${NC}"
    exit 0
fi

if [ "$synced" -eq 0 ] && [ "$removed" -eq 0 ]; then
    echo -e "${GREEN}✓ already in sync${NC} - nothing to copy or remove"
else
    echo ""
    echo -e "${GREEN}Synced $synced file(s), removed $removed.${NC}"
fi
echo -e "${YELLOW}schemas/ is the source: it is what the \$schema URLs name.${NC}"
echo "The copy exists only because //go:embed cannot reach outside its package."
