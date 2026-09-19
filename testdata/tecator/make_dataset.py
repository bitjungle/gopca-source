#!/usr/bin/env python3
"""Tecator NIT meat spectra -> a CSV GoPCA and GoCSV can read.

Source file: ``tecator_dataset.txt``, the StatLib distribution of the data set
first described in Borggaard & Thodberg (1992), "Optimal Minimal Neural
Interpretation of Spectra", Analytical Chemistry 64, 545-551.

The raw file is a fixed-shape block of bare numbers with no delimiters, headers
or sample identifiers: 240 samples x 25 lines x 5 values. This script turns it
into a labelled CSV. It is deliberately strict -- every structural claim the
file's own header makes is checked against the data, and a mismatch is an error
rather than a warning, because a silent misparse here produces a CSV that looks
entirely reasonable and is wrong.


WHAT EACH SAMPLE'S 125 VALUES ARE
---------------------------------
Per the file's section 2, each sample is one contiguous run of 125 values:

    [0:100]     100 absorbances, -log10 of transmittance, 850-1050 nm
    [100:122]   22 principal component scores
    [122]       moisture (water) content, percent
    [123]       fat content, percent
    [124]       protein content, percent

which agrees with the machine-readable ``real_in=122`` and ``real_out=3`` lines
that immediately precede the data.


THE 22 SUPPLIED PRINCIPAL COMPONENTS ARE LEFT OUT BY DEFAULT
------------------------------------------------------------
They are not extra measurements. They are linear combinations of the same 100
absorbances, computed by the original authors on subset C alone and scaled to
unit variance there. Verified: over the 129 rows of C each has mean 0.0000 and
population sd 0.9961 = sqrt(128/129), i.e. unit *sample* variance on C.

Putting them in the same matrix as the absorbances they were derived from would
feed a PCA two representations of one measurement, and the unit-variance scaling
would hand them influence out of all proportion. So they are written to a
separate file on request (``--pcs-out``) and never mixed into the main one.

They are worth keeping available: reference (1)'s headline 10-6-1 network used
the first 10 of them as its inputs, so reproducing that result needs these exact
scores rather than ones recomputed here.


THE FIVE SUBSETS
----------------
The samples appear in a fixed order, and which subset a sample belongs to is
recorded in a ``Set#category`` column:

    C    129   training
    M     43   monitoring (early stopping / model selection)
    T     43   testing -- interpolation
    E1     8   extrapolation in fat
    E2    17   extrapolation in protein

This column is the reason to prefer this CSV over a bare matrix. It is a
grouping variable for cross-validation (``pca regress --cv-group``), it colours
a scores plot by design role, and it is what makes the published benchmark
numbers reproducible: they are quoted on T, having been tuned on C+M.

The subset boundaries are not guessed. The file's header gives
``training_examples=172`` (C+M), ``test_examples=43`` (T) and
``extrapolation_examples=25`` (E1+E2); the finer C/M and E1/E2 splits come from
the prose table in section 2, and the script checks that they sum to the
machine-readable totals before using them.


TWO PLACES WHERE THE PAPER AND THE DATA DISAGREE
------------------------------------------------
Both were found by measuring rather than by reading, and the data wins:

1. Borggaard & Thodberg section V says E2 holds "the 17 samples with the highest
   water contents". It does not. E2's protein runs 22.0-23.2% while the whole of
   C tops out at 21.8%, so E2 extrapolates in *protein* -- which is what the data
   file's own table says. E2's moisture (65.2-74.6%) sits comfortably inside C's
   range (39.3-76.6%), so it cannot be the highest-water samples.

2. The same section gives the fat range as "2% to 59%". Measured, it is
   0.9-58.5%.

Neither affects how the data is used, but a script that silently encoded the
paper's version would propagate both.


WAVELENGTHS ARE NOT IN THE SOURCE FILE
--------------------------------------
The file states a range of 850-1050 nm and a count of 100 channels, and gives no
per-channel wavelength table. Those two facts do not determine the spacing, and
both conventions are in circulation:

    step2 (default) 850 ... 1048, step 2 nm
                    exactly evenly spaced, but the last channel then
                    contradicts the stated 1050 nm upper end
    span            850.0 ... 1050.0, step 200/99 ~= 2.0202 nm
                    exact at both endpoints, but not evenly spaced once
                    written down as decimal labels
    index           A1 ... A100
                    asserts nothing at all

``step2`` is the default because these labels are read as data, not only shown
as text. GoPCA's Savitzky-Golay filter checks that the variables are evenly
spaced and warns when they are not, since the filter treats them as equally
spaced whatever they say. ``span`` cannot satisfy that check: 200/99 =
2.0202... has no exact decimal form, so every rounding yields at least two
distinct step sizes -- 2.0/2.1 at one decimal, 2.02/2.03 at two, 2.02/2.021 at
three. More precision does not help, and a tester then meets a warning that is
correct about the labels and says nothing about the data.

``span`` was the original default, on the argument that linear interpolation
across the stated range is the only mapping derivable from what the source
says. That argument still holds for the physics. It does not hold for labels a
continuity check reads. ``step2`` pays for its evenness visibly: the last
channel reads 1048 where the source says the range reaches 1050. The spacing is
a derived label under every scheme -- if you have an instrument specification
that settles it, pass ``--wavelengths`` accordingly rather than trusting this
choice.


NUMBERS ARE COPIED, NOT RECOMPUTED
----------------------------------
Values are written out as the exact text tokens found in the source. Parsing to
float happens only for validation. Round-tripping through a float and back would
risk changing the last digit of 30,000 values for no benefit.


REDISTRIBUTION
--------------
The source carries a permission note requiring that the instrument and company
(Tecator) be credited in any publication using these data, and that the note
travel with any redistribution. The script therefore writes the note beside the
CSV by default; see ``--no-permission-note``.


USAGE
-----
    python3 make_dataset.py                          # -> tecator.csv
    python3 make_dataset.py --wavelengths span
    python3 make_dataset.py --pcs-out tecator_supplied_pcs.csv
    python3 make_dataset.py --check-only             # validate, write nothing
"""

