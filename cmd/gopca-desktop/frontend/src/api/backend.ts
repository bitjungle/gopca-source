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
export * from '../../bindings/github.com/bitjungle/gopca/cmd/gopca-desktop/app';
export * as main from '../../bindings/github.com/bitjungle/gopca/cmd/gopca-desktop/models';
export * as config from '../../bindings/github.com/bitjungle/gopca/internal/config/models';
export * as types from '../../bindings/github.com/bitjungle/gopca/pkg/types/models';
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

// The generator's model types carry two conventions the UI's own types in
// src/types do not: map values are optional (`{ [k]?: T }`), because JSON
// cannot promise a key is present, and pointer fields are `T | null`. On the
// wire Go fills every map key it sends and returns nil only alongside an
// error, so the UI types are accurate for anything that arrives here. This is
// the one place a wire type becomes a UI type. It is a type assertion, not a
// copy, and it is deliberately the only such assertion in the frontend.
export function fromWire<T>(value: unknown): T {
    return value as T;
}

// True inside a Wails window, false in a plain browser tab during frontend
// development, where exports fall back to a browser download. v2 exposed
// window.go for this test; v3 exposes nothing equivalent, so look for the
// native message bridge the runtime itself uses to reach Go.
export function isWailsEnvironment(): boolean {
    const w = window as unknown as {
        webkit?: { messageHandlers?: { external?: unknown } };
        chrome?: { webview?: unknown };
    };
    return Boolean(w.webkit?.messageHandlers?.external || w.chrome?.webview);
}
