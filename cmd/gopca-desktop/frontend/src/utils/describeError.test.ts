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

import { describe, it, expect } from 'vitest';
import { describeError } from './describeError';

// A Wails binding rejects with whatever the Go side produced, and interpolating
// that straight into a template literal gives "[object Object]" for most of it.
// The message then tells the user only that something failed, which they knew.

describe('describeError', () => {
    it('uses the message of an Error', () => {
        expect(describeError(new Error('file is not valid UTF-8'))).toBe('file is not valid UTF-8');
    });

    it('passes a string through unchanged', () => {
        expect(describeError('no such file')).toBe('no such file');
    });

    // The case that prompted this: a plain object is what a rejected binding
    // most often carries, and it is the one String() renders uselessly.
    it('serialises a plain object rather than rendering [object Object]', () => {
        const described = describeError({ code: 2, detail: 'permission denied' });
        expect(described).not.toContain('[object Object]');
        expect(described).toContain('permission denied');
    });

    it('falls back for a value that cannot be serialised', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(() => describeError(circular)).not.toThrow();
        expect(describeError(circular)).toBe('[object Object]');
    });

    it('does not return a bare empty object', () => {
        expect(describeError({})).toBe('[object Object]');
    });

    it('renders null and undefined readably', () => {
        expect(describeError(null)).toBe('null');
        expect(describeError(undefined)).toBe('undefined');
    });
});
