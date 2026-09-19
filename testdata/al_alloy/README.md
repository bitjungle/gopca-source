## Aluminium Alloy Dataset

The Aluminium Alloy Dataset for Unsupervised Learning is a publicly available materials dataset containing 1,154 aluminium alloy instances characterized by their elemental compositions and processing conditions. The dataset includes concentrations of 25 alloying elements together with categorical information describing heat treatment and mechanical processing states, making it suitable for exploring relationships between composition, processing history, and alloy classification. Originally compiled from published literature and experimental sources, the dataset was developed to support unsupervised machine-learning approaches for discovering natural groupings and patterns within aluminium alloy systems. Its relatively diverse chemical and processing information makes it a useful benchmark for clustering, dimensionality reduction, anomaly detection, and other materials-informatics studies. 

* [Data source](https://data.mendeley.com/datasets/tvtg7gs59p/1)

* Research article: Bhat, N., Barnard, A. S., & Birbilis, N. (2023). Unsupervised machine learning discovers classes in aluminium alloys. Royal Society Open Science, 10(2), 220360.

## The file

`unsupervised_learning_dataset.xlsx` is the dataset exactly as downloaded from
Mendeley Data: a single sheet named `in`, with 1155 data rows.

That count is one higher than the 1154 alloys the paper describes, and the
difference is a malformed row. Sheet row 42 holds `compression test` in column C
and nothing else, while the record above it ends with a dangling comma:

```
row 41  Condition: "Cast material, quenched from 648C, aged 300C/5 h,"
row 42  Condition: "compression test"        (and nothing in any other column)
```

Three neighboring records from the same study end `..., compression test`, so a
spreadsheet line break that stranded the tail of row 41 is the likely
explanation. Only the free-text `Condition` is affected; the columns that carry
the processing information for modeling, `Condition augmented` and `proc_num`,
are intact and agree with those neighbors.

The row is left exactly as published rather than corrected here, so this copy
does not disagree with the source. GoCSV's data quality report flags it.

## The prepared file

`al_alloy_data.csv` is the workbook after preparation in GoCSV Desktop, ready
for PCA. **1057 rows × 30 columns**, of which 24 are element concentrations that
enter the analysis.

Six things were done to get there, in this order:

**1. Deleted the malformed row.** Data row 41, described above.

*Why delete it rather than leave it.* It is not an observation: every one of the
26 numeric columns is empty, because the row is the stranded tail of a sentence
in the row above. Left in place it forces a choice between dropping it during
the analysis anyway or imputing 26 values for a record that describes nothing —
and an imputed row sits at the mean of the data, adding a point to the center
of every scores plot that corresponds to no alloy. Removing it also brings the
row count to 1154, which is what the paper describes.

**2. Deleted `Pb`.** `Pb` and `Bi` are identical in every row. 30 → 29 columns.

*Why delete one of them.* Two columns holding one variable is not neutral in a
covariance method. The pair contributes its variance twice to every component,
so a machinability additive present in seven alloys out of 1057 gets double the
say of any element measured once. The pair is also perfectly collinear, which
makes the covariance matrix singular: the second column adds a zero eigenvalue
and no information. Keeping both would inflate one chemical story at the expense
of the rest, for no gain at all.

The paper drops `Pb` and keeps `Bi`, on the grounds that bismuth has the larger
documented effect on mechanical properties, and this file follows that choice.

> The identity is not a compilation error. Only seven rows carry either element,
> they are the free-machining alloys **2011** and **6262**, and in those alloys
> lead and bismuth are added *together* — they form a low-melting eutectic that
> embrittles the chip so it breaks cleanly during machining. The standards
> specify them in matched ranges (2011: 0.2–0.6% of each; 6262: 0.4–0.7% of
> each), and the nominal composition used here takes the same value for both.

**3. Marked `proc_num` as a category.** It is a processing-type code numbered
1–5 and 7–11, not a quantity, and its variance is roughly 7400× the largest
element's — left as a variable it takes 99.97% of PC1 and the chemistry
disappears. `#category` holds it out of the analysis while keeping it available
to color a scores plot, which is what makes the paper's central claim testable:
the components never saw it, so any grouping by color is independent agreement.

**4. Removed the 97 repeated rows.** 1154 → 1057 distinct rows. **This is a
departure from the paper**, which treats all 1154 as instances.

*Why remove them.* An identical row is not an additional observation; it is the
same point in the feature space a second time. Six copies do not carry six
alloys' worth of evidence, they put six times the weight on one location. PCA
finds the directions of greatest variance about the mean, so repeated points
drag the mean towards themselves and lend their direction more influence than
the data supports — and any density-based method reads them as a cluster that is
not there, which is worth noting because the paper's own clustering finds its
classes by looking for density discontinuities.

The deciding argument is that the repeats cannot be interpreted. A genuine
replicate measurement and an accidental copy look identical here, and the
information that would tell them apart is not in the file. Keeping them means
weighting an arbitrary subset of alloys more heavily than the rest without being
able to say why those ones. For a dataset meant to demonstrate PCA, one row per
distinct alloy is the honest default.

> The repeats concentrate in particular sources rather than being spread through
> the file. One study — *Influence of chemical composition variation and heat
> treatment on microstructure and mechanical properties* — contributes 18 rows of
> which only 3 are distinct. Its six copies of `6063` are identical in **all 30
> columns of the workbook as published** — that is where the repeats were
> counted, before `Pb` was dropped, so 25 element columns rather than the 24 in
> the prepared file.
>
> A study of composition variation cannot have produced six identical
> compositions, so what distinguished those runs is absent from this file: it
> carries composition and processing only, and the mechanical properties that
> were the studies' actual subject are not columns here. Strip the response
> variables from a designed experiment and its runs collapse onto one feature
> vector.
>
> Removing them changes the result very little, which is worth knowing in itself:
> PC1–PC3 move from 58.9 / 21.9 / 10.8% on the full 1154 rows to **59.4 / 22.1 /
> 10.3%** here, with PC1 still reading as aluminium against the main alloying
> additions (`Al +0.87`, `Si −0.32`). Keep the duplicates if you want to match
> the paper exactly; the structure is the same either way.

**5. Kept all four text columns.** `Name`, `Source`, `Condition` and
`Condition augmented` are text, so GoCSV excludes them from the analysis
automatically and offers them for coloring. They cost nothing and they are the
only route from a point in a scores plot back to a real alloy.

**6. Numbered the rows.** `Sample_ID` runs 1 to 1057 and is the row-name column.

*Why.* No column in the file can identify a row: `Name` holds 420 distinct
values across 1154 rows, and even all 30 columns together give only 1057
distinct combinations. Without identifiers a plot labels its points by position,
and a position is recomputed whenever rows are filtered or sorted — so a point
cannot be traced back to the row it came from. `Sample_ID` travels with the row
instead, which is what makes a filtered subset still answerable.

### What the file contains

| | |
|---|---|
| Rows | 1057 |
| Columns | 30 |
| Numeric, entering the PCA | 24 elements |
| Held out | `Sample_ID` (row names), `proc_num#category`, and the four text columns |
| Missing values | 15 cells — 10 in `Condition augmented`, 5 in `Condition` |
| Row names | `Sample_ID`, 1 to 1057 |

**`Sample_ID` is a row-name column, not a variable.** It is the first column on
export, and GoPCA reads column 0 as row names, so it labels points rather than
entering the analysis. Do not move it into the table as an ordinary column: a
column of 1 to 1057 has variance enormously larger than any weight fraction and
would take essentially all of PC1.

**Recommended preprocessing: mean centering only, no scaling.** All 24 variables
are weight fractions of the same whole in the same unit. Autoscaling gives a
trace element present in three samples the same influence as aluminium, and
spreads the variance across two dozen directions — PC1 falls to about 10% and
picks up elements that are zero in most rows.