from __future__ import annotations

import argparse
import csv
import math
import statistics
import sys
from pathlib import Path

# --- Shape of the source, from its own section 2 -----------------------------

N_ABSORBANCE = 100
N_SUPPLIED_PCS = 22
N_CONTENTS = 3  # moisture, fat, protein
VALUES_PER_SAMPLE = N_ABSORBANCE + N_SUPPLIED_PCS + N_CONTENTS  # 125
VALUES_PER_LINE = 5
LINES_PER_SAMPLE = VALUES_PER_SAMPLE // VALUES_PER_LINE  # 25

# Subsets in the order they appear. The totals are cross-checked against the
# machine-readable header lines before anything is written.
SUBSETS = (("C", 129), ("M", 43), ("T", 43), ("E1", 8), ("E2", 17))

# Stated wavelength range, section 2. See the module docstring on spacing.
WAVELENGTH_MIN_NM = 850.0
WAVELENGTH_MAX_NM = 1050.0

CONTENT_COLUMNS = ("Moisture", "Fat", "Protein")


class SourceError(RuntimeError):
    """The source file does not have the shape its own header describes."""


# --- Reading -----------------------------------------------------------------


def split_source(text: str) -> tuple[str, list[str]]:
    """Return (header text, data lines).

    The data block begins after the last machine-readable declaration line. That
    marker is used rather than a fixed line number so an edited or re-wrapped
    preamble does not silently shift the parse.
    """
    lines = text.split("\n")
    markers = [
        i for i, line in enumerate(lines) if line.startswith("extrapolation_examples=")
    ]
    if not markers:
        raise SourceError(
            "no 'extrapolation_examples=' line found -- this does not look like "
            "the StatLib Tecator file"
        )
    start = markers[-1] + 1
    return "\n".join(lines[:start]), [ln for ln in lines[start:] if ln.strip()]


def declared_counts(header: str) -> dict[str, int]:
    """Parse the ``name=value`` lines the file puts just before the data."""
    counts: dict[str, int] = {}
    for line in header.split("\n"):
        line = line.strip()
        if "=" not in line or " " in line:
            continue
        name, _, value = line.partition("=")
        try:
            counts[name] = int(value)
        except ValueError:
            continue
    return counts


def read_samples(data_lines: list[str]) -> list[list[str]]:
    """Group the data lines into one list of 125 text tokens per sample."""
    for lineno, line in enumerate(data_lines, start=1):
        n = len(line.split())
        if n != VALUES_PER_LINE:
            raise SourceError(
                f"data line {lineno} holds {n} values, expected {VALUES_PER_LINE}: "
                f"{line.strip()[:60]!r}"
            )

    tokens = [tok for line in data_lines for tok in line.split()]
    if len(tokens) % VALUES_PER_SAMPLE:
        raise SourceError(
            f"{len(tokens)} values do not divide into samples of "
            f"{VALUES_PER_SAMPLE}"
        )
    return [
        tokens[i : i + VALUES_PER_SAMPLE]
        for i in range(0, len(tokens), VALUES_PER_SAMPLE)
    ]


