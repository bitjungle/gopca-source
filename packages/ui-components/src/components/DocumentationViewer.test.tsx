// @vitest-environment jsdom
//
// GoPCA Suite
//
// Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
//
// This file is part of GoPCA Suite.
//
// See LICENSE for the full license terms.

import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentationViewer } from './DocumentationViewer';
import { extractHeadings } from '../utils/tocUtils';
// Typed by vite/client, declared in src/vite-env.d.ts. These imports needed a
// suppression directive until that file existed.
import introToPca from '../../../../docs/intro_to_pca.md?raw';
import introToDataPrep from '../../../../docs/intro_to_data_prep.md?raw';

/**
 * The table of contents renders and looks right, and clicking an entry does
 * nothing (#436). Every reading of the code says it should work: the entries
 * come from the same slug function the headings use, the handler queries the
 * scroll container for that id and calls scrollIntoView, and the button is a
 * real button with a real onClick.
 *
 * So the defect is not visible in the source, only in a rendered tree — which
 * is why this is the first component test in this package.
 */

const MARKDOWN = `# Title

Intro paragraph.

## 1. Introduction: The Need for Simpler Data

Some text.

## 2. What is PCA?

More text.

### 2.1 A Sub Heading

Detail.

## 3. Conclusion

Done.
`;

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK',
        text: () => Promise.resolve(MARKDOWN)
    }));
    // jsdom implements neither, and both are called by the component.
    // jsdom implements neither scrollTo nor layout, so getBoundingClientRect
    // returns zeros. The offset arithmetic is therefore not exercised here --
    // what is checked is that the right container is asked to scroll.
    Element.prototype.scrollTo = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
        observe() {}
        unobserve() {}
        disconnect() {}
    });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

// Both applications mount inside React.StrictMode, which invokes render twice
// in development to surface side effects. Every test here renders the same way:
// without it, a renderer that mutates state while building the tree looks
// correct, which is exactly how #436 survived a browser reproduction, a jsdom
// suite and two attempted fixes.
const openViewer = async () => {
    render(
        <StrictMode>
            <DocumentationViewer
                isOpen
                onClose={() => {}}
                title="Docs"
                markdownPath="/docs/test.md"
            />
        </StrictMode>
    );
    // Wait for the fetch to resolve and the markdown to render.
    await waitFor(() => expect(screen.getByRole('heading', { name: '3. Conclusion' })).toBeTruthy());
};

