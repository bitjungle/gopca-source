# Data Preparation with GoCSV Desktop

## Overview

Real data rarely arrives ready for analysis. It comes with a title block above the table, samples running across the top instead of down the side, a sample ID that hides the batch number inside it, blank cells, and a column that turns out to hold the same value in every row.

GoCSV Desktop is where you sort all of that out. It handles everything that comes *before* PCA — opening awkward files, fixing the shape of the table, filling or removing gaps, reshaping variables — and then hands clean data to GoPCA Desktop.

One division is worth fixing in your mind from the start:

> **GoCSV prepares the data. GoPCA preprocesses it.**
>
> Centering and scaling belong to the analysis, not to the file, because they depend on which samples you are analysing. GoPCA applies them at analysis time and can undo them. Do not apply them here.

| Task | Where |
|------|-------|
| Open CSV, Excel, TSV, Parquet | GoCSV |
| Fix the table's shape (transpose, row names) | GoCSV |
| Handle missing values | GoCSV |
| Choose rows and columns | GoCSV |
| Encode categories, split or combine columns | GoCSV |
| Log / square-root transforms | GoCSV |
| Mark group variables (`#target`) | GoCSV |
| **Mean centering** | **GoPCA** |
| **Scaling (autoscaling, Pareto, SNV…)** | **GoPCA** |
| PCA computation and visualisation | GoPCA |

---

## 1. Getting your data in

### Supported formats

| Format | Extension | Notes |
|--------|-----------|-------|
| CSV | `.csv` | Delimiter and decimal separator are detected automatically |
| TSV | `.tsv` | Tab-separated |
| Excel | `.xlsx`, `.xls` | A single-sheet workbook opens directly. One with several sheets opens the Import Wizard, so you choose which one. Sheets the workbook marks hidden are not counted |
| Parquet | `.parquet` | Columnar format used by Kaggle, Hugging Face, Our World in Data and similar sources |

You can save as **CSV** or **Excel**.

**A note on Parquet.** These files have no row index, so GoCSV adds a `Sample_ID` column (1, 2, 3 …) to give every row a unique identifier. String columns arrive marked `#category`, which keeps them out of the analysis and available as group variables for colouring plots. The marker matters because a Parquet file knows a column is text while a CSV does not: a column of zero-padded codes like `001`, `002` would otherwise be read back as numbers and analysed as measurements. Numeric columns come in directly, and nulls become empty cells.

### When a file will not open on its own

Most files open with **Choose File**. Two situations need more control, and **Import with Wizard** handles both.

**The table does not start at the first row.** Spreadsheets are often written for people rather than programs — a report title, a date, a blank row, and only then the real headers. GoCSV recognises this and offers the Import Wizard with the right number of rows already skipped. Check the preview and import.

**You want to choose what comes in.** The wizard lets you pick the sheet, say which row holds the headers, and select only the columns you need.

| Option | Applies to | What it does |
|--------|-----------|--------------|
| Sheet | Excel | Which sheet to read |
| Delimiter | CSV / TSV | Comma, semicolon, tab or pipe |
| First row contains headers | All | Uncheck for files with no header row |
| Header Row | All | Which row holds the column names (0-based) |
| Skip Rows from Top | All | Discard rows above the table — pre-filled when a title block is detected |
| Maximum Rows | All | Read only the first N rows; 0 reads them all |
| Row Names Column | All | Which column holds sample names (−1 for none) |
| Column selection | All | Tick the columns to import, in the preview step |

> **If a spreadsheet refuses to open,** the cause is almost always that the data does not begin at the first row. **Skip Rows from Top** in the Import Wizard is nearly always the answer.

### A file with no numbers in it is still a valid file

You do not need numeric columns to open a file. A table of nothing but text — sample names, sites, categories — opens perfectly well. Preparing data for PCA often *starts* from something that is not numeric yet, and the encoders in section 5 are how you make it numeric.

GoCSV will tell you the file is not ready for PCA yet, which is true and useful. It will not refuse to let you work on it.

---

## 2. Getting the shape right

Before anything else, one question decides whether the analysis will mean anything: **what is in your rows, and what is in your columns?**

There is a single right answer, and it is the same one GoPCA shows you in Step 1:

- **Rows are samples** — the things you measured
- **Columns are variables** — the things you measured *about* them

If that sounds abstract, it is easier to see than to define. Say you measured three flowers:

| | Sepal length | Sepal width | Petal length |
|---|---|---|---|
| **Flower 1** | 5.1 | 3.5 | 1.4 |
| **Flower 2** | 4.9 | 3.0 | 1.4 |
| **Flower 3** | 4.7 | 3.2 | 1.3 |

