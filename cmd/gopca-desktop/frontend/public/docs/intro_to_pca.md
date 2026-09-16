# An Introduction to Principal Component Analysis (PCA) with GoPCA

## 1. Introduction: The Need for Simpler Data

If you've ever felt overwhelmed by complex datasets with dozens or even hundreds of variables, you're not alone. This guide will show you how Principal Component Analysis (PCA) can help you make sense of complex data.

Consider these scenarios: You're a wine researcher with 178 Italian wines from three different cultivars, each analyzed for 13 chemical properties. Or perhaps you're monitoring a manufacturing plant with hundreds of sensors recording temperature, pressure, flow rates, and vibrations every second. Maybe you're studying gene expression with thousands of measurements per sample. How do you make sense of all this information? How do you find the patterns hidden in the numbers?

![Wine and sensors](images/intro_to_pca_fig_01-01.jpg)

This is where **Principal Component Analysis (PCA)** becomes invaluable. Think of PCA as a sophisticated lens that helps you see through the complexity to find the essential patterns in your data. Just as a photographer might use different lenses or angles to capture the essence of a scene, PCA helps you capture the essence of your data by focusing on what matters most.

PCA has stood the test of time. **Developed over a century ago by Karl Pearson (1901) and later refined by Harold Hotelling (1933)**, PCA remains one of the most widely used techniques in modern data science. From movie streaming recommendation systems to climate science, from quality control in manufacturing to discoveries in genomics, PCA is everywhere. It's mathematically elegant, computationally efficient, and remarkably effective at revealing hidden structure in complex data.

The **GoPCA Suite** brings this powerful technique to your fingertips with a focused, professional-grade implementation. Whether you prefer the efficiency of command-line tools (pca CLI) for automation and reproducible research, or the intuitive visual exploration of GoPCA Desktop, our tools make PCA both accessible and practical.

GoPCA is designed to serve two roles simultaneously — and it does not compromise on either:

* **A learning tool:** GoPCA ships with seven carefully chosen sample datasets spanning biology, chemistry, spectroscopy, chemical engineering, neuroscience, and public health. Each dataset comes with a step-by-step interactive tutorial that teaches both PCA concepts and how to use the software. You can go from zero to a complete multivariate analysis — including data diagnostics, outlier removal, and interpretation — without leaving the application. The tutorials are not toy examples; they are real datasets with real challenges, selected precisely because they expose the situations you will encounter in your own work.

* **A professional analysis tool:** The same application you use to learn is the one you use on your own data. Load your CSV, configure your preprocessing, choose your method (standard SVD, NIPALS, Kernel PCA, or Temporal PCA), and export your model. There are no artificial limits, no watermarks, and no features locked behind a tutorial mode. When you are ready to analyse your own datasets, GoPCA is ready too.

> **Interactive Tutorials:**  
> GoPCA Desktop includes guided interactive tutorials for seven carefully chosen sample datasets. Each tutorial walks you through a complete analysis, explains what to look for, and teaches you a specific aspect of PCA or data analysis. This introduction gives you the conceptual foundation; the tutorials give you the hands-on experience. Look for the **Open Tutorial** button next to each sample dataset in GoPCA Desktop.

> **Note on Data Preparation:**  
> Before performing PCA, your data should be properly cleaned and structured. If you're starting with raw data that contains missing values, outliers, or quality issues, consider using **GoCSV Desktop** for data preparation. See our companion guide *"Data Preparation with GoCSV Desktop"* for detailed guidance on getting your data ready for analysis.

---

## 2. What is PCA? Understanding the Core Concept

Let's start with an analogy that makes PCA intuitive. Imagine you're a photographer trying to capture the essence of a bustling city square. You could take hundreds of photos, but most would show similar things from slightly different perspectives. Instead, a skilled photographer knows to find the few key vantage points that capture the most important aspects: one showing the grand architecture, another revealing the flow of people, perhaps a third highlighting the interplay of light and shadow. These few carefully chosen perspectives tell the complete story more effectively than hundreds of redundant shots.

