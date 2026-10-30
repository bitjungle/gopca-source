/**
 * Ordering the levels of a categorical column so that the order -- and the
 * colour that rides on it -- depends on the values, not on the rows.
 *
 * Every plot that colours by a category builds its legend from
 * `Array.from(new Set(groups))`, which keeps first-appearance order, and then
 * picks each level's colour by its index in that list. So a level's colour
 * depended on where it first occurred in the file, and changed when rows were
 * filtered: processing type `10` was colour 0 in the full al_alloy file and
 * colour 7 in a single-source subset. Two plots of the same categories, two
 * colour schemes, and nothing on screen saying so (#1013).
 *
 * This is the TypeScript counterpart of `sortCategoryValues` in
 * `pkg/transform/category_sort.go`, which fixed the same class of problem for
 * GoCSV's one-hot column order (#996). The two are one rule in two languages,
 * and `categoryOrder.test.ts` holds the Go test table so they cannot drift.
 */

/**
 * Parses a level the way Go's `strconv.ParseFloat` would accept it, returning
 * `undefined` for anything that is not a usable number.
 *
 * `Number()` alone is the wrong tool: it reads `""` and whitespace as 0, and
 * it does not know the `Inf` spelling that Go (and CSV exports from Go, R and
 * pandas) use for infinities. NaN is rejected in every spelling, because it
 * compares false against everything including itself and so cannot be placed
 * in an ordering -- it falls to the text path with the rest of the set.
 */
export function parseCategoryNumber(value: string): number | undefined {
    const trimmed = value.trim();
    if (trimmed === '') {
        return undefined;
    }
    const infinity = /^([+-]?)(inf|infinity)$/i.exec(trimmed);
    if (infinity) {
        return infinity[1] === '-' ? -Infinity : Infinity;
    }
    const n = Number(trimmed);
    return Number.isNaN(n) ? undefined : n;
}

/**
 * Returns the levels in a stable order: numerically when every one of them is
 * a number, lexicographically otherwise.
 *
 * All-or-nothing, as in Go: `{"1", "2", "unknown"}` sorts as text, because
 * there is no defensible numeric position for `unknown`. Equal numbers keep a
 * deterministic order by falling back to a text comparison, so `1` and `1.0`
 * never swap between runs. The text comparison is plain code-unit order, not
 * `localeCompare`, because that is what `sort.Strings` does on the Go side.
 *
 * The input is not modified.
 */
export function sortCategoryLevels(values: readonly string[]): string[] {
    const levels: { label: string; number: number }[] = [];
    for (const label of values) {
        const number = parseCategoryNumber(label);
        if (number === undefined) {
            return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        }
        levels.push({ label, number });
    }
    return levels
        .sort((a, b) => {
            if (a.number !== b.number) {
                return a.number < b.number ? -1 : 1;
            }
            return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
        })
        .map(level => level.label);
}

/**
 * The distinct levels of a group column, in the order every plot should use.
 *
 * This is the one call that replaces `Array.from(new Set(groups))` at each
 * plot's legend-building site, so a level's index -- and therefore its colour
 * -- is a function of the set of levels alone.
 */
export function uniqueCategoryLevels(groups: readonly string[]): string[] {
    return sortCategoryLevels(Array.from(new Set(groups)));
}