describe('DocumentationViewer table of contents', () => {
    it('gives headings the ids the contents asks for, under StrictMode', async () => {
        // The defect itself. StrictMode renders twice; a counter mutated during
        // render then sees every heading as a repeat of itself and appends "-2",
        // while the contents list -- built in one pass over the source -- keeps
        // asking for the first id. Every entry points at nothing.
        await openViewer();
        const wanted = extractHeadings(MARKDOWN).map(e => e.id);
        const rendered = Array.from(document.querySelectorAll('h2[id], h3[id]')).map(h => h.id);
        expect(rendered).toEqual(wanted);
    });

    it('gives the same ids however many times it renders', async () => {
        // Ids must be a function of the source, not of how often React chose to
        // render. Anything stateful shows up here as a second render producing
        // different ids from the first.
        await openViewer();
        const first = Array.from(document.querySelectorAll('h2[id], h3[id]')).map(h => h.id);
        cleanup();
        await openViewer();
        const second = Array.from(document.querySelectorAll('h2[id], h3[id]')).map(h => h.id);
        expect(second).toEqual(first);
    });

    it('lists every H2 and H3 as a button', async () => {
        await openViewer();
        const toc = screen.getByLabelText('Table of contents');
        const items = toc.querySelectorAll('button');
        expect(Array.from(items).map(b => b.textContent)).toEqual([
            '1. Introduction: The Need for Simpler Data',
            '2. What is PCA?',
            '2.1 A Sub Heading',
            '3. Conclusion'
        ]);
    });

    // The heart of #436. Every TOC entry must find its heading: an entry whose
    // id matches nothing is a button that silently does nothing when clicked,
    // which is exactly what a reader sees.
    it('gives every entry an id that exists in the rendered document', async () => {
        await openViewer();
        const toc = screen.getByLabelText('Table of contents');
        const buttons = Array.from(toc.querySelectorAll('button'));

        const headings = Array.from(document.querySelectorAll('h2[id], h3[id]'));
        const renderedIds = new Set(headings.map(h => h.id));

        expect(headings.length).toBe(buttons.length);
        expect(renderedIds.size).toBe(buttons.length);
    });

    it('scrolls the content container when an entry is clicked', async () => {
        const scrollTo = vi.fn();
        Element.prototype.scrollTo = scrollTo;

        await openViewer();
        const toc = screen.getByLabelText('Table of contents');
        const button = Array.from(toc.querySelectorAll('button'))
            .find(b => b.textContent === '3. Conclusion')!;

        await userEvent.click(button);

        expect(scrollTo).toHaveBeenCalled();
        // The scroller must be the content column, not the sidebar and not the
        // page: asking the wrong element to scroll is indistinguishable, to a
        // user, from nothing happening.
        // Identity, not containment: several ancestors contain the heading, so
        // "something that contains it was scrolled" passes even when the wrong
        // element moves -- which an earlier version of this assertion did.
        const scroller = scrollTo.mock.instances[0] as HTMLElement;
        expect(scroller).toBe(screen.getByTestId('documentation-scroll'));
        expect(scroller.contains(toc)).toBe(false);
        expect(scrollTo.mock.calls[0][0]).toMatchObject({ behavior: 'smooth' });
    });

    it('falls back to scrollTop where scrollTo is unavailable', async () => {
        // Not a case that has been observed, but every failure on this path is
        // silent, so the cheapest mechanism is kept as a backstop.
        const original = Element.prototype.scrollTo;
        // @ts-expect-error - deliberately removing a DOM method for the test
        delete Element.prototype.scrollTo;

        await openViewer();
        const container = screen.getByTestId('documentation-scroll');
        const setter = vi.fn();
        Object.defineProperty(container, 'scrollTop', { set: setter, get: () => 0, configurable: true });

        const toc = screen.getByLabelText('Table of contents');
        const button = Array.from(toc.querySelectorAll('button'))
            .find(b => b.textContent === '3. Conclusion')!;
        await userEvent.click(button);

        expect(setter).toHaveBeenCalled();
        Element.prototype.scrollTo = original;
    });

    it('does nothing rather than throwing when a heading is missing', async () => {
        // An entry with no heading should not take the application down; the
        // guard also documents that a mismatch is survivable.
        const scrollTo = vi.fn();
        Element.prototype.scrollTo = scrollTo;
        await openViewer();
        document.getElementById('3-conclusion')!.remove();

        const toc = screen.getByLabelText('Table of contents');
        const button = Array.from(toc.querySelectorAll('button'))
            .find(b => b.textContent === '3. Conclusion')!;

        await expect(userEvent.click(button)).resolves.not.toThrow();
        expect(scrollTo).not.toHaveBeenCalled();
    });

    // jsdom performs no layout, so no test here can observe that the container
    // actually scrolls. What can be pinned is the class that makes it able to:
    // without min-h-0 the flex chain never constrains this element, it grows to
    // fit the whole document, and there is no scroll for a click to perform.
    // That is invisible in every DOM-less test and was invisible in Chromium
    // too, so the class is asserted rather than trusted.
    it('keeps the scroll container able to shrink inside the flex chain', async () => {
        await openViewer();
        const container = screen.getByTestId('documentation-scroll');
        expect(container.className).toContain('overflow-y-auto');
        expect(container.className, 'min-h-0 is what lets this element scroll').toContain('min-h-0');
        expect(container.parentElement!.className,
            'the row must shrink too, or it never constrains its child').toContain('min-h-0');
    });

    it('says why when a click cannot scroll anywhere', async () => {
        // Silence here cost two rounds of guessing: a dead click looked exactly
        // like a dead handler.
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await openViewer();
        document.getElementById('3-conclusion')!.remove();

        const toc = screen.getByLabelText('Table of contents');
        const button = Array.from(toc.querySelectorAll('button'))
            .find(b => b.textContent === '3. Conclusion')!;
        await userEvent.click(button);

        expect(warn).toHaveBeenCalled();
        expect(String(warn.mock.calls[0])).toContain('no heading has that id');
        warn.mockRestore();
    });

    it('marks the clicked entry as the current location', async () => {
        await openViewer();
        const toc = screen.getByLabelText('Table of contents');
        const button = Array.from(toc.querySelectorAll('button'))
            .find(b => b.textContent === '2. What is PCA?')!;

        await userEvent.click(button);
        expect(button.getAttribute('aria-current')).toBe('location');
    });
});

/**
 * The synthetic document above is small and tidy. The documents this component
 * actually shows are not: intro_to_pca.md has 72 headings, LaTeX, tables,
 * images and code blocks, and intro_to_data_prep.md has 25. A TOC entry that
 * finds no heading is a button that does nothing, so the check that matters is
 * against the real files rather than a fixture chosen to pass.
 */
describe('against the documents the apps actually ship', () => {
    // Imported as raw text by Vite rather than read with node's fs, so the
    // package needs no node types to type-check.
    const REAL_DOCS: Record<string, string> = {
        'intro_to_pca.md': introToPca,
        'intro_to_data_prep.md': introToDataPrep
    };
    const docs: [string, string][] = [
        ['intro_to_pca.md', 'intro_to_pca.md'],
        ['intro_to_data_prep.md', 'intro_to_data_prep.md']
    ];

    for (const [name, relative] of docs) {
        it(`every TOC entry in ${name} points at a heading that exists`, async () => {
            const markdown = REAL_DOCS[relative];

            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true, statusText: 'OK', text: () => Promise.resolve(markdown)
            }));

            render(
                <StrictMode>
                    <DocumentationViewer
                        isOpen onClose={() => {}} title="Docs" markdownPath={`/docs/${name}`}
                    />
                </StrictMode>
            );

            const toc = await screen.findByLabelText('Table of contents');
            await waitFor(() => expect(toc.querySelectorAll('button').length).toBeGreaterThan(10));

            const renderedIds = new Set(
                Array.from(document.querySelectorAll('h2[id], h3[id]')).map(h => h.id)
            );

            // Compare the ids themselves, not how many there are. Counting
            // would pass while every entry pointed at the wrong heading, which
            // is the failure being investigated -- and it is the mistake the
            // first version of this test made.
            const wanted = extractHeadings(markdown);
            const missing = wanted.filter(entry => !renderedIds.has(entry.id));

            expect(
                missing.map(m => `${m.text} -> #${m.id}`),
                'TOC entries whose heading id does not exist in the document'
            ).toEqual([]);
            expect(wanted.length).toBe(renderedIds.size);
        });
    }
});