# --- Validation --------------------------------------------------------------


def check(condition: bool, message: str, problems: list[str]) -> None:
    if not condition:
        problems.append(message)


def validate(samples: list[list[str]], declared: dict[str, int]) -> list[str]:
    """Check the parse against the file's own header and against physics.

    Returns a list of problems; empty means everything held. These are checks
    that can genuinely fail: each one was confirmed to fire when the subset
    boundaries or the column slices are perturbed.
    """
    problems: list[str] = []
    expected_total = sum(n for _, n in SUBSETS)

    check(
        len(samples) == expected_total,
        f"parsed {len(samples)} samples, expected {expected_total}",
        problems,
    )

    # The header declares the coarse splits; the prose table gives the fine ones.
    # Reconciling the two is what makes the subset labels trustworthy.
    sizes = dict(SUBSETS)
    if "training_examples" in declared:
        check(
            sizes["C"] + sizes["M"] == declared["training_examples"],
            f"C+M = {sizes['C'] + sizes['M']} but the file declares "
            f"training_examples={declared['training_examples']}",
            problems,
        )
    if "test_examples" in declared:
        check(
            sizes["T"] == declared["test_examples"],
            f"T = {sizes['T']} but the file declares "
            f"test_examples={declared['test_examples']}",
            problems,
        )
    if "extrapolation_examples" in declared:
        check(
            sizes["E1"] + sizes["E2"] == declared["extrapolation_examples"],
            f"E1+E2 = {sizes['E1'] + sizes['E2']} but the file declares "
            f"extrapolation_examples={declared['extrapolation_examples']}",
            problems,
        )
    if "real_in" in declared:
        check(
            N_ABSORBANCE + N_SUPPLIED_PCS == declared["real_in"],
            f"inputs = {N_ABSORBANCE + N_SUPPLIED_PCS} but the file declares "
            f"real_in={declared['real_in']}",
            problems,
        )
    if "real_out" in declared:
        check(
            N_CONTENTS == declared["real_out"],
            f"outputs = {N_CONTENTS} but the file declares "
            f"real_out={declared['real_out']}",
            problems,
        )

    if problems:
        return problems  # the slicing below would be meaningless

    numeric = [[float(tok) for tok in sample] for sample in samples]

    absorbances = [v for row in numeric for v in row[:N_ABSORBANCE]]
    check(
        all(0.0 < v < 10.0 for v in absorbances),
        f"absorbances out of plausible range: "
        f"{min(absorbances):.4f} .. {max(absorbances):.4f}; -log10 of a "
        f"transmittance should be a small positive number",
        problems,
    )

    for offset, name in enumerate(CONTENT_COLUMNS):
        col = [row[N_ABSORBANCE + N_SUPPLIED_PCS + offset] for row in numeric]
        check(
            all(0.0 <= v <= 100.0 for v in col),
            f"{name} outside 0-100%: {min(col):.1f} .. {max(col):.1f}",
            problems,
        )

    # The subset boundaries are an assumption about row order, and this is what
    # tests it. Borggaard & Thodberg put the samples above 50% fat into E1, so if
    # the offsets are wrong by even one row this fails.
    bounds = subset_bounds(numeric)
    fat_lo, fat_hi = bounds["E1"]["Fat"]
    check(
        fat_lo > 50.0,
        f"E1 fat runs {fat_lo:.1f}-{fat_hi:.1f}%, but E1 is defined as the "
        f"samples above 50% fat -- the subset offsets are wrong",
        problems,
    )

    problems.extend(check_c_boundary(numeric))

    # E2 is the high-protein set (see the docstring: the paper says water, the
    # data says protein). Its protein must sit clear above the training range.
    _, c_protein_hi = bounds["C"]["Protein"]
    e2_protein_lo, _ = bounds["E2"]["Protein"]
    check(
        e2_protein_lo > c_protein_hi,
        f"E2 protein starts at {e2_protein_lo:.1f}% but C reaches "
        f"{c_protein_hi:.1f}% -- E2 does not extrapolate in protein, so the "
        f"subset offsets are wrong",
        problems,
    )

    return problems


# The C/M boundary is the one split neither the machine-readable header nor any
# content range pins down: the header gives only C+M=172, and moving the boundary
# leaves that total intact. Tolerances are set from a sweep over candidate
# boundaries -- at the true 129 the mean is 0.0014 and the sd error 0.0000, while
# 128 and 130 are off by 0.018 and 0.006, so this separates them comfortably.
C_BOUNDARY_MEAN_TOL = 0.01
C_BOUNDARY_SD_TOL = 0.002