Each **row** is one flower — one thing you observed. Each **column** is one property, measured the same way for every flower. Reading across a row tells you about one flower; reading down a column tells you about one measurement across all of them.

### Am I the wrong way round?

Two questions settle it, and you only need one:

**"If I collected one more sample tomorrow, where would it go?"** It should be a new **row**. If your table would grow a new *column* instead, it is transposed.

**"Does one column hold values measured in different units?"** If a single column contains a temperature, then a pH, then a concentration, those are variables stacked vertically — the table is on its side.

> **This is not a formatting preference.** PCA looks for variables that vary together across samples. Feed it the transpose and it will answer a question you did not ask — how *samples* vary across *measurements* — and give you a perfectly ordinary-looking set of components describing nothing you meant. The arithmetic cannot tell you it happened; only you can.

### Your instrument probably disagrees

Spectrometers, chromatographs and sequencers commonly export the other way round: one **column** per sample, one **row** per wavelength or channel. That is the transpose of what PCA needs.

Use **Transpose** in the toolbar. It swaps rows and columns, turning your headers into row names and your row names into headers. It tells you what the result will be before it does anything, and it undoes cleanly if the answer surprises you.

Two things happen that are worth expecting:

- **Column types are recalculated.** A transposed table has entirely different columns, so a row that mixed text and numbers becomes a column that does.
- **Any `#target` marking stops applying.** A target has to be a column; after transposing it is a row.

### Row names: which column identifies your samples

Your samples need labels, and the first column of your file is where GoCSV looks for them. When it can serve, it becomes the **row-name column**: shown down the left of the grid, kept out of the numbers, and used to label points in GoPCA's plots.

**"When it can serve" means every value is present and different from every other.** That is what a label has to be. If the first column repeats itself — a source, a batch, a category — GoCSV leaves it in the table as an ordinary column and the table simply has no row names. Nothing is lost and nothing is silently mislabelled.

The reason for the rule is worth seeing rather than taking on trust: row names label the points in a scores plot. Two samples sharing a name are indistinguishable exactly where you would most want to tell them apart, and a sample with a blank name is a point you cannot identify at all.

Two commands, both on the right-click menu of any column header:

- **Use as Row Names** — promote a different column. Whatever was serving as row names returns to the table, so nothing is lost.
- **Move Row Names into Table** — put the row names back as an ordinary column and leave the table without any. If those names are numbers, the column arrives marked `#category`, because they are identifiers rather than measurements: a column of `1, 2, 3 …` has variance vastly larger than any real variable and would otherwise take almost the whole first component. Remove the marker from the same menu if you disagree.

> **If no column identifies your samples,** that is a perfectly ordinary situation, and you have three choices.
>
> **Build one from what you have.** **Combine Columns** will join a site and a date into something unique, and **Split Column** will pull an identifier out of a code that has one buried in it. Prefer this when the pieces are there — a label that says *what* a point is beats one that says only *which*.
>
> **Number the rows.** Right-click any column header and choose **Number the Rows…**. A small dialog asks where to start and what to count by, and shows you the identifiers before it writes them. Leave both at 1 and every row gets `1`, `2`, `3` …, unique by construction. Change the start to 101 if that is how your samples are numbered, or the step to 2 if that is how they were taken.
>
> Inside GoCSV the numbers are row names rather than a column, so nothing new enters the analysis and the column count does not change — and **when you save, they are written as the first column of the file**, which is where GoPCA reads row names from. There is no second step to "put them into the table"; saving does it. Use this when the file genuinely has nothing to build an identifier from and you want a say in the numbering.
>
> **Do nothing, and let the export handle it.** If you export a file that still has no row names — as CSV, as Excel, or by handing it straight to GoPCA — GoCSV writes a `Sample_ID` column of `1`, `2`, `3` … as the first column for you, and says that it did. Nothing is added to the table you are editing: the column is in the file that left, not in the grid you are looking at.
>
> The only difference between this and **Number the Rows** is *when*. The command gives you the identifiers now, where you can see them in the grid. The export supplies them at the last moment if you never asked.

**A file never leaves GoCSV without something that tells its rows apart.** Whatever the loader found, whatever you assigned, or numbers written at the door — one of the three is always there.

That guarantee is about GoCSV's exports and nothing else. A file you open in GoPCA **directly**, having never passed through GoCSV, may have nothing to serve as row names — and GoPCA takes its first column regardless, because nothing in a column's contents says whether it is an identifier or a measurement. Its Loaded Data panel names the column it took and offers a checkbox, **First column contains data, not row names**, to say it was wrong. With that ticked, GoPCA numbers the points itself, from 1 — so the fourth row of your file is `Sample 4` in a scores plot. Nothing is lost except the ability to identify a point by anything more meaningful than its position.

### What part does each column play?

