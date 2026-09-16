import { describe, expect, it } from 'vitest';
import { isCategoryColumn, isTargetColumn } from './columnMarkers';

describe('isCategoryColumn', () => {
    it('accepts both spellings, as the Go parser does', () => {
        expect(isCategoryColumn('proc_num#category')).toBe(true);
        expect(isCategoryColumn('proc_num# category')).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(isCategoryColumn('Site#CATEGORY')).toBe(true);
        expect(isCategoryColumn('Site#Category')).toBe(true);
    });

    it('ignores trailing whitespace', () => {
        expect(isCategoryColumn('Site#category  ')).toBe(true);
    });

    it('rejects a plain column', () => {
        expect(isCategoryColumn('proc_num')).toBe(false);
        expect(isCategoryColumn('Al')).toBe(false);
    });

    it('rejects a marker that is not at the end', () => {
        // uniqueMarkedHeader exists so this case does not arise, but a header
        // ending in something else is not a marked column whatever it contains.
        expect(isCategoryColumn('Sample_ID#category_2')).toBe(false);
    });

    it('does not confuse a target with a category', () => {
        expect(isCategoryColumn('Yield#target')).toBe(false);
    });
});

describe('isTargetColumn', () => {
    it('accepts both spellings', () => {
        expect(isTargetColumn('Yield#target')).toBe(true);
        expect(isTargetColumn('Yield# target')).toBe(true);
    });

    it('does not confuse a category with a target', () => {
        // A target is a measurement held out of the analysis, so it keeps its
        // numeric formatting; a category is a label and must not.
        expect(isTargetColumn('proc_num#category')).toBe(false);
    });
});