def check_c_boundary(numeric: list[list[float]]) -> list[str]:
    """Confirm where C ends, using the standardisation of the supplied PCs.

    The source says the 22 principal components were computed on subset C and
    scaled to unit variance. That makes the boundary measurable rather than
    assumed: over exactly the rows of C, and nowhere else, each component has
    mean 0 and sample variance 1 -- so population sd sqrt((n-1)/n).

    Without this, mislabelling one row of C as M would pass every other check
    here, and would quietly corrupt any result quoted as "tuned on C, tested on
    T". Verified to fire for a boundary off by one in either direction.
    """
    size = dict(SUBSETS)["C"]
    block = numeric[:size]
    if len(block) < size:
        return [f"only {len(block)} samples parsed, fewer than the {size} of C"]

    target_sd = math.sqrt((size - 1) / size)
    worst_mean = 0.0
    worst_sd = 0.0
    for j in range(N_SUPPLIED_PCS):
        column = [row[N_ABSORBANCE + j] for row in block]
        mean = statistics.mean(column)
        sd = statistics.pstdev(column)
        worst_mean = max(worst_mean, abs(mean))
        worst_sd = max(worst_sd, abs(sd - target_sd))

    if worst_mean > C_BOUNDARY_MEAN_TOL or worst_sd > C_BOUNDARY_SD_TOL:
        return [
            f"the supplied principal components are not standardised over the "
            f"first {size} samples (worst |mean| {worst_mean:.5f}, worst "
            f"|sd-{target_sd:.5f}| {worst_sd:.5f}) -- they were scaled on subset "
            f"C, so the C/M boundary is not where this script thinks it is"
        ]
    return []


def subset_bounds(numeric: list[list[float]]) -> dict[str, dict[str, tuple[float, float]]]:
    """Min and max of each content variable within each subset."""
    out: dict[str, dict[str, tuple[float, float]]] = {}
    start = 0
    for name, size in SUBSETS:
        block = numeric[start : start + size]
        start += size
        out[name] = {
            content: (
                min(r[N_ABSORBANCE + N_SUPPLIED_PCS + i] for r in block),
                max(r[N_ABSORBANCE + N_SUPPLIED_PCS + i] for r in block),
            )
            for i, content in enumerate(CONTENT_COLUMNS)
        }
    return out


# --- Writing -----------------------------------------------------------------


def channel_names(scheme: str) -> list[str]:
    """Column names for the 100 absorbance channels. See the module docstring."""
    if scheme == "index":
        return [f"A{i + 1}" for i in range(N_ABSORBANCE)]
    if scheme == "step2":
        return [str(int(WAVELENGTH_MIN_NM) + 2 * i) for i in range(N_ABSORBANCE)]
    if scheme == "span":
        span = WAVELENGTH_MAX_NM - WAVELENGTH_MIN_NM
        step = span / (N_ABSORBANCE - 1)
        return [f"{WAVELENGTH_MIN_NM + i * step:.1f}" for i in range(N_ABSORBANCE)]
    raise ValueError(f"unknown wavelength scheme: {scheme}")


def subset_labels() -> list[str]:
    return [name for name, size in SUBSETS for _ in range(size)]


def sample_ids(count: int) -> list[str]:
    """S001 .. S240.

    Deliberately not bare integers. The first column of a CSV is read as row
    names by both GoPCA and the pca CLI, and a purely numeric identifier column
    is indistinguishable from a measurement to anything that has to guess.
    Zero padding keeps the ids in order under a plain lexicographic sort too.
    """
    width = len(str(count))
    return [f"S{i + 1:0{width}d}" for i in range(count)]


def write_main_csv(path: Path, samples: list[list[str]], scheme: str) -> None:
    header = (
        ["Sample_ID", "Set#category"]
        + [f"{name}#target" for name in CONTENT_COLUMNS]
        + channel_names(scheme)
    )
    ids = sample_ids(len(samples))
    sets = subset_labels()

    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(header)
        for sample_id, subset, values in zip(ids, sets, samples):
            contents = values[N_ABSORBANCE + N_SUPPLIED_PCS :]
            writer.writerow([sample_id, subset] + contents + values[:N_ABSORBANCE])