Getting rows and columns right settles the *shape* of your table. There is a second question, and it only arrives once you start thinking about regression: **do all your columns play the same part?**

For PCA, the answer is yes. PCA asks one question of every variable at once — *how do these vary together?* — and no column is special. There is nothing to predict and nothing doing the predicting. This is what people mean when they call PCA **unsupervised**: nobody has told it what the right answer looks like.

Principal Component **Regression**, new in version 2, asks a different question: *can these variables predict that one?* Now the columns divide into two parts:

| Part | Also called | What it is |
|------|-------------|------------|
| **Predictors** | independent variables, *X* | The things you measure in order to make a prediction — spectra, concentrations, process settings |
| **Response** | dependent variable, *Y*, target | The one thing you want to predict — a yield, a density, a concentration you would rather not measure every time |

**A note on the words**, because they confuse almost everyone at first. "Independent" and "dependent" come from designed experiments: you *set* the independent variable and watch the dependent one respond. Most data is not like that — nobody set the iron content of a rock — so the value does not really depend on anything you controlled. **Predictor** and **response** say the same thing without the implied experiment, and are the safer words when in doubt. You will meet both.

**Why this matters here, in the preparation step.** A response variable left sitting among the predictors is used to predict itself. The model will look superb and mean nothing, and neither the numbers nor the plots will look wrong. You tell GoCSV which column is which by marking the response with **`#target`** — see **Target columns** in section 5.

> **One variable, two jobs.** A column marked `#target` is held out of the PCA in both cases. In PCA it comes back as a reference variable — colour the scores plot by yield and see whether the components have found anything related to it. In PCR that same column becomes the response you are modelling. The marking is the same; what you do with it is the difference between the two analyses.

---

## 3. Looking before you leap

Open the **Data Quality Report** first, before changing anything. It is quicker to read than the grid and it will often decide what you do next.

**For the dataset:** dimensions, overall missing percentage, duplicate rows, and how many columns are numeric against categorical.

**For each column:** mean, median, standard deviation, quartiles, missing percentage, outlier counts, and a quality score.

Two things it flags are worth acting on:

**Columns with no variation at all.** Every value identical. Such a column contributes exactly nothing to any component — but it is not harmless, because it sits at the origin of every loadings plot where its position can be read as meaningful. Instrument settings, a constant temperature, a batch code that never changed: all common, all worth removing.

**Columns that barely vary.** Reported as a fraction of the column's own level, so the judgement does not depend on whether you recorded metres or kilometres. Below a tenth of a percent, standardisation will scale that column to unit variance anyway — which can turn measurement noise into an apparent component.

Neither is removed for you. Whether a quiet variable matters is a question about your experiment, not about the numbers.

**And one it flags that usually needs nothing.** The report also counts how many numeric columns are *skewed or have unusual tail weight*. This is information rather than a fault. PCA assumes nothing about the shape of your distributions, so there is no requirement here to satisfy before you can proceed, and a long list of flagged columns is not a problem with your data.

It is worth knowing for one reason: leverage. A column with a long tail has a few values sitting far from the mean, and a covariance method notices distance — so that column can pull a component towards itself for reasons of shape rather than substance. That is the case worth acting on, and section 6 covers the transforms that reduce it.

Read the flag before reaching for one, though, because it is deliberately two-sided. It fires when a column's tails are unusual in *either* direction, so a column whose values are spread evenly across their range — no tail at all — is flagged exactly as a long-tailed one is. Nothing is pulling on a component there, and transforming it would be work without a purpose.

**Repeated rows.** The report also counts rows that repeat a row appearing earlier in the file — identical in *every* column. These are easy to miss by eye, because copies often sit next to each other and differ in nothing at all, so scrolling past them looks like scrolling past ordinary data.

Whether that matters is a question about your experiment, not about the numbers, which is why nothing is removed for you:

- **Replicate measurements** of the same sample are legitimate data. Keep them, or collapse them to one row per sample with **Average Replicates**.
- **Accidental copies** — a file concatenated twice, a row pasted in duplicate — give those samples double weight in every component, and make a cluster look denser than the evidence supports.

The finding names the rows, so you can judge rather than guess. Click **Show rows in the table** and the grid selects the repeats — the second and later occurrence of each, **never the first** — so deleting exactly that selection leaves one of every distinct row. **Delete Row** acts on the whole selection at once.

> That asymmetry matters when you look at the result. Every highlighted row repeats an **unhighlighted** row earlier in the file — the first occurrence of its group. A row can appear three, four or six times, and then all its copies are highlighted together with only the first left unmarked, so two adjacent highlighted rows may well be copies of the same original. To check one, compare it with the nearest unhighlighted row above it.

---

## 4. Missing values

**Finding them:** the Data Quality Report gives percentages per column, and empty cells are highlighted in the grid.

