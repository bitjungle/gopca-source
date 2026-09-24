// GoPCA Suite
//
// Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
//
// This file is part of GoPCA Suite.
//
// See LICENSE for the full license terms.

import { defineConfig } from 'vitest/config';

// GoCSV's frontend had no test setup at all until #1002, which is why a dialog
// could report "Transformation Results" for a transform that had refused to act
// and nothing caught it. The rule that decides what the dialog says is a pure
// function so that it can be tested here rather than only looked at.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
    }
});
