import { describe, it, expect } from 'vitest';
import { escapeHoverText } from './hoverText';

describe('escapeHoverText', () => {
    it('leaves an ordinary value untouched', () => {
        expect(escapeHoverText('Cast alloy 6061')).toBe('Cast alloy 6061');
    });

    it('escapes a below-detection-limit value', () => {
        // The case that motivated this: `<LOD` reaches Plotly's parser as the start
        // of a tag and the rest of the label disappears with it.
        expect(escapeHoverText('<LOD')).toBe('&lt;LOD');
    });

    it('escapes comparison operators in both directions', () => {
        expect(escapeHoverText('>99.9')).toBe('&gt;99.9');
        expect(escapeHoverText('0.1 < x < 0.5')).toBe('0.1 &lt; x &lt; 0.5');
    });

    it('escapes ampersands', () => {
        expect(escapeHoverText('R&D')).toBe('R&amp;D');
    });

    it('escapes the ampersand before the angle brackets, not after', () => {
        // Escaping `<` first and `&` second would turn `<` into `&amp;lt;`, which
        // renders as the literal text "&lt;" rather than as "<".
        expect(escapeHoverText('<')).toBe('&lt;');
        expect(escapeHoverText('&lt;')).toBe('&amp;lt;');
    });

    it('neutralises markup rather than passing it through', () => {
        expect(escapeHoverText('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
        expect(escapeHoverText('<a href="x">link</a>')).toBe('&lt;a href="x"&gt;link&lt;/a&gt;');
    });

    it('handles an empty value', () => {
        expect(escapeHoverText('')).toBe('');
    });
});