**Filling them:** the **Fill Missing Values** dialog works one column at a time.

| Strategy | When to use it |
|----------|----------------|
| Mean | Roughly symmetric numeric data |
| Median | Skewed numeric data, or when outliers are present |
| Mode | The most frequent value — the only sensible choice for categorical columns |
| Forward fill | Time-ordered data; carry the last observation forward |
| Backward fill | Time-ordered data; carry the next observation back |
| Custom value | You know what the gap means — zero, a detection limit, "Unknown" |

Removing rows or columns is the other option, and often the better one: use **Filter Rows** (section 5) or delete the column outright when a variable is mostly empty.

> **You may not need to fill anything.** GoPCA's **NIPALS** algorithm handles moderate missing data directly, without imputation. SVD and Kernel PCA need every value present. If your gaps are few and scattered, choosing NIPALS in GoPCA is more honest than inventing values here.

---

## 5. Choosing and shaping what you analyse

### Choosing rows

**Filter Rows** keeps or removes the rows matching a condition — drop the QC standards, analyse one batch, exclude samples you have decided are unusable.

It shows how many rows match, and how many would remain, *before* you apply it. A filter that would empty the table says so.

One rule is worth knowing because it protects you: **blank cells match only "is empty"**. A negative condition will never sweep up rows for having *no* value in that column. Asking to remove rows where `Region is not Nord` removes the ones you can see are not Nord, not the ones whose region was never recorded. Deciding a sample's fate on a missing value should be something you ask for deliberately, which is what the "is empty" condition is for.

### Averaging replicates

Measuring each sample two or three times is good practice, but those repeats should usually become **one row** before analysis. **Average Replicates** does that: group by the column identifying the sample, and the numeric columns are combined — mean by default, or median, sum, or first value.

It also removes a hazard rather than working around one. Replicates left as separate rows **leak between cross-validation folds**: the same sample lands in both training and validation, and the model looks better than it is. Averaging first prevents that; the alternative is remembering to set `--cv-group` on every PCR run.

Three things it will not do quietly:

- **Missing numbers are skipped, not counted as zero.** Averaging a gap in as zero would drag the result towards zero in proportion to how much data is absent — a silent bias rather than a visible gap. A group with nothing present stays empty.
- **Where a group disagrees on a text value, the cell is cleared** and the count reported. Picking one of the competing values would assert something about the aggregated sample that no row actually said.
- **Rows with no group value stop the operation.** A blank is not a group: averaging the unlabelled rows together would invent a sample, and dropping them would lose data. Remove or label them first — Filter Rows does it in one step.

The grouping column becomes the row-name column afterwards, since the rows it identified no longer exist and the group value is what identifies the new one. Those names are unique by construction, which is exactly what row names need to be — and **Move Row Names into Table** puts them back as a column if you want them there, marked `#category` if they are numeric, which for a batch or sample number is what they are.

> **The grouping column often has to be made first.** If your replicate structure is buried in a sample ID like `B3_S12_r1`, split it on `_` and group by the batch part.

### Choosing columns

- **Delete columns** — remove what you are not analysing: record numbers, timestamps, operator codes
- **Insert Column Before / After** — add an empty column to fill in yourself
- **Rename column** — give variables names you will recognise in a loadings plot
- **Reorder columns** — drag a column header. The move is applied to the data, so it survives export and reaches GoPCA, and Undo reverses it like any other edit
- **Mark as Target Column** — see below

Worth considering for removal: columns with no or almost no variation (section 3), and near-duplicate columns that correlate almost perfectly with another variable.

### Splitting and combining columns

Sample identifiers often carry structure. `B3_S12_r1` means batch 3, sample 12, replicate 1 — three facts stuffed into one string.

**Split Column** divides a column on a delimiter, giving one new column per part. Splitting that ID on `_` gives you the batch as a column of its own, which is exactly what PCR's grouped cross-validation needs and what you would group on to average replicates.

**Combine Columns** does the reverse, joining several into one. Columns join **in the order you tick them**, so `Site` then `Year` gives `Oslo_2024` while `Year` then `Site` gives `2024_Oslo`. The dialog shows the result as you go.

> **The ID you want to split is probably your row-name column,** and row names are not in the selection list. Right-click any header, choose **Move Row Names into Table**, and it becomes a column you can split.

### Making categories numeric

PCA works on numbers. A categorical column has to be encoded before it can take part — and *how* you encode it is a statement about your data, not a formatting choice.

**One-Hot Encode** makes no claim about order. Each category becomes its own column, and PCA treats them as equally distant from one another. This is right for unordered categories: species, site, operator, instrument.