def write_pcs_csv(path: Path, samples: list[list[str]]) -> None:
    header = (
        ["Sample_ID", "Set#category"]
        + [f"{name}#target" for name in CONTENT_COLUMNS]
        + [f"PC{i + 1}" for i in range(N_SUPPLIED_PCS)]
    )
    ids = sample_ids(len(samples))
    sets = subset_labels()

    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(header)
        for sample_id, subset, values in zip(ids, sets, samples):
            pcs = values[N_ABSORBANCE : N_ABSORBANCE + N_SUPPLIED_PCS]
            contents = values[N_ABSORBANCE + N_SUPPLIED_PCS :]
            writer.writerow([sample_id, subset] + contents + pcs)


def extract_permission_note(header: str) -> str:
    """Lift the redistribution note out of the source rather than retyping it."""
    start = header.find("1. Statement of permission")
    end = header.find("2. Description of the data file")
    if start == -1 or end == -1 or end <= start:
        raise SourceError("could not locate the permission note in the source header")
    return header[start:end].rstrip() + "\n"


# --- Reporting ---------------------------------------------------------------


def report(samples: list[list[str]], scheme: str) -> None:
    numeric = [[float(tok) for tok in s] for s in samples]
    bounds = subset_bounds(numeric)
    names = channel_names(scheme)

    print(f"  samples            {len(samples)}")
    print(f"  spectral channels  {N_ABSORBANCE}  ({names[0]} .. {names[-1]})")
    print(f"  responses          {', '.join(n + '#target' for n in CONTENT_COLUMNS)}")
    print()
    print(f"  {'set':4} {'n':>4}   " + "   ".join(f"{c:>13}" for c in CONTENT_COLUMNS))
    for name, size in SUBSETS:
        cells = "   ".join(
            f"{bounds[name][c][0]:5.1f}-{bounds[name][c][1]:5.1f}"
            for c in CONTENT_COLUMNS
        )
        print(f"  {name:4} {size:4}   {cells}")

    totals = [sum(r[-N_CONTENTS:]) for r in numeric]
    print()
    print(
        f"  moisture+fat+protein spans {min(totals):.1f}-{max(totals):.1f}% "
        f"(mean {sum(totals) / len(totals):.1f}%), so these are not a closed "
        f"composition and need no log-ratio treatment"
    )


# --- Entry point -------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description=__doc__.split("\n")[0],
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--input", type=Path, default=here / "tecator_dataset.txt",
        help="raw StatLib file (default: tecator_dataset.txt beside this script)",
    )
    parser.add_argument(
        "--output", type=Path, default=here / "tecator.csv",
        help="CSV to write (default: tecator.csv beside this script)",
    )
    parser.add_argument(
        "--wavelengths", choices=("step2", "span", "index"), default="step2",
        help="how to name the 100 spectral columns; see the module docstring "
             "(default: step2, 850-1048 nm in exact 2 nm steps)",
    )
    parser.add_argument(
        "--pcs-out", type=Path, default=None,
        help="also write the 22 principal components supplied with the source "
             "to this file; omitted by default because they are linear "
             "combinations of the absorbances",
    )
    parser.add_argument(
        "--no-permission-note", action="store_true",
        help="do not write the Tecator redistribution note beside the CSV",
    )
    parser.add_argument(
        "--check-only", action="store_true",
        help="parse and validate, write nothing",
    )
    args = parser.parse_args(argv)

    try:
        text = args.input.read_text(encoding="utf-8", errors="strict")
    except OSError as err:
        print(f"error: cannot read {args.input}: {err}", file=sys.stderr)
        return 1

    try:
        header, data_lines = split_source(text)
        samples = read_samples(data_lines)
    except SourceError as err:
        print(f"error: {err}", file=sys.stderr)
        return 1

    problems = validate(samples, declared_counts(header))
    if problems:
        print("error: the source does not match its own description:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1

    print(f"Parsed {args.input.name} and every structural check held.")
    print()
    report(samples, args.wavelengths)
    print()

    if args.check_only:
        print("--check-only: nothing written.")
        return 0

    write_main_csv(args.output, samples, args.wavelengths)
    print(f"Wrote {args.output}")

    if args.pcs_out is not None:
        write_pcs_csv(args.pcs_out, samples)
        print(f"Wrote {args.pcs_out}  (supplied PCs -- do not analyse alongside "
              f"the absorbances)")

    if not args.no_permission_note:
        note_path = args.output.with_name(args.output.stem + "_PERMISSION.txt")
        note_path.write_text(extract_permission_note(header), encoding="utf-8")
        print(f"Wrote {note_path}")
        print()
        print("Tecator's terms require the instrument and company to be credited")
        print("in any publication using these data, and the note above to travel")
        print("with any redistribution.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
