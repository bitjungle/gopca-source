# Exploring Structure in Data: EEG Eye State Dataset and Temporal PCA

## Background

[Electroencephalography](https://en.wikipedia.org/wiki/Electroencephalography) (EEG) measures electrical activity at the scalp via small electrodes. Each electrode records a voltage signal reflecting the activity of neurons underneath, sampled many times per second.

![How EEG measures brain activity](./eeg_illustration.png)

This dataset contains a 117-second recording from **one subject** using the **Emotiv EPOC headset** (named the "Emotiv EEG Neuroheadset" in the original dataset description), with 14 electrodes placed at positions corresponding to the international 10–20 / 10–10 electrode naming convention:

* Frontal: `AF3`, `F7`, `F3`, `F4`, `F8`, `AF4`
* Central/temporal: `FC5`, `T7`, `T8`, `FC6`
* Parietal/occipital: `P7`, `O1`, `O2`, `P8`

The figure below shows the scalp positions of all 14 electrodes, viewed from above (nose pointing up). The occipital electrodes `O1` and `O2` sit at the bottom — the region most sensitive to visual and alpha-band activity. The electrode coordinates shown are based on the MNE `standard_1020` montage, which provides the best available approximation; the original dataset documentation identifies the 14 channels by name but does not specify explicit coordinates.

![EEG electrode positions](./eeg_illustration_electrode_map.png)

The sampling rate is **128 Hz** — one measurement every 7.8 ms, giving approximately **14,980 rows** in total. During the recording the subject alternately opened and closed his or her eyes. Eye state was determined from video and added as a label:

* `eye_state = open` — eyes open
* `eye_state = closed` — eyes closed

> **Note on data quality**: the recording carries electrode artifacts, and they come in two kinds — which matters, because only the first kind is easy to see.
>
> **Four isolated single-sample excursions**, at approximately t = 7 s, 81 s, 90 s and 103 s. Three are enormous positive spikes: AF4 reaches 715,897 against a channel median of 4,355 (164×), FC5 156×, AF3 72×. The fourth is the opposite — at 103 s, F8 **drops** to 86.7 from a median of 4,603, roughly one fiftieth of normal. An artifact can be a dropout as easily as a spike; both are extreme, and both distort a PCA.
>
> **Short runs of much milder disturbance**, which are far harder to spot. There is one at t ≈ 1.4 s on F8, and a more consequential one at **t ≈ 83.3–83.8 s on P7**, lasting 56 consecutive samples. These are about a thousand times closer to normal than the four spikes, so they survive a scan that catches the obvious ones — and Step 5 shows what one of them does to a Temporal PCA if you let it through.
>
> Keep both kinds in mind when interpreting unexpected structure.

The original research motivation was classification: can EEG alone predict eye state? Here we use PCA — an *unsupervised* method that ignores the labels entirely — to ask: what structure does PCA find on its own, and does it relate to eye state?

---

## This dataset versus the others

In a previous tutorial, the Swiss Roll showed us that the *shape* of the data matters. Here, the challenge is different: the structure is about **time**.

| | Swiss Roll | EEG Eye State |
|---|---|---|
| **What each row is** | One independent data point | One snapshot of an ongoing signal |
| **What PCA sees first** | Geometric shape of the data cloud | Spatial correlations between 14 channels |
| **What PCA misses** | Curved manifold structure | Temporal dynamics and oscillations |
| **The solution** | Kernel PCA | Temporal PCA — give PCA a memory by embedding time |
| **Why standard PCA fails** | Data lies on a curved surface | Shuffling the rows gives *identical* PCA results |

> **The key analogy**: Kernel PCA transforms *space*. Temporal PCA transforms *time*. Both use the same SVD algorithm on a larger, restructured matrix.

Standard PCA treats each row as an independent observation and completely ignores row order. A shuffled EEG dataset gives exactly the same PCA result. This tutorial has two parts: first run standard PCA to see what it finds (and what it misses), then switch to Temporal PCA to reveal the temporal structure.

---

## Step 1: Load the dataset

Click the **EEG Eye State** sample dataset button to load the data (you may have done this already, see the **Loaded data** matrix preview).

The `time` column is used as row identifiers and excluded from the PCA model fitting. The 14 EEG channel columns are the input variables. The `eye_state` column is automatically recognized as categorical and available for plot coloring.


#### Question:

* How many rows and columns does the dataset have?

👉 At 128 Hz, two consecutive rows are only 7.8 ms apart. Brain signals change slowly relative to the sampling rate, so neighboring rows are very similar — the data is far from a collection of independent snapshots.

---

## Step 2: Run standard PCA — scale problem and outliers

In the PCA configuration panel, set:

* **PCA Method** → SVD
* **Preprocessing** → leave at the default (mean centering only) for now

Click **Go PCA**.

Before opening any plots, read the GoPCA warning banner:

> *"Variables have very different scales (40000× difference). Consider standardization unless this is intentional."*

All 14 channels are EEG voltages in microvolts — they should be comparable. The large scale difference comes from brief electrode artifacts and slightly different impedance conditions between channels.

Open the **Loadings Plot (PC1)**.

#### Questions:

* Which channels dominate PC1? Do they look like a genuine signal pattern, or could a few high-variance channels simply be drowning out the rest?

👉 Without scaling, PCA measures *covariance* — channels with higher variance automatically dominate regardless of whether that variance is signal or noise.

### Re-run with Standard Scaling

Change **Preprocessing** to **Standard Scaling**. Click **Go PCA** again and re-open the **Loadings Plot (PC1)**.

#### Questions:

* How does the loading distribution change? Do more channels now contribute meaningfully?
* Do occipital electrodes (`O1`, `O2`) stand out more?

👉 Standard scaling makes PCA measure *correlation* — all channels are treated equally regardless of raw amplitude. For EEG with known scale imbalances this is generally the more informative starting point. The GoPCA warning is your cue to make this choice deliberately.

Now open the **Scores Plot (PC1 vs PC2)** and color by `eye_state`.

The plot will look almost empty — just two or three isolated points with what appears to be a single dot at the origin. **Do not be fooled.** Use the **zoom tool** (box-select or scroll wheel) to zoom into the region near the origin. You will find that the "dot" is in fact a dense cluster of ~14,976 observations squeezed into a tiny area because the axis range is dominated by the extreme outliers far from the center.

#### Questions:

* After zooming in to the origin cluster, can you see the ~14,976 normal time points?
* Hover over the extreme outliers at the edges of the unzoomed plot — what time labels do they carry? Do they match the artifact times mentioned above (~7 s, 81 s, 90 s, 103 s)?

👉 This is **outlier domination**: standard scaling equalizes column variances but does not protect against extreme rows. The four artifact rows have values 70–150× the normal range, so PCA points both PC1 and PC2 towards them — collapsing the remaining ~14,976 normal time points into a tiny cluster near the origin.

| Problem | What it is | Fix |
|---|---|---|
| **Scale imbalance** | Different *variables* have very different variance | Standard scaling (column-wise) |
| **Outlier domination** | A few extreme *observations* dominate the components | Identify with Diagnostic Plot, remove with lasso |

### Identify outliers with the Diagnostic Plot

Open the **Diagnostic Plot**. Two axes:

* **Horizontal — Hotelling's T²**: how far an observation is from the [centroid](https://en.wikipedia.org/wiki/Centroid) — the average position of all the samples — within the PCA model space
* **Vertical — Q-statistic**: how well the model fits the observation (large Q = large residuals)

| Region | T² | Q | Interpretation |
|---|---|---|---|
| Bottom-left | Low | Low | Regular observations |
| Top-left | Low | High | Orthogonal outliers — structure the model cannot represent |
| Bottom-right | High | Low | Good leverage — extreme but on-model |
| Top-right | High | High | Bad outliers — extreme and poorly fitted |

The artifact points should appear in the top-right or far right. The normal ~14,976 time points should cluster in the bottom-left inside both dashed limits.

### Remove outliers with the lasso tool

1. Click the **lasso icon** in the plot toolbar
2. Draw a selection around the extreme outlier points
3. GoPCA will **exclude** them (see e.g. the command line preview to confirm)
4. Click **Go PCA** again

Repeat until all artifact time points are excluded.

#### Questions (after removing outliers):

* How does the Scores Plot change?
* Do `open` and `closed` samples show any visible separation now?
* Is the separation clear, or do the two states still overlap considerably?

👉 Some separation is expected, but with considerable overlap. Standard PCA works only with spatial correlations between channels at each instant — not with temporal dynamics. The main lesson: even clean, well-scaled data may not yield clean class separation when the relevant structure is temporal rather than spatial.

---

## Step 3: What standard PCA cannot see

Standard PCA computes correlations between channels across all rows simultaneously. What it cannot detect:

* **Oscillations**: a 10 Hz [alpha wave](https://en.wikipedia.org/wiki/Alpha_wave) completes one full cycle in 100 ms (~13 consecutive rows). Standard PCA has no way to detect this periodic structure.
* **Delayed relationships**: one channel's activity may predict another's activity a few time steps later. Standard PCA ignores row order entirely.
* **Waveform shape**: EEG events span many consecutive time points. Standard PCA sees only one snapshot at a time.

#### Question:

* If you shuffled the 14,980 rows in random order before running PCA, would the result change? What does this tell you about what standard PCA can and cannot detect?

---

## Step 4: The trajectory matrix

To make PCA sensitive to time, we transform the data using a **sliding window** — the central idea of **[Singular Spectrum Analysis (SSA)](https://en.wikipedia.org/wiki/Singular_spectrum_analysis)** and its [multivariate extension MSSA](https://en.wikipedia.org/wiki/Singular_spectrum_analysis#Multivariate_extension).

Instead of describing each time point as one vector of 14 channel values, we describe it as a short sequence of *L* consecutive time points — a **window**. Each window becomes one row in a **trajectory matrix**:

* Rows: approximately *T* − *L* + 1 (one per window position)
* Columns: 14 channels × *L* lags = 14*L* columns

With *L* = 32 and *T* ≈ 14,976 (after removing the four artifact rows): approximately 14,945 rows and 448 columns. SVD on this larger matrix finds **spatiotemporal patterns** — capturing which channels co-vary and how that co-variation evolves across the window.

> GoPCA implements the first two SSA steps — **embedding** (build the trajectory matrix) and **decomposition** (SVD). The full SSA algorithm also includes grouping and reconstruction, which transform selected components back into the time domain.

### Choosing the window length *L*

The window should cover 2–3 full periods of the oscillation you want to detect. For this dataset, eye closure triggers **alpha activity at ~8–12 Hz** (period 83–125 ms). At 128 Hz, one alpha period is about 11–16 samples:

| Lags | Duration | Notes |
|-----:|--------:|-------|
|    8 |    63 ms | Too short — less than one alpha cycle |
|   16 |   125 ms | Borderline — one short alpha cycle |
|   32 |   250 ms | **Recommended** — 2–3 alpha cycles, readable loadings |
|   64 |   500 ms | Fine, but loadings plot becomes crowded |

> **General rule**: convert the period of the oscillation you want to detect into samples (period in seconds × sampling rate). Set *L* to 2–4 times that value.

> Increasing the lag gives PCA memory. But too much memory can make the model harder to interpret.

---

## Step 5: Switch to Temporal PCA

Change **PCA Method** to **Temporal PCA**. Set **Number of Time Lags** to **32**. Keep **Preprocessing** at **Standard Scaling** — the same scale imbalance affects Temporal PCA, since preprocessing is applied to the original time series before the trajectory matrix is built.

Click **Go PCA**.

GoPCA builds the trajectory matrix (14 × 32 = 448 columns) and applies SVD. The result has approximately 14,945 score rows — one per window position.

Open the **Scores Plot** and color by `eye_state`.

### Reading the scores plot as a trajectory

This is the most important conceptual shift from standard PCA to Temporal PCA.

In standard PCA, each point is an **independent sample** — you look for clusters and class separation. In Temporal PCA, each point is a **moment in time**. Consecutive points are 7.8 ms apart. You are watching the brain's state move through a 2D projection of a high-dimensional state space. **The path is the story.**

**How to read a phase-space trajectory:**

1. **Tight loops** — the trajectory traces small repeated loops: these are oscillations
2. **Long sweeping arms** — the trajectory moves far from the central cluster: a state transition, *or* a stretch of bad recording. The two look alike, and the next section shows why
3. **Dense regions** — where the trajectory spends most time: stable states

**What to expect in this scores plot:**

* A **dense central cluster** holding the great majority of the 14,945 windows
* **One long arm** reaching much further along PC1 than anything else in the plot. PC1 spans roughly −104 to +35, and almost all of that range is taken up by this single excursion
* Small repeated loops inside the dense cluster

#### Questions:

* Can you find the long arm? Roughly how many points does it hold, against the central cluster?
* Hover over the points at the very tip of the arm. What **time labels** do they carry?
* Now color by `eye_state`. Does the arm belong to one eye state and the cluster to the other?

👉 **The arm is not brain activity.** Hover along it and every point at the tip carries a time between **83.2 s and 83.8 s** — 71 windows drawn from the same half-second. (Each point is labeled by the *first* sample of its window, so the label marks where the window starts, not where the disturbance sits inside it.) That is the P7 disturbance described in the data-quality note at the top of this tutorial. It survived the Step 2 cleanup because it is roughly a thousand times milder than the four spikes you removed there, and the trajectory matrix then *smeared* it. A single bad sample sits inside the sliding window for **32** consecutive window positions; this run of 56 samples keeps one inside for 87. A disturbance lasting less than half a second becomes a long, smooth, convincing-looking excursion.

That smearing is worth understanding, because it is specific to Temporal PCA. In standard PCA one bad sample makes one outlying point, which looks like what it is. In Temporal PCA it makes *L* consecutive outlying points that trace a graceful arc — precisely the shape you have been told to read as a state transition.

> **The habit to take from this step**: before reading any story into a dramatic excursion in a Temporal PCA scores plot, hover over it and check *when* it happened. If the points come from one narrow stretch of time, suspect the recording before the brain.

**Where the eye state actually is.** Color by `eye_state` and the two states are thoroughly mixed. Measuring the separation between their means along each component, in units of the pooled standard deviation:

| | PC1 | PC2 | PC3 | PC14 |
|---|---|---|---|---|
| eye-state separation (*d*) | 0.23 | **0.44** | 0.35 | 0.32 |

PC2 does best, and even there *d* = 0.44 leaves the two distributions overlapping across most of their range. PC1 — which holds 53% of the variance — is among the weaker ones.

That is worth sitting with rather than glossing over. Eye state is a real and substantial physiological difference, and Temporal PCA has genuinely found structure here: Steps 6 to 8 will identify a true 10 Hz alpha rhythm and locate it on the scalp. But components are ordered by **variance**, and the variance in this recording is dominated by slow drift and amplitude changes that have little to do with whether the eyes are open. It is the same lesson the Body Measures tutorial teaches with sex: a group difference can be entirely real and still not be what the leading components are about.

> **On alpha suppression.** Opening the eyes really does suppress alpha-band activity across the scalp — that is well-established physiology, and this recording contains it. What it does *not* do is dominate PC1. Look for it where it lives: in the oscillatory pair you will find in Step 7, whose strongest channels are P8, T8 and O2 — the parietal and occipital sites nearest the visual cortex.

> **Note on available plots**: the **Loadings Plot**, **Biplot**, **Circle of Correlations**, and **Diagnostic Plot** are not available for Temporal PCA — they require loadings in the original variable space, which Temporal PCA does not produce directly. The dedicated plots are **Temporal Loadings** and **Variable Importance**.

---

## Step 6: The Temporal Loadings Plot

Open the **Temporal Loadings** plot with **5 components** first, then increase to **20**. Twenty rather than fifteen matters here: the oscillatory pair you will look for in Step 7 sits at PC15 and PC16, and asking for only 15 computes the first of the pair without its partner.

Each curve corresponds to one principal component. The horizontal axis is lag (0 to *L*−1); the vertical axis shows the loading of the most influential channel for that component across the window.

> Each curve is one line per *component* — not one line per EEG channel. For each component, GoPCA finds the single channel with the highest overall loading and plots its signed values across all lags. This preserves sign information, which is essential for reading temporal structure.

**Three patterns to look for:**

| Curve shape | Interpretation |
|---|---|
| **Nearly flat** | Global mean-shift — equal loading at all lags |
| **Monotone ramp or S-shape** | Slow trend or step-response dynamics |
| **Sinusoidal (multiple zero-crossings)** | Oscillatory rhythm |

**With only 5 components, do not expect oscillations.** The top components are dominated by slow eye-state modulation, which generates far more variance than fast rhythms:

* **PC1** (~53% variance): nearly flat — a global mean-shift component. You may see a subtle U-shape; check the y-axis scale. The variation is only a few percent of the absolute loading value, so all lags contribute nearly equally.
* **PC2–PC4**: gently sloped or arched — slow trend components
* **PC5**: may show an S-shape — slow modulation, not yet a true oscillation

> **Why does slow structure dominate?** The eye-state shift lasts several seconds and affects all 14 channels simultaneously — this generates large variance. Alpha oscillations at 10 Hz are faster, more localized, and lower in variance. They are present, but outranked.

Increase **Components** to **20** and click **Go PCA!** again.

#### Frequency from zero-crossings

Count the number of times a curve crosses zero. Each pair of zero-crossings = one complete cycle:

* 2 zero-crossings → 1 cycle → **4 Hz** (theta)
* 4 zero-crossings → 2 cycles → **8 Hz** (alpha lower bound)
* 5–6 zero-crossings → ~2.5 cycles → **~10 Hz** (alpha)
* 10 zero-crossings → 5 cycles → **~20 Hz** (beta)

Curves with many zero-crossings look angular rather than smooth — this is normal at high frequencies where only a few samples exist per cycle.

> **Practical tip**: when a 20-component plot looks overwhelming, use the Plotly legend. **Click a component name to hide it; double-click to show only that one.** Add others back one by one.

#### Questions:

* Does PC1 appear nearly flat? (Check the y-axis scale — a U-shaped curve can still be "nearly flat" if the variation is small relative to the mean loading.)
* Looking at components 13–15, can you identify any that cross zero multiple times?
* Count the zero-crossings on the most rapidly oscillating curve — what frequency does this imply?

---

## Step 7: Paired components

A fundamental property of SSA is that **oscillatory signals produce pairs of components** (Vautard & Ghil, 1989). SSA extracts two components per oscillation: one resembling a sine wave and one a cosine wave, offset by exactly one quarter of the period (90°). Neither component alone gives the full picture — together they encode one complete oscillation.

Below PC6, many components have nearly equal variance, far too many to identify specific pairs visually from bar heights alone.

**Use the Temporal Loadings and Explained Variance panel, in this order:**

1. **Temporal Loadings (primary)**: open the plot with 20 components. Scan the curves for **sinusoidal shapes** — curves that cross zero multiple times and look like a sine wave. A monotone ramp or arch is *not* an oscillatory component, regardless of its variance.
2. **Explained Variance panel (supporting check)**: once you find a sinusoidal curve, read off its % variance from the panel (or the legend). Check whether the immediately adjacent component (the one above or below it in the ranking) has nearly the same % variance.
3. **Confirm with 90° phase shift**: in the Temporal Loadings, isolate the two candidate curves (double-click to show one, then single-click the other). A true pair shows the **same frequency** but with one curve shifted approximately one quarter-cycle — one peaks where the other crosses zero.

> Equal variance alone is not sufficient. Two unrelated components can share the same variance by coincidence. The definitive test is always the shape of the temporal loading curves.

**What to look for with 20 components:**

* **PC1** (~53%): flat — global mean
* **PC2–PC14** (declining from ~12% to ~0.6%): slow structure — ramps, arches, bowls, and S-shapes with no or very few zero-crossings
* **PC15 (~0.6%) and its neighbor**: the first clearly sinusoidal curve appears around this rank — ~2.5 cycles over 32 lags, corresponding to ~10 Hz (alpha band). The paired component should appear at a similar % variance with the same frequency but ~90° phase-shifted.

#### Questions:

* In the Temporal Loadings plot, which is the first component whose curve clearly oscillates (multiple zero-crossings)?
* Read its % variance from the Explained Variance panel. Does the adjacent component have nearly the same value?
* Isolate the two candidate curves in the Temporal Loadings. Are they the same frequency and ~90° phase-shifted?
* What frequency does this pair correspond to?

👉 A 10 Hz alpha wave has a period of ~12.8 samples at 128 Hz. Over 32 lags you see ~2.5 complete cycles — enough for the sinusoidal pattern to be clearly visible.

---

## Step 8: Variable Importance

Open the **Variable Importance** plot.

This heatmap shows the RMS loading of each EEG channel aggregated across all lags, for each component. It answers the question the Temporal Loadings plot cannot: *which channels* drive each component.

> **Temporal Loadings** tells you the *temporal shape* of each component. **Variable Importance** tells you *where on the scalp* it originates. Together they give the full spatiotemporal picture.

#### Questions:

* Look at PC1: do any channels stand out as clearly brighter than the rest, or are all channels nearly equally loaded? What does that tell you about the nature of PC1?
* Scan down the rows (higher-ranked components). Is there any component where a **single channel** is dramatically brighter than all others — a bright isolated cell that stands out from its row? Which channel is it, and which component? Does its location on the scalp match any physiological expectation?
* For the oscillatory pair you identified in Step 7: do the two paired components show the **same spatial pattern** of channel importance? (They should — they represent the same oscillation, just phase-shifted in time, so the same channels must drive both.)
* Is there a clear difference between the channel patterns of the slow-structure components (PC2–PC10) and any oscillatory components?

👉 PC1's nearly uniform row confirms it is a global component — its brightest channel (F4) is only **1.9×** its dimmest, so no single brain region is specifically responsible.

The isolated bright cell is on **PC4, at `O1`**, which outweighs the next channel by **3.9×** — the most single-channel-dominated component in the set by a wide margin. `O1` is an occipital electrode, sitting over the visual cortex, which is exactly where you would expect a component that no other site shares.

For the Step 7 pair, the two rows should look like copies of each other, and they do: `P8` brightest in both, then `T8`, then `O2`, with a correlation of **0.99** between the two channel-importance profiles. Those are the parietal and occipital sites nearest the visual cortex — the right place for an alpha rhythm to originate. Two components that share a spatial pattern this closely while differing by a quarter-cycle in time are the same oscillation seen twice, which is the SSA signature you were looking for.

---

## Step 9: Experiment with window length

Change **Number of Time Lags** and observe how the results shift. Try these values:

* **8 lags** → 63 ms — less than one alpha cycle
* **16 lags** → 125 ms — about one alpha cycle
* **32 lags** → 250 ms — recommended: 2–3 alpha cycles
* **64 lags** → 500 ms — more temporal context, wider trajectory matrix

After each change, click **Go PCA** and look at the **Scores Plot** and the **Explained Variance** panel.

**What to expect as L increases:**

* **Scores plot**: the trajectory becomes visually richer as *L* grows — but read the richness carefully. At L=8 the plot is a diffuse cloud with sparse arms, barely trajectory-like. At L=16 loops begin to appear. At L=32 the looping structure is clear. At L=64 the plot develops a striking fan of long thin blades radiating from a dense core, insect-like at a glance.

  **Those blades are Step 5's lesson magnified.** At L=64 the outermost 0.1% of points come *entirely* from t ≈ 83 s, and the outermost 1% is dominated by two short intervals — roughly 83–84 s and 91–92 s. A longer window keeps each disturbance inside the sliding frame for more consecutive positions, so **growing *L* makes artifacts more prominent, not less**: the same excursion is drawn 64 windows long instead of 32. The 14,913 ordinary windows are all in the dense core.
* **PC1 explained variance**: decreases as L grows (roughly 56% → 55% → 53% → 50%). Longer windows capture more oscillatory variance in later components, so PC1's share of the total decreases.
* **Trajectory matrix**: grows wider with L (14 × L columns). The Scores Plot does not become harder to read, but the **Temporal Loadings** plot becomes more crowded and harder to interpret at high L values.

#### Questions:

* At L=8, does the scores plot look like a clear trajectory, or more like a diffuse cloud?
* At L=16, can you see the beginning of looping structure in the dense cluster?
* At L=64, hover over the tips of the longest blades. How many *distinct* moments in the recording do they come from?
* Compare L=32 and L=64: the L=64 plot is richer, but is it more or less interpretable than L=32 for understanding eye-state dynamics?
* How does PC1's explained variance change as L increases? What does this tell you about how variance is redistributed across components?

👉 A short window cannot see a full oscillation cycle — components reflect adjacent-sample correlations rather than meaningful rhythms. A longer window gives PCA more temporal context, and both plots change in ways worth separating.

The **Temporal Loadings** plot simply gets more crowded: more components, each drawn across more lags. That is a legibility problem and no more.

The **Scores Plot** changes in a way that is easy to misread. Its most eye-catching features grow with *L* — but so does the smearing, and the two are the same thing. A handful of brief disturbances end up drawn as long, elaborate blades, while the 14,913 ordinary windows stay packed in the core. A richer-looking plot is not necessarily a more informative one, and here the extra richness is mostly a few seconds of bad recording, stretched.

---

# What you should take away

After this exploration, you should be able to:

* Explain why EEG is a multivariate time series and why rows are not independent samples
* Diagnose a scale problem from the GoPCA warning and fix it with Standard Scaling
* Identify and remove extreme outliers using the Diagnostic Plot and lasso tool — and recognize that milder artifacts survive a cleanup aimed at the obvious ones
* Explain the SSA embedding step: sliding windows, trajectory matrix, window length *L*
* **Recognize a smeared artifact in a Temporal PCA scores plot** — a brief disturbance is stretched across *L* consecutive windows and arrives looking like a smooth state transition, so check *when* a dramatic excursion happened before deciding what it means
* Interpret the Temporal Loadings plot: one curve per component showing the dominant channel's signed temporal eigenvector — not one curve per channel
* Recognize the three curve types: flat (global), monotone (slow trend), sinusoidal (oscillation)
* Estimate oscillation frequency from the number of zero-crossings
* Identify **paired oscillatory components** using the Temporal Loadings (sinusoidal shape, 90° phase shift) and the Explained Variance panel (nearly equal % for adjacent components)
* Use **Variable Importance** to identify which channels drive each component, and verify that paired components share the same spatial pattern

---

## Final Reflection

> Standard PCA treats the EEG table as a collection of independent snapshots. Temporal PCA, by embedding the data into sliding windows, gives PCA access to *sequences* — and the resulting components represent oscillations and temporal dynamics rather than just spatial correlations. The same SVD algorithm is used in both cases; the embedding step is what makes the difference.
>
> In SSA, oscillatory signals leave a characteristic fingerprint: a pair of components with equal singular values, 90°-phase-shifted temporal eigenvectors, and the same spatial pattern of channel importance. Learning to recognize this fingerprint is the core skill of temporal dimensionality reduction.

#### Questions:

* The SSA algorithm has four steps: embedding, decomposition, grouping, and reconstruction. GoPCA implements the first two. What would you gain from grouping and reconstruction — and what tasks would those enable?
* Could the Temporal PCA scores be used as input features to a classifier predicting `eye_state`? What might be the advantage compared to using the raw EEG values?

---

## References

Broomhead, D. S., & King, G. P. (1986). Extracting qualitative dynamics from experimental data. *Physica D: Nonlinear Phenomena*, 20(2–3), 217–236. https://doi.org/10.1016/0167-2789(86)90031-X

Vautard, R., & Ghil, M. (1989). Singular spectrum analysis in nonlinear dynamics, with applications to paleoclimatic time series. *Physica D: Nonlinear Phenomena*, 35(3), 395–424. https://doi.org/10.1016/0167-2789(89)90077-8

Ghil, M., Allen, M. R., Dettinger, M. D., Ide, K., Kondrashov, D., Mann, M. E., Robertson, A. W., Saunders, A., Tian, Y., Varadi, F., & Yiou, P. (2002). Advanced spectral methods for climatic time series. *Reviews of Geophysics*, 40(1), 1003. https://doi.org/10.1029/2000RG000092

Golyandina, N., Korobeynikov, A., Shlemov, A., & Usevich, K. (2015). Multivariate and 2D extensions of singular spectrum analysis with the Rssa package. *Journal of Statistical Software*, 67(2), 1–78. https://doi.org/10.18637/jss.v067.i02

Golyandina, N. (2020). Particularities and commonalities of singular spectrum analysis as a method of time series analysis and signal processing. *WIREs Computational Statistics*, 12(4), e1487. https://doi.org/10.1002/wics.1487

Roesler, O., & Suendermann, D. (2013). A first step towards eye state prediction using EEG. In *Proceedings of the AIHLS 2013*. UCI Machine Learning Repository. https://doi.org/10.24432/C57G7J

Alghamdi, A., Nilashi, M., Abumalloh, R. A., Ahmadi, H., Alrizq, M., Alyami, S., Zogaan, W. A., & Nayer, F. K. (2026). Accuracy improvements for electroencephalography (EEG) eye state classification using eXtreme gradient boosting and cluster ensembles. *Journal on Advances in Signal Processing*, 2026, 20. https://doi.org/10.1186/s13634-025-01290-z
