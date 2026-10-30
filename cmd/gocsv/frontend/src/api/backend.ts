// GoPCA Suite
//
// Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
//
// This file is part of GoPCA Suite.
//
// See LICENSE for the full license terms.

// The one place the frontend touches Wails. Every bound Go method, every
// generated model namespace, the typed event names and the runtime managers
// are re-exported from here, so a change to where the generator puts things
// -- it keys the path on the Go import path, so moving a Go type between
// packages moves its TypeScript too -- is a one-line change in this file
// rather than an edit in every component that imports it.
export * from '../../bindings/github.com/bitjungle/gopca/cmd/gocsv/app';
export * as main from '../../bindings/github.com/bitjungle/gopca/cmd/gocsv/models';
export * as dataquality from '../../bindings/github.com/bitjungle/gopca/pkg/dataquality/models';
export * as events from '../../bindings/events';
export { Events, Browser } from '@wailsio/runtime';

// A Go method that returns a pointer is typed `T | null` by the generator. On
// success the Go side always returns a value: nil only ever accompanies an
// error, and an error rejects the promise before this runs. A null here is
// therefore a broken contract, not a case to handle, and the callers' existing
// error handling is the right place for it to surface.
export function required<T>(value: T | null | undefined, method: string): T {
    if (value === null || value === undefined) {
        throw new Error(`${method} returned no data`);
    }
    return value;
}
