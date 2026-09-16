import { describe, expect, it } from 'vitest';
import { isCategoryColumn, isLabelColumn, isTargetColumn } from './columnMarkers';

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

describe('isLabelColumn', () => {
    it('accepts a column marked by its header, with no map at all', () => {
        expect(isLabelColumn('proc_num#category')).toBe(true);
        expect(isLabelColumn('site # category', {})).toBe(true);
    });

    it('accepts a column the parser classified, with no marker in the header', () => {
        // #950: "Name" holds alloy designations such as 6101, which parse as
        // numbers. Only the parser's verdict says it is a label column.
        expect(isLabelColumn('Name', { Name: ['6101', 'AA7055'] })).toBe(true);
    });

    it('rejects a measurement column', () => {
        expect(isLabelColumn('Zn', { Name: [] })).toBe(false);
        expect(isLabelColumn('Zn')).toBe(false);
        expect(isLabelColumn('Zn', null)).toBe(false);
    });

    it('does not treat a target as a label', () => {
        // A target is held out of the analysis but is still a measurement, so
        // it keeps numeric formatting.
        expect(isLabelColumn('Moisture#target', {})).toBe(false);
    });

    it('does not mistake an inherited property for a column', () => {
        // `'toString' in {}` is true. A column may legitimately be named
        // toString, and it is not categorical unless the map really says so.
        expect(isLabelColumn('toString', {})).toBe(false);
        expect(isLabelColumn('constructor', {})).toBe(false);
        expect(isLabelColumn('toString', { toString: ['a'] })).toBe(true);
    });
});