**Ordinal Encode** replaces categories with 0, 1, 2 … in an order you set. Use it only when the categories genuinely form a scale — `lav, middels, høy`, or `never, rarely, sometimes, often, always`. The dialog lists the values with arrows to reorder them, and recognises common scales in English and Norwegian, so `lav / middels / høy` comes up already in the right order.

Both keep the original column by default. Keeping it is usually what you want, because GoPCA colours scores plots by categorical columns — encoding `species` and discarding it costs you a colouring you would probably have wanted.

**The mistake worth avoiding.** Numbering unordered categories tells PCA something untrue. Encoding `species` as setosa = 0, versicolor = 1, virginica = 2 asserts that virginica is three times setosa and that versicolor sits exactly halfway between them. None of that is true, and PCA cannot know — it is a covariance method, so it consumes those invented distances as though they were measurements. The resulting component will look perfectly ordinary. If your categories have no order, reach for one-hot encoding.

> **If you have used scikit-learn's `LabelEncoder`,** it assigns codes alphabetically. For an ordered scale that is usually wrong: `low, medium, high` becomes `high = 0, low = 1, medium = 2`, scrambling the very order the numbers are supposed to carry. Leaving GoCSV's list untouched gives you that same alphabetical result — the arrows exist so you do not have to accept it.

### Target columns

This is where you say which column plays which part — the question raised in section 2.

**Mark as Target Column** appends `#target` to a column name. A numeric column marked this way is **held out of the PCA** and offered instead as a reference variable:

```
ID,x1,x2,x3,Yield#target
  -> variables entering the PCA : x1, x2, x3
  -> held out, available as a reference : Yield#target
```

What you then do with it decides the analysis:

- **In PCA**, colour the scores plot by it. If samples high in yield gather on one side of a component, that component has found something related to yield — without ever having been shown it. That is a genuinely independent check, and it is only worth anything *because* the variable was held out.
- **In PCR**, it is the response you model: `pca regress --response "Yield#target"`, or pick it from the list in GoPCA Desktop.

**The test to apply is simple: will this variable be available when you come to make a prediction?** A spectrum will be — that is the point of the model. A lab-measured density will not, if measuring it is the work you are trying to avoid. Anything in the second group belongs out of the predictors, whether or not it is the response you are modelling today. A column that is only known *after* the answer is known will predict that answer beautifully and be useless on the next sample.

Categorical columns are already excluded from the PCA and already available for colouring, so marking one changes its name without changing what it does. Marking `Batch#target` is a way of writing down what the column is *for* — a grouping variable, not a measurement — which is worth doing for the next person to open the file, and for you in six months.

> **What `#target` is not.** It does not transform the column, weight it, or tell PCA to pay attention to it. It does the opposite: it takes the column *out* of the analysis so that any agreement you find afterwards was not arranged in advance.

### Category columns

There is a second marker, and it exists for a problem `#target` cannot express.

Some columns hold numbers that are not measurements. A processing code running 1
to 11, a site number, a batch identifier. Each parses as a number, so PCA treats
it as a quantity — and the arithmetic distance between code 3 and code 9 enters
the analysis as though it meant something.

It can be worse than meaningless. Codes are often numbered 1, 2, 3 … while the
measurements beside them are fractions, percentages or ratios — so the code
varies over a range hundreds or thousands of times wider than anything real in
the table. Variance is what PCA is built on, so that one column can take almost
the whole of the first component, leaving the measurements to share what is
left. **Nothing in the output looks wrong**: the scores plot is perfectly
ordinary, and the loadings quietly say that one variable explains everything.

The same trap catches anything numeric that is not a measurement — a sample ID,
a year, a timestamp stored as seconds. If GoCSV's Data Quality Report finds one
column carrying more than half the variance in your table, it will name it.

**Mark as Category Column** appends `#category`, and the column is then treated
as a class: held out of the PCA, offered for colouring, and available to the
encoders in the previous section — which only accept categorical columns, so
this is what makes one-hot encoding a numeric code possible at all.

**Which of the two markers you want:**

| | `#target` | `#category` |
|---|---|---|
| You are saying | "this is an outcome, not a predictor" | "these numbers are labels, not quantities" |
| Colouring | gradient | by class |
| In regression | can be the response | never the response; can group CV folds |
| Encoders | not offered | one-hot and ordinal |

Two questions decide it. **"Would I ever want to predict this?"** — that is a
target. **"Is the gap between 3 and 9 meaningful?"** — if not, it is a category.

The two are alternatives, so a column carries one or the other. Marking a column
as a category removes any target flag it had, and the other way round — you do
not have to clear the old one first.

On a column that already holds text, `#category` changes nothing: text is
categorical anyway. The marker is for numbers pretending to be measurements.

