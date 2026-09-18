## Tecator NIT meat spectra

The Tecator dataset is **240 near-infrared transmission spectra of finely
chopped pure meat**, each paired with laboratory-determined moisture, fat and
protein contents. It was assembled at the Danish Meat Research Institute and
published as the benchmark accompanying Borggaard & Thodberg (1992), and it has
been a standard test case for calibration and functional-data methods ever
since.

The task it is built around is a regression one: **predict fat content from the
spectrum**. What makes it interesting rather than routine is that the
relationship is *not* linear — both of the papers below show a linear model
leaving a visible curved pattern in its residuals, and non-linear methods cutting
the error by half or more. That makes it a good dataset for seeing where PCR's
assumptions hold and where they stop.

* [Data source: StatLib at Carnegie Mellon](https://lib.stat.cmu.edu/datasets/tecator)
* Research article: Borggaard, C., & Thodberg, H. H. (1992). Optimal minimal
  neural interpretation of spectra. *Analytical Chemistry, 64*(5), 545–551.
  [https://doi.org/10.1021/ac00029a018](https://doi.org/10.1021/ac00029a018)
* Also used as a benchmark in: Eilers, P. H. C., Li, B., & Marx, B. D. (2009).
  Multivariate calibration with single-index signal regression. *Chemometrics and
  Intelligent Laboratory Systems, 96*(2), 196–202.
  [https://doi.org/10.1016/j.chemolab.2009.02.001](https://doi.org/10.1016/j.chemolab.2009.02.001)

### Permission and redistribution

The data carry a permission note from Tecator, reproduced verbatim in
`tecator_PERMISSION.txt`:

> The data are available in the public domain with no responsability from the
> original data source. The data can be redistributed as long as this permission
> note is attached.

and, separately:

> If results from these data are used in a publication we want you to mention the
> instrument and company name (Tecator) in the publication.

**So this dataset may be redistributed, unlike the Paprika data**, provided the
note travels with it. `make_dataset.py` writes the note next to the CSV on every
run for that reason; `--no-permission-note` suppresses it.

## The files

| File | In the repo | Where it comes from |
|---|---|---|
| `tecator_dataset.txt` | yes | downloaded from StatLib (link above) |
| `make_dataset.py` | yes | this repository |
| `README.md` | yes | this repository |
| `tecator.csv` | yes | produced by `make_dataset.py` |
| `tecator_PERMISSION.txt` | yes | extracted from `tecator_dataset.txt` by the script |
| `tecator_supplied_pcs.csv` | no | produced on request — see *The 22 supplied principal components* below |

```bash
cd testdata/tecator
python3 make_dataset.py                    # writes tecator.csv + the permission note
python3 make_dataset.py --check-only       # validate the source, write nothing
```

The script needs no third-party packages. It checks every structural claim the
source file makes against the data and **stops rather than write a CSV that is
quietly wrong** — see *How the parse is verified*.

## Purpose

Predict **fat content** from a 100-channel NIR spectrum. Moisture and protein are
supplied as well and can be predicted the same way.

The dataset is designed for honest model evaluation, which is why it ships as
five named subsets rather than one matrix. The intended protocol, from the source
file's own section 3:

* **C + M** are used to build the model. Approaches that need a held-out set to
  control overfitting should take it from within C+M; the original work used M.
* **T** is used once, to test the finished model. It is drawn from the same pool
  as C and M, so it measures **interpolation**.
* **E1** and **E2** measure **extrapolation**, and are not part of model
  development at all.

## Samples

**240** samples, in five subsets that appear in this fixed order:

| Set | n | Role |
|---|---|---|
| `C` | 129 | Training |
| `M` | 43 | Monitoring — early stopping and model selection |
| `T` | 43 | Testing — interpolation |
| `E1` | 8 | Extrapolation in **fat** |
| `E2` | 17 | Extrapolation in **protein** |

Membership is carried in the `Set#category` column. That column is the main
reason to prefer this CSV over a bare matrix: it is a grouping variable for
cross-validation (`pca regress --cv-group`), it colours a scores plot by design
role, and it is what makes the published benchmark numbers reproducible, since
they are all quoted on T after tuning on C+M.

Measured ranges, in percent:

| Set | n | Moisture | Fat | Protein |
|---|---|---|---|---|
| `C` | 129 | 39.3 – 76.6 | 0.9 – 49.1 | 11.0 – 21.8 |
| `M` | 43 | 41.2 – 76.1 | 1.4 – 46.5 | 11.1 – 21.6 |
| `T` | 43 | 40.7 – 75.6 | 2.0 – 47.8 | 11.6 – 21.7 |
| `E1` | 8 | 32.8 – 35.9 | **54.7 – 58.5** | 8.8 – 10.1 |
| `E2` | 17 | 65.2 – 74.6 | 1.7 – 12.3 | **22.0 – 23.2** |

The two bold ranges are what make E1 and E2 extrapolation sets: both sit entirely
outside the range C covers.

## Features

**100 absorbance channels**, recorded on a **Tecator Infratec Food and Feed
Analyzer** working over **850–1050 nm** by the Near Infrared Transmission (NIT)
principle. Absorbance is −log₁₀ of the measured transmittance; values in this
file run 2.06 – 5.47.

### The channel wavelengths are not in any source

This is worth stating plainly, because the column names look authoritative and
are not. The StatLib file gives a **range** (850–1050 nm) and a **count** (100)
and no per-channel table. Neither do the two R distributions of this data:
`fda.usc` documents `rangeval = (850, 1050)` with "100 discretization points from
850 to 1050", and `caret` gives only the range. A count and a range do not
determine a spacing, and both conventions are in circulation.

`make_dataset.py` therefore makes the choice explicit:

| `--wavelengths` | Columns | Rationale |
|---|---|---|
| `span` *(default)* | `850.0` … `1050.0`, step 200/99 ≈ 2.0202 nm | Exact at both endpoints, so it matches the only range anyone states. Matches `seq(850, 1050, length = 100)`, the convention of the functional-data literature |
| `step2` | `850` … `1048`, step 2 nm | Round numbers, but the last channel then contradicts the stated 1050 nm upper end |
| `index` | `A1` … `A100` | Asserts nothing |

If you have an instrument specification that settles it, pass the flag
accordingly rather than trusting the default.

## Targets

Three, all in percent and all determined by analytic chemistry (fat by the
Soxhlet method):

| Column | Range across all 240 |
|---|---|
| `Moisture#target` | 32.8 – 76.6 |
| `Fat#target` | 0.9 – 58.5 |
| `Protein#target` | 8.8 – 23.2 |

**These are not a closed composition.** Moisture + fat + protein sums to between
91.8% and 101.5%, mean 99.1% — close to 100 but not fixed at it, because the
three do not account for ash and because each is measured independently. So no
log-ratio treatment (CLR) is called for here, unlike the aluminium alloy data
where every row sums to exactly 1.

## Published results

All standard error of prediction (SEP) figures on the **test set T**, predicting
fat, and therefore comparable with one another:

| Method | SEP on T | Source |
|---|---|---|
| Linear model, 10 inputs | 2.78 | source file, section 4 |
| PCR | 2.92 | Eilers et al. (2009), Table 1 |
| PLS | 2.86 | Eilers et al. (2009), Table 1 |
| PSR (penalized signal regression) | 1.85 | Eilers et al. (2009), Table 1 |
| SISR (single-index signal regression) | 1.39 | Eilers et al. (2009), Table 1 |
| 10-6-1 neural network, early stopping | 0.65 | source file ref (1) = Borggaard & Thodberg (1992) |
| 10-3-1 network, Bayesian | 0.52 | source file ref (2), Thodberg (1993) |
| 13-X-1 network, Bayesian + ARD | 0.36 | source file ref (3), Thodberg (1995) |

The gap between the linear group (2.78–2.92) and the non-linear group
(0.36–1.85) is the point of the dataset.

As a rough anchor for this repository's own tooling — **not** comparable with the
table above, because it uses all 240 samples and 10-fold cross-validation rather
than training on C+M and testing on T:

```bash
pca regress --response "Fat#target" --cv 10 tecator.csv
# 15 components, RMSECV 2.93, Q² 0.958
```

which lands where a linear method should.

## Notes on the data

### The 22 supplied principal components

The source file carries 22 principal component scores per sample alongside the
100 absorbances. **They are not extra measurements.** They are linear
combinations of the same absorbances, computed by the original authors on subset
C alone and scaled to unit variance there.

`tecator.csv` leaves them out. Including them beside the absorbances they derive
from would feed a PCA two representations of one measurement, and the
unit-variance scaling would hand them influence out of all proportion to what
they contain.

They are still available, because reference (1)'s headline 10-6-1 network used
the first 10 of them as its inputs, and reproducing that needs these exact scores
rather than ones recomputed here:

```bash
python3 make_dataset.py --pcs-out tecator_supplied_pcs.csv
```

Do not analyse that file alongside `tecator.csv`.

### Two claims in Borggaard & Thodberg that the data contradicts

Found by measuring the distributed file, not by reading. Recorded here so the
next person does not have to rediscover them:

**E2 is the highest-*protein* set, not the highest-water set.** Section V of the
paper says "spectra of the 17 samples with the highest water contents were put
into the extrapolation test set E2". Measured, E2's protein runs 22.0–23.2% while
the whole of C tops out at 21.8%, so E2 extrapolates in protein. E2's moisture,
65.2–74.6%, sits comfortably inside C's range of 39.3–76.6% and is not extreme at
all. **The StatLib file's own summary table agrees with the data** and labels E2
"Extrapolation, Protein".

**The fat range is 0.9–58.5%, not 2–59%.** The paper's figure is probably
rounding, but the lower end is wrong by more than a factor of two.

Neither affects the paper's argument or its published results.

### This copy has 240 samples; the R packages have 215

The `caret` and `fda.usc` distributions of this dataset carry only C+M+T and drop
E1 and E2. Results quoted from work using those packages are therefore on the
215-sample subset. `tecator.csv` keeps all 240 and labels them, so either can be
reproduced — filter on `Set#category` to get the 215.

### How the parse is verified

The raw file is a bare block of 6,000 lines × 5 numbers with no delimiters,
headers or identifiers, so a misparse would produce a CSV that looks entirely
reasonable and is wrong. `make_dataset.py` checks, and fails rather than writes,
if any of these do not hold:

* every data line holds exactly 5 values, and the total divides into samples of 125;
* the subset sizes reconcile with the file's own machine-readable
  `training_examples`, `test_examples`, `extrapolation_examples`, `real_in` and
  `real_out` declarations;
* absorbances are positive and small, and the three contents lie in 0–100%;
* **E1's fat is entirely above 50%**, which is how the paper defines it — this
  fails if the subset offsets are off by even one row;
* **E2's protein starts above C's maximum**, likewise;
* **the 22 supplied components are standardised over exactly the first 129 rows**
  — mean 0 and population sd √(128/129).

That last check earns its place. The C/M boundary is the one split nothing else
pins down: the header gives only C+M = 172, so moving the boundary leaves every
total intact and every other check passing. Because the components were scaled on
C, the boundary is measurable — at 129 rows the worst component mean is 0.0014
and the worst standard-deviation error 0.0000, while at 128 and 130 they are 0.018
and 0.006. The check separates them comfortably, and an independent source agrees:
`caret`'s documentation notes that "the first 129 were originally used as a
training set".

### Values are copied, not recomputed

Every number in `tecator.csv` is the exact text token from the source file.
Parsing to float happens only for the validation above. Round-tripping 30,000
values through a float and back could change the last digit of some of them for
no benefit.
