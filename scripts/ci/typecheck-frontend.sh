#!/usr/bin/env bash
#
# GoPCA Suite
#
# Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
#
# This file is part of GoPCA Suite.
#
# See LICENSE for the full license terms.
#
# Type-checks all three frontends -- the shared UI components, GoPCA Desktop and
# GoCSV -- then runs the structural checks tsc cannot make.
#
# Why this is a script rather than a handful of workflow steps. The type error
# that broke `make pca-dev` in #885 passed a completely green pull request, and
# the first attempt to catch it in CI then passed on a developer machine and
# failed on a runner. Both failures have one cause: the check ran against a tree
# in a different state from the one it was meant to verify. A single script,
# invoked identically by `make typecheck` and by the workflow, removes that
# difference -- what a developer runs before pushing is line for line what CI
# runs afterwards.
#
# Type-checking is only meaningful against real bindings. `tsc` either resolves
# the `wailsjs` imports to actual Go-derived declarations, or it reports TS2307
# for every one of them followed by a cascade of TS7006 on the values that are
# now untyped. Stubbing those imports would make the check pass without
# checking the thing that matters, so this script generates them.

set -euo pipefail

cd "$(dirname "$0")/../.."
ROOT="$(pwd)"

# Check the prerequisites separately, so the error names the dependency that is
# actually missing. Without the Go check, a machine with no Go at all reports
# "Wails CLI is not installed" -- `go env GOPATH` fails, the substitution yields
# an empty string, and the lookup falls through to the wrong branch.
if ! command -v go &> /dev/null; then
    echo "ERROR: Go is not installed, and the frontends cannot be type-checked"
    echo "without the Wails bindings it generates from the app's Go source."
    echo "Install Go 1.26 or later: https://go.dev/dl/"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo "ERROR: Node.js is not installed. Install Node.js 24 or later:"
    echo "https://nodejs.org/"
    exit 1
fi

# Checked separately from npx: this script also runs a plain Node script, and a
# minimal environment can carry one without the other. Naming the missing
# binary beats failing later with "node: command not found" from a step whose
# purpose is unrelated to it.
if ! command -v node &> /dev/null; then
    echo "ERROR: the node binary is not on PATH, and the structural checks"
    echo "below are plain Node scripts. Install Node.js 24 or later:"
    echo "https://nodejs.org/"
    exit 1
fi

# Locate the Wails v3 CLI, following the same convention as build-desktop.sh.
if ! command -v wails3 &> /dev/null; then
    if [ -x "$(go env GOPATH)/bin/wails3" ]; then
        export PATH="$PATH:$(go env GOPATH)/bin"
    else
        echo "ERROR: Wails CLI is not installed, and the frontends cannot be"
        echo "type-checked without the Go bindings it generates."
        echo "Install with: go install github.com/wailsapp/wails/v3/cmd/wails3@$(grep 'wailsapp/wails/v3 v' "$ROOT/go.mod" | awk '{print $2}')"
        exit 1
    fi
fi

# `wails3 generate bindings` analyses the Go source statically; nothing is
# compiled or run, so the `//go:embed all:frontend/dist` in each main.go is
# never evaluated and no placeholder dist is needed (the v2 CLI built and ran
# the app to discover bindings, which is why one used to be created here).
#
# -ts without -i: class bindings keep Go slices typed as T[] the way v2 did;
# interface mode types every slice `T[] | null` and the frontends are not
# written for that. The Taskfiles pass the same flags, so what tsc checks here
# is what the apps are built against.
generate_bindings() {
    local app="$1"
    (cd "$ROOT/cmd/$app" && wails3 generate bindings -ts -d frontend/bindings)
}

# The apps import their types from the built shared package, not from its
# source, so a missing or stale dist produces type errors that have nothing to
# do with the code under test. Rebuilding takes a few seconds; a check that can
# fail for a reason unrelated to the code is worth more than those seconds.
echo "==> Building shared UI components"
npm run build-ui

# Both apps' frontend/bindings/ are gitignored and generated, so neither can go
# stale against the Go it describes.
echo "==> Generating GoPCA Desktop Wails bindings"
generate_bindings gopca-desktop

echo "==> Generating GoCSV Wails bindings"
generate_bindings gocsv

# --no-install pins tsc to the version npm installed. Plain `npx tsc` silently
# fetches a TypeScript of its own choosing when one is missing from
# node_modules, and a check whose version can change underneath you is not a
# check.
echo "==> Type-checking shared UI components"
npx --no-install tsc --noEmit -p packages/ui-components/tsconfig.json

echo "==> Type-checking GoPCA Desktop frontend"
npx --no-install tsc --noEmit -p cmd/gopca-desktop/frontend/tsconfig.json

echo "==> Type-checking GoCSV frontend"
npx --no-install tsc --noEmit -p cmd/gocsv/frontend/tsconfig.json

# Structural checks that tsc cannot make. The GoCSV context menu is built in a
# React callback with no test runner behind it, so a menu entry can be valid
# TypeScript, pass every Go test, and still render wrong (#923, #927).
echo "==> Checking frontend invariants"
node scripts/ci/check-frontend-invariants.mjs

echo ""
echo "All frontends type-check cleanly, and the frontend invariants hold."