> **Marking a class code as a target and then regressing on it** is the mistake
> worth naming. The fit runs, reports an R², and asserts that your three species
> are ordered and evenly spaced. GoPCA warns when a response looks like a class
> code — but `#category` says what you meant before anyone has to be warned.

---

## 6. Transformations

Transform in GoCSV when the *distribution* of a variable needs correcting. Leave centering and scaling to GoPCA.

### Which one, and when

Most datasets need none of these. Reach for a transformation when you have a reason, and the reason is usually one of three:

**"One variable has a long tail."** A few large values sit far from the mean, and PCA is a covariance method — it notices distance. That variable will pull a component towards itself for reasons of shape rather than substance. Use **Box-Cox** if every value is above zero, **Yeo-Johnson** if any are zero or negative. Let them fit the exponent; that is what they are for.

**"My columns are parts of a whole."** Percentages, assays, anything summing to 100. Use **CLR**, and read the section below first — this is a correctness problem, not a tidiness one.

**"I know the mechanism."** Log for a process that is multiplicative rather than additive, square root for counts that behave like a Poisson, square for a left skew. These are claims about how your measurement works, and if you can make one, a fixed transform is more defensible than a fitted one because you can say why you chose it.

If none of those applies, **do nothing here.** Centering and scaling in GoPCA handle differences of unit and range, which is what most preparation actually needs.

| Transformation | Use case |
|----------------|----------|
| Log | Right-skewed data — concentrations, counts, incomes |
| Square root | Count data, or moderate skew |
| Square | Left-skewed data |
| Standardisation (z-score) | General scaling — though GoPCA can do this at analysis time |
| Min-max scaling | Scale to [0, 1] or a range you choose |
| Binning | Turn a continuous variable into categories |
| Box-Cox | Right-skewed data, with the strength of the correction fitted to the column |
| Yeo-Johnson | The same, but defined at zero and for negative values |
| Centred log-ratio (CLR) | Compositional data — percentages, assays, parts of a whole |

**A column is transformed completely or not at all.** `log` is undefined at zero and below, and `sqrt` at negatives. If any value in a column is outside the range, GoCSV leaves the whole column untouched and tells you which rows are the problem.

This matters more than it sounds. Transforming the valid values and skipping the rest would leave one variable holding two different scales — some cells in log units, some raw — and nothing downstream could detect it. Zeros in concentration and count data are normal, not exotic, so this is a case you are likely to meet. When you do, decide what the zeros mean before transforming: a true zero, a value below the detection limit, and a missing measurement are three different things.

### The order you do things in changes the answer

This is the part that is easy to get wrong, because every individual step looks correct.

**Filter before you transform.** Box-Cox and Yeo-Johnson fit their exponent to the values present. Remove a batch afterwards and the exponent was fitted partly to rows you have discarded — harmless in most cases, wrong if the batch you removed was the skewed one.

**Decide about replicates before you transform, not after.** Averaging and transforming do not commute, and the difference is not small. Two replicates of a concentration, 10 and 100:

| Order | Result | What it means |
|-------|--------|---------------|
| Average, then log | `log(55.0) = 4.007` | The **arithmetic** mean of the measurements |
| Log, then average | `mean(log) = 3.454` | `log(31.6)` — the **geometric** mean |

Both are defensible; they answer different questions. If your measurement error is additive, average first. If it is multiplicative — as it usually is for concentrations spanning orders of magnitude — transform first, so you are averaging on the scale where the error is symmetric. What you should not do is pick by accident.

**Do not stack distribution transforms.** Log followed by Box-Cox is Box-Cox applied to data that has already been corrected, and the fitted λ will reflect that. Choose one.

**Apply CLR to raw compositional data**, before anything else touches those columns. It works on the ratios between parts; transforming the parts individually first destroys the very relationship it is reading.

### Letting the data choose the transform

`log`, `square root` and `square` all ask you to guess how skewed a variable is. **Box-Cox** and **Yeo-Johnson** fit the exponent instead, by maximum likelihood, so the strength of the correction comes from the column rather than from your judgement about it.

Both belong to one family:

```
                (xᵏ − 1) / k    for k ≠ 0
Box-Cox(x) =
                ln(x)           for k = 0
```

The logarithm is not a special case bolted on — it is the k = 0 member, which the formula approaches smoothly. So "should I take logs, or a square root, or neither?" becomes one question with one answer: what value of k best symmetrises this column?

**Which of the two?** Box-Cox needs every value strictly above zero. **Yeo-Johnson** extends the same idea to zero and negative values, which is precisely where `log` and `sqrt` refuse — so it is the answer for zero-inflated concentration and count data, and the one to reach for when Box-Cox declines your column.

**The fitted λ is reported afterwards**, because a transform whose parameter you cannot see is one you cannot quote in a paper or reproduce anywhere else. You can also supply λ yourself: a validation set should be transformed the same way as its training set, not fitted to its own optimum.

