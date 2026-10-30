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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { HelpWrapper } from './HelpWrapper';
import {
    toRuns, describeRun, runToIndices, parseRangeSpec, namesFormOrderedAxis,
    profileFractions, sharedScaleIsReadable, columnBoxStats, boxFractions, ProfileMode
} from '../utils/columnRanges';

interface ColumnRangeSelectorProps {
    headers: string[];
    data: number[][];
    /** 0-based indices currently held out of the analysis. */
    excludedColumns: number[];
    onChange: (excluded: number[]) => void;
}

const VIEW_W = 1000;
const VIEW_H = 120;
/**
 * Height of the edge mark drawn for a column whose box has collapsed to a
 * point, in viewBox units. Short enough that it cannot be read as a span.
 */
const EDGE_MARK = 4;

/**
 * Range selector for wide datasets.
 *
 * A 700-channel spectrum rendered as 700 checkboxes is a strip tens of thousands
 * of pixels wide, where excluding a region means finding both ends by scrolling.
 * The columns of such a dataset are not an unordered set though — they are an
 * ordered axis, so the natural gesture is to drag across the region you want
 * gone.
 *
 * The profile behind the axis is the mean of each column, which for spectroscopy
 * is the mean spectrum: the water bands appear as peaks, and the user drags over
 * the shape they can already see.
 *
 * How that profile is drawn depends on the columns. A connected line claims the
 * columns are consecutive samples of something continuous, so it is used only
 * when the column names say so — see namesFormOrderedAxis. Forty unrelated assay
 * variables get bars instead, because a line through them would draw a curve
 * where the data has none. The gesture is identical either way.
 *
 * What the bars are measured against is a separate question from how they are
 * drawn. One shared y-axis makes heights comparable between columns, which is
 * what a spectrum wants; but it also lets a single large-magnitude column flatten
 * every other one, which is what happens to any dataset storing measurements next
 * to their targets. So the starting scale is chosen from the values rather than
 * from the column names or the column count — see sharedScaleIsReadable — and the
 * toolbar lets the user switch, because which reading is wanted depends on a
 * question about the data that the data cannot answer.
 */
