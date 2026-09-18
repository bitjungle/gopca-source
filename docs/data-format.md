# GoPCA Data Format Guide

## Overview

GoPCA accepts tabular data in CSV (Comma-Separated Values) format with specific conventions for organizing your data. This guide explains the expected format, supported features, and best practices for preparing your data for PCA analysis.

## Basic Structure

### Required Elements

1. **Header Row**: The first row must contain column names representing your variables/features
2. **Data Matrix**: Subsequent rows contain numeric data values for each sample

### Example Structure

```csv
Sample,Feature1,Feature2,Feature3,Category
Sample1,1.23,4.56,7.89,TypeA
Sample2,2.34,5.67,8.90,TypeB
Sample3,3.45,6.78,9.01,TypeA
```

## File Format Details

### CSV Separators

GoPCA supports multiple CSV formats that can be specified:

- **Comma-separated (`,`)**: Standard CSV format (default)
  - Uses period (`.`) as decimal separator by default
  - Example: `1.23,4.56,7.89`

- **Semicolon-separated (`;`)**: European CSV format
  - Often paired with comma (`,`) as decimal separator
  - Example: `1,23;4,56;7,89`

- **Tab-separated**: TSV format
  - Uses tab character as delimiter
  - Useful for data containing commas

When using the CLI, specify the delimiter with `--delimiter` and decimal separator with `--decimal-separator`.

### Row Names (Sample Identifiers)

**The first column is read as row names**, whatever it contains. A first
column of `1, 2, 3 …` becomes row names exactly as `Patient001, Patient002 …`
does, and in neither case does it enter the PCA. These identifiers:

- Appear as labels in scores plots
- Help identify outliers or interesting samples
- Should be unique for each sample — two points sharing a label are
  indistinguishable exactly where you would most want to tell them apart
- Can contain any text (avoid special characters that might interfere with CSV parsing)

Example:
```csv
SampleID,Height,Weight,Age
Patient001,175.5,72.3,34
Patient002,168.2,65.1,28
Control001,172.0,70.5,31
```

> **A file with no identifier column would lose its first variable.** Because
> the first column is taken as row names, a file that begins `Si,Fe,Cu` would be
> analysed on `Fe` and `Cu` alone, with the silicon values serving as labels.
>
> Both interfaces let you say otherwise, and neither tries to guess. There is
> nothing in a column's contents to guess from: a measurement column can have
> entirely distinct values, and an identifier column is often `1, 2, 3`.
>
> **On the command line, `--no-index`:**
>
> ```bash
> pca analyze --no-index measurements.csv
> ```
>
> It is accepted by `analyze`, `regress`, `transform` and `validate`, and it says
> "the first column contains data, not row names".
>
> **In GoPCA Desktop, the Loaded Data panel** names the column that became row
> names — `Row names taken from the first column: Si` — with a checkbox reading
> **First column contains data, not row names**. Ticking it re-reads the file
> with every column as a variable.
>
> If you prepare your data in GoCSV you need not think about it at all: a file
> never leaves GoCSV without an identifier column.

## Column Types

GoPCA automatically detects and handles different types of columns:

### 1. Numeric Features (Default)

Standard numeric columns used in PCA calculation:
- Contain floating-point or integer values
- Can include scientific notation (e.g., `1.23e-4`)
- Form the main data matrix for PCA

### 2. Categorical Variables

Columns with string values are automatically detected as categorical:
- **Excluded from PCA calculation** (non-numeric data)
- **Available for plot coloring** using qualitative color palettes
- Useful for visualizing group membership or classifications

Example:
```csv
Sample,Gene1,Gene2,Gene3,Treatment,Batch
S1,12.3,45.6,78.9,Control,Batch1
S2,13.4,46.7,79.0,Treated,Batch1
S3,11.2,44.5,77.8,Control,Batch2
```

Both `Treatment` and `Batch` would be available as categorical coloring options.

### 3. Target Variables