**What it looks like.** A right-skewed concentration column, and what Box-Cox does to it:

| Input | 0.4 | 0.7 | 1.1 | 1.8 | 3.2 | 6.5 | 14.0 | 31.0 |
|-------|-----|-----|-----|-----|-----|-----|------|------|
| **Output** | −0.97 | −0.36 | 0.09 | 0.57 | 1.08 | 1.67 | 2.26 | 2.81 |

> `Box-Cox applied to 'Conc' (λ = −0.1214, fitted by maximum likelihood)`

Read the gaps rather than the numbers. In the input, the last two values are 17 units apart while the first two are 0.3 apart — a ratio of nearly sixty. After transforming, those gaps are 0.55 and 0.60: comparable. The largest sample no longer sits at a distance that would dominate a component on its own.

Note also that λ came out at −0.12, close to zero — which is the logarithm. For data generated by a multiplicative process the estimator tends to find its way there by itself, which is a useful check that it is doing something sensible rather than something arbitrary.

> **Not about normality.** PCA makes no assumption that your variables are normally distributed, so this is not a box to tick before analysis. The reason to reduce skew is more concrete: a variable with a long tail exerts leverage out of proportion to its information, because a handful of large values sit far from the mean and a covariance method notices distance. Reducing the skew reduces that pull. If a variable is not skewed, leave it alone — a fitted λ near 1 is the transform telling you exactly that.

**References:** Box & Cox (1964), *An Analysis of Transformations*, JRSS B 26(2). Yeo & Johnson (2000), *A New Family of Power Transformations to Improve Normality or Symmetry*, Biometrika 87(4).

### Compositional data: parts of a whole

Some measurements only make sense relative to each other. Mineral assays, food composition, soil fractions, percentage breakdowns — each row describes how a whole divides into parts, and the parts add up to 100 (or 1, or a fixed total).

**This breaks PCA in a way that is easy to miss.** If the parts must sum to a constant, then one part rising forces the others to fall, whatever the underlying chemistry. That is not a fact about your samples; it is arithmetic. The covariance matrix becomes singular, correlations between parts come out spuriously negative, and the components you get describe the constant-sum constraint as much as the material.

The fix is over a century old in outline and standard since Aitchison: stop analysing the amounts and start analysing the *ratios* between them.

**Centred Log-Ratio (CLR)** does this. Each part is replaced by the logarithm of its ratio to the geometric mean of the whole row:

```
clr(x)ᵢ = ln( xᵢ / geometric mean of the row )
```

Select **every part of the composition together** — all the oxides, all the percentages — and each becomes a new `_clr` column. Two things follow from the definition and are worth recognising:

- **The values describe ratios, not amounts.** A row of `[2, 3, 5]` and a row of `[2000, 3000, 5000]` transform identically, because they are the same composition measured in different units.
- **Each transformed row sums to zero.** That is inherent to centring on the geometric mean, not a sign of anything wrong.

**What it looks like.** Two samples, three parts, percentages:

| | A | B | C | | A_clr | B_clr | C_clr |
|---|---|---|---|---|---|---|---|
| Sample 1 | 60 | 30 | 10 | → | 0.828 | 0.135 | −0.963 |
| Sample 2 | 20 | 20 | 60 | → | −0.366 | −0.366 | 0.732 |

Sample 2 shows the reading most clearly: A and B are equal, so they take the same value, and it is *negative* — meaning both sit below the geometric mean of that row. C is above it. The numbers say "this part is large or small relative to the rest of this sample", which is the only thing a composition can honestly tell you. And each row sums to zero, as it must.

CLR keeps one output column per input column, so a loadings plot still names your variables — which is why it is the sensible choice here over ILR, whose coordinates are no longer per-variable, or ALR, which needs you to nominate one part as a denominator.

> **Zeros need a decision from you.** The logarithm is undefined at zero, and zeros are routine in trace-element work. GoCSV refuses the transform by default and tells you which rows are affected.
>
> If you want to proceed, give a **replacement value** below your detection limit. The other parts in that row are scaled down so the row total is unchanged, which keeps the ratios among the parts you actually measured intact. This is the standard remedy (Martín-Fernández et al., 2003) — but it invents a measurement that was not made, and "absent" and "below the detection limit" are different claims. That is why GoCSV makes you ask rather than doing it quietly.

You do not need a closed composition. A **subcomposition** — a subset of the parts — is still compositional and is analysed this way routinely. GoCSV tells you which case you are in: whether the columns you selected sum to a constant in every row, or vary. If they vary when you expected them not to, you have probably missed a part.

