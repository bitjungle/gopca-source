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

/**
 * Renders a caught value as something a user can read.
 *
 * Interpolating a rejection straight into a template literal gives
 * "[object Object]" for anything that is not an Error or a string — which is
 * most of what a Wails binding rejects with. The message then tells the user
 * only that something failed, which they already knew from the failure.
 */
export function describeError(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === 'string') {
        return err;
    }
    try {
        const described = JSON.stringify(err);
        if (described && described !== '{}') {
            return described;
        }
    } catch {
        // Circular or otherwise unserialisable; fall through.
    }
    return String(err);
}