![You're a photographer](images/intro_to_pca_fig_02-01.jpg)

PCA does something remarkably similar with your data. When you have many variables describing your samples, PCA finds the "best vantage points" called **principal components (PCs)** that capture the most important patterns in your data. Just as those key photos summarize the city square, principal components summarize your complex dataset.

Principal Component Analysis is a **dimensionality reduction** technique that transforms your original variables into a new set of uncorrelated variables called principal components. These components are special because:

* **They're ordered by importance:** The first principal component (PC1) captures the most variation in your data, PC2 captures the second-most (while being completely uncorrelated with PC1), and so on.

* **They're efficient:** Often, just 2–3 principal components can capture 80–90% of the information contained in dozens of original variables.

* **They're interpretable:** Each PC is a weighted combination of your original variables, revealing what aspects of your data each component represents.

To make "a weighted combination of your original variables" concrete: you already rely on combined measurements every day. **Body Mass Index (BMI)** — weight divided by height squared — folds two measurements into a single number that summarizes body build. Someone designed that formula by hand. PCA automates the same idea of compressing several measurements into one informative number, with one twist: the combinations PCA builds are **weighted sums** (linear blends) that it *learns* from the data, rather than a fixed formula handed down by an expert.

Without diving too deep into the mathematics (we'll explore that later for those interested), PCA essentially rotates your data's coordinate system to align with the directions of maximum variation. It's like turning a tilted oval until it lies flat along the x-axis: suddenly, the main pattern becomes crystal clear.

![Dimensionality reduction](images/intro_to_pca_fig_02-02.jpg)

By reducing complexity while preserving information, PCA enables you to:
- **Visualize high-dimensional data** in 2D or 3D plots that your brain can actually comprehend
- **Identify hidden patterns** that would be invisible when looking at variables individually
- **Remove noise** by focusing on the dominant patterns and ignoring minor variations
- **Prepare data** for further analysis, making subsequent statistical or machine learning methods more effective

---

## 3. Motivation and Intuition: Why Use PCA?

Modern data challenges often involve datasets with dozens, hundreds, or even thousands of variables. This complexity creates both computational and interpretational hurdles that PCA elegantly addresses. By transforming your data into a new coordinate system that highlights the most important patterns, PCA turns overwhelming complexity into manageable insight.

![The Curse of Dimensionality](images/intro_to_pca_fig_03-01.jpg)

As the number of variables grows, data analysis quickly becomes unwieldy. With just 10 variables, there are already 45 possible pairwise scatterplots; with 100 variables, that number explodes to 4,950. Interpreting all of these possible relationships is simply impossible. And beyond visualization, high-dimensional data suffers from what's known as the **curse of dimensionality**: distances and densities become less meaningful, making statistical modeling and machine learning less reliable.

Compounding the problem, many real-world variables are correlated. In wine chemistry, for instance, high ethanol often goes hand-in-hand with high glycerol. In genomics, groups of genes are co-regulated. This redundancy inflates the apparent complexity of the data without adding new information.

PCA addresses these challenges head-on. It finds new variables — principal components — that capture the directions of greatest variation in the data. These components combine correlated variables into single, more informative dimensions, stripping away redundancy and focusing attention on what really matters. Often just a handful of components explain most of the variation across dozens or even hundreds of variables.

The benefits are immediate and tangible. A simple plot of the first two principal components can reveal clusters, trends, or groupings that would be invisible in the raw variables. PCA also prepares your data for downstream tasks. Whether you're running regressions, building classification models, or clustering samples, working in a reduced set of principal components often leads to models that are faster, less noisy, and more interpretable. That last use has a name — Principal Component Regression — and Section 12 shows how it can also tell you something about the PCA itself.

---

## 4. Seven Datasets, Seven Lessons

GoPCA Desktop ships with seven carefully selected sample datasets. Together they cover the most important situations you will encounter in practice — from a clean textbook case to spectroscopic data to a nonlinear manifold to a time series from a chemical reactor to a real population health survey. Each dataset teaches a specific lesson about data, preprocessing, and the choice of PCA method. This section introduces all seven. The interactive tutorials in GoPCA Desktop go deeper into each one.

![Wine Analysis Walkthrough](images/intro_to_pca_fig_04-01.jpg)

---

### Dataset 1: Iris — Learning to See Clusters

**The data:** 150 flower measurements from three species of iris (*Setosa*, *Versicolor*, and *Virginica*). Four variables: sepal length, sepal width, petal length, and petal width. Measured by the botanist Edgar Anderson and made famous by Ronald Fisher's 1936 paper on discriminant analysis — still one of the most widely used teaching datasets in statistics.

**Why it is special:** The dataset is clean, well-behaved, and small enough to understand completely. The three species form partially overlapping groups that become clearly separated in PCA space — making it a perfect first experience of PCA doing something useful.

**What you will learn:**
- How to load data and run a basic PCA in GoPCA Desktop
- How to read a Scores Plot: what clusters mean, what distances mean
- How to read a Loadings Plot: which variables drive the separation
- How to use the Scree Plot to decide how many components to keep
- Why the first two components are usually enough for visualization

**Preprocessing:** Mean centering is standard. Standard scaling is worth trying — it changes the result because the four measurements have different units and ranges, and comparing scaled vs. unscaled teaches you exactly what scaling does.

**PCA method:** Standard SVD. No special methods needed — this is the cleanest possible starting point.

> **→ Open the Iris tutorial in GoPCA Desktop** to work through this analysis step by step.

---

### Dataset 2: Wine — Variable Importance and Chemical Fingerprints

**The data:** 178 Italian wines from three grape cultivars (Barolo, Grignolino, Barbera), each analyzed for 13 chemical properties including alcohol, phenols, flavanoids, color intensity, and proline. Originally collected by Forina and colleagues (1986) to support wine authentication by objective chemical analysis.

**Why it is special:** Thirteen correlated chemical measurements, three cultivars, and a real-world motivation (detecting adulteration). The dataset shows how PCA handles correlated variables and reveals chemical fingerprints that distinguish the three cultivars — something no single measurement could do alone. The Biplot and Circle of Correlations become genuinely informative here.

**What you will learn:**
- Why standard scaling is important when variables have very different units and ranges
- How to read a Biplot: samples and variables on the same plot
- How to identify which variables are correlated by looking at their loading vectors
- What it means when a loading is near zero vs. near ±1
- How PCA supports authentication: wines with unusual chemical profiles appear as outliers

**Preprocessing:** Standard scaling (zero mean, unit variance) is essential here — proline ranges from 278 to 1680 mg/L while nonflavanoid phenols range from 0.13 to 0.66. Their standard deviations differ by a factor of roughly 2,500. Without scaling, proline dominates purely because of its larger numbers.

**PCA method:** Standard SVD. A clean example of correlation PCA at work.

> **→ Open the Wine tutorial in GoPCA Desktop** to explore chemical fingerprinting with PCA.

---

### Dataset 3: Corn NIR — Preprocessing for Spectroscopic Data

**The data:** 80 corn samples measured on near-infrared (NIR) spectrometers across 700 wavelength channels (1100–2498 nm at 2 nm intervals). Four composition values are also available for each sample: moisture, oil, protein, and starch.

**Why it is special:** This dataset represents a fundamentally different challenge from Iris and Wine: it has **700 variables and only 80 samples** — far more variables than observations. This is normal in spectroscopy. What is also normal is that NIR spectra are affected by physical effects (particle size, packing density) that cause the entire spectrum to shift up or down for a sample — a phenomenon called **multiplicative scatter**. These physical effects have nothing to do with the chemical composition and will dominate a naive PCA.

**What you will learn:**
- How to handle high-dimensional data (far more variables than samples)
- What multiplicative scatter looks like in a scores plot and why it is a problem
- How **SNV (Standard Normal Variate)** preprocessing removes scatter artifacts by normalizing each spectrum row-wise
- That the choice of preprocessing can completely change what PCA finds
- How PCA enables calibration: the scores from a spectral PCA are excellent inputs for predicting composition values — and the four `#target` columns let you try it directly (Section 12). Those four are genuine outcomes: moisture, oil, protein and starch are quantities you would measure in a laboratory and would rather predict from a spectrum

**Preprocessing:** SNV is the key step here, applied before mean centering. The tutorial walks you through what the data looks like without SNV (a single scatter artifact dominates PC1) and then with SNV (genuine compositional variation becomes visible).

**PCA method:** Standard SVD. The lesson is entirely about preprocessing — the algorithm itself is unchanged.

> **→ Open the Corn tutorial in GoPCA Desktop** to see how preprocessing transforms the analysis.

---

### Dataset 4: Swiss Roll — When Standard PCA Is Not Enough

**The data:** 1,000 synthetic data points in three dimensions, arranged on a two-dimensional surface that has been rolled up like a Swiss roll pastry. Each point has three coordinates (x, y, z) and a special column `color #target` indicating position along the roll. Columns ending in `#target` are excluded from the PCA calculation and used only for colouring plots — a GoPCA convention for attaching external information to a dataset without influencing the analysis. A companion suffix, `#category`, does the same for columns whose numbers are labels rather than quantities. See the [GoPCA Data Format Guide](data-format.md) for both.

**Why it is special:** This dataset has no noise problem, no scale problem, and no outlier problem — and yet standard PCA completely fails to reveal its structure. The reason is geometric: the data lives on a curved surface, and PCA can only find flat (linear) projections. When you project a Swiss roll onto a flat plane, the two ends of the roll overlap. The underlying two-dimensional structure — which is completely real — is invisible to standard PCA. This is the clearest possible demonstration of PCA's fundamental limitation.

**What you will learn:**
- What "nonlinear structure" means geometrically, and why linear PCA cannot see it
- How **Kernel PCA** maps the data into a higher-dimensional space where curved structure can become flat
- What the RBF (Radial Basis Function) kernel does and how the gamma parameter controls it
- Why a nonlinear method is not automatically an improvement: the kernel encodes an assumption about what "similar" means, and the Swiss Roll is built to violate it
- That a tidy, orderly scores plot can still be the wrong answer — one of the most useful habits this suite can teach you

**Preprocessing:** No centering or scaling — Kernel PCA handles the geometry internally.

**PCA method:** Kernel PCA with the RBF kernel. The tutorial has you compare it against standard SVD directly. Be warned that the result is not the tidy victory you might expect: the RBF kernel measures straight-line distance, which is precisely the misleading quantity on a rolled-up sheet, so no setting of gamma unrolls it. Working out *why* is the point of the exercise.

> **→ Open the Swiss Roll tutorial in GoPCA Desktop** to see standard PCA fail — and to find out why reaching for a more powerful method does not always fix it.

---

### Dataset 5: CSTR — Time Series from a Chemical Process

**The data:** 801 simulated sensor readings from a non-isothermal Continuous Stirred-Tank Reactor (CSTR) running an exothermic first-order reaction A→B, sampled every minute over 800 minutes. Twelve process variables are recorded: reactor temperature, coolant outlet temperature, feed temperature, reactant and product concentrations, feed flow rate, feed concentration, cooling duty, reaction rate, conversion fraction, heat-transfer coefficient, and residence time. The simulation passes through six distinct operating phases — normal operation, two feed disturbances, a periodic flow oscillation (40-minute period), a cooling fault, and recovery.

**Why it is special:** Process data from a reactor is fundamentally different from independent samples like Iris or Wine — every measurement is connected to the previous one through the physics of the reactor. The energy and mass balances couple the variables to each other with time delays (thermal inertia, residence time, controller response), and the dataset contains both slow trends and a periodic oscillation designed to be identified by Temporal PCA. The cooling fault scenario makes the dataset directly relevant to industrial process monitoring and fault detection.

**What you will learn:**
- How to compare ordinary PCA to Temporal PCA, and what the lag window adds
- How to read PCA scores as a **process trajectory**: stable clusters, step jumps, loops from oscillations, and drift from faults
- How temporal loading curves reveal **delayed coupling** between variables (e.g. coolant temperature changes before reactor temperature responds)
- How to identify an SSA **oscillatory pair** from the shape of temporal loading curves — sinusoidal and ~90° phase-shifted — and why similar explained variance alone is not a reliable criterion
- How to select the lag parameter L based on process time constants
- How Temporal PCA can detect process faults by showing the reactor leaving its normal operating region

**Preprocessing:** Standard scaling is essential — temperatures, concentrations, and flow rates have completely different units and magnitudes. The tutorial starts with unscaled results so you can see the distortion directly.

**PCA method:** Temporal PCA. The tutorial compares an ordinary SVD baseline against L = 5, 10 and 40 to show how the lag window controls which dynamics become visible. L = 40 is needed to resolve the 40-minute flow oscillation as a recognisable sine/cosine pair.

> **→ Open the CSTR tutorial in GoPCA Desktop** to explore process dynamics and fault detection with Temporal PCA.

---

### Dataset 6: EEG Eye State — PCA for Brain Signals

**The data:** 14,980 EEG measurements from a single subject wearing a 14-electrode headset, recorded at 128 Hz over 117 seconds. During the recording, the subject alternately opened and closed their eyes. Each row is one time point; each column is one EEG channel. The eye-state label (open/closed) is included.

**Why it is special:** This dataset breaks a fundamental assumption of standard PCA — that observations are independent. Every row is a snapshot of an ongoing brain signal: row 500 and row 501 are only 7.8 ms apart, and the brain was doing nearly the same thing at both moments. Shuffling the rows would give identical standard PCA results, which proves that standard PCA completely ignores temporal order. But the most scientifically interesting structure in EEG — oscillations, brain rhythms, the eye-state transition — is *entirely* in the temporal order.

**What you will learn:**
- Why time series data requires a different approach than independent samples
- How **Temporal PCA** (based on Singular Spectrum Analysis) gives PCA a memory by building a trajectory matrix from sliding windows
- How to read PCA scores as a **phase-space trajectory** rather than a sample cloud
- How to recognize oscillatory components in the **Temporal Loadings** plot from their sinusoidal shape — and why similar explained variance alone is not sufficient to identify a pair
- What alpha suppression looks like in PCA space (eyes-open brain state)

**Preprocessing:** Standard scaling, applied to the original 14 channels *before* building the trajectory matrix. The tutorial explains exactly why and what happens if you skip it.

**PCA method:** Temporal PCA with 32 time lags (250 ms window). The tutorial explains how to choose the window length based on the signal frequencies you want to detect.

> **Note for students without an EEG background:** EEG signals and brain rhythms (alpha, beta, theta waves) are a specialist topic. If the neuroscience context is unfamiliar, the tutorial is still valuable for learning Temporal PCA — but you may want to read a brief introduction to EEG before working through Steps 6 and 7. The CSTR dataset (Dataset 5) covers the same Temporal PCA concepts in a chemical engineering context that may be more accessible if you come from a natural science or engineering background.

> **→ Open the EEG Eye State tutorial in GoPCA Desktop** to explore brain dynamics with Temporal PCA.

---

### Dataset 7: Body Measures — What the Components Mean

**The data:** Seven body measurements from 5,096 US adults in the 2017–2018 National Health and Nutrition Examination Survey (NHANES): weight, height, upper leg length, upper arm length, and arm, waist, and hip circumferences. Unlike the curated benchmarks above, this is a slice of a real population survey.

**Why it is special:** Iris and Wine were about separating *known groups*. Body Measures has no natural classes — instead, the interesting question is what the components themselves *mean*. Because every body measurement grows with overall size, PCA hands you two remarkably interpretable axes: **PC1 (~60% of the variance) is an overall "size" factor** — all seven loadings share the same sign, so moving along it makes a person larger or smaller in every dimension at once — and **PC2 (~29%) is a "shape" factor** that contrasts stature (height, limb lengths) against girth (waist, hip, arm circumference). Together they capture about 88% of the variation in a clean 2D picture.

**What you will learn:**
- How a principal component can be an *interpretable factor* (size, shape), not just an abstract axis
- Why a set of positively correlated measurements always yields a first component with same-sign loadings — a general "size" component
- How to tell a *shift between overlapping groups* (men and women differ along the shape axis but overlap heavily) from the clean cluster separation seen in Iris
- That PCA finds the directions of greatest variance, which need not line up with any variable you care about (colouring by age reveals almost no structure)

**Preprocessing:** Standard scaling is essential — weight is in kilograms while the lengths and circumferences are in centimetres, and weight's numerical variance is roughly 60× that of arm length. Without scaling, weight and the largest girths dominate; with it, the size-and-shape structure emerges cleanly.

**PCA method:** Standard SVD. The lesson is about *interpretation* — reading meaning into the components — rather than a new algorithm.

> **→ Open the Body Measures tutorial in GoPCA Desktop** to see how PCA separates body size from body shape.

---

### The Seven Datasets at a Glance

| Dataset | Domain | Variables | Key lesson | Preprocessing | Method |
|---|---|---|---|---|---|
| **Iris** | Biology | 4 | Reading scores and loadings | Mean centering ± scaling | SVD |
| **Wine** | Chemistry | 13 | Variable importance, biplot | Standard scaling | SVD |
| **Corn NIR** | Spectroscopy | 700 | Preprocessing for spectra (SNV) | SNV + centering | SVD |
| **Swiss Roll** | Synthetic | 3 | Nonlinear structure | None | Kernel PCA |
| **CSTR** | Chemical engineering | 12 (×time) | Process dynamics, fault detection | Standard scaling | Temporal PCA |
| **EEG Eye State** | Neuroscience | 14 (×time) | Brain rhythms, phase-space trajectories | Standard scaling | Temporal PCA |
| **Body Measures** | Public health | 7 | Interpreting components (size vs shape) | Standard scaling | SVD |

---

## 5. How Does PCA Work? A Step-by-Step Guide

Now that you've seen PCA in action with our sample datasets, let's peek under the hood to understand the elegant mathematics that makes it work. Don't worry if math isn't your forte: we'll build understanding step by step, connecting each concept to practical intuition.

![A Step-by-Step Guide](images/intro_to_pca_fig_05-01.jpg)

PCA transforms your data through six key steps: organizing your data, preprocessing it to ensure fair comparisons, finding relationships between variables, discovering the best new viewing angles, transforming to this new perspective, and deciding how much to keep. Each step has a clear purpose and builds on the previous one.

### Step 1: Organize Your Data Matrix

Start by organizing your data into a matrix **X**. Think of this as a spreadsheet where:
- Each row represents a sample (a wine bottle, a patient, a time point)
- Each column represents a variable (alcohol content, pH, temperature)
- If you have *n* samples and *p* variables, **X** is an *n × p* matrix

For the Iris example: 150 rows (flowers) × 4 columns (measurements) = a 150 × 4 matrix. For the Corn NIR dataset: 80 rows × 700 columns — far more variables than samples, a situation PCA handles naturally.

![Our data matrix](images/intro_to_pca_fig_05-02.jpg)

### Step 2: Preprocess Your Data

**Why Preprocessing Matters:**
Raw data rarely tells the full story. Variables measured in different units (mg/L vs pH) or with different ranges can bias your analysis. Preprocessing levels the playing field.

**Centering (Essential):**  
PCA requires **centered** data. By subtracting a reference value from each variable, you shift your data cloud to the origin — this ensures PCA finds the directions of genuine variation rather than being pulled toward arbitrary baseline levels. The standard approach subtracts each variable's **mean**. When your data contains outliers, the **median** is a more reliable choice, since a single extreme value can shift the mean substantially without changing the median at all.

**Scaling (Often Critical):**  
When variables have different units or ranges, **scaling** prevents variables with larger numbers from dominating. Consider two of the wine dataset's 13 measurements:
- Proline: ranges from 278 to 1680 mg/L
- Nonflavanoid phenols: ranges from 0.13 to 0.66

Without scaling, proline would dominate the analysis simply due to its larger numbers — it contributes about six million times more variance than nonflavanoid phenols, purely as an accident of the units each was reported in.

> **Decision Guide:**
> - **Always center** your data (PCA will not work properly without it)
> - **Scale with Standard Scaling when:** Variables have different units or vastly different ranges, and you have no extreme outliers
> - **Scale with Robust Scaling when:** Variables have different units or ranges *and* your data contains outliers that are genuine measurements — not errors — that you want to include without letting them distort the analysis
> - **Don't scale when:** All variables are in the same units and scale differences carry scientific meaning

**Advanced Preprocessing Options in GoPCA Suite:**

Beyond basic centering and scaling, GoPCA Suite offers specialized preprocessing methods:

1. **Standard Preprocessing:**
   - **Mean Centering**: Subtracts the mean of each variable (essential for PCA)
   - **Standard Scaling**: Divides by standard deviation (recommended for mixed units)
   - **Robust Scaling**: Achieves the same goals as Standard Scaling — centering each variable and equalizing their scales — but using statistics that are resistant to extreme values. Instead of the mean and standard deviation (which outliers can pull strongly), it uses the **median** and **MAD** (median absolute deviation). The practical difference: one unusually large measurement will barely affect the result of robust scaling, but can substantially distort standard scaling.

2. **Spectroscopic Preprocessing:**
   - **SNV (Standard Normal Variate)**: Row-wise normalization that removes multiplicative scatter effects in spectroscopic data
   - **Vector Normalization**: Scales each sample to unit length (`x / ‖x‖`), removing differences in overall magnitude between samples while keeping the shape of each one. Useful for spectra, where overall intensity varies for reasons that are not chemical.
   - **Savitzky-Golay Smoothing and Derivatives**: Fits a low-order polynomial across a sliding window of wavelengths and reads off its value — or its slope, or its curvature — at the centre of the window. It can be used alone; combined with SNV or vector normalization it runs after that step, and always before centering.

> **Why take a derivative of a spectrum?** Scatter correction removes a good deal, but not everything. What often remains is a **baseline** that drifts across the spectrum — from particle size, packing density, or the instrument itself. A first derivative removes an additive offset and a second derivative removes a linear slope, because a constant and a straight line simply vanish when you differentiate. What survives is the shape you cared about: the peaks.
>
> The reason to use Savitzky-Golay rather than subtracting neighbouring points is noise. Differentiating amplifies exactly the fast, point-to-point variation that noise consists of, so a derivative taken by plain differencing can be mostly noise. Fitting a smooth polynomial across a window first, and differentiating that, smooths and differentiates in the same step.
>
> **Choosing the window and order.** These two trade smoothing against fidelity. A wider window or a lower polynomial order smooths more aggressively and can flatten narrow peaks into the baseline; a narrower window or a higher order follows the shape more faithfully and keeps more noise. A window of 11 variables with order 2 is a common starting point for near-infrared spectra, but it is a starting point, not an answer. There is no way to read the right choice off the spectra themselves — judge it by whether predictions improve, using cross-validation, not by which curve looks cleanest.
>
> **Does SNV before a derivative do anything?** It is a fair question — both are sold as ways of dealing with scatter, so combining them sounds like doing the same job twice. It is not, and the reason is worth seeing.
>
> Differentiating removes any constant. SNV subtracts each spectrum's mean and divides by its standard deviation, and that subtracted mean is a constant — so it vanishes the moment you differentiate. What is left is exactly
>
> ```
> savgol_deriv(SNV(x)) = savgol_deriv(x) / sd(x)
> ```
>
> an identity, not an approximation. So SNV followed by a derivative is: take the derivative, then divide each sample by its own spectral spread. The half of SNV that centres the spectrum was redundant — the derivative already did it — while the half that rescales it survives, and that is the **multiplicative** scatter correction a derivative cannot perform.
>
> This is why the two belong together rather than being alternatives. Scattering changes a spectrum in two ways: it shifts the baseline up or down, and it stretches the whole spectrum by a factor. The derivative handles the first, the divisor handles the second. Using only one leaves the other kind of scatter in the data.
>
> Two footnotes. For **smoothing** rather than differentiation, nothing vanishes and SNV applies in full. And **L2 vector normalisation** behaves the same way at every derivative order — `savgol_deriv(x/‖x‖) = savgol_deriv(x)/‖x‖` — because it never centres anything to begin with.

> **When is a derivative meaningful at all?** Differentiation only makes sense along an axis where the value changes smoothly from one variable to the next — where neighbouring variables are measuring nearly the same thing. A near-infrared spectrum is like that: 1100 nm and 1102 nm see almost the same chemistry. Thirteen chemical assays on a wine are not: `ash` and `magnesium` are neighbours only because of the order someone typed the columns in, and the "derivative" between them means nothing.
>
> GoPCA measures this rather than assuming it, using the **von Neumann ratio** — the mean square difference between neighbouring variables divided by the variance along the row. Its value under a random column order is 2, which gives the number a reference point rather than an arbitrary scale. Across the datasets shipped with GoPCA, the spectra score about 0.0003 — some six thousand times smoother than a random ordering — while everything else, spectra aside, scores between 1.1 and 2.7. There is no ambiguity to resolve; the two groups are three orders of magnitude apart.
>
> This is why GoPCA Desktop offers smoothing and derivatives for spectra and not for the Iris data, and why the pca CLI warns rather than silently returning a number. It is a default rather than a verdict: if your columns are genuinely ordered in a way the data does not reveal, you can override it.
>
> **Two things that will catch you out.** The filter walks along the columns in the order they appear in your file, and assumes they are evenly spaced wavelengths. If you have excluded a band from the middle of a spectrum, the gap closes and two wavelengths that were never neighbours become adjacent — trimming to a contiguous range is fine, cutting a hole in the middle is not. And a derivative spectrum is not a spectrum: the peaks you knew turn into zero-crossings, and a second derivative flips them upside down. That is normal, and it is why derivative spectra are read differently from raw ones.

> **A caution about compositional data.** Vector normalization is sometimes described as the answer for data whose columns are *parts of a whole* — percentages, mineral assays, food composition. It is not. It removes magnitude differences, but the problem with compositional data is the **constant-sum constraint**: if the parts must add to 100, one rising forces the others to fall, whatever the underlying chemistry. That makes the covariance matrix singular and the correlations between parts spuriously negative, so the components describe the constraint as much as the samples. The remedy is a **log-ratio transform**, which analyses the ratios between parts rather than their amounts — available as **Centred Log-Ratio (CLR)** in GoCSV Desktop, applied before the data reaches GoPCA. See [Data Preparation](intro_to_data_prep.md).

**In GoPCA Suite:** Both the pca CLI and GoPCA Desktop provide simple options for all preprocessing methods. GoPCA Desktop offers intuitive checkboxes, while the pca CLI uses flags like `--no-mean-centering`, `--scale` (with options: none, standard, or robust), `--scale-only` (variance scaling without centering), `--snv`, `--vector-norm`, and `--savgol-window` with `--savgol-order` and `--savgol-deriv`. The standard near-infrared recipe is scatter correction followed by a first derivative:

```bash
pca analyze --snv --savgol-window 11 --savgol-order 2 --savgol-deriv 1 --scale standard corn.csv
```

![Center and scale](images/intro_to_pca_fig_05-03.jpg)

> **Important:** These mathematical preprocessing steps (centering and scaling) are handled by GoPCA Suite during the analysis. Larger data cleaning tasks — handling missing values, reshaping, merging files — should be done beforehand with a data preparation tool like GoCSV Desktop. Excluding individual rows and variables, however, is part of the analysis itself and belongs inside GoPCA Desktop, where you can take a variable out, re-run, and see immediately what changed.

### Step 3: Calculate the Covariance Matrix

Once your data is preprocessed, PCA examines how your variables relate to each other by computing the **covariance matrix**. This square matrix captures all pairwise relationships:

- **Diagonal elements:** The variance of each variable (how spread out it is)
- **Off-diagonal elements:** The covariance between pairs of variables (how they vary together)

![Center and scale](images/intro_to_pca_fig_05-04.jpg)

For standardized data, this becomes the **correlation matrix**, where values range from −1 (perfect negative correlation) to +1 (perfect positive correlation).

### Step 4: Find the Principal Directions (Eigendecomposition)

Here's where the mathematical magic happens. PCA finds the "best" new coordinate system for your data through **eigendecomposition** of the covariance matrix.

**The Key Players:**
- **Eigenvectors:** These define the directions of your new axes (principal components). Each eigenvector is a recipe that combines your original variables.
- **Eigenvalues:** These tell you how much variance is captured along each direction. Bigger eigenvalue = more important direction.

**The Intuition:**
Imagine your data cloud as a swarm of points in space. PCA finds:
1. The direction along which the swarm is most stretched out (PC1)
2. The perpendicular direction with the next most stretch (PC2)
3. And so on, each perpendicular to all previous directions

**In Practice:**
GoPCA Suite computes standard PCA with **Singular Value Decomposition (SVD)**, which reaches the same answer as eigendecomposition but is more numerically stable — it never has to form the covariance matrix explicitly. Kernel PCA does use eigendecomposition, applied to the kernel matrix rather than the covariance matrix.

**A third option: NIPALS.**
GoPCA also offers **NIPALS** (Nonlinear Iterative Partial Least Squares), which extracts components one at a time instead of all at once. Two situations make it worth choosing. First, when you need only the first few components of a very wide dataset, computing them one by one is cheaper than a full decomposition. Second — and this is the more useful property — NIPALS can work **directly on data containing missing values**, without discarding rows or filling gaps with invented numbers. In the pca CLI this is `--method nipals --missing-strategy native`; GoPCA Desktop offers the same choice when it detects missing values in your file.

![Find the Principal Direction](images/intro_to_pca_fig_05-05.jpg)

### Step 5: Transform Your Data to Principal Components

With directions identified, PCA transforms your original data into the new coordinate system. This creates your **principal component scores**.

**What You Get:**
- **Scores:** The coordinates of each sample in the new PC space. If a wine sample has PC1 score of 2.3, it sits at position 2.3 along the first principal component axis.
- **Loadings:** The recipe for each PC. If PC1 has a loading of 0.42 for alcohol, it means alcohol contributes strongly and positively to PC1.

**Interpreting Components:**
- **PC1** might be "overall chemical intensity" (high loadings on phenols, color, proline in wine)
- **PC2** might be "alcohol vs acidity balance"
- Each sample now has just a few numbers (PC scores) that capture its essential characteristics

### Step 6: Decide How Many Components to Keep

Not all principal components are created equal. The **Scree Plot** helps you decide how many to retain. It shows each PC's explained variance as bars:
- PC1 typically explains the most (perhaps 30–50%)
- PC2 explains less (perhaps 10–30%)
- Each subsequent PC explains progressively less
- Eventually, PCs explain so little they're capturing noise

![Decide How Many Components to Keep](images/intro_to_pca_fig_05-06.jpg)

**Decision Strategies:**

1. **Elbow Method:** Look for the "elbow" where the curve flattens. Components before the elbow are signal; after are likely noise.

2. **Cumulative Variance:** Keep enough PCs to explain your target variance:
   - 70–80% for exploratory analysis
   - 90–95% for reconstruction or modeling

3. **Kaiser Criterion:** For standardized data, keep PCs with eigenvalues > 1 (explaining more variance than a single original variable).

**When the strategies disagree.** They very often do, and that is normal rather than a sign that something has gone wrong. On a dataset of 1057 aluminium alloys measured on 24 elements, the three answers come out as 6, 10 and 14 components depending on which rule you apply. None of them is the "right" one; they are asking slightly different questions.

A few things worth knowing when you have to choose:

- **The Kaiser criterion tends to keep too many.** It is a convenient rule of thumb, not a test, and with many variables it will happily retain components that are indistinguishable from noise. Treat its answer as an upper bound rather than a target.
- **A flat scree plot is itself a result.** If the bars decline gently with no clear elbow, your data genuinely has no small set of dominant patterns. That is worth reporting, not something to fix by keeping more components.
- **Interpretability is a legitimate tiebreaker.** A component you can explain in terms of your variables is more useful than one that merely clears a numerical threshold. Look at the loadings before you decide.
- **You can keep more for computation than for interpretation.** Retaining extra components costs little if you are reconstructing data or feeding a later model, but every component you try to *interpret* is one you have to justify.

When the rules disagree, the honest report says so: "six components by the scree elbow, ten by the Kaiser criterion; we interpret six and note the rest."

---

## 6. The Geometry of PCA: Visualizing Data in Fewer Dimensions

While the mathematics of PCA involves matrices and eigenvalues, its true elegance emerges through geometry. In this chapter, we'll explore how PCA transforms your data cloud, why it works so well for dimension reduction, and what the various plots actually show you. Understanding these geometric concepts will deepen your intuition and help you interpret PCA results with confidence.

![Geometry of PCA](images/intro_to_pca_fig_06-01.jpg)

### Your Data as a Cloud of Points

Imagine your dataset as a cloud of points floating in multidimensional space. With the wine dataset, each of the 178 wines becomes a single point whose position is determined by its 13 chemical measurements. This creates a "wine cloud" in 13-dimensional space. While we can't visualize 13 dimensions directly, the geometric principles remain the same whether we're working in 2D, 3D, or 13D.

### What PCA Does Geometrically

PCA essentially rotates your coordinate system to align with the natural "shape" of your data cloud:

1. **Finding the Main Axis:** PCA first finds the direction through your data cloud along which the points are most spread out. This becomes PC1.
2. **Finding Perpendicular Axes:** It then finds the next direction of maximum spread that's perpendicular to the first. This becomes PC2.
3. **Continuing the Process:** This continues for PC3, PC4, and so on, each perpendicular to all previous ones.

There is a subtle but important detail in that first step. The line PCA draws is the one that comes as close as possible to the points *taken together* — precisely, the line that makes the **total of the squared perpendicular distances** from the points to the line as small as possible. Two things are worth noticing. First, those distances are measured **perpendicular** to the line, not straight up and down — which is what sets PCA apart from the familiar "line of best fit" from regression, which minimizes only the **vertical** gaps because it treats one variable as the thing to be predicted. Second, PCA plays no favorites: it singles out no variable as the response, measuring how far each data point sits from the line itself. This is, in fact, the original definition of a principal component — Karl Pearson introduced it in 1901 in a paper titled *On Lines and Planes of Closest Fit to Systems of Points in Space*. The axis PCA finds is quite literally Pearson's "line of closest fit."

Notice that this makes PCA and regression complementary rather than rival ideas. Regression needs you to nominate a response and then asks how the other variables predict it; PCA asks what shape the cloud has, with no response in mind at all. Nothing stops you from doing one and then the other — finding the cloud's natural axes first, and *then* regressing against them. That is Principal Component Regression, and Section 12 takes it up.

Projecting onto PC1–PC2 is like shining a light through your data cloud and looking at its 2D shadow — but unlike random projections, this shadow is carefully chosen to preserve as much of the cloud's structure as possible.

### Geometric Interpretation of Key Concepts

**Loadings** tell you how the new axes (PCs) relate to the old axes (original variables):
- A loading of +0.71 means the PC points 45° toward that variable's positive direction
- A loading near 0 means the PC is nearly perpendicular to that variable
- A loading of ±1 means perfect alignment with that variable

**Scores** are simply the coordinates of each sample in the rotated coordinate system. Positive scores place a sample on one side of the center, negative on the other.

**The Biplot** overlays the sample positions (scores) with variable directions (loadings), creating a unified geometric view. When samples lie in the direction of a variable vector, they tend to have high values for that variable.

![The Biplot](images/intro_to_pca_fig_05-07.jpg)

### Outliers and Diagnostics in PC Space

Outliers and anomalies are unusual samples that stand out geometrically:
- **Leverage points:** Far from center along major PCs (high Hotelling's T²)
- **Orthogonal outliers:** Far from the PC subspace (high Q residuals)
- **Mixed outliers:** Both far along PCs and poorly reconstructed

The **Diagnostic Plot** in GoPCA Desktop plots T² against Q-residuals, dividing the space into four quadrants and making outlier types immediately visible. This is particularly powerful in the EEG tutorial, where electrode artifacts appear as extreme outliers before the real structure can be seen.

### Beyond Linear Geometry: When PCA Struggles

PCA assumes linear geometry, but real data might have:
- **Curved manifolds:** Like the Swiss Roll dataset
- **Circular patterns:** Periodic or cyclic relationships
- **Temporal structure:** Where the order of observations carries information

When you see curved or horseshoe-shaped patterns in PCA scores plots, it is a sign that nonlinear methods (like Kernel PCA) might reveal additional structure. One caution about the horseshoe in particular: it very often arises when a *single* strong gradient runs through the data nonlinearly, and PCA is forced to bend it across two components. The second component is then an artifact of the first rather than a separate finding — so resist the temptation to interpret it as one.

---

## 7. Mathematical Foundations of PCA

Now that you've seen PCA in action and understood its geometry, let's explore the elegant mathematics that powers it. We'll build this understanding step by step, connecting each mathematical concept to practical intuition.

![Mathematical Foundations](images/intro_to_pca_fig_07-01.jpg)

### Covariance: The Heart of PCA

**Covariance** measures whether two variables tend to vary together. Positive covariance means when one goes up, the other tends to go up. Negative covariance means when one goes up, the other tends to go down.

For a dataset with *p* variables, we can compute covariances between every pair, forming a *p × p* symmetric matrix called the **covariance matrix** $S$:

$$
S = \frac{1}{n-1} X^T X
$$

where $X$ is your mean-centered data matrix (*n* samples × *p* variables). For standardized data, this becomes the **correlation matrix**.

### Eigendecomposition: Finding the Principal Directions

PCA finds the principal directions by solving:

$$
S a = \lambda a
$$

This equation asks: *which direction $a$ (eigenvector), when we project our covariance structure onto it, simply scales by some amount $\lambda$ (eigenvalue) without changing direction?*

- The **eigenvectors** are the principal directions — each tells us how to combine original variables to form a PC, and they are always orthogonal (perpendicular) to each other.
- The **eigenvalues** tell us how much variance is captured along each direction. The ratio of each eigenvalue to the total gives the percentage of variance explained.

Once we have the eigenvectors, we project the data:

$$
t = X a
$$

These projections $t$ are the principal component scores.

### Singular Value Decomposition (SVD): The Modern Approach

![SVD](images/intro_to_pca_fig_07-02.jpg)

In practice, GoPCA uses **SVD** — a more numerically stable approach that arrives at the same result. SVD decomposes your centered data matrix directly:

$$
X = U \Sigma V^T
$$

- **U**: Sample patterns — how samples relate to the principal components
- **Σ**: Diagonal matrix of singular values (related to the square roots of eigenvalues)
- **V**: Variable patterns — the loadings showing how variables contribute

The connection: loadings are the columns of **V**; scores are **U × Σ**; eigenvalues are the squared singular values divided by (*n*−1).

### A note on the sign of a component

A principal component is defined only up to its sign. If **a** is a unit-length direction of maximum variance, so is **−a**: it describes the same line through the data, traversed the other way, with the same eigenvalue. Flipping a component's loadings and its scores together leaves the reconstruction of your data exactly as good. Nothing in the mathematics prefers one direction over the other.

The practical consequence is that **the same data can produce mirror-image plots in different software**, and this is not an error in either. Different packages resolve the ambiguity differently, and there is no agreed standard:

- **GoPCA** makes the largest-magnitude loading of each component positive. This is the rule scikit-learn and MATLAB also use, and it guarantees that GoPCA's own methods — SVD and NIPALS — always agree with each other on the same data.
- **R's `prcomp`** applies no rule at all. Its documentation states that the signs "are arbitrary, and so may differ between different programs for PCA, and even between different builds of R."

So if your GoPCA scores plot is a mirror image of one you produced elsewhere, nothing is wrong. What you should compare instead is what the signs mean *relative to one another*:

- Which variables load with the **same** sign as each other, and which oppose them
- Whether a group of samples sits on the same side as a given variable
- The **magnitude** of each loading

All of these are unchanged by a flip. A statement like "PC2 contrasts the length measurements against the girth measurements" is reproducible anywhere; "height loads +0.53 on PC2" is only reproducible in software that happens to share your sign convention.

### The Optimization at the Heart of PCA

PCA solves a beautiful optimization problem: find the direction that captures the most variance in the data. For PC1:

$$
\text{maximize Var}(Xa) \text{ subject to } \|a\| = 1
$$

The constraint $\|a\| = 1$ (unit length) is crucial — without it, we could make the variance arbitrarily large by scaling up $a$. Each subsequent PC solves the same problem with the added constraint of being perpendicular to all previous PCs, ensuring no redundancy between components.

---

## 8. What Does PCA Do? Assumptions, Strengths and Limitations

Like any analytical tool, PCA excels in certain situations and struggles in others. Understanding both its powers and limitations helps you apply it wisely and know when to reach for alternatives.

### Assumptions: The Ground Rules of PCA

PCA works best under certain conditions:

**Linearity:** PCA assumes that relationships between variables are linear. This holds well in many measurement settings — absorbance rises in proportion to concentration under the Beer–Lambert law, which is a large part of why PCA works so well on the Corn NIR spectra. It fails for genuinely curved patterns, such as enzyme activity against pH, where the relationship is bell-shaped.

**Variance equals importance:** PCA assumes that the directions with the most spread contain the most meaningful signal. This is often true in measurement data, but can fail when subtle, low-variance signals matter more than broad fluctuations.

**Orthogonality:** Each principal component must be perpendicular to the others. That is a constraint you impose, not one nature is obliged to respect. It works well when the true underlying factors really are uncorrelated, but if those factors overlap, PCA has no choice but to split them awkwardly across several components.

**Continuous, quantitative data:** PCA handles measurements, concentrations, and intensities naturally, but struggles with categorical, binary, or purely count-based variables.

![PCA Strengths](images/intro_to_pca_fig_08-01.jpg)

### Strengths: Where PCA Shines

**Uncovering hidden structure:** PCA considers all variables simultaneously, finding combinations that reveal underlying structure invisible when examining variables individually. In the wine dataset, no single chemical measurement cleanly separates the three cultivars — but PCA on all 13 reveals clear clustering.

**Efficient dimensionality reduction:** A handful of components often captures most of the meaningful variation in dozens or hundreds of variables. This isn't just compression — it's intelligent summarization.

**Natural noise filtering:** Systematic patterns concentrate in early components while random noise spreads across all components. Keeping only the major components automatically filters much of the measurement noise.

**Better features for downstream analysis:** PC scores capture coordinated patterns of variation. Because the components are uncorrelated by construction, they sidestep the multicollinearity that destabilises ordinary regression on correlated variables — the idea behind Principal Component Regression (Section 12).

**Visualization of the impossible:** We cannot directly picture 13-dimensional wine chemistry, but we can plot PC1 against PC2 — the optimal two-dimensional view that preserves as much variation as possible.

![The Ferris Wheel Problem](images/intro_to_pca_fig_08-02.jpg)

### Limitations: Where PCA Struggles

**Nonlinear relationships:** If your data contains important nonlinear patterns, linear PCA will miss them. This is why GoPCA Suite includes Kernel PCA. Note that Kernel PCA is not a universal remedy — it works when closeness in the original space genuinely reflects closeness on the underlying structure, and the Swiss Roll tutorial explores a case where that assumption breaks down.

**Interpretability:** Each PC is a weighted combination of all original variables, sometimes mixing conceptually different measurements in ways that are hard to interpret.

**Scale sensitivity:** Results depend critically on variable scaling. Without standardization, variables with larger numerical ranges dominate — not because they are more important, but simply because their numbers are bigger.

**Outlier sensitivity:** A single extreme sample can pull the first principal component toward itself, distorting the entire analysis. The Diagnostic Plot in GoPCA Desktop helps identify these cases.

**Categorical variables:** PCA works best with continuous, quantitative measurements. Categories don't fit naturally into the PCA framework.

**Time series data:** Standard PCA treats observations as independent samples, ignoring temporal structure — trends, seasonality, or lagged dependencies. For sequential data like sensor readings or EEG, **Temporal PCA** is the appropriate method (see Section 11 and the EEG tutorial).

---

## 9. Practical Considerations and Applications

![Art and Science of Preprocessing](images/intro_to_pca_fig_09-01.jpg)

### Data Preparation Essentials

Before running PCA, ensure your data is clean and properly formatted. This involves handling missing values (remove, impute, or let NIPALS work around them natively), investigating outliers (genuine extremes or errors?), and selecting relevant variables (avoid constants and near-duplicates).

**Selecting variables is rarely a one-off decision.** You usually discover which variables to drop *from* a PCA — a variable that turns out to be an identifier, a region of a spectrum swamped by a single strong absorber, a sensor that was offline. GoPCA Desktop is built for that loop: exclude a variable or a region, click **Go PCA!** again, and compare. For datasets with more than about twenty columns the **Variables** panel above the data table shows the variables as an axis you can drag across, so a whole region is one gesture rather than hundreds of checkboxes; below that, the per-column checkboxes in the data table are the more precise tool, since every variable name is visible at once. The `pca` CLI does the same job non-interactively with `--exclude-columns` and `--exclude-rows`.

Be aware that excluding variables is never free. Removing a region removes whatever information it carried along with the interference you were aiming at — so a variable exclusion is a claim about your data that you should be able to justify, and record.

**The Preprocessing Decision Tree:**
- **Always center** your data
- **Scale** when variables have different units or vastly different ranges
- **Use robust scaling** when outliers are present but genuine
- **Consider SNV or vector normalization** for spectroscopic data
- **Consider a log-ratio transform** when your columns are parts of a whole

**A note on strongly skewed variables.** PCA assumes nothing about the shape of your distributions, so there is no normality requirement to satisfy. But a variable with a long right tail exerts leverage out of proportion to what it tells you: a few large values sit far from the mean, and a covariance method notices distance. If one skewed variable is dominating a component for that reason rather than a scientific one, a **Box-Cox** or **Yeo-Johnson** transform in GoCSV Desktop will reduce the skew — with the exponent fitted to the data rather than guessed. See [Data Preparation](intro_to_data_prep.md).

> **Pro Tip:** When in doubt, try both scaled and unscaled PCA. If results differ dramatically, consider which makes more scientific sense for your application.

### Choosing the Right Number of Components

More components retain more information but add complexity. The main approaches:

1. **Scree Plot Elbow:** Look for where the variance curve flattens
2. **Cumulative Variance:** Use 70–80% for exploration, 90–95% for modeling
3. **Interpretability:** Can you explain what PC3 or PC4 represents?

In practice, 2–3 components often suffice for visualization and understanding main patterns.

### Interpreting Results

**Understanding Loadings:**
Loadings show how original variables combine to form each PC. Variables with similar loadings are correlated; the magnitude shows importance (closer to ±1 = more important). Opposing variables are negatively correlated; orthogonal variables are uncorrelated.

**Understanding Scores:**
Scores reveal sample patterns in PC space. Look for distinct clusters (different sample types), gradients (continuous variation), outliers (errors or discoveries), and horseshoe patterns (strong underlying gradients). The key insight: if a sample has high PC1 score and a variable has high PC1 loading, that sample likely has a high value for that variable.

**Real-World Example: Manufacturing Quality Control**

Imagine monitoring a chemical reactor. PC1 (60% variance) has high loadings for temperature-related variables — high scores mean hot conditions. PC2 (20% variance) has high loadings for pressure and flow. Normal operation clusters near the origin. A temperature excursion shifts points along PC1. A pressure problem shifts them along PC2. This creates a "normal operating envelope" in PC space — new samples outside this envelope trigger investigation.

### Visualization Tools in GoPCA Suite

GoPCA Suite provides comprehensive interactive visualizations:

- **Score Plots (2D/3D):** Explore sample relationships, identify clusters and outliers
- **Loadings Plots:** Understand variable contributions via bar charts and heatmaps
- **Scree Plot:** Determine optimal number of components
- **Biplot:** Combined view of samples and variables
- **Circle of Correlations:** Visualize variable relationships
- **Diagnostic Plots:** Advanced outlier detection using T² and Q statistics
- **Eigencorrelation Plots:** Relate PCs to external variables
- **Temporal Loadings:** Visualize patterns in time-series PCA (flat = global mean, monotone = trend, oscillating = rhythm)

All visualizations are interactive with zoom, pan, hover details, and high-quality export.

---

## 10. Beyond Linear PCA: Kernel PCA for Nonlinear Patterns

While classical PCA excels at finding linear patterns in data, real-world datasets often contain complex, nonlinear relationships that standard PCA cannot capture. GoPCA Suite implements **Kernel PCA**, a powerful extension that can uncover these hidden nonlinear structures.

![Beyond Linear PCA](images/intro_to_pca_fig_10-01.jpg)

### The Core Idea

Standard PCA can only find flat (linear) projections of your data. If your data lies on a curved surface — like a spiral, a shell, or the Swiss Roll — projecting it onto a flat plane collapses the structure into an uninterpretable tangle.

Kernel PCA overcomes this using the **kernel trick**: rather than explicitly mapping the data into a higher-dimensional space (which could be computationally prohibitive), it uses a kernel function to compute the similarity between data points *as if* they had been mapped. Standard PCA is then applied to this similarity structure, and the curved manifold is effectively unrolled.

### When to Use Kernel PCA

Consider Kernel PCA when:
- Score plots from standard PCA show circular or spiral patterns
- Known groups overlap significantly in linear PCA
- You suspect the true structure lies on a curved surface
- Working with data known to have nonlinear structure

### Available Kernels in GoPCA Suite

| Kernel | Best for | Key parameter |
|---|---|---|
| **RBF** (Radial Basis Function) | General nonlinear patterns, curved manifolds | gamma (controls flexibility) |
| **Linear** | Comparison baseline — equivalent to standard PCA | None |
| **Polynomial** | Polynomial relationships of a known degree | degree, gamma, coef0 |

The **RBF kernel** is the right starting point for most nonlinear problems. The gamma parameter controls how local the kernel is — small gamma captures global structure, large gamma captures fine local structure.

### Practical Note on Preprocessing

Kernel PCA handles centering internally in kernel space. Avoid preprocessing methods that include centering (mean centering, standard scaling, robust scaling). Use variance scaling, SNV, or vector normalization if preprocessing is needed.

**Computational note:** Kernel PCA scales with the square of the number of samples, making it more intensive than standard PCA. It works well for datasets up to ~5,000 samples.

> **→ See the Swiss Roll tutorial in GoPCA Desktop** for a hands-on comparison of standard PCA vs. Kernel PCA on data with a known nonlinear structure.

---

## 11. Temporal PCA: Analysis for Time-Series Data

While classical PCA treats each observation as independent, time-series data has inherent temporal structure where the order and timing of observations carry crucial information. GoPCA Suite implements **Temporal PCA** (based on Singular Spectrum Analysis, SSA), which captures these temporal dynamics by incorporating time dependencies directly into the analysis.

![Analysis for Time-Series Data](images/intro_to_pca_fig_11-01.jpg)

> **Important:** Temporal PCA is designed specifically for **time-series data** where observations represent sequential measurements over time. Do not use this method for cross-sectional data where sample order is arbitrary.

### The Core Idea

Standard PCA on time-series data has a revealing property: shuffle the rows in a random order and you get *exactly the same result*. PCA is completely blind to temporal order. But for EEG, sensor data, climate records, and financial time series, the *sequence* of observations is the entire point.

Temporal PCA addresses this by constructing a **trajectory matrix**: each observation is augmented with its recent history, creating a row that captures what happened in a short window of time rather than just at one instant. The window length *L* (number of time lags) is the key parameter — it determines what temporal scale the analysis can resolve.

Standard SVD is then applied to this expanded matrix. The result is components that represent **spatiotemporal patterns** — capturing not just which variables co-vary, but how that co-variation unfolds over time.

### What the Results Look Like

**Scores plot:** Unlike standard PCA, the scores are a *time-ordered trajectory* through PC space. You are watching the system's state evolve over time. Look for distinct regions (attractors where the system spends most of its time), loops (oscillations — the system traces repeated circles in PC space), and sweeping arms (transitions between states).

**Temporal Loadings plot:** Each component has a characteristic temporal shape across the window. Three types reveal different physics:
- **Nearly flat:** A global mean-shift component — the system-wide amplitude
- **Monotone (trend-like):** A slow drift or state transition
- **Oscillatory (sinusoidal):** A repeating rhythm at a specific frequency

**Paired components:** A fundamental property of SSA is that oscillatory signals produce *pairs* of components (Vautard & Ghil, 1989). The definitive signature of such a pair is **two temporal loading curves at the same frequency, approximately 90° phase-shifted from each other** — one resembling a sine, the other a cosine. For a pure sinusoidal signal, the pair will also have nearly equal explained variance; in practice, similar variance is a useful supporting indicator but not a reliable primary criterion, since two unrelated dynamics can explain the same percentage of variance by coincidence.

### Choosing the Window Length

The window length *L* should cover at least 1–2 full periods of the oscillation you want to detect. For EEG alpha waves (~10 Hz) at 128 Hz sampling rate, one period is ~13 samples — so *L* = 32 covers 2–3 cycles comfortably. For hourly industrial data with daily patterns, *L* = 24 is the natural choice.

> **→ See the EEG Eye State tutorial in GoPCA Desktop** for a complete walkthrough of Temporal PCA, including how to read trajectories, identify oscillatory pairs, and interpret the Temporal Loadings and Variable Importance plots.

### Comparison with Standard PCA

| Aspect | Standard PCA | Temporal PCA |
|---|---|---|
| Input | Data matrix [T × p] | Trajectory matrix [(T−L+1) × (p·L)] |
| Captures | Static correlations | Temporal dynamics and oscillations |
| Scores meaning | Sample cloud | Phase-space trajectory |
| When to use | Independent samples | Sequential/time-series data |

---

## 12. Principal Component Regression: Putting the Components to Work

Every section so far has treated principal components as a destination. **Principal Component Regression (PCR)** treats them as a starting point: run PCA, then regress your response on the component scores instead of on the original variables. William Massy introduced it in 1965, and it is PCA with a least-squares step at the end — everything you have learned about preprocessing, component counts, scores and loadings carries over unchanged.

PCR is not the best predictive method available, and this section says what to reach for instead. But it does two things well: it dissolves a problem that defeats ordinary regression, and it tells you something about your PCA that the PCA alone cannot.

### The Problem PCR Solves: Collinearity

Ordinary Least Squares (OLS) regression has one notorious weakness: **correlated predictors**. When two variables carry nearly the same information, OLS cannot decide how to divide the credit — it will hand you +4,000 on one and −3,950 on the other when either alone would do. The fitted values look fine; the coefficients are nonsense, and liable to swap signs if you add a single sample. This is **multicollinearity**, and it is the normal condition of spectroscopic data, sensor arrays, and any set of measurements describing the same underlying object.

Push a little further and OLS stops working altogether. The Corn NIR dataset has **700 wavelengths and 80 samples**. Infinitely many coefficient vectors reproduce those 80 measurements perfectly, and OLS has no basis for choosing among them. There is no unique answer to be had.

PCR dissolves this, for a reason you already understand: **principal components are uncorrelated by construction**. Section 2 said so in its first bullet — PC2 captures the second-most variation *while being completely uncorrelated with PC1*, and so on. Regress on the scores and there is no credit to divide. The instability has nowhere to live. Truncation does the rest: the directions where collinear data is most degenerate are precisely the low-variance components at the end of the list, and dropping them is the ordinary business of PCA.

> **One honest caveat.** Keep *every* component and PCR is algebraically identical to OLS, instability and all. The stabilisation comes entirely from leaving components out — which is why the choice of how many to keep matters far more here than in exploratory PCA.

### What Regression Tells You About Your PCA

This half has nothing to do with prediction, and may be the more useful one.

PCA orders components by variance, and it is easy to slide from that into assuming the first ones are the *important* ones. Section 8 lists "variance equals importance" as an assumption precisely because it is one — and a regression against a known property is one of the few ways to test it. Try it on the corn spectra, predicting moisture:

```bash
pca regress --response "Moisture#target" --scale standard \
    --cv 10 --cv-scheme contiguous --max-components 12 corn.csv
```

**PC1 explains 97.5% of the spectral variance** — and a model on PC1 alone predicts moisture with a cross-validated R² of just **0.26**. Meanwhile **PC7 carries 0.009% of the variance**, less than one hundredth of one percent, and adding it lifts the cross-validated R² from **0.81 to 0.97**.

That is a finding about the data, not a quirk of the method: almost all the variation between these spectra is *something other than moisture*, and the moisture signal sits in a component any sensible scree plot would have discarded. Ian Jolliffe warned about exactly this in 1982.

**A second lesson from the same data.** Section 4 recommends **SNV** for the corn spectra, and that advice is sound for exploration: it removes the scatter that otherwise dominates PC1. But add `--snv` to the command above and the best cross-validated R² for moisture falls from 0.99 to **0.81**. The likely reason is instructive — SNV normalises each spectrum to a common mean and spread, while water absorbs strongly in the near-infrared and so raises a spectrum's overall level. Some of what SNV removes as a scatter artefact is signal you wanted.

Neither choice is wrong; they answer different questions. Until you fit a model, you have no way to notice they disagree.

> **A caution that comes with it.** If you use the cross-validated error to *choose* your preprocessing, that error becomes an optimistic estimate of future performance — you have fitted the choice to the validation data. When it matters, keep a genuine test set out of development entirely.

### Reading the Error Figures

Three quantities sound alike and mean quite different things. Confusing them is the most common way to overstate a model.

| Figure | Measured on | What it tells you |
|---|---|---|
| **RMSEC** | The training samples themselves | How well the model *fits*. Always the most flattering number, and not a performance estimate |
| **RMSECV** | Held-out samples during cross-validation | An estimate of performance, and what selects the component count |
| **RMSEP** | An independent test set, never used in development | The honest estimate of future performance |

All three are in the units of your response: corn moisture spans 9.4% to 11.0%, so an RMSECV of 0.031 means predictions typically land within about 0.03 percentage points of the reference. GoPCA also reports **bias** and **SEP** separately, because a model that is precise but consistently 2 units high is repairable with an offset while one that is merely scattered is not. **Q²** is the cross-validated R²; unlike R² it can be negative, meaning you would have done better predicting the average every time.

Cross-validation gives you a curve of error against component count, and GoPCA offers several rules for reading it — the minimum, the simplest model within one standard error of it (the default), a tolerance you name, the first upturn, or Wold's R. But a rule reads the curve and nothing else. **The final decision should also rest on what you know about the instrument and the system being measured**, which no statistic in the panel can see. Treat the curve as evidence, not a verdict.

### Where PCR Sits Among Regression Methods

**Partial Least Squares (PLS)** is the standard tool in chemometrics. Where PCA chooses components capturing the most variance in **X** alone — ignoring your response entirely — PLS chooses components capturing the most *covariance between* **X** and **y**, aiming at the target from the start. It usually reaches comparable accuracy with noticeably fewer components, and is less exposed to the situation the corn data illustrates. Frank and Friedman's 1993 comparison found PCR, PLS and ridge regression broadly similar on predictive accuracy — but PLS gets there more directly.

**Gradient-boosted trees** (XGBoost and relatives) assume no linearity at all, and on tabular data with a few thousand samples and genuinely nonlinear relationships they will usually beat any linear method — but they need far more data than a calibration set of 80 spectra provides, give you no loadings to interpret, and extrapolate badly. **Ridge regression and the lasso** attack collinearity by shrinking coefficients rather than dropping directions.

So why does GoPCA offer PCR? Because this is a PCA toolset and PCR *is* PCA — adding PLS would mean a second decomposition with different components and a different notion of what an axis means. And because a PCR model is a fast, informative first look at what your data can support: predict a property at Q² = 0.97 and the information is unmistakably there; manage only 0.15 and you have learned something valuable cheaply. Often enough, particularly with well-behaved spectroscopic data, PCR is simply good enough for the job.

### Using PCR in GoPCA Suite

Any numeric `#target` column can serve as the response — the same convention that marks a column for colouring plots, now doing double duty. In **GoPCA Desktop**, switch from **Explore** to **Regress** mode: Step 2 stays your familiar PCA configuration, and Step 3 adds the response, the validation design and the selection rule. You get the error curve, a predicted-against-measured plot with its 1:1 line, and the coefficients on the original variable scale — for spectra, the plot showing which wavelength regions the model actually uses.

```bash
pca regress --list-responses corn.csv                    # what can be a response?
pca regress --response "Moisture#target" --cv 10 corn.csv
pca regress --response "Yield#target" --cv loo --cv-group "BatchID" process.csv
```

Three limitations are worth stating plainly. **Kernel and Temporal PCA cannot be used for PCR** — neither can project a new sample from its variables alone, so a saved model could not predict. Under **SNV or vector normalisation** no fixed per-variable coefficients exist, since those methods scale each sample by a statistic of itself; the model still predicts correctly through the full pipeline, but GoPCA says the coefficient plot is unavailable rather than showing an approximation. **Savitzky-Golay is the exception among the row-wise methods**: it applies the same filter to every sample, so it folds into the coefficients and the original-scale form survives — though combining it with SNV loses that again, for the reason just given. And PCR predicts *numbers*: a `#target` column holding 0, 1 and 2 for three species is a class label, and regressing on it asserts the classes are ordered and evenly spaced. Predicting a category is classification, which this suite deliberately does not attempt — GoPCA warns you when a response looks like a class code. Mark such a column `#category` instead and the question does not arise: it is held out of the analysis, offered for colouring by class, and never listed as a candidate response.

---

## 13. PCA in Practice: Tips for Effective Use

![A Practical Checklist](images/intro_to_pca_fig_12-01.jpg)

### The PCA Workflow (A Practical Checklist)

**Before You Start:**
- [ ] **Know your goal:** Exploration? Visualization? Dimensionality reduction? Outlier detection?
- [ ] **Understand your data:** What do variables represent? What's the expected structure?
- [ ] **Check data quality:** Missing values handled? Outliers investigated?
- [ ] **Consider scale:** Should all variables contribute equally?

**During Analysis:**
- [ ] **Start simple:** Try standard PCA first before reaching for variants
- [ ] **Iterate preprocessing:** Compare centered-only vs scaled results
- [ ] **Vary components:** Test different numbers to understand stability
- [ ] **Look for patterns:** Clusters? Trends? Outliers? Horseshoes?

**After Analysis:**
- [ ] **Validate findings:** Do results make scientific sense?
- [ ] **Test robustness:** How do results change with different preprocessing?
- [ ] **Document decisions:** Why this preprocessing? Why this many components?
- [ ] **Share visualizations:** Use plots to communicate findings

### Common Pitfalls and How to Avoid Them

**Pitfall 1: Over-interpreting Components**
- **Problem:** Assuming each PC represents a single, pure phenomenon
- **Reality:** PCs often capture mixtures of effects
- **Solution:** Look at loadings carefully; one PC might represent "overall size" (many correlated variables) rather than a specific process

**Pitfall 2: Ignoring the Rest of the Variance**
- **Problem:** Focusing only on PC1 and PC2 when they explain <50% variance
- **Reality:** Important patterns might be in PC3, PC4, or beyond
- **Solution:** Always check the Scree Plot; explore multiple PC combinations

**Pitfall 3: Forcing Interpretation**
- **Problem:** Creating elaborate explanations for noise components
- **Reality:** Beyond true structure, you're looking at random variation
- **Solution:** Use the elbow in the Scree Plot to identify where signal ends and noise begins

**Pitfall 4: Scale Amnesia**
- **Problem:** Forgetting whether data was scaled, leading to misinterpretation
- **Reality:** Scaled and unscaled PCA can give opposite conclusions
- **Solution:** Always document and report your preprocessing choices

**Pitfall 5: Reading Meaning into a Component's Sign**
- **Problem:** Concluding that results disagree because a plot is mirrored, or that "positive PC2" means something in itself
- **Reality:** Components are defined only up to sign, and software packages resolve that ambiguity differently — see Section 7. A flipped component is the same component.
- **Solution:** Compare *relative* signs (which variables oppose which) and magnitudes, not absolute direction. If you quote a signed loading in a report, say which software produced it.

### Domain-Specific Best Practices

**Spectroscopy (NIR, Raman, etc.):**
- Apply SNV preprocessing to remove scatter effects — see the Corn tutorial
- May need many components (10–20) for calibration tasks
- Watch for baseline effects dominating PC1
- If you are heading for a calibration, check the preprocessing against a cross-validated model rather than against the scores plot alone — the two can disagree (Section 12)

**Genomics/Proteomics:**
- Log-transform count data first
- Be aware of batch effects (may dominate PC1)
- Consider removing low-variance genes/proteins

**Process Monitoring:**
- Build model on normal operation data only
- Use T² and Q statistics for fault detection
- Update models periodically for process drift

**Time Series (EEG, sensors, climate):**
- Use Temporal PCA, not standard PCA
- Choose window length based on the oscillation period you want to detect
- Read scores as trajectories, not sample clouds

> **Golden Rule:** PCA is a tool for understanding, not an end in itself. The best PCA analysis is one that leads to insights, decisions, or hypotheses that can be tested further.

---

## 14. Conclusion: Your Path Forward with PCA

![Your Path Forward with PCA](images/intro_to_pca_fig_13-01.jpg)

### What You've Learned

You've traveled from the basic intuition of PCA through its mathematical foundations to practical applications. You now understand:

- **The Core Concept:** How PCA transforms complex, high-dimensional data into a simpler form that preserves the essential patterns
- **The Mathematics:** From covariance matrices to eigendecomposition, the elegant math that powers PCA
- **The Practice:** How to preprocess data, choose components, and interpret results
- **The Variants:** When to use Kernel PCA for nonlinear patterns or Temporal PCA for time series
- **The Components at Work:** How Principal Component Regression turns the scores into predictions, and what it reveals about the decomposition that produced them
- **The Limitations:** When PCA shines and when to reach for alternatives

### Your Next Steps with GoPCA Suite

**Start with the interactive tutorials:** Each of the seven sample datasets has a guided tutorial in GoPCA Desktop. Work through the first six in order — Iris first to build your foundations, then Wine, Corn, Swiss Roll, CSTR, and EEG. By the end of the EEG tutorial, you will have used every major feature of GoPCA and encountered every major challenge that real datasets present. Then finish with Body Measures, the seventh — a fitting close: a simple, real population dataset that steps back from method complexity to ask what the principal components actually *mean* — how PC1 and PC2 become interpretable "size" and "shape" factors.

**Then bring your own data:**
1. Prepare your data with GoCSV Desktop (handle missing values, check quality)
2. Start with standard PCA to establish a baseline
3. Try different preprocessing options to understand their impact
4. Use multiple visualizations to fully explore your results
5. Document your choices for reproducibility

**For automation and pipelines:** The pca CLI supports all the same methods and preprocessing options as GoPCA Desktop, making it straightforward to move from interactive exploration to reproducible batch analysis.

### A Final Thought

Over a century ago, Karl Pearson developed the mathematical foundations of what would become PCA. Today, you're using those same principles, refined and implemented in modern software, to solve 21st-century problems. From understanding wine chemistry to monitoring manufacturing processes, from analyzing spectroscopic data to exploring brain dynamics, PCA continues to reveal the hidden simplicity within complexity.

Welcome to the community of PCA practitioners. May your principal components be interpretable, your variance well-explained, and your insights profound!

---

## 15. References and Further Reading

![References and Further Reading](images/intro_to_pca_fig_14-01.jpg)

### Foundational Papers
- **Pearson, K. (1901).** On lines and planes of closest fit to systems of points in space. *Philosophical Magazine*, 2(11), 559–572.
- **Hotelling, H. (1933).** Analysis of a complex of statistical variables into principal components. *Journal of Educational Psychology*, 24(6), 417–441.

### Modern Reviews and Tutorials
- **Jolliffe, I. T., & Cadima, J. (2016).** Principal component analysis: a review and recent developments. *Philosophical Transactions of the Royal Society A*, 374, 20150202.
- **Bro, R., & Smilde, A. K. (2014).** Principal component analysis. *Analytical Methods*, 6, 2812–2831. Practical guide from a chemometrics perspective.
- **Shlens, J. (2014).** A Tutorial on Principal Component Analysis. *arXiv:1404.1100.* Clear mathematical exposition suitable for self-study.
- **Gallagher, N. B., Blake, T. A., & Gassman, P. L. (2020).** The effect of data centering on PCA models. *Journal of Chemometrics*, 34(3), e3189.

### Books for Deeper Study
- **Jolliffe, I. T. (2002).** *Principal Component Analysis* (2nd ed.). Springer. The definitive reference covering theory and applications.
- **Esbensen, K. H., et al. (2002).** *Multivariate Data Analysis: In Practice.* CAMO Process AS. Industry-focused with real-world chemometrics examples.

### Kernel PCA
- **Schölkopf, B., Smola, A., & Müller, K.-R. (1998).** Nonlinear component analysis as a kernel eigenvalue problem. *Neural Computation*, 10(5), 1299–1319.

### Temporal PCA and Singular Spectrum Analysis
- **Broomhead, D. S., & King, G. P. (1986).** Extracting qualitative dynamics from experimental data. *Physica D: Nonlinear Phenomena*, 20(2–3), 217–236.
- **Vautard, R., & Ghil, M. (1989).** Singular spectrum analysis in nonlinear dynamics, with applications to paleoclimatic time series. *Physica D: Nonlinear Phenomena*, 35(3), 395–424.
- **Golyandina, N., Korobeynikov, A., Shlemov, A., & Usevich, K. (2015).** Multivariate and 2D extensions of singular spectrum analysis with the Rssa package. *Journal of Statistical Software*, 67(2), 1–78.
- **Golyandina, N. (2020).** Particularities and commonalities of singular spectrum analysis as a method of time series analysis and signal processing. *WIREs Computational Statistics*, 12(4), e1487.

### Principal Component Regression and Related Methods
- **Massy, W. F. (1965).** Principal components regression in exploratory statistical research. *Journal of the American Statistical Association*, 60(309), 234–256. The paper that introduced PCR.
- **Jolliffe, I. T. (1982).** A note on the use of principal components in regression. *Journal of the Royal Statistical Society, Series C (Applied Statistics)*, 31(3), 300–303. The classic warning that low-variance components can carry the predictive signal — demonstrated on the Corn data in Section 12.
- **Frank, I. E., & Friedman, J. H. (1993).** A statistical view of some chemometrics regression tools. *Technometrics*, 35(2), 109–135. A careful comparison of PCR, PLS and ridge regression.
- **Wold, S., Sjöström, M., & Eriksson, L. (2001).** PLS-regression: a basic tool of chemometrics. *Chemometrics and Intelligent Laboratory Systems*, 58(2), 109–130. The standard introduction to the method PCR is most often compared against.
- **Næs, T., Isaksson, T., Fearn, T., & Davies, T. (2002).** *A User-Friendly Guide to Multivariate Calibration and Classification.* NIR Publications. Practical treatment of RMSEC, RMSECV, RMSEP, bias and SEP.
- **Chen, T., & Guestrin, C. (2016).** XGBoost: A Scalable Tree Boosting System. *Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining*, 785–794.

### Implementation References
- **Golub, G. H., & Van Loan, C. F. (2013).** *Matrix Computations* (4th ed.). Johns Hopkins University Press.
- **Wold, H. (1966).** Estimation of principal components and related models by iterative least squares. *Multivariate Analysis*, 391–420.