export const ColumnRangeSelector: React.FC<ColumnRangeSelectorProps> = ({
    headers, data, excludedColumns, onChange
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
    const [spec, setSpec] = useState('');
    const [specErrors, setSpecErrors] = useState<string[]>([]);

    const n = headers.length;
    const excludedSet = useMemo(() => new Set(excludedColumns), [excludedColumns]);
    const runs = useMemo(() => toRuns(excludedColumns), [excludedColumns]);

    // Whether the columns are an axis or an unordered set decides how the profile
    // is drawn, but never how selection works: a column occupies the same slice of
    // the width either way, so dragging behaves identically.
    const orderedAxis = useMemo(() => namesFormOrderedAxis(headers), [headers]);

    // Whether one shared y-axis can actually show every column, or whether the
    // largest-magnitude column would flatten the rest. Decided from the values,
    // not the column count: corn.csv is 709 columns wide and still unreadable
    // under a shared axis, because four named target columns sit two orders of
    // magnitude above the spectral channels they are stored beside.
    const sharedReadable = useMemo(
        () => sharedScaleIsReadable(data, n),
        [data, n]
    );

    // A spectrum is drawn on one axis because its columns genuinely share a unit.
    // Everything else starts on whichever axis can be read, and the user can
    // override that from the toolbar.
    const [modeOverride, setModeOverride] = useState<ProfileMode | null>(null);
    const scaleMode: ProfileMode = modeOverride
        ?? (orderedAxis || sharedReadable ? 'shared' : 'independent');

    // Mean profile, normalised into the viewBox. Recomputed only when the data
    // or the chosen scaling changes, not on every drag frame.
    const profile = useMemo(() => {
        if (scaleMode === 'distribution') return { line: '', bars: '' };
        const fractions = profileFractions(data, n, scaleMode);
        const top = 8;
        const base = VIEW_H - 8;
        const yOf = (f: number) => base - f * (base - top);
        const xAt = (i: number) => ((i + 0.5) * VIEW_W) / n;

        if (orderedAxis) {
            return {
                line: fractions.map((f, i) => `${xAt(i).toFixed(1)},${yOf(f).toFixed(1)}`).join(' '),
                bars: ''
            };
        }

        // One bar per variable, emitted as a single path rather than n <rect>
        // elements so that a few thousand columns stay cheap to render. Bars grow
        // from the floor: under either scaling the fractions are already relative
        // to the smallest value drawn, so the floor is the natural origin.
        const zero = base;
        return {
            line: '',
            bars: fractions
                .map((f, i) => `M${xAt(i).toFixed(1)},${zero.toFixed(1)}V${yOf(f).toFixed(1)}`)
                .join('')
        };
    }, [data, n, orderedAxis, scaleMode]);

    // Five-number summary per column, as three paths rather than 3n elements so a
    // wide dataset stays cheap to render. Whiskers span the column's full range,
    // the box is its interquartile band and the tick is the median, all rescaled
    // to that column's own range: the reader compares shapes, not magnitudes.
    const distribution = useMemo(() => {
        if (scaleMode !== 'distribution') return null;
        const top = 8;
        const base = VIEW_H - 8;
        const yOf = (f: number) => base - f * (base - top);
        const xAt = (i: number) => ((i + 0.5) * VIEW_W) / n;

        const whiskers: string[] = [];
        const tails: string[] = [];
        const marks: string[] = [];
        const boxes: string[] = [];
        const medians: string[] = [];
        const stats = columnBoxStats(data, n);

        stats.forEach((st, i) => {
            const f = boxFractions(st);
            if (!f) return;
            const x = xAt(i).toFixed(1);
            // Whiskers reach the Tukey fences, not the extremes. Drawn to min and
            // max they would span the full height of every column, since the
            // column is normalised by exactly those two values.
            whiskers.push(`M${x},${yOf(f.lowerFence).toFixed(1)}V${yOf(f.upperFence).toFixed(1)}`);
            // The stretch from a fence out to the extreme exists only where there
            // are outliers, so its presence and length are the outlier signal.
            //
            // Not when the box has collapsed. With IQR = 0 every other value is
            // an outlier and the tail runs the full height of the panel, which
            // reads as a wide spread for a column that is one number in almost
            // every row: on al_alloy fifteen of twenty-four elements drew the
            // same full-height line (#1016). Such a column gets a short mark at
            // the edge instead -- "values exist beyond this box" -- so the
            // length of a tail stays something a reader can trust.
            if (f.pointMass) {
                if (f.lowTail) marks.push(`M${x},${yOf(0).toFixed(1)}V${(yOf(0) - EDGE_MARK).toFixed(1)}`);
                if (f.highTail) marks.push(`M${x},${yOf(1).toFixed(1)}V${(yOf(1) + EDGE_MARK).toFixed(1)}`);
            } else {
                if (f.lowTail) tails.push(`M${x},${yOf(0).toFixed(1)}V${yOf(f.lowerFence).toFixed(1)}`);
                if (f.highTail) tails.push(`M${x},${yOf(f.upperFence).toFixed(1)}V${yOf(1).toFixed(1)}`);
            }
            // A box with zero height would vanish, so it is floored at a hairline
            // to keep a tightly packed column visible as a mark rather than a gap.
            const yTop = yOf(f.q3);
            const yBottom = yOf(f.q1);
            const height = Math.max(0.8, yBottom - yTop);
            boxes.push(`M${x},${(yTop + height).toFixed(1)}V${yTop.toFixed(1)}`);
            medians.push(`M${x},${yOf(f.median).toFixed(1)}v0.01`);
        });

        return {
            whiskers: whiskers.join(''),
            tails: tails.join(''),
            marks: marks.join(''),
            boxes: boxes.join(''),
            medians: medians.join('')
        };
    }, [data, n, scaleMode]);

    // Bars should fill most of the space each variable occupies, so their width is
    // a share of the column pitch rather than a fixed number of pixels.
    const barWidth = useMemo(() => Math.max(0.6, (VIEW_W / Math.max(1, n)) * 0.6), [n]);

    /** Map a pointer position to the column index under it. */
    const columnAt = useCallback((clientX: number): number => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return 0;
        const frac = (clientX - rect.left) / rect.width;
        return Math.max(0, Math.min(n - 1, Math.floor(frac * n)));
    }, [n]);

    const commit = useCallback((from: number, to: number) => {
        const lo = Math.min(from, to);
        const hi = Math.max(from, to);
        const range = runToIndices({ start: lo, end: hi });
        // Dragging over a region that is already wholly excluded puts it back,
        // so the same gesture both removes and restores.
        const allExcluded = range.every(i => excludedSet.has(i));
        const next = new Set(excludedColumns);
        range.forEach(i => (allExcluded ? next.delete(i) : next.add(i)));
        onChange([...next].sort((a, b) => a - b));
    }, [excludedColumns, excludedSet, onChange]);

    const applySpec = () => {
        const { indices, errors } = parseRangeSpec(spec, headers);
        setSpecErrors(errors);
        if (indices.length > 0) {
            onChange([...new Set([...excludedColumns, ...indices])].sort((a, b) => a - b));
            if (errors.length === 0) setSpec('');
        }
    };

    // Every column owns an equal band of the width, and the whole width is spoken
    // for. Drawing on the band's centre keeps the end bars inside the frame, and
    // measuring highlights from its edges makes an excluded region cover exactly
    // the columns it names rather than stopping at the centre of the last one.
    const pitch = VIEW_W / n;
    const edgeOf = (i: number) => i * pitch;
    const midOf = (i: number) => (i + 0.5) * pitch;
    // Ticks at even fractions, labelled with the real column names.
    //
    // How many fit is a question about pixels, so it is measured rather than
    // assumed: a constant is wrong in both directions, showing six labels on a
    // panel with room for fifteen and still colliding when the window is narrow.
    //
    // Labels are rotated 45°, which changes what "fits" means. Upright, a label
    // needs its full width and a 28-character variable name crowds out its
    // neighbours; tilted, consecutive labels only need enough horizontal room to
    // clear each other's line height, so the pitch is a small multiple of that
    // rather than the length of the longest name.
    const LABEL_PITCH_PX = 28;
    const [panelWidth, setPanelWidth] = useState(0);
    useEffect(() => {
        const el = svgRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) setPanelWidth(entry.contentRect.width);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const ticks = useMemo(() => {
        // Before the first measurement, and where ResizeObserver is unavailable,
        // fall back to the old fixed count rather than rendering no labels.
        const fits = panelWidth > 0 ? Math.floor(panelWidth / LABEL_PITCH_PX) : 6;
        const count = Math.max(2, Math.min(n, fits));
        if (count >= n) {
            return headers.map((label, i) => ({ i, label }));
        }
        return Array.from({ length: count }, (_, k) => {
            const i = Math.round((k / Math.max(1, count - 1)) * (n - 1));
            return { i, label: headers[i] ?? String(i + 1) };
        });
    }, [headers, n, panelWidth]);

    const included = n - excludedColumns.length;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 p-4">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div className="flex items-baseline gap-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">Variables</h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {excludedColumns.length === 0
                            ? `all ${n} included`
                            : `${included} of ${n} included · ${excludedColumns.length} excluded`}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="hidden md:inline text-xs text-gray-400 dark:text-gray-500">
                        drag across the plot to exclude a region
                    </span>
                    {/* Only offered for bars. A spectrum shares a unit across every
                        column, so scaling its channels apart would misrepresent it.
                        Explanations go to the app-wide help area rather than a title
                        tooltip, so the header keeps its promise that hovering any
                        element explains it. */}
                    <div
                        role="group"
                        aria-label="Profile display"
                        className="inline-flex rounded border border-gray-300 dark:border-gray-600 overflow-hidden"
                    >
                        {(
                            [
                                // A spectrum shares a unit across every column, so its
                                // channels are already on one axis and the shared/per
                                // column choice is moot — but it still needs a way back
                                // from the distribution view, so one profile button stays.
                                ...(orderedAxis
                                    ? ([
                                        ['shared', 'Profile', 'variable-profile-scale-shared']
                                    ] as Array<[ProfileMode, string, string]>)
                                    : ([
                                        ['shared', 'Shared', 'variable-profile-scale-shared'],
                                        ['independent', 'Per column', 'variable-profile-scale-independent']
                                    ] as Array<[ProfileMode, string, string]>)),
                                ['distribution', 'Distribution', 'variable-profile-distribution']
                            ] as Array<[ProfileMode, string, string]>
                        ).map(([mode, label, helpKey]) => (
                            <HelpWrapper key={mode} helpKey={helpKey}>
                                <button
                                    onClick={() => setModeOverride(mode)}
                                    aria-pressed={scaleMode === mode}
                                    className={`text-xs px-2 py-1 ${
                                        scaleMode === mode
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {label}
                                </button>
                            </HelpWrapper>
                        ))}
                    </div>
                    {excludedColumns.length > 0 && (
                        <button
                            onClick={() => onChange([])}
                            className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
                        >
                            Include all
                        </button>
                    )}
                </div>
            </div>

            <svg
                ref={svgRef}
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                preserveAspectRatio="none"
                className="w-full h-28 select-none cursor-crosshair rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                onPointerDown={(e) => {
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                    const i = columnAt(e.clientX);
                    setDrag({ from: i, to: i });
                }}
                onPointerMove={(e) => {
                    if (!drag) return;
                    setDrag({ from: drag.from, to: columnAt(e.clientX) });
                }}
                onPointerUp={(e) => {
                    // Take the end of the range from the release position rather
                    // than the last move: a quick drag can produce no intermediate
                    // pointermove at all, which would collapse it to one column.
                    if (drag) commit(drag.from, columnAt(e.clientX));
                    setDrag(null);
                }}
                onPointerLeave={(e) => {
                    if (drag) commit(drag.from, columnAt(e.clientX));
                    setDrag(null);
                }}
            >
                {/* Already-excluded regions */}
                {runs.map((r, k) => (
                    <rect
                        key={`ex-${k}`}
                        x={edgeOf(r.start)}
                        width={Math.max(1.5, (r.end - r.start + 1) * pitch)}
                        y={0} height={VIEW_H}
                        className="fill-red-400/25 dark:fill-red-500/25"
                    />
                ))}

                {/* Live drag preview */}
                {drag && (
                    <rect
                        x={edgeOf(Math.min(drag.from, drag.to))}
                        width={Math.max(1.5, (Math.abs(drag.to - drag.from) + 1) * pitch)}
                        y={0} height={VIEW_H}
                        className="fill-blue-400/30 dark:fill-blue-400/25"
                    />
                )}

                {distribution ? (
                    <>
                        {/* Outlier tails first, so the solid whisker draws over
                            them. Omitted entirely when no column has outliers,
                            rather than emitting a path with an empty d. */}
                        {distribution.tails !== '' && (
                            <path
                                d={distribution.tails}
                                fill="none"
                                vectorEffect="non-scaling-stroke"
                                strokeDasharray="2 2"
                                className="stroke-blue-400/50 dark:stroke-blue-400/40"
                                strokeWidth={1}
                            />
                        )}
                        {/* Edge marks for collapsed boxes: a column that is one
                            value in the middle half and something else beyond.
                            Solid and short, so they cannot be read as a span. */}
                        {distribution.marks !== '' && (
                            <path
                                d={distribution.marks}
                                fill="none"
                                vectorEffect="non-scaling-stroke"
                                className="stroke-blue-500 dark:stroke-blue-400"
                                strokeWidth={1.5}
                                data-testid="variable-profile-edge-marks"
                            />
                        )}
                        <path
                            d={distribution.whiskers}
                            fill="none"
                            vectorEffect="non-scaling-stroke"
                            className="stroke-blue-500 dark:stroke-blue-400"
                            strokeWidth={1.5}
                        />
                        <path
                            d={distribution.boxes}
                            fill="none"
                            className="stroke-blue-600 dark:stroke-blue-400"
                            strokeWidth={barWidth}
                        />
                        {/* Drawn with a round cap so a zero-length segment still
                            renders as a dot: the median is a position, not a span. */}
                        <path
                            d={distribution.medians}
                            fill="none"
                            strokeLinecap="round"
                            className="stroke-white dark:stroke-gray-900"
                            strokeWidth={Math.min(barWidth, 3)}
                        />
                    </>
                ) : orderedAxis ? (
                    <polyline
                        points={profile.line}
                        fill="none"
                        vectorEffect="non-scaling-stroke"
                        className="stroke-blue-600 dark:stroke-blue-400"
                        strokeWidth={1.5}
                    />
                ) : (
                    <path
                        d={profile.bars}
                        fill="none"
                        className="stroke-blue-600 dark:stroke-blue-400"
                        strokeWidth={barWidth}
                    />
                )}

                {ticks.map(t => (
                    <line
                        key={`t-${t.i}`}
                        x1={midOf(t.i)} x2={midOf(t.i)} y1={VIEW_H - 6} y2={VIEW_H}
                        vectorEffect="non-scaling-stroke"
                        className="stroke-gray-400 dark:stroke-gray-500"
                        strokeWidth={1}
                    />
                ))}
            </svg>

            {/* Axis labels sit outside the SVG so they are not distorted by
                preserveAspectRatio="none". */}
            {/* No clipping here: a rotated label reaches left of its own tick,
                and the leftmost one would lose its start to the container edge.
                The card's padding absorbs the overhang; truncation stays on the
                spans, where it is the ellipsis rather than a hard cut. */}
            <div className="relative h-[4.5rem] mt-1">
                {ticks.map(t => (
                    <span
                        key={`l-${t.i}`}
                        // Anchored by its right edge at the tick and rotated about
                        // that corner, so the name ends where the column is rather
                        // than starting there — the reading runs up into the tick.
                        style={{
                            right: `${100 - (midOf(t.i) / VIEW_W) * 100}%`,
                            transformOrigin: 'top right',
                            transform: 'rotate(-45deg)'
                        }}
                        // Truncation is what bounds the panel's height: at 45° a
                        // label's vertical extent is its width times sin 45°, so
                        // capping the width caps how far the axis grows.
                        title={t.label}
                        className="absolute top-0 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap max-w-[5rem] overflow-hidden text-ellipsis"
                    >
                        {t.label}
                    </span>
                ))}
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
                <input
                    type="text"
                    value={spec}
                    onChange={(e) => { setSpec(e.target.value); setSpecErrors([]); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') applySpec(); }}
                    placeholder="Exclude by name or range, e.g. 1400-1450, 1900-1960"
                    aria-label="Exclude columns by name or range"
                    className="flex-1 min-w-[16rem] px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                />
                <button
                    onClick={applySpec}
                    disabled={spec.trim() === ''}
                    className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded"
                >
                    Exclude
                </button>
            </div>

            {specErrors.length > 0 && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                    Could not resolve {specErrors.join(', ')}
                </p>
            )}

            {runs.length > 0 && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Excluded:</span>
                    {runs.map((r, k) => (
                        <HelpWrapper key={`chip-${k}`} helpKey="variable-profile-excluded">
                            <button
                                onClick={() => {
                                    const next = new Set(excludedColumns);
                                    runToIndices(r).forEach(i => next.delete(i));
                                    onChange([...next].sort((a, b) => a - b));
                                }}
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/70"
                            >
                                {describeRun(r, headers)}
                                <X className="w-3 h-3" />
                            </button>
                        </HelpWrapper>
                    ))}
                </div>
            )}
        </div>
    );
};