Numeric columns marked as targets are treated specially:
- **Excluded from PCA calculation** (like dependent variables in regression)
- **Available for plot coloring** using sequential/gradient color palettes
- Perfect for visualizing continuous outcomes or responses

#### Marking Target Columns

Target columns are identified by the `#target` suffix in the column name:

```csv
Sample,Feature1,Feature2,Feature3,Response#target
S1,1.2,3.4,5.6,0.95
S2,2.3,4.5,6.7,0.87
S3,3.4,5.6,7.8,0.73
```

Alternative naming (with space):
```csv
Sample,Feature1,Feature2,Feature3,Response #target
```

Common use cases for target variables:
- Regression targets (y values)
- Continuous phenotypes
- Measurement outcomes
- Quality scores
- Time points

### Category Columns (`#category`)

Some columns hold numbers that are not measurements. A processing code taking the
values 1 to 11, a site number, a batch identifier: each parses as a number, and
each would otherwise enter the PCA as a quantity, where the arithmetic distance
between code 3 and code 9 is meaningless.

The `#category` suffix says the values are labels:

```csv
Sample,Feature1,Feature2,SiteCode#category
S1,1.2,3.4,10
S2,2.3,4.5,11
S3,3.4,5.6,10
```

The column is then held out of the PCA and offered for colouring by class,
exactly as a column of text would be. It also becomes available to the one-hot
and ordinal encoders, which only accept categorical columns.

`#category` on a column that already holds text is harmless but unnecessary — a
text column is categorical anyway. The marker exists for numbers.

### Which marker do I want?

Both markers take a column out of the PCA. They differ in what you are saying
about it, and in what GoPCA offers to do with it afterwards.

| | `#target` | `#category` |
|---|---|---|
| **What you are saying** | "This is an outcome, not a predictor" | "These numbers are labels, not quantities" |
| **Applies to** | Numeric columns | Numeric columns (text is already categorical) |
| **In the PCA** | Held out; colours plots on a gradient | Held out; colours plots by class |
| **In regression** | Can be nominated as the response with `--response` | Never a response; can group cross-validation folds with `--cv-group` |
| **Encoders** | Not offered | Offered to one-hot and ordinal encoding |

**A column carries one marker or the other, never both.** They describe
alternative roles, so marking a column as a category removes any `#target` it had,
and marking it as a target removes any `#category`. The undo history says which
was replaced.

Two questions settle it:

**"Would I ever want to predict this?"** A yield, a density, a concentration you
would rather not measure every time — that is `#target`.

**"Is the gap between 3 and 9 meaningful?"** If the numbers are codes and the
answer is no, that is `#category`.

A worked example. This file has one of each:

```csv
Sample,Wavelength1,Wavelength2,Batch#category,Moisture#target
S1,0.412,0.388,3,10.4
S2,0.407,0.391,3,10.9
S3,0.419,0.385,7,11.2
```

Two wavelengths enter the PCA. `Batch` is held out as a class — colour the scores
plot by it and you can see whether batches separate, and pass it to `--cv-group`
so a batch never straddles a cross-validation fold. `Moisture` is held out as an
outcome — colour by it to see whether the components relate to moisture, or model
it with `pca regress --response "Moisture#target"`.

> **The mistake to avoid.** Marking a class code `#target` and then regressing on
> it. The fit will run and mean nothing: it asserts that the codes are ordered
> and evenly spaced. GoPCA warns when a response looks like a class code, but
> `#category` says what you meant in the first place.

## Missing Values

GoPCA recognizes several representations of missing data:
- Empty cells
- `NA` or `N/A`
- `NaN` or `nan`  
- `NULL` or `null`

Note: The CLI allows customization of null value strings with the `--na-values` flag.

Missing value handling strategies:
1. **Error** (default): Report an error if missing values are found
2. **Drop rows**: Remove samples with any missing values
3. **Impute mean**: Replace with column mean
4. **Impute median**: Replace with column median
5. **NIPALS native**: Use NIPALS algorithm's built-in missing value handling

## Special Values

