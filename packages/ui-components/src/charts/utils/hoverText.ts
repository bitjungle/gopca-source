/**
 * Putting a data value into a Plotly hover label without letting it be read as
 * markup.
 *
 * Plotly renders hover text through a small HTML subset — `<br>`, `<b>`, `<span>`,
 * `<a>` and a few others — so a value taken from the user's file is parsed, not
 * printed. The values that break are ordinary ones in the sciences this tool
 * serves: `<LOD` for below the limit of detection, `>99.9`, `R&D`, `A&B`. Each is
 * either swallowed or mangled, and the one place the full value was guaranteed to
 * be readable is the hover label (#999) — so it has to survive intact.
 */

/**
 * Escapes the three characters Plotly's hover parser treats as markup. Plotly
 * renders the entities back as the original characters, so the label reads exactly
 * as the data does.
 *
 * `&` is replaced first: doing it last would re-escape the ampersands introduced
 * by the other two.
 */
export function escapeHoverText(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
