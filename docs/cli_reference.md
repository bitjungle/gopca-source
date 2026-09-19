# pca CLI Reference

Complete command-line interface documentation for the pca CLI.

## Overview

The pca CLI (part of the GoPCA Suite) provides powerful PCA analysis capabilities for automation, batch processing, and integration into data pipelines. It supports multiple PCA algorithms, comprehensive preprocessing options, and flexible output formats.

## Installation

Download the latest binary for your platform from the [GitHub Releases](https://github.com/bitjungle/gopca/releases) page:

```bash
# Linux/macOS
wget https://github.com/bitjungle/gopca/releases/latest/download/pca
chmod +x pca

# Add to PATH (optional)
sudo mv pca /usr/local/bin/
```

## Global Options

These options apply to all commands:

- `--help, -h` - Show help for any command

The version is a subcommand rather than a flag: `pca version`.

## Commands

### `version` - Show Version Information

Display the version of the pca CLI.

```bash
pca version
```

### `completion` - Generate Shell Completion Scripts

Generate shell completion scripts for bash, zsh, fish, or PowerShell.

#### Examples

```bash
# Bash
pca completion bash > /etc/bash_completion.d/pca

# Zsh
pca completion zsh > "${fpath[1]}/_pca"

# Fish
pca completion fish > ~/.config/fish/completions/pca.fish

# PowerShell
pca completion powershell > pca.ps1
```

### `analyze` - Perform PCA Analysis

The main command for running PCA analysis on your data.

#### Basic Usage

```bash
pca analyze [OPTIONS] <input.csv>
```

**Important:** The input CSV file must be specified as the last argument. All options must come before the filename.

#### Options

##### General Options
- `--verbose, -v` - Enable verbose output with detailed progress
- `--output-dir, -o <path>` - Output directory (default: same as input file)
- `--format, -f <format>` - Output format: `table` or `json` (default: `table`)

##### PCA Configuration
- `--components, -c <n>` - Number of principal components (default: 2)
- `--method, -m <method>` - PCA algorithm: `svd`, `nipals`, or `kernel` (default: `svd`)
  - `svd` - Singular Value Decomposition (fastest, requires complete data)
  - `nipals` - Nonlinear Iterative Partial Least Squares (handles missing data)
  - `kernel` - Kernel PCA for non-linear relationships

##### Preprocessing Options
- `--no-mean-centering` - Disable mean centering
- `--scale <method>` - Scaling method:
  - `none` - No scaling (default)
  - `standard` - Standardize to unit variance
  - `robust` - Robust scaling using median and MAD
- `--scale-only` - Apply variance scaling without mean centering (useful for Kernel PCA)
- `--snv` - Apply Standard Normal Variate (row-wise normalization)
- `--vector-norm` - Apply L2 vector normalization (row-wise)

Row-wise methods act along the variable axis, so two combinations are **refused** rather than silently ignored:

- `--method temporal` embeds the series in time lags, which makes a row a window in time rather than a spectrum. It has no variable axis to normalize along, so `--snv`, `--vector-norm` and the Savitzky-Golay flags are all rejected.
- `--missing-strategy native` leaves gaps in the data, and a row's mean and norm are undefined when entries in that row are missing — each row would be normalized over a different subset of variables, putting them on different scales. Impute or drop first.

##### Savitzky-Golay Smoothing and Derivatives

Fits a low-order polynomial across a sliding window of variables and evaluates it, or one of its derivatives, at the window centre. It can be used on its own; when `--snv` or `--vector-norm` is also given, the filter runs **after** it, and in every case **before** any column centering or scaling.

- `--savgol-window <n>` - Window length in variables, and the flag that switches the filter on. Any value greater than zero enables it, and must be odd and greater than the polynomial order. Omitted or `0` means no filtering.
- `--savgol-order <n>` - Degree of the polynomial fitted in each window (default: `2`)
- `--savgol-deriv <n>` - Derivative order: `0` smooths, `1` and `2` take the first and second derivative (default: `0`). Must not exceed `--savgol-order`.

`--savgol-order` and `--savgol-deriv` are rejected without `--savgol-window`, because on their own they would do nothing.

**Why derivatives.** For near-infrared spectra, a first derivative removes an additive baseline offset and a second removes a baseline slope — both vanish under differentiation. This is the usual next step after scatter correction. Differencing a noisy spectrum directly would amplify the noise, which is why the derivative is taken through a fitted polynomial rather than by subtracting neighbours.

**Combining with `--snv`.** These are complementary, not alternatives. Differentiating removes any constant, so SNV's mean-subtraction vanishes and `savgol_deriv(SNV(x))` equals `savgol_deriv(x) / sd(x)` exactly. What survives is the division by each sample's spectral spread — the multiplicative scatter correction a derivative cannot perform. Scattering both shifts the baseline and stretches the spectrum; the derivative handles the first, SNV's divisor the second. For smoothing (`--savgol-deriv 0`) nothing vanishes and SNV applies in full, and `--vector-norm` behaves the same way at every derivative order since it never centres.

**Choosing the parameters.** Window and order trade smoothing against fidelity: a wider window or lower order smooths harder and can flatten narrow peaks, while a narrower window or higher order preserves shape and keeps more noise. A window of 11 with order 2 is a common starting point for NIR; there is no universally right pair, and the honest way to choose is to compare cross-validated predictions rather than the look of the spectra.

**Variable order matters, and GoPCA checks it.** The filter slides along the columns in the order they appear in the file, so it assumes they are in wavelength order and evenly spaced. Two warnings are printed to standard error when that looks doubtful — warnings, not refusals, because you may know something the data does not show:

- *The variables do not form a continuum.* For a derivative to mean anything the values have to change smoothly from one variable to the next. GoPCA measures this with the **von Neumann ratio** — the mean square difference between neighbouring variables divided by the variance along the row. Under a random column order its expected value is 2; a spectrum drives it to about 0.0003, roughly six thousand times smoother. Below 0.5 the axis is treated as a continuum. Thirteen unrelated chemical measurements score about 1.1, and a derivative across them mostly amplifies noise.

- *The variables are not evenly spaced.* Excluding columns from the middle of a spectrum with `--exclude-columns` closes the gap and makes wavelengths adjacent that were not, while leaving the data every bit as smooth — so only the spacing check can catch it. Restricting to a contiguous range is safe; removing an interior band is not.

The same check drives GoPCA Desktop, where the control is disabled with the measured figure shown and an *Enable anyway* option.

**Restrictions.**
- Not available with `--method temporal`, which works along the time axis and applies no transform along the variable axis.
- Not available with `--missing-strategy native`, since a window spanning a missing value would spread it across every variable in that window. Impute or drop first.
- The window cannot be wider than the number of variables.

```bash
# Scatter correction, then a first derivative: the standard NIR recipe
pca analyze --snv --savgol-window 11 --savgol-order 2 --savgol-deriv 1 --scale standard corn.csv

# Smoothing only, no differentiation
pca analyze --savgol-window 15 --savgol-order 3 corn.csv
```

##### Kernel PCA Options
- `--kernel-type <type>` - Kernel type: `rbf`, `linear`, or `poly`
- `--kernel-gamma <value>` - Gamma parameter for RBF and polynomial kernels (default: 0.01)
- `--kernel-degree <n>` - Degree for polynomial kernel (default: 3)
- `--kernel-coef0 <value>` - Coef0 for polynomial kernel (default: 1)

##### Data Format Options
- `--no-headers` - First row contains data, not column names
- `--no-index` - First column contains data, not row names
- `--delimiter <string>` - CSV field delimiter (default: ",")
- `--na-values <list>` - Comma-separated strings representing missing values
  - Default: `",NA,N/A,nan,NaN,null,NULL,m"`

##### Missing Data Handling
- `--missing-strategy <strategy>` - How to handle missing values:
  - `error` - Report error if missing values are found (default). SVD method requires complete data
  - `drop` - Remove rows with missing values
  - `mean` - Replace with column mean
  - `median` - Replace with column median
  - `zero` - Replace with zero
  - `native` - Use NIPALS algorithm's native missing data handling (NIPALS only)
- `--missing-percent <float>` - Maximum missing percentage before dropping column (default: 50)

**Note:** The `native` strategy is only available with the NIPALS method. When using SVD (default), you must choose a preprocessing strategy (drop, mean, median, or zero) if your data contains missing values.

**Preprocessing with `native`:** Column-wise preprocessing is fully supported — `--scale standard`, `--scale robust` and `--scale-only` compute their statistics over the observed values of each column, so a request to scale is honoured rather than ignored. The row-wise methods `--snv` and `--vector-norm` are **rejected** with this strategy: both divide a row by a statistic of that row, which is computed over a different subset of variables for every incomplete row, so the rows would no longer share a common scale. Impute or drop first if you need them.

##### Data Selection
- `--exclude-rows <string>` - Row indices to exclude (1-based). Supports individual indices and ranges: `1,3,5` or `1-5,8-10`
- `--exclude-columns <string>` - Columns to exclude, as names, 1-based indices, or ranges of either: `col1,col2`, `1-3,5`, or `1400-1450`. Each entry is resolved in that order — an exact column name first, then a range between two column names, then an index range, then a single index — so on a spectrum whose columns are named by wavelength, `1400-1450` means the wavelength band. An entry that resolves to nothing is an error, never silently ignored.
- `--target-columns <string>` - Comma-separated list of target columns to exclude

##### Group and Correlation Analysis
Currently, group and metadata analysis features are available through the GoPCA Desktop application but not yet implemented in the CLI.

##### Output Control
- `--output-scores` - Include PC scores in output (default: true)
- `--output-loadings` - Include loadings in output (default: true)
- `--output-variance` - Include explained variance in output (default: true)
- `--output-all` - Output all results
- `--include-metrics` - Calculate and include advanced metrics (T², Q-residual, etc.)

#### Examples

##### Basic Analysis
```bash
# Simple 2-component PCA with default settings
pca analyze data.csv

# 3 components with standard scaling
pca analyze --components 3 --scale standard data.csv

# Save results to specific directory
pca analyze -o results/ data.csv
```

##### Advanced Preprocessing
```bash
# SNV preprocessing for spectroscopic data
pca analyze --snv --scale standard spectral_data.csv

# Robust scaling for data with outliers
pca analyze --scale robust --components 4 data.csv

# Vector normalization
pca analyze --vector-norm data.csv
```

##### Kernel PCA
```bash
# RBF kernel with custom gamma
pca analyze --method kernel --kernel-type rbf --kernel-gamma 0.5 data.csv

# Polynomial kernel of degree 3
pca analyze --method kernel --kernel-type poly --kernel-degree 3 data.csv

# Linear kernel PCA
pca analyze --method kernel --kernel-type linear data.csv
```

##### Missing Data
```bash
# Drop rows with missing values
pca analyze --missing-strategy drop data.csv

# Use NIPALS with native missing data handling
pca analyze --method nipals --missing-strategy native data.csv

# Replace missing with mean (for SVD compatibility)
pca analyze --missing-strategy mean data.csv

# Verbose output to see missing data statistics
pca analyze --verbose --missing-strategy drop data.csv
```

When verbose mode is enabled, the CLI will report:
- Total number and percentage of missing values
- Number of rows affected
- Missing values per column
- Applied strategy and its effect

##### Data Selection Examples
```bash
# Exclude specific columns by name
pca analyze --exclude-columns "id,timestamp" data.csv

# Exclude a wavelength region from a spectrum whose columns are named by wavelength
pca analyze --exclude-columns "1400-1450,1900-1960" --snv corn.csv

# Exclude specific rows (individual and ranges)
pca analyze --exclude-rows "1,5,10-15" data.csv

# Exclude target columns
pca analyze --target-columns "result,outcome" data.csv
```

##### Output Formats
```bash
# JSON output with all results
pca analyze -f json --output-all data.csv

# Table format with scores and variance
pca analyze --output-scores --output-variance data.csv

# Include diagnostic metrics
pca analyze --include-metrics -f json data.csv
```

### `regress` - Fit a Principal Component Regression Model

Predict a numeric response from principal component scores.

The components are chosen from the predictors alone, without looking at the response, so a component that matters for prediction can carry very little predictor variance. Choose the number of components by cross-validation rather than by explained variance.

#### Basic Usage

```bash
pca regress [OPTIONS] <input.csv>
```

#### Choosing a Response

The response is a numeric column marked with the `#target` suffix. Ask which columns qualify:

```bash
pca regress --list-responses corn.csv
```

Categorical columns are listed separately and cannot be used as a response: predicting a category is classification, which GoPCA does not do.

If a numeric column is really a class code — 0, 1, 2 for three species — mark it `#category` rather than `#target`. Regressing on it would report an R² while asserting that the classes are ordered and evenly spaced. GoPCA warns when a response looks like a class code, but the marker says what you meant before the warning is needed.

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--response <name>` | Numeric `#target` column to predict | required |
| `--list-responses` | List usable response columns and exit | `false` |
| `-c, --components <n>` | Fix the component count instead of selecting it | select by CV |
| `--max-components <n>` | Ceiling for the cross-validation sweep | `20` |
| `--cv <n\|loo>` | Number of folds, or `loo` for leave-one-out | `10` |
| `--cv-scheme <s>` | `random`, `contiguous`, `forward-chaining` | `random` |
| `--cv-group <column>` | Categorical column whose levels must not split across folds | none |
| `--cv-repeats <n>` | Repeat the design with fresh partitions | `1` |
| `--cv-seed <n>` | Seed for the fold shuffle, recorded with the result | `42` |
| `--select <rule>` | `min`, `one-se`, `tolerance`, `wold` | `one-se` |
| `--tolerance <x>` | For `--select tolerance`: acceptable error increase | `0` |
| `--wold-r <x>` | For `--select wold`: PRESS ratio threshold | `1.0` |
| `--metric <m>` | Selection metric: `rmse` or `mae` | `rmse` |

Predictor-side options (`--method`, `--scale`, `--snv`, `--vector-norm`, `--savgol-window`, `--savgol-order`, `--savgol-deriv`, `--exclude-rows`, `--exclude-columns`) work as they do for `analyze`.

**Two do not.** `--no-mean-centering` and `--scale-only` are refused by `regress`. Without centering, the first component absorbs the mean of the data — so one retained component describes where the samples sit rather than how they vary — while the intercept accounts for that offset at no cost. Uncentered PCA remains available for `analyze`, where exploring the data in its original position can be a deliberate choice; it is regression, with a response and an intercept, that leaves it no purpose.

Savitzky-Golay is worth singling out for regression. Unlike SNV it is the *same* operator for every sample, so it folds into the reported coefficients and the original-scale form stays available — a deployed model needs the raw wavelengths and nothing else. Combine it with `--snv` and that collapse is lost again, because SNV still scales each sample by its own spread.

#### Examples

```bash
# Choose the component count by 10-fold cross-validation
pca regress --response "Moisture#target" --cv 10 --scale standard corn.csv

# Leave-one-out, which is K-fold with as many folds as there are groups
pca regress --response "Moisture#target" --cv loo corn.csv

# Keep replicates of one object together so none straddles a fold boundary
pca regress --response "Yield#target" --cv 10 --cv-group "BatchID" process.csv

# Leave-one-group-out
pca regress --response "Yield#target" --cv loo --cv-group "BatchID" process.csv

# Fix the component count instead of selecting it
pca regress --response "Oil#target" --components 7 corn.csv

# Save the predictions, coefficients, error curve and a reusable model
pca regress --response "Protein#target" --cv 10 -o results/ corn.csv
```

#### Reading the Error Figures

Three root-mean-square errors appear, and they are not interchangeable:

| Name | Computed from | What it is for |
|------|---------------|----------------|
| `RMSEC` | Training residuals of the final model | Describes the fit. **Not** an estimate of future performance: the model has seen every row it is scored on. |
| `RMSECV` | Held-out predictions from cross-validation | Selecting the component count. |
| `RMSEP` | An independent test set | The estimate of future performance. `regress` does not produce it, because a test set must be kept out of model development entirely. |

`bias` and `SEP` decompose `RMSECV` exactly, through `RMSECV² = bias² + (n−1)/n · SEP²`. A large bias with a small SEP is a precise model with a systematic offset, which a slope-and-bias correction can repair; a small bias with a large SEP is simply imprecise. The two call for different remedies, which is why both are reported.

#### Missing Values

Rows whose **response** is missing are excluded from the regression but still inform the decomposition, since PCA does not use the response. The counts are reported.

Missing **predictors** must be resolved first. `--missing-strategy drop` and `zero` are available, and `--method nipals --missing-strategy native` handles them internally. `mean` and `median` are deliberately refused: both estimate values from the data, so applying them before cross-validation would let the held-out rows influence the model and make every reported error optimistic.

#### Applying a Model

With `-o`, `regress` writes `pcr_model.json` alongside the CSV outputs. It is an ordinary GoPCA model file with a `regression` block added, so `transform` reads it and emits predictions as well as scores:

```bash
pca regress --response "Moisture#target" --cv 10 -o cal/ calibration.csv
pca transform cal/pcr_model.json new_samples.csv
```

#### Why PCR and Not PLS

Partial least squares generally predicts better on the calibration problems this suite targets, because it chooses its directions using the response rather than predictor variance alone. GoPCA implements PCR deliberately: the suite exists to do Principal Component Analysis exceptionally well, and PCR is built from the same decomposition, whereas PLS is a different latent-variable family. This is a scope decision, not a claim that PCR predicts better. If PLS is what your problem calls for, a dedicated chemometrics package will serve you better.

### `validate` - Validate Input Data

Check your data for issues before running PCA analysis.

#### Basic Usage

```bash
pca validate [OPTIONS] <input.csv>
```

#### Options

- `--no-headers` - First row contains data, not column names
- `--no-index` - First column contains data, not row names
- `--delimiter <char>` - CSV delimiter (default: comma)
- `--na-values <list>` - Strings representing missing values
- `--strict` - Fail on warnings (not just errors)
- `--summary` - Show data summary statistics

#### Validation Checks

The validate command performs these checks:
- File format and structure validation
- Missing values detection and reporting
- Data type consistency verification
- Numerical range checks
- Low variance detection (constant columns)
- High missing value warnings (>50% missing)

#### Examples

```bash
# Basic validation
pca validate data.csv

# Show detailed summary statistics
pca validate --summary data.csv

# Strict mode - fail on any warnings
pca validate --strict data.csv

# Custom delimiter and missing values
pca validate --delimiter ";" --na-values "?,unknown" data.csv
```

### `transform` - Apply PCA Model to New Data

Apply a previously trained PCA model to transform new data.

#### Basic Usage

```bash
pca transform [OPTIONS] <model.json> <input.csv>
```

**Note:** Both the model file and input CSV must be specified as the last two arguments.

#### Options

- `--output, -o <string>` - Output directory for results
- `--format, -f <format>` - Output format: `table` or `json` (default: `table`)
- `--no-headers` - First row contains data, not column names
- `--no-index` - First column contains data, not row names
- `--delimiter <string>` - CSV field delimiter (default: ",")
- `--na-values <string>` - Comma-separated list of strings representing missing values (default: ",NA,N/A,nan,NaN,null,NULL,m")

#### Requirements

- New data must have the same number of features as training data
- Column names should match for proper alignment
- Preprocessing from training is automatically applied:
  - Row-wise transforms (SNV, vector norm) are recalculated fresh for new data
  - Column-wise transforms (centering, scaling) use parameters from the model
- Currently supports SVD and NIPALS models

#### Examples

```bash
# Basic transformation
pca transform model.json new_data.csv

# Save to specific file with JSON format
pca transform -f json -o results/ model.json new_data.csv

# Exclude specific rows (using range syntax)
pca transform --exclude-rows 1,5-10 model.json new_data.csv

# Include diagnostic metrics
pca transform --include-metrics model.json new_data.csv
```

## Output Formats

### Table Format (Default)

Human-readable tabular output displayed in the terminal:

```
Principal Component Scores:
Sample      PC1        PC2        PC3
------      ---        ---        ---
Sample1     2.345     -0.123      1.456
Sample2    -1.234      0.987     -0.543
...

Explained Variance:
Component   Variance   Cumulative
---------   --------   ----------
PC1         45.23%     45.23%
PC2         23.45%     68.68%
PC3         12.34%     81.02%
```

### JSON Format

Machine-readable JSON output for integration with other tools:

```json
{
  "scores": [[2.345, -0.123, 1.456], [-1.234, 0.987, -0.543]],
  "loadings": [[0.234, -0.567], [0.123, 0.456]],
  "explainedVariance": [0.4523, 0.2345, 0.1234],
  "cumulativeVariance": [0.4523, 0.6868, 0.8102],
  "eigenvalues": [5.234, 2.456, 1.234],
  "rowNames": ["Sample1", "Sample2"],
  "columnNames": ["Feature1", "Feature2"],
  "metrics": {
    "hotellingT2": [1.234, 0.567],
    "mahalanobis": [2.345, 1.234],
    "rss": [0.012, 0.023]
  }
}
```

## Input Data Format

### CSV Requirements

- **Headers**: First row should contain column names (unless `--no-headers`)
- **Index**: First column can contain row names (unless `--no-index`)
- **Numeric Data**: All data columns must be numeric
- **Delimiters**: Comma (default), semicolon, or tab
- **Missing Values**: Use standard representations (NA, NaN, null, etc.)

### Example CSV Structure

```csv
Sample,Feature1,Feature2,Feature3,GroupLabel
Sample1,1.23,4.56,7.89,TypeA
Sample2,2.34,5.67,8.90,TypeB
Sample3,3.45,6.78,9.01,TypeA
```

### Special Columns

Two suffixes take a column out of the analysis and keep it for interpretation.
They differ in what they claim about it:

| Suffix | Says | In PCA | In regression |
|--------|------|--------|---------------|
| `#target` | an outcome you might predict | colours plots on a gradient | can be the `--response` |
| `#category` | the values are labels, not quantities | colours plots by class | never a response; can be `--cv-group` |

- **Target Columns**: numeric columns ending with `#target`, detected automatically
- **Category Columns**: columns ending with `#category`, treated as categorical
  whatever they contain. This is how a numeric code — a processing type, a site
  number — is kept out of the analysis, where it would otherwise be read as a
  measurement
- **Metadata Columns**: additional columns for correlation analysis

Text columns are categorical without any marker; `#category` is for numbers.

## Preprocessing Pipeline

The preprocessing steps are applied in this order:

1. **Row-wise preprocessing** (if enabled):
   - SNV (Standard Normal Variate)
   - L2 Vector Normalization

2. **Column-wise preprocessing**:
   - Mean Centering (unless disabled)
   - Scaling (standard, robust, or none)

3. **Algorithm-specific processing**:
   - SVD: Requires complete data after preprocessing
   - NIPALS: Can handle missing values natively
   - Kernel: Applies kernel transformation

## Best Practices

### Data Preparation
1. Validate your data first: `pca validate data.csv`
2. Handle missing values appropriately for your domain
3. Consider scaling for mixed-unit variables
4. Use SNV for spectroscopic data

### Algorithm Selection
- **SVD**: Fast and accurate for complete data
- **NIPALS**: When you have missing values
- **Kernel PCA**: For non-linear relationships

### Preprocessing Choices
- **No scaling**: When all variables are in same units
- **Standard scaling**: Mixed units or scales
- **Robust scaling**: Data contains outliers
- **SNV**: Spectroscopic or similar data

### Performance Tips
- Use `--format json` for scripting and automation
- JSON format is faster to parse programmatically
- Exclude unnecessary columns to reduce memory usage
- Pre-filter rows if analyzing subsets

## Troubleshooting

### Common Issues

#### "Invalid CSV format"
- Check delimiter matches your file
- Ensure consistent column count across rows
- Verify decimal separator setting

#### "Insufficient numeric columns"
- Exclude non-numeric columns with `--exclude-columns`
- Check for columns with all missing values
- Ensure proper NA value detection

#### "Memory allocation failed"
- Reduce number of components
- Exclude unnecessary columns/rows
- Use NIPALS instead of SVD for large sparse data

#### "Convergence not achieved" (NIPALS)
- Increase max iterations (if option available)
- Check for extreme outliers
- Consider different preprocessing

## Integration Examples

### Bash Pipeline
```bash
#!/bin/bash
# Batch process multiple files
for file in data/*.csv; do
    pca analyze -f json -o results/ "$file"
done
```

### Python Integration
```python
import subprocess
import json

# Run PCA analysis
result = subprocess.run(
    ['pca', 'analyze', '-f', 'json', '--output-all', 'data.csv'],
    capture_output=True, text=True
)

# Parse JSON results
pca_results = json.loads(result.stdout)
scores = pca_results['scores']
variance = pca_results['explainedVariance']
```

### R Integration
```r
# Run pca from R
library(jsonlite)

output <- system2(
  "pca",
  args = c("analyze", "-f", "json", "--output-all", "data.csv"),
  stdout = TRUE
)

# Parse results
results <- fromJSON(paste(output, collapse = "\n"))
scores <- results$scores
```

## See Also

- [Introduction to PCA](intro_to_pca.md) - Understanding PCA theory
- [Data Format Guide](data-format.md) - Detailed CSV format specification
- [Data Preparation Guide](intro_to_data_prep.md) - Best practices for data preparation

## Getting Help

```bash
# General help
pca --help

# Command-specific help
pca analyze --help
pca validate --help
pca transform --help
```

For issues or questions, visit the [GitHub repository](https://github.com/bitjungle/gopca).