The parser correctly handles:
- **Infinity**: `Inf`, `inf`, `+Inf`, `-Inf`
- **Scientific notation**: `1.23e-10`, `5.67E+5`
- **Very large/small numbers**: Within floating-point limits

## Data Preparation Best Practices

### 1. Variable Scaling

Consider your data scale:
- Variables with vastly different scales may dominate the PCA
- GoPCA offers preprocessing options (standardization, robust scaling)
- For spectroscopic data, consider SNV or vector normalization
- Use GoCSV for general data preparation, then let GoPCA handle PCA-specific preprocessing

### 2. Sample Size

PCA does not require more samples than variables — it works naturally in both directions. The Corn NIR tutorial, for example, has 80 samples and 700 variables (n ≪ p). However, smaller sample counts relative to variables do reduce statistical reliability:

- Workable: Any number of samples (PCA always produces results)
- Recommended: At least 3–5 samples per variable for stable loadings
- For reliable generalisation: 10+ samples per variable

### 3. Column Naming

Use descriptive, valid column names:
- Avoid special characters: `<>:"/\|?*`
- Use underscores or camelCase: `Gene_Expression` or `geneExpression`
- Keep names reasonably short for better visualization
- Add `#target` suffix for target variables

### 4. Data Quality

Before analysis:
- Check for and handle outliers appropriately (GoCSV provides outlier detection)
- Verify measurement units are consistent
- Ensure proper decimal separator usage (specify with CLI flags if needed)
- Remove or impute missing values as needed (GoCSV offers multiple imputation strategies)

## Example Files

### 1. Gene Expression Data
```csv
Sample,BRCA1,BRCA2,TP53,EGFR,Subtype,Survival#target
P001,5.23,3.45,7.89,2.34,Basal,24.5
P002,4.12,3.89,8.23,1.98,Luminal,48.2
P003,5.67,3.12,7.45,2.56,Basal,18.7
```

### 2. Spectroscopic Data
```csv
Wavelength,400nm,450nm,500nm,550nm,600nm,Concentration#target
Sample1,0.234,0.456,0.678,0.543,0.321,1.5
Sample2,0.245,0.467,0.689,0.554,0.332,1.8
Sample3,0.223,0.445,0.667,0.532,0.310,1.2
```

### 3. Mixed Data Types
```csv
ID,Height,Weight,Age,BMI,Gender,Group,Disease_Score#target
S001,175.5,72.3,34,23.5,M,Control,0.0
S002,162.3,58.7,28,22.3,F,Treatment,2.5
S003,180.2,85.1,45,26.2,M,Treatment,3.8
```

## Validation

Use the GoPCA CLI to validate your data format:

```bash
pca validate yourdata.csv
```

This will report:
- Data dimensions
- Detected column types
- Missing value locations
- Categorical columns (excluded from PCA)
- Target columns (excluded from PCA)
- Any format issues

## Summary

For successful PCA analysis with GoPCA:

1. ✅ Include a header row with column names
2. ✅ First column is read as sample identifiers — include one, or say otherwise with `--no-index` or the checkbox in the Loaded Data panel
3. ✅ Use consistent CSV format (comma or semicolon)
4. ✅ Ensure numeric data for PCA features
5. ✅ Mark target columns with `#target` suffix
6. ✅ Categorical columns are auto-detected for visualization
7. ✅ Handle missing values appropriately
8. ✅ Validate your data before analysis

Following these guidelines will ensure smooth data import and meaningful PCA results with full visualization capabilities in GoPCA.

## Working with GoCSV

GoCSV is the companion application for preparing data in this format:
- Automatically detects and preserves column types
- Handles the #target suffix for target columns
- Provides data quality assessment and cleaning tools
- Exports clean CSV files ready for GoPCA analysis
- **Always writes a column of row identifiers as column 1** — whatever the file
  arrived with, whatever you assigned, or `Sample_ID` numbering the rows from 1
  if it had neither. This is what makes the warning above something you never
  have to think about when GoCSV prepared the file
- Use "Open in GoPCA" for seamless transfer between applications