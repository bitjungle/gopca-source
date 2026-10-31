// @vitest-environment jsdom
//
// Issue #1042: the drop zone's handler alerted that drag-and-drop was
// unsupported. Under Wails v2 the runtime intercepted the DOM event before it
// arrived, so the alert was dead code; under v3 it fired on every drop, while
// the host application was loading the file from the Go side. The handler's
// whole job is to end the hover state and keep the webview from navigating to
// the dropped file; this pins both, and that no alert comes back.

import { StrictMode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FileSelector } from './FileSelector';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function dropZone() {
    // The zone is the element that announces the gesture.
    return screen.getByText(/drag and drop files here/i).closest('div[class*="border-dashed"]') as HTMLElement;
}

const fileTransfer = {
    dataTransfer: { types: ['Files'], files: [new File(['a,b\n1,2'], 'x.csv')], items: [] }
};

describe('FileSelector drop zone (#1042)', () => {
    it('does not alert on a drop, and prevents the navigation default', () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        render(<StrictMode><FileSelector onFileSelect={() => {}} /></StrictMode>);

        const zone = dropZone();
        fireEvent.dragEnter(zone, fileTransfer);
        // fireEvent returns false when a handler called preventDefault, which is
        // what stops WebKit from navigating to the dropped file.
        expect(fireEvent.drop(zone, fileTransfer)).toBe(false);

        expect(alertSpy).not.toHaveBeenCalled();
    });

    it('ends the hover state on drop', () => {
        render(<StrictMode><FileSelector onFileSelect={() => {}} /></StrictMode>);
        const zone = dropZone();

        // Exact strings: the hover text "Drop files here" is a substring of
        // the resting text "Drag and drop files here, or", so a regex would
        // match both.
        fireEvent.dragEnter(zone, fileTransfer);
        expect(screen.getByText('Drop files here')).toBeTruthy();

        fireEvent.drop(zone, fileTransfer);
        expect(screen.queryByText('Drop files here')).toBeNull();
        expect(screen.getByText(/drag and drop files here/i)).toBeTruthy();
    });
});
