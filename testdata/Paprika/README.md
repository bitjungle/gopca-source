## Paprika Powder Dataset (Pimentón de la Vera)

The Paprika Powder Dataset is the elemental fingerprint of 67 commercially
available paprika powders, measured by energy dispersive X-ray fluorescence
(ED-XRF). It was collected to test whether paprika carrying the **Pimentón de la
Vera** Protected Denomination of Origin (PDO) can be told apart from other
paprika powders on trace-element composition alone — an authentication problem,
since PDO products are vulnerable to origin masking. Fifteen elements are
reported for each sample, together with a three-level group label and
descriptive information about the product. The samples were bought in
supermarkets across Europe and on-line between 2014 and 2020, so the data carry
the real variation of commercial product: different brands, harvest years,
cultivars, botanical types and storage histories.

* Research article: Fiamegos, Y., Dumitrascu, C., Papoci, S., & de la Calle, M. B.
  (2021). Authentication of PDO paprika powder (Pimentón de la Vera) by
  multivariate analysis of the elemental fingerprint determined by ED-XRF. A
  feasibility study. *Food Control, 120*, 107496.
  [https://doi.org/10.1016/j.foodcont.2020.107496](https://doi.org/10.1016/j.foodcont.2020.107496)

* [Article and supplementary data on ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0956713520304126) —
  the elemental data is Appendix A, Supplementary data (`mmc1.docx`, Table S1).

### Copyright and license

> © 2020 The Authors. Published by Elsevier Ltd.
>
> This is an open access article under the CC BY-NC-ND 4.0 licence,
> [http://creativecommons.org/licenses/by-nc-nd/4.0/](http://creativecommons.org/licenses/by-nc-nd/4.0/)

The license is as registered by the publisher with Crossref for the version of
record. The supplementary file itself carries no license statement.

**This repository redistributes none of that material.** It carries
`make_dataset.py`, which rebuilds the dataset from documents you obtain
yourself. The reason is the **ND** clause: a change of format alone would be
fine, because CC 4.0 §2(a)(4) says media and format conversions never produce
adapted material — but the workbook the script builds is a *compilation*, and
that is a different thing. It combines two separately published tables, drops
the summary rows from one of them, and adds a sheet of metadata that is not in
either source. Rather than decide whether that counts as adapted material, the
repository simply does not ship it.

## The files

Neither source document is in the repository. Obtain both, then run the script.

| File | In the repo | Where it comes from |
|---|---|---|
| `make_dataset.py` | yes | this repository |
| `README.md` | yes | this repository |
| `1-s2.0-S0956713520304126-mmc1.docx` | no | the article's Appendix A on ScienceDirect |
| the article PDF | no | the publisher; found by pattern in `docs/references/`, which is local-only, or passed with `--pdf` |
| `paprika.xlsx` | no | produced by `make_dataset.py` |

```bash
cd testdata/Paprika
python make_dataset.py
```

The script needs `pdftotext` (poppler) and nothing else — no third-party Python
packages. It checks its own parse against the counts stated in the paper and
stops rather than write a workbook that is quietly wrong.

`paprika.xlsx` has three sheets:

| Sheet | Contents | Source |
|---|---|---|
| `data` | 67 samples × 15 elements, plus a `CLASS` column | Table S1 (supplementary) |
| `sample_info` | 67 samples × 6 descriptive fields | Table 1 (article body, page 2) |
| `meta` | Article link, group definitions, method, instrument, meaning of `< LoQ` | written by this project |

**Modifications made to the published material**, which the license requires to
be stated:

* the two tables above are combined into one workbook;
* the `Median`, `Mean`, `STD` and `RSD` summary rows of Table S1 are omitted;
* the units, which Table S1 keeps inside its header cells, are moved to a row of
  their own;
* the unnamed group column of Table S1 is given the header `CLASS`;
* the `meta` sheet is added.

No measured value is altered.

## Purpose

Classify a paprika powder as **La Vera PDO** or not, from its elemental profile.
The paper builds one-class models (SIMCA, referred to there as PCA-Class) and a
supervised PLS-DA model, and reports that the two fail in opposite directions:
PCA-Class reached 100% specificity but 82% sensitivity, PLS-DA 100% sensitivity
but 91% specificity.

## Samples

* Total: **67** paprika powders, bought 2014–2020
* Groups: **3**
* Group distribution: `LV` 33, `SNLV` 7, `Rest` 27

| Group | Meaning |
|---|---|
| `LV` | Pimentón de La Vera, the PDO product — 12 brands, all listed on the official PDO site |
| `SNLV` | Spanish paprika **not** from La Vera |
| `Rest` | Not Spanish, or of unknown origin |

`SNLV` and `Rest` are kept as separate groups rather than merged, because
Spanish non-La Vera paprika is expected to be the harder case: more similar to
`LV` in composition, and so more likely to be mistaken for it.

## Features

Fifteen elements, in two different units. Five are reported in g kg⁻¹ and ten in
mg kg⁻¹, so the columns span roughly four orders of magnitude — which makes the
scaling decision a real one rather than a formality.

| Element | Unit | Range in this data |
|---|---|---|
| P | g kg⁻¹ | 1.90 – 4.16 |
| Cl | g kg⁻¹ | 2.33 – 6.25 |
| S | g kg⁻¹ | 2.01 – 4.26 |
| K | g kg⁻¹ | 19.2 – 41.2 |
| Ca | g kg⁻¹ | 1.53 – 4.92 |
| Cr | mg kg⁻¹ | 1.63 – 10.4 |
| Mn | mg kg⁻¹ | 10.7 – 77.5 |
| Fe | mg kg⁻¹ | 110 – 679 |
| Ni | mg kg⁻¹ | 0.22 – 2.74 |
| Cu | mg kg⁻¹ | 4.85 – 10.7 |
| Zn | mg kg⁻¹ | 14.5 – 41.1 |
| Br | mg kg⁻¹ | 1.77 – 26.6 |
| Rb | mg kg⁻¹ | 8.35 – 47.4 |
| Sr | mg kg⁻¹ | 3.89 – 37.3 |
| Ba | mg kg⁻¹ | 3.45 – 10.4 |

The paper reports **Mn, Br and Zn as higher in La Vera** paprika and **Fe and Sr
as lower**, with no overlap between La Vera and either other group for Mn, Fe or
Sr. Elements measured but excluded from modeling, because more than half the
samples fell below the limit of quantification, were Mg, Sb, Mo and Cs.

## Target

`CLASS` in the `data` sheet, and `Group in the study` in `sample_info`: the
three-level label `LV` / `SNLV` / `Rest`.

`sample_info` additionally carries `Type of paprika` (Sweet 37, Hot 13,
Semisweet 6, NA 11), `Smoked` (Yes 38, No 23, NA 6), `Country of origin`,
`Country of purchase` and `Year of purchase`. None of these entered the models
in the paper; they are available for coloring or grouping.

## Notes on the data

Five things to know before using the workbook. The first two and the last are
properties of the published tables, and the script reproduces them rather than
correcting them — for the same reason the aluminium alloy file keeps its
malformed row: this copy should not disagree with its source. The other two
follow from the restructuring listed above.

**The group label is spelled differently in the two published tables.** Table S1
writes the middle group `SNVL`; Table 1 and the body of the paper write `SNLV`.
The counts agree either way, so it is a transposition in the supplementary file
rather than a disagreement about which samples belong where. The `data` sheet
therefore reads `SNVL` and `sample_info` reads `SNLV`.

**The two tables are not row-aligned.** Both list the same 67 sample codes with
no duplicates and none missing, but six appear in a different order — Table S1
has `PAPR0050`, `PAPR0058`, `PAPR0055` where Table 1 has `PAPR0055`,
`PAPR0050`, `PAPR0058`. **Join the sheets on the sample code, never by row
position.** The script reports the count of misaligned rows when it runs.

**There is a units row.** Row 2 of the `data` sheet holds `(g kg-1)` and
`(mg kg-1)` rather than measurements, so it is a second header line and not a
sample. Importing the sheet without accounting for it produces 68 rows, one of
which is text in every element column.

**The sample-code column has no header.** Table S1 leaves it unlabelled and the
workbook keeps it that way, which also lets GoCSV offer the codes as row names —
they are unique across all 67 samples.

**`Br` carries the only missing values**, eight of them, written as `< LoQ`
(below the limit of quantification) — seven spelled `< LoQ` and one `<LoQ`
without the space. Every other element column is complete and numeric across all
67 samples.
