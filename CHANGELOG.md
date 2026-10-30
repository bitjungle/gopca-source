# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

GoPCA 2.0. Two things make this a major version. **Regression mode**: a Principal Component
Regression engine with cross-validation, a `pca regress` command, a **Regress** mode in GoPCA
Desktop, and a saved model that `pca transform` applies to new data and says how far each
prediction can be trusted. **Wails v3**: both desktop applications were ported to the stable v3
framework, which raises the macOS floor and changes the Linux runtime. Around them: Savitzky-Golay
smoothing and derivatives, a GoCSV that can prepare compositional, replicated and badly-shaped data,
a v2 model file format whose numbers mean what their names say, one custom Plotly build at a third
of the size, and the fixes from three beta-test passes on real datasets. **Read Breaking changes
first** if you script against the CLI, parse model files, or run on an older macOS.

### Breaking changes
- **macOS 13 (Ventura) or later is required.** The Go 1.27 toolchain the applications are built
  with links against macOS 13 — measured on a trivial binary, not inherited from Wails — and the
  bundles now declare it. Earlier releases claimed 10.13 and could not have run there since Go
  dropped it (#531)
- **On Linux the desktop binaries need GTK4 and WebKitGTK 6.0.** Wails v3 targets them; its GTK3
  path is being removed upstream. **The AppImages are unaffected**: they bundle WebKitGTK and its
  helper processes and run on distributions that do not ship 6.0. The plain binaries in the tarball
  are for systems that have it (#531)
- **Model files declare `schemas/v2`, and `explained_variance_ratio` and `cumulative_variance` are
  fractions of 1, not percentages.** The fields were named *ratio* and held percentages, so anyone
  comparing against scikit-learn's `explained_variance_ratio_` was silently out by a factor of 100
  — and every model GoPCA had ever written violated the `maximum: 1` its own v1 schema declared.
  Both interfaces convert for display once, at the boundary. The `$schema` URL now resolves (the v1
  one was a GitHub web path returning 404), and Temporal PCA's `explained_variance` is now the
  eigenvalue, as for linear and kernel PCA. **Files written by earlier releases still load**: a model
  is validated against the version it declares (#848)
- **`pca regress` refuses `--no-mean-centering` and `--scale-only`.** Without centering the first
  component absorbs the mean of the data, so one retained component describes where the samples sit
  rather than how they vary, while the intercept already accounts for the offset — on `tecator` PC1's
  share went from 98.6% to 99.96%, a component spent on the mean spectrum. The run used to succeed
  with a quietly different model; it now stops and says why. `pca analyze` still accepts both (#981)
- **Every GoCSV export carries a column of row identifiers.** `SaveCSV`, `SaveExcel` and the GoPCA
  handoff each decided for themselves whether to write one, with three different headers, and all
  three wrote nothing when the file had no row names. They now agree, and a file without identifiers
  is exported with a `Sample_ID` column numbered from one, and the export says so (#966)
- **One-hot encoding in GoCSV keeps the source column.** It previously removed the column it
  encoded, silently and unconditionally. The dialog now offers a **Keep original column** checkbox,
  ticked by default. This matters beyond GoCSV: GoPCA colours scores plots by categorical columns,
  so encoding `species` used to cost the ability to colour by it. For anyone using `pkg/transform`
  directly the new option is `Options.RemoveOriginal`, spelled that way round so the zero value
  keeps the column (#854, #855)
- **`regression.validation.folds` now records the folds actually built.** It previously echoed the
  *configured* fold count, which is `0` for any design meaning "one fold per group" — so a
  leave-one-out run reported `"folds": 0` regardless of sample count. A leave-one-out sweep over 441
  labelled rows now reports `"folds": 441`. Anything reading this field to describe the validation
  design was reading a configuration value that could not be interpreted without also knowing the
  row count. `design` carries the human-readable form (`leave-one-row-out`) and was never affected
  (#844)

### Added
- **Principal Component Regression** (#832). One engine behind both interfaces, validated against
  scikit-learn references, with a differential test asserting the CLI and the desktop give the same
  regression from the same settings.
  - *Cross-validation designs*: K-fold, leave-one-out, grouped K-fold and leave-one-group-out on a
    categorical column (`--cv-group`), contiguous blocks and forward chaining (`--cv-scheme`), with
    repeats (`--cv-repeats`) and a recorded seed. Leave-one-out is grouped K-fold with K equal to
    the group count, so the five share one implementation.
  - *Component selection rules*: lowest error, one standard error (the default), within a
    tolerance, Wold's R, and first minimum, on RMSECV or MAE (`--select`, `--metric`). The report
    names the rule that chose the count, and says when the search ran off the end of the range.
  - *Rows whose response is unmeasured inform the decomposition but not the regression*, so a
    calibration set where only some samples went for reference analysis uses every spectrum. On
    `bronir2` that is 48% of the responses missing. Missing *predictors* are refused rather than
    imputed, because imputing before cross-validation lets held-out rows shape the fit.
  - *The report names its three error figures and what each is for*: RMSEC is the training residual
    and describes the fit, not future performance; RMSECV is held out and is what chose the component
    count; RMSEP is not reported because it needs a test set kept out of model development entirely.
    Q², bias and SEP follow, then the cross-validated error curve from k = 0 (the intercept-only
    baseline, which predicts the training mean), the largest coefficients on the original scale, and
    predicted against measured with the held-out prediction beside the fitted one.
  - *`pca regress`* writes `pcr_model.json`, `pcr_predictions.csv`, `pcr_coefficients.csv` and
    `pcr_selection_curve.csv`; `--list-responses` says which columns can be predicted. A response
    that takes only a handful of distinct values is flagged as what a class label looks like, since
    predicting a category is classification (#840)
  - *GoPCA Desktop* gains an **Explore / Regress** switch in the header. Explore mode is unchanged.
    The two share preprocessing, the decomposition and the row and column exclusions, so they cannot
    disagree about what data they are looking at. Regress mode has a Step 3 panel for the response,
    folds, grouping, rule and metric, and a results view with the error block, the selection curve,
    predicted against measured, and the coefficients. A fold count the data cannot support is
    refused in the Folds menu's own words (#973)
  - Section 12 of `intro_to_pca.md` introduces the method (#842)
- **`pca transform` says how far each prediction can be trusted** (#978). For every sample it reports
  Hotelling's T² and the Q residual against the limits the model carries, and marks the sample
  **outside the model** when either is exceeded. A PCR model also predicts its response; when the
  file being transformed carries the measured response, an RMSEP section follows, split into the
  samples within the model's limits and those outside, because the pooled figure describes neither.
  On the Tecator extrapolation subset all eight samples are flagged, including the two predicted at
  69% and 72% fat from a calibration that tops out at 49%. The JSON results file carries the
  prediction too (#1037)
- **Savitzky-Golay smoothing and derivatives** (#843), as a preprocessing step in the engine, the CLI
  (`--savgol-window`, `--savgol-order`, `--savgol-deriv`), the model file, `pca transform` and
  GoPCA Desktop. It chains after scatter correction, which is the standard NIR recipe, and a PCR
  model keeps its original-scale coefficients through it because the filter is the same linear
  operator for every sample. Edge handling matches scipy's `mode="interp"`. GoPCA Desktop offers
  the control only where a derivative means something — the von Neumann ratio decides whether the
  variables form a continuous axis, so it appears for spectra and not for thirteen unrelated wine
  measurements (#892) — and shows a live preview of the spectra as the decomposition will see them
  while the window and order are chosen
- **GoCSV can prepare data it previously had to send back to Excel.**
  - *Centred log-ratio transform* for compositional data, where a constant-sum constraint makes the
    covariance singular and correlations spuriously negative; PCA on raw closed data is a textbook
    error (#865)
  - *Box-Cox and Yeo-Johnson* power transforms, which fit the exponent by maximum likelihood instead
    of asking you to guess it; Yeo-Johnson is the answer for a column with zeros that `log` and
    `sqrt` correctly refuse (#868, #861)
  - *Split and combine columns* — `B3_S12_r1` becomes a `B3` column that `--cv-group` can use (#866)
  - *Filter rows by criterion*, keep or remove, with undo; empty cells match only "is empty" (#863)
  - *Transpose*, for instrument exports with samples across the top (#862)
  - *Ordinal encoding* with a category order you arrange, and numeric codes ordered as numbers rather
    than as text, so level 10 is not encoded between 1 and 2 (#856, #996)
  - *Average replicates*, and the row-removal gap it shared with deletion: `CategoricalColumns` and
    `NumericTargetColumns` are now removed alongside the rows (#864, #871)
  - *Use as Row Names* and *Move Row Names into Table* from the header menu; every entry must be
    non-empty and distinct, because row names label the points in a scores plot (#859)
  - *Number the Rows*, with a start and increment of your choosing, for files whose columns all
    repeat (#923, #967)
  - *A `#category` marker* for numbers that are labels — processing codes, site numbers, batch
    identifiers. On the aluminium alloy dataset the processing-code column carried roughly 7,400
    times the variance of the largest element concentration and took 99.97% of PC1; the marker holds
    it out of the analysis and offers it for colouring. `#target` and `#category` are mutually
    exclusive (#914, #922)
  - *Dragging a column reorders the data*, not just the view; the guide recommended the gesture
    while the grid discarded it (#878)
  - *A multi-sheet workbook goes to the import wizard* instead of silently opening the first sheet
    (#905)
- **The Data Quality Report names what it finds and what to do about it.** Rows holding far fewer
  values than the rest are reported, with a way to show them (#908, #931); duplicate rows are listed
  rather than counted (#932); the skew finding names its columns, and the transform recommendation
  drops the ones no monotone transform can reshape (#951, #954); a column that would dominate the
  analysis is named with its share of the variance (#909); constant columns are reported and the
  variance check is scale-free (#867)
- **The Model Overview reasons about scale, not just spread** (#957, #1014, #956). The scale
  warning names the two variables and reports a ratio of standard deviations rather than of
  variances (21,494× for Al against Be on the alloy data, where it said 462,008,282×). When the
  variables sum to a constant it argues *against* standardizing and points at the log-ratio
  transform; when the extreme variable is zero in almost every row it says the difference is about
  presence, not units; on wine it still recommends standardizing. The Kaiser verdict reads the whole
  eigenvalue spectrum and says "Kaiser: 10" when ten is its answer, "5+" only when it genuinely ran
  out of components to count, and never calls a censored count an agreement
- **The Loaded Data panel says which column became row names and lets you say it is data** (#969).
  The first column of a CSV was always taken as row names, so a file with no identifier column
  silently lost its first variable. The CLI has `--no-index` for the same case
- **Three datasets for beta testing and tutorials**: the Tecator NIT meat spectra, whose
  extrapolation subsets exist to make a regression fail in a known way (#976); the aluminium alloy
  compositions from Bhat et al. (2023), with a tutorial (#912, #940, #998); and the paprika PDO
  authentication data (#938)

### Changed
- **GoPCA Desktop and GoCSV run on Wails v3** (#531). Each application is a Wails service; events
  are registered with typed names so a renamed event fails the TypeScript build instead of silently
  never arriving; dialogs, file drops and the unsaved-changes prompt use the v3 window hooks, and
  GoPCA's `--open` file is loaded when the window is ready rather than after a fixed delay.
  Bindings are generated at build time and never committed. The AppImages are built by `wails3
  generate appimage`. The tutorial window remains a separate process for now
- **One custom Plotly build instead of two bundled copies** (#898). Every application shipped Plotly
  twice, and the maplibre code the dependency override claimed to patch was compiled inside the
  prebuilt distribution, untouched. The build now registers only the six trace types the suite
  draws, through one component: GoPCA Desktop's main chunk fell from 10.1 MB to 2.9 MB and GoCSV's
  from 11.0 MB to 3.8 MB, and no map code ships
- **The reports state the preprocessing that was applied** (#982) — `Preprocessing  SNV, mean
  centering`, in the order the steps run. Two runs that transformed the data differently used to
  produce output distinguishable only by its digits. A repeated cross-validation design says so on
  the Design line (#1036)
- **Categorical legends are ordered by value, not by first appearance** (#1013). A level's colour
  came from where it first occurred in the file, so filtering rows recoloured the plot and two plots
  of the same categories used two colour schemes with nothing saying so. Levels now sort numerically
  when they are all numbers and as text otherwise, the same rule GoCSV applies to one-hot columns
- **Long legend labels are shortened, and the plot says when the palette has run out** (#999).
  Colouring by a column with 124 levels used to take half the plot width for the legend and repeat
  25 colours in silence. Labels are cut at 28 characters, the full value stays in the hover text, and
  a note by the colour selector says that colours repeat and no longer identify a group
- **The 3D scores plot is drawn to the data's aspect, not a cube** (#1018). Under `cube` each axis
  was stretched to equal visual length, so a component with a tenth of the first's spread looked as
  wide as it, and distances on screen were not score distances. A low-variance component now draws
  flat, which is the honest cost; the 3D biplot keeps its cube because its unit-norm loading arrows
  already give comparable axes
- **Smart labels spend their budget on distinct positions** (#1017). Rows that repeat another row
  land on one point, and "Max labels: 10" used to draw ten labels at five positions
- **The data preview draws a collapsed box's outlier tails as edge marks** (#1016). A column that is
  zero except in a few rows has IQR = 0, every other value is an outlier, and the dashed tail ran the
  full height of the panel — fifteen identical full-height lines on the alloy data, reading as "these
  vary enormously" about columns that are one number in 99% of rows
- **The loadings threshold label sits inside the plot at a readable precision** (#1000). It used to
  anchor outside the plot area and print seventeen significant digits; it now reads `Threshold:
  ±0.204`
- **GoCSV says when a transform declined to act** (#1002). A refused Box-Cox used to be reported in
  the same blue panel as a success; an untouched or partial run is now amber and says `No columns
  were transformed. Your data is unchanged.` or `1 of 2 columns transformed, 1 left unchanged`
- **Variable labels in the Circle of Correlations are separated angularly** so three arrows within
  7° — the tightly correlated variables a reader is trying to tell apart — no longer overlap (#830)
- **User-facing documentation uses American spelling** throughout, and the data preparation guide was
  rewritten around what the software now does (#991, #880)
- **Model files are now validated against the JSON schema.** The v1 schemas shipped with the
  applications but were never parsed; `ValidateModel` ran a set of hand-written structural checks
  instead. The schema graph is now compiled and enforced, both on `pca transform` and on the Desktop
  export path. **Models GoPCA writes are unaffected** — every variant was checked (SVD, NIPALS,
  kernel, robust, SNV, dropped missing values, and both PCR cases) and all validate. The change is
  visible only for hand-edited or third-party-generated files, which may now be rejected where they
  previously loaded, and the error names the failing path:

  ```
  $ pca transform hand_edited_model.json data.csv
  Error: model validation failed: model does not match the schema:
    metadata.analysis_id: Does not match pattern '^[0-9a-f]{8}-[0-9a-f]{4}-...'
  ```

  `analysis_id` has always been documented as a UUID and was simply never checked, so a file
  carrying `"analysis_id": "model-2024-run-7"` used to load without complaint. This is enforcement
  catching up with the documentation rather than a new restriction (#846)

### Fixed
- **The exported `preprocessing` block now records the transformation that was applied, not the
  flags that were requested** (#987). `Preprocessor.Transform` takes one of three branches in
  precedence order, so robust and scale-only scaling each suppress mean centering. Three of the five
  reachable combinations therefore described a pipeline the training run had not used — a model
  built with `--scale-only` claimed a centering that never happened, and one built with
  `--scale robust` recorded `mean_center: true` when the centering was on the median, not the mean.

  ```
                                        before                        after
  --scale-only            mean_center, scale_only            scale_only
  --scale robust          mean_center, robust_scale          robust_scale
  ```

  The flags are now mutually exclusive: at most one of `standard_scale`, `robust_scale` and
  `scale_only` is ever set, so a consumer never needs to know GoPCA's internal precedence. Note that
  `robust_scale` implies centering on the median, so `mean_center: false` alongside it does **not**
  mean the data was uncentered; the schema descriptions now say so.

  **Existing model files are unaffected and need no migration.** The flags that were wrong are
  exactly the ones the precedence ignores, so a pre-fix file selects the same branch and transforms
  identically — verified, and pinned by a regression test.
- **Exporting a partially labelled dataset no longer fails.** `PreservedColumns.NumericTarget` was a
  `map[string][]float64`, and `encoding/json` refuses to marshal a NaN under any circumstances. A
  `#target` column with an unmeasured value therefore aborted the entire export, on both
  `pca analyze -f json` and `pca regress -o`:

  ```
  Error: failed to encode the model: json: unsupported value: NaN
  ```

  This is the ordinary case in chemometrics rather than an edge case — a calibration set where only
  some samples went for reference analysis — and it survived because every fixture it had been tried
  on had complete target columns. Gaps are now encoded as `null` and read back as NaN; on
  `testdata/bronir2` that is 414 nulls of 855 values. **Consumers parsing `numericTarget` into a
  plain float array will now encounter `null`**, which they never could before, because the file
  simply did not exist. The schema was updated to allow it (#839)
- **A PCR model file carries its diagnostic limits.** `pca regress -o` exported `"diagnostics": {}`
  while `pca analyze` filled all four limits for the same data; the computation was never called on
  the regression path. Without them nothing downstream could say a prediction was an extrapolation
  (#977)
- **Sample, group and variable names are escaped before Plotly parses them as markup** (#999,
  #1004). Plotly renders hover labels and on-plot text through an HTML subset, so `<LOD`, `>99.9`
  and `R&D` were swallowed or mangled. Every hover and label site in every chart now escapes, and a
  test builds all seven plot classes with hostile names to prove it
- **`pca transform` no longer prints `RMSEP 0 on the 0 samples within the model's limits`** when no
  sample is inside them; a root mean square over no samples is undefined, and the line now says so.
  `-o` writes the results file whatever the console format, instead of creating an empty directory
  (#1037, #1038)
- **Numeric values in GoCSV sort as numbers.** A CSV has no types, every cell arrived as a string,
  and sorting `Zn` descending put `7e-05` above `0.12`. Data columns no longer claim to be sortable
  when their header cannot sort them (#963)
- **A `#category` column is displayed as the labels it holds**, not as `3.0000`; a column of alloy
  designations such as `6101` is no longer painted as a mixed measurement; columns derived from a
  marked column no longer inherit its marker; the category menu entry has its icon; and the menu
  says what *Number the Rows* gives you rather than what it does (#945, #950, #947, #927, #949)
- **Moving row names into the table keeps them out of the analysis**, and samples are numbered from
  one. A column of `1..n` moved into the table used to become a variable carrying 100% of the
  variance (#942)
- **The import applies the same row-name rule as the manual choice.** A first column that repeats —
  a source title, a batch name — no longer becomes row names that cannot tell rows apart (#904)
- **The Data Quality Report no longer tells users that PCA assumes normality**, no longer calls
  correct data an outlier under a rule that was inverted and then twice wrong, and its row findings
  can be reached in the grid (#929, #933, #931)
- **The Parquet import no longer appends `#target` to string columns**, and the embedded sample
  datasets are synchronised and verifiable; the iris tutorial dataset is generated from scikit-learn
  (#918, #915, #917)
- **A CSV with no numeric column opens in GoCSV** instead of being refused (#801)
- **The data grid shows that it scrolls**, in both directions and in both applications; the
  scrollbars were invisible (#961)
- **Table-of-contents entries in the documentation viewer navigate to their section.** The heading
  numbering mutated state during render, which React's StrictMode double render exposed in both
  applications (#436)
- **Temporal PCA refuses row-wise preprocessing instead of silently dropping it** (#889)
- **The fold-count refusal names a remedy each interface accepts.** It used to advise `0` for
  leave-one-out, which the CLI then refused; the CLI now says `--cv loo` and the desktop says
  *Choose 5 folds, or "Leave one out"* (#973)
- **The Tecator channels are labelled at an even 2 nm spacing**, so the Savitzky-Golay continuity
  check no longer fires on a dataset whose spectra are evenly sampled (#986)

### Security
- **Every open Dependabot advisory is cleared, twice over.** The September batch of 23 (#758) was
  resolved without a major bump, with four obsolete override pins retired and a security-only
  Dependabot policy added (#1008). The October batch of 35 — fifteen in `excelize`, the rest across
  `vite`, `undici`, `brace-expansion`, `katex`, `vitest` and others — is resolved in #1024;
  `excelize` is pinned to a master commit carrying all fifteen fixes, since no tagged release does,
  and `katex` to 0.18.10, the last release before a deprecated one
- **The custom Plotly build removes the vulnerable `maplibre` code from both applications** (#898);
  the override that claimed to patch it never reached the shipped artifact

### Development
- **Model files are validated against the schema on every load and export** (#846), the schema
  copies are guarded against drift and untested packages fail the build (#835, #836)
- **Kernel PCA and Temporal PCA are validated against scikit-learn and a reference generator**, and
  the four gaps in the existing scikit-learn validation are closed (#845, #832)
- **One entry point for frontend type-checking**, run by CI, that regenerates the bindings and
  type-checks all three frontends, after a desktop build broke without anything noticing (#886, #885)
- **Release tags point at a minimal anchor tree in the public repository**, and docs, schemas and
  releases are published there from `main` (#992, #993)

## [1.7.0] - 2026-09-01

This release turns the column overview above the data table into a general data preview. It now
appears for every dataset rather than only wide ones, it no longer collapses when variables are
measured on different scales, and it can show the distribution of each variable rather than just its
mean. The Circle of Correlations also gets the panel space it needs. If you compare plots or
screenshots against earlier versions, read **Changed** first.

### Added
- **The data preview appears for every dataset.** The column overview above the data table used to
  be reserved for datasets wider than 20 columns, where a checkbox list becomes unwieldy. It doubles
  as a preview of what you loaded, which is worth having at any width, so it now appears for any
  dataset with two or more columns. Appearing only past a threshold made it look like it came and
  went at random (#820)
- **A distribution view for the data preview.** A new **Distribution** button draws a five-number
  summary of each variable, with each variable scaled to its own range so you compare shapes rather
  than sizes: the box is the middle half, the tick is the median, the whisker reaches the last value
  within 1.5×IQR, and a dashed tail marks outliers beyond it. It shows what a mean cannot — which
  variables are skewed, where their mass sits, and which columns are index sequences you should
  exclude before analysis. Most legible below roughly 100 columns (#820, #825)

### Changed
- **The data preview no longer flattens variables measured on different scales.** Every variable was
  drawn against one shared axis, which is correct for a spectrum but lets a single large-magnitude
  variable compress all the others to nothing. On the built-in Corn dataset, where four reference
  measurements sit two orders of magnitude above the 700 spectral channels stored beside them, only
  5 of 709 bars were visible; all 705 are now. The preview picks its scaling from the values
  themselves and offers **Shared** and **Per column** buttons to switch. **Spectra are unaffected** —
  they keep the connected line on a shared axis (#820)
- **The Circle of Correlations fills the panel.** It rendered at about a third of the available
  width, because the axes are locked to a 1:1 ratio and the plot was resolving that by widening the
  range rather than squaring the plotting area. The circle is now as large as the panel allows and
  the axes read ±1.2 as intended. **This plot will look considerably larger than in v1.6.0.** It
  matters here more than on other plots: the reading depends on how far an arrow reaches toward a
  fixed reference circle, so a shrunken circle crowds short arrows into the origin (#807)
- **The data preview explains itself through the help area.** Its controls used to show native
  tooltips while the rest of the application explains itself in the header that says "Hover over any
  element for help". They now use the header like everything else (#820)
- **Variable names on the preview axis are rotated and no longer capped at six.** How many fit is now
  measured from the panel width instead of assumed, and rotating them 45° means a few long variable
  names no longer crowd out all the others (#825)

### Fixed
- **The distribution whiskers now carry information.** Drawn to each variable's minimum and maximum,
  they spanned the full height of every column by construction, since that is what the column is
  scaled by. They now end at the Tukey fences, so their length varies and outliers are visible
  (#825)
- **Outliers are no longer missed in large datasets.** Quartiles for the distribution view are
  computed from a row sample for speed, but extremes and outliers were too, and an outlier is rare by
  definition. Extremes are now read from every row (#825)
- **GoCSV no longer advertises a spreadsheet cell range it cannot import.** The import options
  declared a `range` field documented with a worked example, but nothing read it and the wizard
  offered no control for it. Removed — the wizard's existing Skip Rows, Maximum Rows and column
  selection already cover what it would have done (#808)

### Internal
- **Wails updated to v2.13.0** in both applications, matching the CLI version required by Go 1.26+.
  The older CLI could not read the newer Go toolchain's output and rewrote `go.mod` on every dev run,
  which broke the GoCSV module (#822)
- **The Wails CLI is pinned in CI and in the Makefile** rather than installed as `@latest`, so
  release artifacts are built by a version that was chosen and reviewed. The Makefile derives it from
  `go.mod`, so the version a developer installs cannot drift from the library (#827)
- **Build jobs can be run on any branch on demand** via `workflow_dispatch`, replacing a hardcoded
  reference to a branch deleted long ago. Changes to the build workflow could not previously be
  verified before they were merged (#827)
- **`check-dev-setup.sh` verifies the Wails CLI version**, not just its presence, and its Go and Node
  thresholds were corrected to the documented 1.26 and 24 (#822)
- **The project website was brought up to date** — seven datasets rather than six, the correct
  tutorial order, the Microsoft Store link, and GoCSV's Excel, Parquet and URL import (#818)

## [1.6.0] - 2026-08-24

This release is dominated by a systematic quality-assurance pass over every tutorial and over the
parts of the applications no test had exercised. Several of the fixes change what you see on screen
or what a command returns, so read **Changed** before upgrading if you script the CLI or compare
plots against earlier screenshots.

### Added
- **NHANES Body Measures sample dataset and tutorial** — real anthropometric measurements from the
  US National Health and Nutrition Examination Survey, added as the seventh built-in sample dataset
  with a full guided exploration. It gives PCA on data where every variable is positively correlated,
  producing a textbook "size" first component and a shape contrast on the second (#724, #725, #765)
- **Column exclusion in GoPCA Desktop** — datasets wide enough to make the variable list unwieldy now
  offer a selection interface for excluding columns before analysis, with a sparkline preview of each
  variable (#775)
- **Excel files with a title block now open** in GoCSV. Spreadsheets written for people rather than
  programs — a report title, a date, a blank row, then the real header — previously failed to load at
  all. GoCSV now detects the layout and opens the Import Wizard on the file with the rows to skip
  already filled in (#799)

### Changed
- **`pca validate` now refuses files that `pca analyze` refuses.** The two commands could disagree:
  a file with no numeric columns was reported as "ready for PCA analysis" and then rejected by
  `analyze`. `validate` now runs the same engine validation `analyze` runs, so the verdicts cannot
  drift apart. **If you script `pca validate`, note that input which previously exited 0 may now exit
  1** — this affects files with no numeric columns or fewer than two samples (#810)
- **The Circle of Correlations now plots correlations rather than loadings.** Arrow lengths were the
  raw loadings, which made every arrow too short and meant the distance to the unit circle carried no
  interpretation. Arrows are now the variable's correlation with each component, so their length
  squared is the share of that variable's variance the plane captures. **Arrows will look longer than
  in v1.5.0** — on the Wine dataset `flavanoids` now reaches 0.92 where it previously drew 0.42. The
  inner reference circle moved from 0.5 to √½ ≈ 0.707, the true halfway mark (#793, #794)
- **Component signs are consistent between methods.** A principal component is defined only up to its
  sign, and SVD and NIPALS previously resolved that ambiguity differently — on the Wine dataset,
  switching method mirrored the scores plot on both axes for otherwise identical components. Both
  methods now make the largest-magnitude loading of each component positive, the rule scikit-learn and
  MATLAB use. **Scores plots may appear mirrored relative to v1.5.0.** Signs may still differ from
  software that applies no convention, such as R's `prcomp`; see "A note on the sign of a component"
  in the PCA introduction (#779, #780)
- **`pca transform` refuses kernel and temporal models** instead of crashing. It previously exited
  with a Go panic on both. Neither can project new data from the model file alone: kernel PCA needs
  the training data and the kernel function, which the file does not store, and temporal PCA needs the
  new series re-embedded with the same lag structure. Both now exit 1 with an explanation and a
  pointer to re-running `analyze` over the combined data (#809)
- **The biplot is titled "Biplot"** rather than "Biplot (correlation scaling)". The scaling type was
  never implemented — the plot is a form biplot, and the label promised a construction the code did
  not perform. No geometry changed; arrow directions and relative lengths are as before (#796)
- Toolchain modernised to **Go 1.26 and Node 24**. Go 1.24 is end-of-life and no longer receives
  security updates (#713)
- GoCSV's stubbed JSON import and Excel cell-range option have been removed. Both were accepted by the
  interface and did nothing (#719)
- Configuration options that no code consumed have been removed from the GUI configuration. Ten of the
  twelve exposed thresholds were read by nothing, with the values actually in force hardcoded in the
  frontend (#778)

### Fixed
- **Kernel PCA training scores** were not scaled by the square root of the eigenvalue, so scores were
  reported on the wrong scale (#736, #747)
- **NIPALS with native missing-value handling** computed explained variance against the wrong
  denominator on complete data, and silently ignored requests for standard, robust or scale-only
  preprocessing — returning an unscaled analysis with no warning a desktop user would ever see. Column
  statistics are now computed over the observed values of each column (#738, #741, #779, #780)
- **`Transform` after a native-NIPALS fit** projected raw values onto loadings learned in centered and
  scaled space, returning scores wrong by an order of magnitude when columns differed in scale, with no
  error. The preprocessing parameters are now recorded and reapplied (#783, #785)
- **The Q-residual (SPE) confidence limit** used the wrong power of h₀, departing from
  Jackson & Mudholkar's formulation (#737, #742)
- **CLI and Desktop reported different diagnostic metrics** for the same analysis. Both now share one
  PCA-and-diagnostics pipeline (#716, #760, #762)
- **The Circle of Correlations disappeared from the GoPCA Desktop menu** in a pre-release build: the
  correlations were computed by the engine but dropped when the result was converted for the frontend
  (#795)
- **The component-count spinner capped Kernel PCA** at the number of variables, when kernel PCA can
  extract up to the number of samples (#767, #768)
- **`pca transform` and `pca validate` panicked on an empty `--delimiter`**, and `validate --summary`
  truncated long column headers (#740, #743)
- **CSV export from GoPCA Desktop lost missing values** when the data had row names (#739, #744)
- A duplicate "Input Data" heading appeared above the data table in GoPCA Desktop (#781, #782)
- Excel sheets whose rows have differing widths — which `GetRows` produces whenever trailing cells are
  empty — failed to parse (#799)
- A React hook cleanup issue left a `setTimeout` unguarded and captured a stale closure (#636, #637)

### Security
- Updated `excelize` to 2.11.0, closing an unbounded row-index allocation in the worksheet parser that
  a crafted spreadsheet could use to exhaust memory. `golang.org/x/crypto` and `golang.org/x/net` were
  raised at the same time; their advisories concern SSH and are not reachable from any GoPCA binary,
  but the bumps clear them from the dashboard so a future alert that matters is not buried (#797)
- Resolved high-severity npm advisories in `postcss`, `nanoid` and `brace-expansion` (#715, #757)
- Fixed all code-scanning alerts: a regular-expression denial-of-service pattern and over-broad
  workflow permissions (#710)

### Documentation
- **Every tutorial has been checked against the software's actual output**, and the errors found were
  corrected: the CSTR, Corn, Body Measures, EEG, Iris and Wine explorations all carried claims that did
  not match what GoPCA produces. The recurring fault was a real observation attributed to the wrong
  cause, with correct arithmetic underneath (#770, #772, #777, #787, #789, #791, #803, #813)
- Factual corrections to the PCA introduction (#763, #764)
- The data-preparation guide now documents the **Import Wizard** — sheet selection, header row, rows to
  skip, row limits, row names and column selection — none of which it previously mentioned (#805)
- Added EEG tutorial illustrations, and the missing `git-aliases.md` referenced by the development
  guide (#712, #722, #723)

### CI/Build
- The full `cmd/gocsv` test suite and the `internal/cobra` tests now run in CI; both were previously
  skipped or filtered, leaving the CLI command layer effectively untested (#746, #748, #751, #753)
- Documentation mirrors are verified by `sync-docs --check`, gated by a pre-commit hook and a broader
  CI trigger, so bundled tutorial copies cannot drift from their sources (#730, #754)
- Frontend ESLint is enforced in CI, with the accumulated backlog cleared (#714, #759)
- `cmd/gocsv/app.go` was split by concern, and dead code was removed from `pkg/integration` (#717,
  #718, #745, #761)
- `package.json.md5` is no longer tracked. It is a Wails build cache the tool rewrites whenever it
  drifts, which gave every developer a permanently dirty working tree (#815)
- Privacy-audit false positives on local and user-initiated fetches are silenced (#755, #756)

## [1.5.0] - 2026-06-02

### Added
- **Load from URL** in GoCSV — paste any public download URL and GoCSV fetches, validates, and imports
  the file directly. Supports CSV, TSV, Excel, Parquet, and ZIP archives. GitHub blob URLs are
  rewritten to raw content URLs automatically. Format and size are shown before download commits.
  ZIP archives with multiple data files show a file picker (#699, #703, #704)
- **Parquet file import** in GoCSV — open `.parquet` files from disk. String columns are marked
  as `#target` group variables; a `Sample_ID` column provides unique row identifiers (#697, #698)
- **Table of Contents** in documentation viewer — sticky sidebar TOC with active-section highlighting
  as you scroll, covering both GoPCA Desktop and GoCSV Desktop (#436)

### Fixed
- Z-axis and loading component indices not reset when re-running PCA with fewer components,
  causing 3D plots and loadings views to request out-of-range components (#635)
- `copyToClipboard` in `useUIState` scheduled stacked `setTimeout` calls with no cleanup on
  unmount; rapid clicks could dismiss the "Copied!" indicator early (#636)
- Stale closure in `useAppInit` — startup file handler always called the callback captured at
  mount instead of the latest version (#637)

### Security
- Fixed polynomial ReDoS in `errorMessages.ts`; replaced backtracking-prone regex with
  `indexOf`-based string parsing (#710)
- Added explicit `permissions: contents: read` to `build.yml` and `check-docs-sync.yml`
  workflows to restrict default GitHub Actions token scope (#710)

### Changed
- **License changed to GoPCA Suite Source-Available Freeware License** — binaries remain free;
  source available for review. Previously released versions ≤ 1.4.0 remain under MIT (#694)
- Removed SignPath from release pipeline — Windows signing handled via Microsoft Store (#696)

### CI/Build
- CI now uses `go mod download` for dependency fetching (deterministic, read-only) followed by
  a tidiness verification step that fails the build if `go.mod`/`go.sum` drift (#638, #707)

### Documentation
- GoCSV data preparation guide rewritten as concise task-oriented reference; includes Load from
  URL, ZIP import, and GoPCA-ready CSV format sections (#704)
- Fixed "five datasets" → "six datasets" in `intro_to_pca.md` introduction (#706)
- Fixed incorrect "n > p" minimum sample size claim in `data-format.md` (#706)
- Fixed `csv-format.md` internal spec to match current `pkg/csv` implementation (#706)

## [1.4.0] - 2026-05-29

### Added
- **Six guided tutorials with real datasets** — each bundled directly in the application and opened automatically when a sample dataset is loaded (#664)
  - **Iris** — classic multivariate dataset; introduces scores, loadings, and group separation (#662)
  - **Wine** — classification with scale imbalance; teaches preprocessing choices (#665)
  - **Corn (NIR)** — near-infrared spectroscopy; covers SNV preprocessing and spectral interpretation (#666)
  - **Swiss Roll** — synthetic non-linear manifold; demonstrates Kernel PCA (#667)
  - **EEG Eye State** — brain signal classification; introduces high-dimensional temporal data (#668, #670, #689)
  - **CSTR** — chemical reactor time-series from a simulator; teaches Temporal PCA for process monitoring (#673)
- **CSTR dataset** — simulated Continuous Stirred Tank Reactor data for Temporal PCA exploration (#673)
- **EEG Eye State dataset** — replaces the former Stocks dataset; EEG recordings for binary classification (#668)

### Fixed
- External links in tutorials and documentation now open in the system browser instead of inside the app (#683)
- Pre-bundle `plotly.js-dist-min` to prevent Wails dev-server crash on startup (#682)
- Suppress misleading scale warning when Robust Scale preprocessing is selected (#690, fixes #684)
- Restore Download as PNG button on the Variable Importance plot — was accidentally removed (#691, fixes #685)

### Changed
- Rename `Sample` column header to `Sample_ID` in all bundled datasets for clarity (#687, fixes #686)
- **License changed from MIT to GoPCA Suite Source-Available Freeware License** — effective for versions 1.4.0 and later (#694)
  - Compiled binaries remain free to use and redistribute
  - Source code is publicly viewable for review, education, and security analysis
  - Modification and redistribution of source code require prior written permission
  - Previously released MIT-licensed versions (≤ 1.3.1) remain under the MIT License

### Documentation
- Clarify robust scaling explanation in the preprocessing guide (#692)
- Extensive human QA and copy-editing pass across all six tutorials (#674, #681, #683, #689)

### Security
- Fix all Dependabot alerts: updated npm and Go dependencies (#679)

## [1.3.1] - 2026-04-24

### Fixed
- macOS binaries are now properly notarized in CI release builds (#651)
  - `notarytool store-credentials` left the keychain profile inaccessible after the signing step modified the keychain search list, causing silent notarization failures
  - Fixed by passing credentials inline to `notarytool submit` instead of relying on a stored keychain profile

## [1.3.0] - 2026-04-24

### Added
- **GoCSV contextual help system** — hover over any toolbar control or button for an inline description (#412, #649)
  - Help components (`HelpProvider`, `HelpWrapper`, `HelpDisplay`, `useHelpHover`) implemented once in `packages/ui-components` and shared by both GoPCA Desktop and GoCSV
  - Each app supplies its own `help-content.json`; the shared components are content-agnostic
  - All major GoCSV controls covered: file loading, import wizard, undo/redo, data quality, fill missing, transform, GoPCA integration, export

### Fixed
- Unsaved changes in GoCSV now trigger a confirmation dialog before the window closes, preventing accidental data loss (#477, #644)
- GoCSV file load errors are now displayed as proper `ErrorAlert` notifications instead of silent `alert()` calls (#495, #643)

### Changed
- **GoCSV app.go refactored into shared packages** — domain logic extracted over three phases (#639–#641, #645–#647)
  - Phase 1: `pkg/dataquality/` extracted — app.go reduced from 3,613 to 2,401 lines
  - Phase 2: `pkg/transform/` extracted — app.go reduced from 2,401 to 1,927 lines
  - Phase 3: CSV parse helpers and column-type detection extracted to `pkg/csv/` — app.go reduced to 1,700 lines
  - app.go is now a thin Wails coordination layer; all domain logic lives in independently testable packages

### Testing
- Expanded test coverage for GoCSV extracted packages (#642, #648)
  - `pkg/csv`: 86.6% coverage (parse, detect, output, convenience wrappers)
  - `pkg/integration`: 64.2% coverage (validation, temp file management, JSON consistency)

## [1.2.0] - 2026-04-11

### Added
- React Context state management for GoPCA Desktop, eliminating prop drilling from App.tsx (#630, #505)
  - 5 new context providers: `FileDataContext`, `PCAContext`, `VisualizationContext`, `UIContext`, `GoCSVContext`
  - Extracted `DataLoadSection`, `PCAConfigSection`, and `ResultsSection` as focused sub-components
  - App.tsx reduced to a lean provider stack (~191 lines)
- Transform and preprocessing validation test suite (#625, #480)
  - 33 new tests validating the complete PCA transform operation and preprocessing pipeline
  - `internal/core` test coverage: 88.1% (requirement: >80%)

### Fixed
- Arrow colors in Circle of Correlations now follow the palette correctly (#626, #513)
  - Arrowhead color was hardcoded to `#3b82f6` instead of reading from the active color scheme

### Changed
- Upgrade Plotly.js from v2.35.3 to v3.5.0 (#622, #618)
  - Includes fix for `customdata` handling and other upstream improvements
- Upgrade Wails framework from v2.10.2 to v2.12.0 (#623, #619)
- Refactor App.tsx: extract 7 custom hooks from monolithic `AppContent` component (#629, #503, #507)
  - `useAppInit`, `useFileData`, `useGoCSVIntegration`, `usePCAConfig`, `usePCARunner`, `useVisualization`, `useUIState`
  - Adds production-safe `logger.ts` — suppresses all console output in production builds
- Optimize React context rendering in GoPCA Desktop (#631, #506)
  - `useMemo` on all 5 context value objects prevents unnecessary consumer re-renders on parent re-renders
  - Functional `setConfig` updater form eliminates stale closure bugs in `PCAConfigSection`
  - `useMemo` for derived arrays (`plotOptions`, `groupColumnOptions`) in `ResultsSection`
- Centralize NIPALS and Kernel PCA algorithm constants (#628, #484)
  - `NIPALSConfig` (tolerance: 1e-8, maxIterations: 1000) and `KernelPCAConfig` (minEigenvalue: 1e-10) in `internal/config`
  - Eliminates duplicated `const` blocks across PCA algorithm files
- Remove dead fields from `PCAResult` struct (#627, #459)
  - Six fields never set or read in production removed: `ExplainedVariance`, `CumulativeVariance`, `Mean`, `Scale`, `Components`, `Config`
- Update copyright year range to 2025-2026 across all source files and LICENSE (#632)

## [1.1.8] - 2025-11-09

### Added
- **Bundled MSIX Package** for Microsoft Store (#608, #567)
  - Single installation package containing both GoPCA Desktop and GoCSV
  - Both apps installed in same directory enabling tight integration
  - Enables "Open in GoPCA" and "Open GoCSV" cross-app features
  - Includes comprehensive MSIX packaging documentation
  - Suitable for Microsoft Store submission and enterprise sideloading

### Fixed
- CustomSelect component keyboard navigation with type-to-search filtering (#607)
- Preprocessor state now used for PreprocessingApplied metadata field (#606)
- Non-comma delimiter handling in mixed parsing and CLI validation (#605, #599, #600)
- --target-columns CLI flag now parsed and applied correctly (#604)
- Missing-strategy zero implementation for imputation (#603)

## [1.1.7] - 2025-11-07

### Fixed
- RFC 4180 compliant CSV field escaping to prevent data corruption (#593, #588)
- DocumentationViewer modal state reset to prevent stale content flash (#595, #589)
- GoCSV async history clearing with proper await (#592, #587)
- CLI command generator uses actual file paths instead of dataset names (#590, #585)

### Changed
- Removed dead code for non-existent kernel types (code cleanup) (#591, #586)

## [1.1.6] - 2025-11-07

### Added
- Microsoft Store distribution with automated MSIX packaging (#561, #560)
- CSV format tooltip to data table in Step 1 (#547)

### Fixed
- Race conditions in EventBus tests preventing pre-commit hooks (#581, #580)
- Nil dereference in CalculateGroupEllipses function (#578, #571)
- Student's t-distribution CDF implementation for accurate p-values (#577, #570)
- Kernel PCA method name normalization ('polynomial' → 'poly') (#576, #569)
- CLI double-preprocessing and incorrect diagnostics data (#575, #572, #573)
- Windows SDK tools dynamic location for MSIX builds (#562)
- Z-axis component selector for 3D Biplot visualization (#535)
- LaTeX math duplication by importing ui-components CSS (#534)
- Preserve unselected rows in table after plot selection (#544)

### Changed
- Removed legacy missing-value helper functions (technical debt cleanup) (#579, #574)
- Default coef0 value for polynomial kernel from 0 to 1 for better defaults (#542)
- Simplified embedded stock dataset for accessibility to non-traders (#539)
- Removed redundant CSV format text in Step 1 UI (#548)

### Documentation
- Optimized intro_to_pca.md illustration images for faster loading (#556)
- Improved temporal PCA documentation and figures (#527, #455)

### Testing
- Comprehensive test coverage improvements for pkg packages (#553)
  - pkg/csv: 26% → 73.8% coverage
  - pkg/security: 50.6% → 85.8% coverage
  - pkg/integration: 34.1% → 46.6% coverage
- Fixed data races in EventBus tests with proper channel synchronization (#581)

### Refactoring
- Code quality improvements following DRY/KISS principles (#557)
  - Consolidated JSON conversion helpers (~150 lines eliminated)
  - Extracted NIPALS algorithm helpers (72% and 54% complexity reduction)
  - Improved testability with comprehensive unit tests

## [1.1.5] - 2025-10-09

### Fixed
- Corrected MSIX package identity name to match Microsoft Partner Center reservation
  - Changed from `BitjungleGoPCA` to `bitjungle.GoPCA`
  - Fixes Partner Center upload validation error
  - Required for successful Microsoft Store submission

## [1.1.4] - 2025-10-09

### Added
- **Microsoft Store Distribution** (#563, #560)
  - Automated MSIX package generation in CI/CD workflow
  - Self-signed temporary certificate (Microsoft Store re-signs on publish)
  - Dynamic Windows SDK tool discovery (no hardcoded paths)
  - Smart version format conversion (strips pre-release suffixes)
  - Complete infrastructure with AppxManifest template and MSIX assets
  - Comprehensive documentation in `docs/devel/msix-packaging.md`
  - End-user installation guide in `docs/windows-installation.md`
  - Resolves Windows SmartScreen warning showstopper

### Documentation
- Added MSIX package to release verification checklist
- Updated release guide with Microsoft Store submission process
- Created comprehensive MSIX technical documentation
- Added Windows installation guide for end users

## [1.1.3] - 2025-01-10

### Changed
- **Code Quality Improvements**: Significant refactoring to improve maintainability (#557)
  - Consolidated JSON conversion helpers to eliminate ~150 lines of duplication across apps
  - Extracted NIPALS algorithm helpers into reusable functions (72% and 54% complexity reduction)
  - Improved testability with comprehensive unit tests for helper functions
  - All changes maintain mathematical correctness and performance
  - Better adherence to DRY and KISS principles from development guidelines

### Documentation
- Optimized intro_to_pca.md illustration images for faster loading (#556)

## [1.1.2] - 2025-01-28

### Added
- Comprehensive test coverage improvements (#553)
  - pkg/csv: 26% → 73.8% coverage with validation and writer tests
  - pkg/security: 50.6% → 85.8% coverage with command, path, and input validation tests
  - pkg/integration: 34.1% → 46.6% coverage with event bus tests
- CSV format tooltip to data table in Step 1 (#547)

### Fixed
- Preserve unselected rows in table after plot selection (#544)
- ReDoS vulnerability in error parsing (#537)
- Z-axis component selector for 3D Biplot visualization (#535)
- LaTeX math duplication by importing ui-components CSS (#534)
- Linter errors in path security tests and output.go

### Changed
- Default coef0 value for polynomial kernel from 0 to 1 (#542)
- Simplified embedded stock dataset for non-traders (#539)
- Removed redundant CSV format text in Step 1 (#548)

## [1.1.1] - 2025-09-25

### Fixed
- Fixed Z-axis component selector missing in 3D Biplot visualization (#535)
- Fixed LaTeX math duplication in UI components by importing CSS correctly (#534)
- Resolved ReDoS vulnerability in ENOENT error parsing (#537)
- Fixed multiple CI/CD configuration issues with golangci-lint v2
- Fixed Wails embed pattern exclusions in linter checks

### Changed
- Simplified embedded stock dataset for better accessibility to non-traders (#539)

### Added
- Experimental non-linear datasets for testing kernel PCA methods

### Documentation
- Updated release guide with lessons learned from v1.1.0 release

## [1.1.0] - 2025-09-23

### Added
- **Temporal PCA (SSA/Time-Delay PCA)**: Complete implementation for time series analysis (#424)
  - Variable Importance Plot for temporal analysis (#502)
  - Biplot support for temporal PCA (#442)
  - SSA documentation and examples (#525, #527)
- **Kernel PCA enhancements**: Additional visualizations and model summary (#483)
- **Validation framework**: sklearn validation tests for mathematical correctness (#460)
- **Shared UI components package**: Modular architecture for frontend components (#453)
- **Stock market datasets**: US technology stocks and enriched market factor data (#514, #475)
- **Privacy audit system**: Comprehensive privacy verification framework (#518)
- **Code quality tools**: golangci-lint integration for Go code analysis (#523)
- **Cross-method validation**: Comprehensive validation between PCA methods (#482)
- **Numerical stability tests**: Tests for algorithm robustness (#463)
- **Error boundaries**: Standardized error handling in frontend (#454)
- **Group coloring in diagnostic plots** (#447)
- **Range syntax for exclusions**: Support for ranges in --exclude-rows/columns (#417)
- **Row index coloring option** for sample visualization (#429)
- **Automatic documentation sync** between main docs and desktop app (#434)

### Fixed
- Font scaling in 3D plot axis labels (#526)
- Color palette control visibility issues (#512)
- Watermark missing in Temporal Variable Importance plot (#510)
- TypeScript/React linting errors (#520)
- 3D plot label display feature (#498)
- File loading in GoPCA Desktop (#494)
- Preprocessing settings when switching from Kernel PCA (#488)
- CLI feedback for variance explained criterion (#478)
- Temporal PCA explained variance display (#476)
- Biplot crash with Kernel PCA (#469)
- Error dialog alignment and overflow (#466)
- sklearn validation test handling (#474)
- CSV loading performance for large datasets (#427)
- Table selection state reset after filtering (#420)

### Changed
- Standardized file dialogs and button naming across apps (#492)
- Removed MET dataset from embedded resources (#490)
- Improved developer documentation structure (#524)
- Enhanced Plotly selection tools in BiPlot and DiagnosticPlot (#445)

### Documentation
- Improved temporal PCA documentation with figures (#527)
- Added SSA/temporal analysis info to README (#525)
- Added PCA literature summaries for reference (#444)
- Fixed markdown table rendering issues (#439)
- Comprehensive frontend code audit and roadmap (#452)

## [1.0.2] - 2025-09-02

### Fixed
- Fixed critical bug where row and column exclusions were not being applied before PCA analysis (#419)
  - Exclusions are now correctly applied to the data matrix before any PCA computations
  - This ensures accurate results when users exclude specific rows or columns from analysis

### Documentation
- Added comprehensive Git workflow documentation (#414)
  - Created detailed guides for the project's Git workflow
  - Helps contributors understand branch strategies and contribution process

## [1.0.1] - 2025-08-31

### Fixed
- Fixed 3D Scores Plot to properly color samples when using target columns (continuous data) (#410)
- Previously only categorical coloring worked; now continuous coloring matches the behavior of 3D Biplot

### Added
- Added missing help text entries for GUI elements in GoPCA Desktop (#411)
  - Added help entries for logo click, documentation button, font size control, 3D plots, and diagnostic threshold
  - Added HelpWrapper components to logo, documentation button, and theme toggle
- Created comprehensive help-content.json for GoCSV Desktop as foundation for future help system implementation
- Created new issue #412 for implementing help system in GoCSV Desktop

### Documentation
- Significantly enhanced CLAUDE.md development guide with:
  - Common Issues & Solutions section
  - Project Structure Quick Reference
  - Release Checklist
  - Performance Optimization Guidelines
  - Security Considerations
  - Testing Strategy
  - Git Aliases
  - MCP Tool Best Practices

## [1.0.0] - 2025-08-31

### Added
- Initial public release of GoPCA Suite
- Three integrated applications:
  - pca CLI for command-line PCA analysis
  - GoPCA Desktop for interactive data exploration
  - GoCSV Desktop for data preparation
- Multiple PCA algorithms: SVD, NIPALS, and Kernel PCA
- Comprehensive preprocessing options
- Rich visualization suite including 2D and 3D plots
- Cross-platform support (Windows, macOS, Linux)
- JSON model export/import capability
- Extensive documentation and help system

[1.3.1]: https://github.com/bitjungle/gopca/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/bitjungle/gopca/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/bitjungle/gopca/compare/v1.1.8...v1.2.0
[1.1.8]: https://github.com/bitjungle/gopca/releases/tag/v1.1.8
[1.1.7]: https://github.com/bitjungle/gopca/releases/tag/v1.1.7
[1.1.6]: https://github.com/bitjungle/gopca/releases/tag/v1.1.6
[1.1.5]: https://github.com/bitjungle/gopca/releases/tag/v1.1.5
[1.1.4]: https://github.com/bitjungle/gopca/releases/tag/v1.1.4
[1.1.3]: https://github.com/bitjungle/gopca/releases/tag/v1.1.3
[1.1.2]: https://github.com/bitjungle/gopca/releases/tag/v1.1.2
[1.1.1]: https://github.com/bitjungle/gopca/releases/tag/v1.1.1
[1.1.0]: https://github.com/bitjungle/gopca/releases/tag/v1.1.0
[1.0.2]: https://github.com/bitjungle/gopca/releases/tag/v1.0.2
[1.0.1]: https://github.com/bitjungle/gopca/releases/tag/v1.0.1
[1.0.0]: https://github.com/bitjungle/gopca/releases/tag/v1.0.0