**References:** Aitchison, J. (1986), *The Statistical Analysis of Compositional Data*, Chapman & Hall, Ch. 4. Egozcue et al. (2003), *Isometric Logratio Transformations for Compositional Data Analysis*, Mathematical Geology 35(3).

---

## 7. Outliers

**GoCSV points out only the obvious ones, on purpose.** Finding the samples that genuinely do not belong is work for GoPCA, once a model has been fitted — so this step is about catching plain mistakes before they reach the analysis, not about deciding which samples are unusual.

The reason is that "unusual" is rarely visible one column at a time. A sample can sit comfortably inside the normal range of every single variable and still be nothing like the rest of your data, because what makes it odd is the *combination* — high silicon with low magnesium, where every other alloy pairs them the other way round. No column-by-column rule can see that. GoPCA can, because it measures each sample against the fitted model using **Hotelling's T²** (how far along the components) and **Q-residuals** (how far off them). That is where outlier work belongs.

So GoCSV does not try to judge whether a value is unusual at all. It looks for one specific thing: a value at least **a hundred times** the next one in.

That is not a statement about your distribution, and it is deliberately far past anything a statistical rule would draw. It is the signature of a mechanical mistake — a misplaced decimal point, metres recorded where millimetres were meant, a sentinel such as `9999` or `-999` left in place of a missing reading. Two real measurements of the same quantity do not usually differ by two orders of magnitude from one another.

**Why not something more sensitive?** Because "far from the other values" and "wrong" are different things, and on real scientific data they come apart completely. An `Al-4Cr-1Fe` alloy contains 4.11% chromium where most aluminium alloys contain none. Every statistical fence flags that value — and it is the defining property of the material and the most correct number in the row. Nothing in the column can tell it apart from an error, because the arithmetic is identical; the difference lives in the alloy's name. A rule sensitive enough to catch small mistakes will accuse your most interesting samples, and it will do so most often exactly where your data is richest.

The comparison is with the **neighbouring** value, not with the middle of the data, so a variable spanning several orders of magnitude is safe: each value is close to the next even when it is far from the median. And a value sitting next to zero is never flagged, because everything is infinitely larger than nothing — otherwise the only real measurements in a mostly-empty column would be reported as errors.

**What this gives up, and why that is the right trade.** It will miss mistakes smaller than a hundredfold. A dew point of 100 recorded where the next highest is 19 is plainly a sentinel; a sensor reading of 309231 among values near 4500 is plainly a glitch. Neither is a hundredfold step, so neither is reported. That is the price of never accusing a correct measurement — and both remain visible in the column statistics, and neither would survive a look at a PCA.

So treat silence here as "nothing obviously mechanical", not as "no outliers".

When something *is* flagged, what to do about it is a judgement GoCSV cannot make for you.

- **Correct it** — if you can check the original record and the value is wrong, fix the cell
- **Remove the sample** — if it is confirmed as an error, use Filter Rows or delete the row
- **Transform** — a Box-Cox or Yeo-Johnson transform reduces the leverage of extreme values without discarding them (section 6)
- **Keep it** — a genuine extreme value is data, not noise

> Investigate before deleting. In a scores plot an outlier is often the most interesting point on the chart, and "unusual" is not the same as "wrong".

---

## 8. Handing over to GoPCA

**Direct transfer:** click **Open in GoPCA**. The data is validated and passed across without an intermediate file.

**Or export:** CSV keeps `#target` markers and is the most portable; Excel is convenient for sharing. Either way the first column identifies the rows — see *Row names* in section 2 — so GoPCA has something to label your points with.

**Before you hand over:**

- [ ] Rows are samples, columns are variables — transpose if not
- [ ] The row-name column identifies your samples, and its values are unique — if the file has none, the export supplies numbers, but a label that says *what* a sample is beats one that says only *which*
- [ ] Missing values dealt with, or NIPALS chosen in GoPCA
- [ ] Columns with no variation removed
- [ ] Categorical variables encoded, if you want them in the analysis
- [ ] Compositional data transformed with CLR, if your columns are parts of a whole
- [ ] Replicates averaged, or `--cv-group` planned for if you are heading to PCR
- [ ] Anything you will not have measured at prediction time marked with `#target`, so no answer is sitting among the predictors
- [ ] Numeric columns that are really codes marked with `#category`, so they do not enter the analysis as quantities
- [ ] Group variables marked with `#target` too, so their role is written down
- [ ] No duplicate column names

**Validate for GoPCA** checks most of this and explains anything it finds. A warning is not a refusal — it tells you something about your data that you may already know and have a reason for.

---

## Where to go next

- [Introduction to PCA](intro_to_pca.md) — what the analysis actually does, and how to read the plots
- [CLI reference](cli_reference.md) — the same preparation and analysis from the command line
- [Troubleshooting](troubleshooting.md) — when something does not behave as you expect
