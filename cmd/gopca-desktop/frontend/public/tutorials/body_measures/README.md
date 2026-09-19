# NHANES Body Measures Dataset

Anthropometric (body-measurement) data for US adults from the **National Health
and Nutrition Examination Survey (NHANES) 2017–2018** cycle, Body Measures
examination file (`BMX_J`), merged with the demographics file (`DEMO_J`).

NHANES is a program of the US **National Center for Health Statistics (NCHS/CDC)**
that combines interviews and standardized physical examinations to assess the
health and nutritional status of the US population. The body-measures component
records standardized anthropometric measurements taken by trained examiners.

This makes a compact, real-world PCA teaching example: body measurements are
strongly correlated through overall body size, so PCA cleanly separates a **size**
factor from a **shape** factor.

## Source

* Body Measures (BMX_J): https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/BMX_J.htm
* Demographics (DEMO_J): https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DEMO_J.htm
* Program overview: https://www.cdc.gov/nchs/nhanes/
* **License:** Public domain. NHANES public-use data files are produced by a US
  federal agency and are not subject to copyright. Please cite NHANES/NCHS as the
  data source.

## Regenerating the data

The CSV is built by [`make_dataset.py`](make_dataset.py), which downloads the two
files via the `pandas-nhanes` package and applies the preparation below:

```bash
source ../.venv/bin/activate      # numpy, pandas, pandas-nhanes
python make_dataset.py            # writes body_measures.csv
deactivate
```

## Samples

* **5096** adults (age 18+), one row per participant.
* Retained from 5533 eligible adults after complete-case filtering (**92.1%**).
* `Sample_ID` is the NHANES participant sequence number (`SEQN`).

## Features (PCA inputs)

Seven raw anthropometric measurements taken for the whole adult population:

| Column | Measurement | Unit |
|--------|-------------|------|
| `Weight (kg)` | Body weight | kg |
| `Height (cm)` | Standing height | cm |
| `Upper Leg Length (cm)` | Upper leg length | cm |
| `Upper Arm Length (cm)` | Upper arm length | cm |
| `Arm Circumference (cm)` | Arm circumference | cm |
| `Waist Circumference (cm)` | Waist circumference | cm |
| `Hip Circumference (cm)` | Hip circumference | cm |

Feature variances differ by ~60× (weight in kg vs. lengths in cm), so
**standardize / autoscale** the columns before running PCA.

## Held out of the PCA (metadata for coloring — not analysis variables)

Four columns are kept out of the analysis and offered for coloring instead. Two
markers do this, and they say different things:

| Column | Marker | Description |
|--------|--------|-------------|
| `Gender#category` | category | Male / Female — a label |
| `BMI_class#category` | category | WHO class: Underweight / Normal / Overweight / Obese — a label |
| `Age#target` | target | Age in years — a quantity you could predict |
| `BMI#target` | target | Body Mass Index (kg/m²) — a quantity you could predict |

`#target` marks an outcome: something you might model. `#category` marks a label:
a group you color by, never a number to regress on. Both are excluded from the
PCA, so the components are built from the body measurements alone.

## Missing-data handling

The raw `BMX_J` file mixes three kinds of columns, and only one is a measurement:

| Prefix | Meaning | Kept? |
|--------|---------|-------|
| `BMX*` | the actual measurement | ✅ features |
| `BMI*` | a *"could-not-obtain" comment code* — blank/NaN when the measurement **was** taken | ❌ dropped |
| `BMD*` | status / category flags | ❌ dropped |

The apparent flood of missing values in the raw file is mostly structural, not
real item-missingness, and is removed by scoping the columns and population
correctly:

1. **Adults only (18+).** This removes the infant-only measures `BMXRECUM`
   (recumbent length) and `BMXHEAD` (head circumference), which are 100% missing
   for adults, along with other age-structured missingness.
2. **Seven raw measurements, no derived BMI.** `BMXBMI` is excluded from the
   feature set because it is an exact function of weight and height
   (`BMI = weight / (height/100)²`); including it would inject deterministic
   collinearity into the loadings. It is retained only as a color target.
3. **Complete-case (listwise) deletion** on the seven features. Among adults the
   per-column missingness is modest (≈1.6% for weight/height up to ≈6.6% for leg
   length), and no single column is a bottleneck, so dropping the ~8% of rows
   with any missing measurement yields a fully complete matrix while keeping
   5096 participants.

**Caveat (mild selection bias).** The ~8% of adults removed by complete-case
deletion skew slightly older (mean age ≈55 vs. ≈49) and heavier (mean BMI ≈33 vs.
≈30): waist, hip, and leg measurements are harder to obtain on older, higher-BMI
participants. Sex balance is preserved. This bias is minor but should be kept in
mind — the file is intended as a PCA demonstration dataset, not for epidemiological
inference.

## Suggested PCA

Standardize the seven features and take two components. The expected structure:

* **PC1 (~60% variance) — overall body size:** all seven loadings positive.
* **PC2 (~29%) — frame-vs-girth shape:** stature variables (height, leg length,
  arm length) load opposite the girth variables (waist, hip, arm circumference).

Color the scores by `Gender#category` to see the sex difference along the shape
axis, or by `BMI_class#category` to see separation along the size axis.

## Background and further reading

NHANES body-measures data are widely used in epidemiology and health machine
learning. Studies commonly (a) **pool multiple cycles** (e.g. `BMX_J` with the
earlier `BMX_I` 2015–2016 and `BMX_H` 2013–2014 files) for statistical power,
(b) derive **non-linear body-shape indices** such as the waist-to-height ratio
(WHtR), Body Roundness Index (BRI), and A Body Shape Index (ABSI) rather than
using raw measurements alone, and (c) link modules via the participant key
`SEQN`.

Representative peer-reviewed examples that use NHANES anthropometric data:

* Zhang H., et al. (2025). *Obesity-related indices are associated with
  self-reported infertility in women: findings from the National Health and
  Nutrition Examination Survey.* https://doi.org/10.1177/03000605251315019
  (pools NHANES 2013–2018; derives WHtR, BRI, ABSI, and related indices.)
* *An Integrated AI Framework for Personalized Nutrition Using Machine Learning
  and Natural Language Processing for Dietary Recommendations.* Applied Sciences
  15(17):9283 (2025). https://doi.org/10.3390/app15179283
  (trains a gradient-boosting model on NHANES demographic and anthropometric data.)
