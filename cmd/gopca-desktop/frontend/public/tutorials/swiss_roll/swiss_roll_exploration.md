# Exploring Structure in Data: The Swiss Roll Dataset and Kernel PCA

## Background: Manifolds, geometry, and the limits of linear methods

The Swiss Roll is a **synthetic benchmark** — a dataset constructed mathematically rather than measured in the real world. Synthetic datasets play a special role in data science: they let us test what an algorithm *should* find, because we already know the true answer.

The dataset consists of **1,000 samples** in three dimensions:

* `X`, `Y`, `Z` — the 3D coordinates of each point
* `color #target` — position along the roll, used only for coloring plots (not included in the analysis)

The data is generated from two underlying parameters:

* *t* — controls position along the length of the roll (the "unrolled" coordinate, ranging from the inner edge to the outer edge)
* *h* — a random height offset, adding thickness to the sheet

The 3D coordinates follow from:

* x = t · cos(t)
* y = h
* z = t · sin(t)

The `color #target` column stores the raw value of *t* and is used only for coloring the scores plot — it plays no part in the analysis. When you load the dataset, this coloring is applied automatically.

The true structure is a **flat 2D sheet wound into a helix in 3D space**. This type of structure is called a **manifold** — a surface that is locally flat but globally curved. A piece of paper lying on a table is flat; roll it up and it becomes a manifold embedded in 3D. The Swiss Roll is exactly this: a flat 2D sheet with coordinates *t* and *h*, curled into a spiral shape.

The central question of this tutorial is:

> Can PCA find and unroll this manifold — or does it fail?

---

## From Corn to Swiss Roll: when the problem is not dimensionality

The previous datasets each introduced a new kind of challenge:

| Dataset | Variables | Challenge |
|---------|-----------|-----------|
| Iris | 4 | Visualizing 4 dimensions at once |
| Wine | 13 | Mixed scales; 78 pairplot panels |
| Corn NIR | 700 | 244,650 panels; extreme collinearity; physical scatter artefacts |
| Swiss Roll | **3** | **None of the above** |

The Swiss Roll has only **three variables**. There is no dimensionality problem — you can plot the data directly in 3D and see the entire structure at once. The variables are simple coordinates, measured in identical units, with no scale differences requiring correction.

And yet linear PCA — which handled 700 highly correlated spectral variables with reasonable accuracy — fails completely on the Swiss Roll.

This is the Swiss Roll's lesson. The failure of PCA is not always a matter of having too many variables. It is a matter of the **shape** of the data.

For Corn, the dominant variation was a physical baseline artefact: a monotone tilt that PCA picked up instead of chemistry. The fix was SNV preprocessing — applied before PCA. For Swiss Roll, the problem is more fundamental. The structure you want to find is **curved in 3D space**, and no amount of preprocessing can fix that. So we will try a different kind of PCA — and find out whether it helps.

> The Swiss Roll confronts you with a 3-variable dataset where you can see the problem with your own eyes — and forces you to think clearly about what "structure" means and how to find it.

---

## Why this matters: curved structure in real data

The Swiss Roll is synthetic — designed to make the geometric problem as clear as possible. But curved, nonlinear structure appears in genuine scientific and industrial data, and it poses exactly the same challenge.

**Face recognition.** Images of a face change dramatically with pose and lighting, even though the underlying identity stays constant. The relationship between pixel values and the factors that matter — who the person is — is highly nonlinear. Linear PCA (historically called "Eigenfaces") groups faces by their dominant pixel variation, which is often lighting rather than identity. A [radial basis function (RBF)](https://en.wikipedia.org/wiki/Radial_basis_function_kernel) or polynomial kernel can capture the nonlinear pixel correlations that define a specific person's features and is more robust to these confounding factors.

**Image denoising.** When an image is corrupted by noise, the underlying clean image typically lives on a low-dimensional nonlinear manifold in pixel space. Linear PCA cannot cleanly separate noise from high-frequency image features because it treats the two as equally linear. Kernel PCA maps the noisy image into a feature space where the clean structure becomes more linearly accessible; projecting onto the leading kernel components and mapping back removes noise while better preserving fine detail (Mika et al., 1998).

**Industrial process monitoring.** Sensors on a manufacturing line record temperature, pressure, vibration, and flow simultaneously. The "normal" operating envelope is not a flat ellipse — it is often a curved cycle that shifts with production conditions. A linear PCA control chart imposes a flat boundary, which either misses real anomalies or triggers false alarms when the process follows its natural curve. Kernel PCA can model the nonlinear shape of normal operation; a deviation from the kernel manifold then flags a genuine problem more reliably (Botre et al., 2022).

**Genomics.** Gene expression profiles of cells undergoing differentiation trace curved trajectories in high-dimensional gene space. As a cell transitions from one type to another, the changes in individual gene activities combine in nonlinear ways — the trajectory bends rather than traveling in a straight line through expression space. Kernel PCA and related nonlinear methods can unfold these trajectories, separating stages of differentiation that appear as an overlapping cloud under linear projection.

In each case, the underlying structure is real and low-dimensional — but it is curved. A linear projection squashes it; a kernel method can follow it.

---

## First look at the data

The figure below shows two views of the same 1,000 data points, colored by position along the roll (the `color #target` value):

![Swiss Roll 3D visualization](./swiss_roll_3d.png)

**Left panel — 3D perspective**: the full shape in three dimensions. You can see the rolled sheet: a band of data wound into a spiral, with the height dimension (*Y*) giving it thickness. The color gradient runs from dark purple (inner edge, low *t*) through orange to yellow (outer edge, high *t*) along the length of the roll.

**Right panel — top-down view (X–Z plane)**: the same data with the height axis (*Y*) removed entirely. This reveals the concentric spiral structure directly. The inner and outer arms of the spiral — dark purple and yellow — run side by side, separated only by the gap between adjacent turns.

Study both panels before running any analysis.

### Reflect:

* In the 3D view: trace the color gradient from dark purple inward to yellow at the outer edge. Can you follow it continuously along the surface of the roll? *(Hint: run your finger along the surface — never lift it, never cut through the interior.)*
* In the top-down view: the inner edge (dark purple) and outer edge (yellow) are physically close in the X–Z plane — they are separated by only the width of one gap between spiral turns. How far apart are they if you instead trace along the surface of the sheet? *(Hint: think of a roll of paper. The first centimetre of paper and the last centimetre are neighbors when the roll is wound — but how far apart are they when you unroll it?)*
* If you could cut the roll along one edge and flatten it completely, what shape would you get? *(Hint: what is the shape of a single sheet of A4 paper before you roll it?)*

👉 A perfectly flattened Swiss Roll would be a rectangle: one axis is *t* (position along the roll, from low to high), the other is *h* (height *Y*). The top-down spiral view makes the core problem immediately visible: the inner and outer edges sit physically adjacent in 3D space, yet they are at opposite ends of the unrolled sheet. Any method that measures straight-line distances through 3D space will see them as neighbors — and fail to unroll the manifold.

---

## The challenge

The Swiss Roll is a **2D structure embedded in 3D space**. The challenge is not compression — it is **unrolling**: finding the coordinates that describe position on the flat sheet, rather than position in 3D space.

Linear PCA finds directions of maximum variance using straight-line projections through the data cloud. Your task in this tutorial is to understand:

> When and why does linear PCA fail — and what does Kernel PCA do differently?

---

# Your task: Explore the Swiss Roll using GoPCA

Work through the steps in order. The sequence matters: the first step deliberately demonstrates failure, so that the later steps make sense.

---

## Step 1: Load the data and see the 3D structure

Load the Swiss Roll dataset into GoPCA by clicking the **Swiss Roll** button.

The dataset loads automatically with the `color #target` column pre-selected as the color variable. You do not need to set anything — GoPCA assigns this as the default coloring when the button is clicked.

Do not run PCA yet. Familiarize yourself with what is shown in the data panel.

#### Questions:

* How many rows (samples) and columns (variables) does the data table show?
* Study the 3D figure above: what will "low color values" (inner edge of the roll) and "high color values" (outer edge) look like in the scores plot if PCA correctly unrolls the manifold?

👉 There are 1,000 samples and 3 numeric variables — a tiny dataset by modern standards. This makes the subsequent failure of linear PCA all the more striking.

---

## Step 2: Run linear PCA and diagnose the failure

Set:

* **PCA Method** → SVD

Click **Go PCA** and open the **Scores Plot (PC1 vs PC2)**.

Leave the color variable as `color #target` (pre-selected automatically).


#### Questions:

* Does the color gradient run smoothly from low values to high values — or is it jumbled?
* Does the shape remind you of anything you have already seen in this tutorial?
* Does the scores plot resemble the flat rectangle you imagined?
* Here is the important one: the colors look beautifully ordered. Does that mean PCA has succeeded?

👉 Look closely at the shape: it is a **spiral**. The darkest samples sit coiled in the middle, and as the color warms the points wind outwards, turn after turn, until the brightest samples form the outermost arm. And the color gradient is *lovely* — smooth, continuous, no mixing at all.

You have seen this picture before. It is the **top-down view from the "First look at the data" figure** — the same concentric spiral, drawn again. That is not a coincidence, and it is the whole story of this step.

Linear PCA searched for the directions of greatest variance and found them in the X–Z plane, where the roll is widest. The third component picked up the height axis *Y* and set it aside. So PC1 and PC2 are, near enough, just X and Z: the plot is the roll photographed from directly above.

Now here is the part worth pausing on. **Nothing about this plot looks like a failure.** The gradient is orderly, the shape is elegant, the explained variance is unremarkable but not alarming. If you had never seen the 3D figure, you might happily conclude that PCA had found the structure.

It has not. Trace one line outward from the center and you cross arm after arm of the spiral — dark, then mid, then bright. Those neighboring arms sit a few millimetres apart on your screen, but along the surface of the sheet they are a **full turn apart**. Two points that the plot presents as near neighbors may be at opposite ends of the unrolled rectangle.

The roll has not been unrolled. It has simply been **photographed from above** — and a photograph of a rolled-up sheet is still rolled up.

Now open the **Scree Plot**.

#### Questions:

* How much variance does PC1 explain?
* Does a high explained variance mean the structure has been correctly recovered?

👉 **This is the key diagnostic moment.** You should see PC1 explaining around 41% of the variance and PC2 around 30% — a total of roughly 71% for the first two components together. Notice also that there is **no clear elbow**: the variance does not drop sharply after PC1. That flatness is itself informative — the three components are all doing similar amounts of work, because the spiral has roughly equal extent in every direction through 3D space.

But the deeper point is this: 71% of the variance is a perfectly respectable number, and it tells you **nothing whatsoever** about whether the manifold has been recovered. Variance is a property of the coordinate system, not of the geometry of the roll. Neither the scree plot nor the smooth color gradient revealed the failure. Only knowing what the data *should* look like — a flat rectangle — exposed it.

That is an uncomfortable lesson, and a genuinely useful one. On your own data you will not have a `color #target` column holding the right answer. You will have a scores plot that looks reasonable and a scree plot that looks fine, and you will have to ask what the structure *ought* to be before deciding whether you have found it.

Compare this to Corn: there, PC1 explained 99% of variance, and the loading curve (monotone, never crossing zero) immediately revealed it was capturing a physical baseline artefact. Here, the scree plot looks unremarkable — no single dramatic number, no obvious red flag. The failure is entirely invisible until you look at the scores plot with a meaningful color variable.

> The Swiss Roll teaches a habit that applies to every dataset: always inspect the scores plot with a meaningful grouping variable before concluding that PCA has succeeded.

---

## Step 3: Why linear PCA fails — and how Kernel PCA works

### The geometric problem

Linear PCA finds the direction of maximum variance using a **straight-line** projection. For the Swiss Roll, the direction of greatest straight-line variance runs diagonally through the roll — from one side of the spiral to the other — because the outer and inner edges span the largest physical extent in 3D.

Points that are far apart *along the surface of the manifold* (for example, at opposite ends of the unrolled sheet) may be physically close in 3D space, because the roll curves back towards itself. When linear PCA projects everything onto a flat plane, these points end up on top of each other. The roll has not been unrolled — it has been squashed.

**Analogy**: imagine a map of a mountain range, rolled into a tube. If you project the tube onto a flat surface from the side, nearby points on the map may be projected on top of each other. The only way to recover the true map is to unroll the tube — to follow the surface, not to cut through it.

### The kernel trick

Kernel PCA addresses this by replacing the linear covariance structure with a **kernel function** that measures similarity between data points. The key idea, introduced by Schölkopf, Smola & Müller (1997, 1998), is to perform PCA not in the original 3D space but in a transformed feature space **F** — implicitly, without ever computing the transformation explicitly.

The **RBF (Gaussian) kernel** used here is:

> k(x, y) = exp(−γ · ‖x − y‖²)

where:
* ‖x − y‖² is the squared Euclidean distance between points x and y in the original 3D space
* γ (gamma) is a free parameter controlling how quickly the kernel falls off with distance
* k(x, y) ranges from 0 (very dissimilar) to 1 (identical)

**Concrete example with γ = 0.01**: two points 3 units apart give k = exp(−0.01 · 9) ≈ 0.91 (very similar). Two points 10 units apart give k = exp(−0.01 · 100) ≈ 0.37 — this is the "1/e distance" at which similarity has fallen by a factor of e, roughly marking the edge of the kernel's effective neighborhood. Two points 30 units apart give k = exp(−0.01 · 900) ≈ 0.0001 (negligible). The Swiss Roll coordinates span between 21 and 25 units depending on the axis, so a kernel with γ = 0.01 gives meaningful similarity to points within about 10 units, while ignoring those that are much farther. With γ = 0.1 (ten times larger), the same points 10 units apart give k = exp(−10) ≈ 0.00005 — essentially zero: at that setting almost every pair of non-neighboring samples is treated as completely dissimilar.

### The kernel matrix

Instead of computing the p×p covariance matrix of the original variables (as linear PCA does), Kernel PCA computes an **n×n kernel matrix** **K**:

> K_ij = k(x_i, x_j) = exp(−γ · ‖x_i − x_j‖²)

For the Swiss Roll, this is a **1,000×1,000 matrix** where every entry encodes the RBF similarity between a pair of samples. The principal components are then extracted by eigendecomposing K (after centering), rather than the data covariance.

This has two important consequences:

**1. The number of components is not limited by the number of input variables.** Linear PCA on 3 variables can yield at most 3 components. Kernel PCA on 1,000 samples can yield up to 1,000 components, because the eigendecomposition is of the n×n kernel matrix. The implicit feature space **F** can be vastly larger — even infinite-dimensional for the RBF kernel.

**2. There are no loadings in the original variable space.** In linear PCA, each principal component is a direction in the original p-dimensional space: you can say "PC1 is 0.52 of variable X, 0.38 of variable Y, ...". In Kernel PCA, the principal components are directions in **F**. A direction in **F** is a linear combination of the feature-space images of the training points — there is no way to map this back to a simple weight per original variable. This is why the **Loadings Plot**, **Biplot**, and **Circle of Correlations** are unavailable when Kernel PCA is selected in GoPCA: those plots require loadings in the original space, and no such thing exists.

What *does* exist is the **scores** — the projections of each sample onto the kernel principal components. The scores plot remains available and is the primary output of Kernel PCA.

---

## Step 4: Apply Kernel PCA and compare to linear PCA

Change:

* **PCA Method** → Kernel PCA
* **Kernel Type** → RBF
* **Gamma** → 0.01

Click **Go PCA** and open the **Scores Plot**.

#### Questions:

* Compare the color pattern to the linear PCA result from Step 2. Is the color gradient more organized, or less?
* Did the result surprise you? Was it what you expected a "more powerful" method to do?
* Look at the Scree Plot. How much variance do PC1 and PC2 explain now, compared with the 71% you saw for linear PCA?

👉 **Brace yourself: this is worse.** Not subtly worse — dramatically. Where linear PCA gave you an elegant spiral with a flawless color gradient, Kernel PCA at γ = 0.01 gives you a hollow ring with the colors thoroughly scrambled. Look along the right-hand side: you will find the darkest samples sitting right next to the brightest ones. Those are the two opposite ends of the roll, placed as neighbors.

If you expected the nonlinear method to rescue the analysis, that expectation has just been corrected — and that is exactly why this step is here. **Reaching for a more sophisticated method is not the same as reaching for the right one.** A kernel is a statement about which points you consider similar; if that statement does not match the geometry of your data, the extra machinery buys you nothing and can cost you a great deal.

Now look at the Scree Plot, and set **Number of Components** to something like 10 or 20 first — Kernel PCA can return far more components than you have variables (this is the point from Step 3), and with only two you cannot see the shape of the spectrum.

What you will find is revealing: PC1 ≈ 14.8%, PC2 ≈ 14.1%, PC3 ≈ 12.3%. Compare that with linear PCA's 41% / 30%. The variance has been spread thinly across many components instead of concentrating in the first few, and the top three are nearly **tied**. When eigenvalues sit that close together, the split between the components is close to arbitrary — there is no strong reason for the manifold coordinate to land in PC1 and PC2 rather than somewhere further down the list.

Because the components are so evenly matched, you may be tempted to go hunting: change the scores plot axes, try PC1 vs PC3, PC2 vs PC4, and so on, until some pair looks better organized. It is worth understanding why that is a trap.

You can indeed find pairs that look tidier — PC3 vs PC5 is the best-looking of the 45 pairs available among the first ten components. But two things should stop you using it. First, the improvement is largely cosmetic: in that view, 68% of each point's ten nearest neighbors are genuinely close along the roll, against 69% for PC1 vs PC2 — the mistakes are no less frequent, merely less extreme. Compare either with linear PCA's 100%. Second, and more important: the only reason anyone could identify PC3 vs PC5 as the best pair is by checking all 45 against the `color #target` column — the answer key. **On your own data you will not have one.** Searching component pairs until the picture pleases you is not analysis; it is choosing the result you wanted.

The honest reading of the near-tie is simpler, and more useful: when eigenvalues sit this close together, no pair of components carries a privileged meaning. That is information about the analysis, and it is telling you the kernel is not organizing this data well.

### Why the RBF kernel cannot unroll this particular sheet

The reason is worth understanding, because it tells you when this method *will* work.

The RBF kernel knows one thing about two points: the **straight-line distance** between them in the original space. On the Swiss Roll that is precisely the information that misleads. Two points on adjacent arms of the spiral are close in 3D but a full turn apart along the sheet. The kernel cannot tell that pair apart from two genuine neighbors, so no setting of gamma can separate them — the ambiguity is baked into the distance measure itself, not into the parameter.

A **perfect unrolling** needs *geodesic* distance: path length measured along the surface rather than through the air. **Isomap** and **LLE (Locally Linear Embedding)** were designed for exactly that, and — as Ghojogh & Crowley (2022) show — they can be expressed as kernel PCA with a *different* kernel. The framework is right; the RBF kernel is the wrong member of the family for this geometry.

> This is not a defect in Kernel PCA, and it is not a reason to avoid it. It is a boundary condition, and the Swiss Roll was constructed to sit right on top of it. For data whose curvature is gentler — or whose neighborhoods in the original space really do reflect neighborhoods on the manifold — the RBF kernel performs well. You will meet exactly that situation in the real-world examples from the start of this tutorial.

**Preprocessing note**: when Kernel PCA is selected, GoPCA restricts column-wise preprocessing to **Variance Scale** or **None**. Mean centering and standard scaling are unavailable because Kernel PCA handles centering through modified kernel matrix algebra — subtracting the feature-space mean implicitly without ever computing it explicitly (Schölkopf et al., 1998). For this dataset the variables are in the same units, so **None** is appropriate.

**Available plots**: the **Loadings Plot**, **Biplot**, **3D Biplot**, **Circle of Correlations**, **Diagnostic Plot** and **Eigencorrelation Plot** are all unavailable for Kernel PCA — for the reasons explained in Step 3. What remains is the **Scores Plot**, the **3D Scores Plot**, the **Scree Plot**, and two views you have not met before: the **Kernel Matrix Heatmap** (Step 5) and **Sample Contributions**, which shows how much each training sample contributes to a given kernel component.

---

## Step 5: Read the Kernel Matrix Heatmap

Open the **Kernel Matrix Heatmap**.

This plot is unique to Kernel PCA — it has no equivalent in linear PCA. It shows the n×n kernel matrix **K** as a color grid: each cell (i, j) is colored according to the value of k(x_i, x_j) — the RBF similarity between sample i and sample j. Bright colors indicate high similarity (close in 3D space); dark colors indicate low similarity (far apart).

#### Questions:

* Do you see patches of high similarity clustered together in some regions of the grid?
* Do any groups of samples appear clearly separated from the rest?
* How does the overall brightness of the heatmap relate to gamma?

Now change gamma to a much larger value — try **Gamma → 0.1** — and regenerate.

#### Questions:

* How does the heatmap change? Is the overall pattern brighter, darker, or more concentrated?
* Can you now see a thin bright diagonal strip? What does that mean?
* Does the scores plot still unroll the manifold correctly at this gamma?

Now try a much smaller gamma — **Gamma → 0.0005** — and regenerate.

#### Questions:

* What does the heatmap look like now? Is there still meaningful variation between cells?
* Does the scores plot still recover the smooth low-to-high ordering?

👉 **Reading the Kernel Matrix Heatmap:**

* **Large gamma** (e.g. 0.1): the kernel decays so quickly with distance that only each point's immediate neighbors have non-negligible similarity. The heatmap shows a bright diagonal — each sample is similar only to itself and perhaps one or two direct neighbors — with an otherwise dark background. The kernel is too *local* — it cannot see global manifold structure. The scores plot breaks down.

* **Good gamma** (e.g. 0.01): the heatmap shows meaningful variation — some pairs are bright, some dark — reflecting the actual geometric relationships between samples. The kernel's effective neighborhood radius matches the characteristic spacing of the data. The scores plot shows more color organization than linear PCA.

* **Small gamma** (e.g. 0.0005): the kernel decays so slowly that nearly all pairs have high similarity — the off-diagonal values average about 0.88. The heatmap becomes close to uniformly bright, and in that sense carries little information: the kernel is treating the whole dataset as one undifferentiated cloud.

  But now look at the scores plot at this setting, because it holds a surprise. Far from losing structure, it is the **cleanest of the three** — the spiral is back, with the same smooth gradient you saw under linear PCA. Hold that thought; Step 6 explains why, and it is the most elegant result in this tutorial.

> The Kernel Matrix Heatmap tells you how the kernel is *behaving* — near-empty, richly varied, or saturated. What it cannot tell you is whether the kernel is the right one for your geometry. As you are about to see, the "uninformative" saturated matrix produces the best scores plot of the three, because of what the kernel degenerates into. Read the heatmap alongside the scores plot, never instead of it.

---

## Step 6: Explore the effect of the gamma parameter

Work down through the following values, in this order:

* **Gamma = 0.05**
* **Gamma = 0.02**
* **Gamma = 0.01**
* **Gamma = 0.005**
* **Gamma = 0.002**
* **Gamma = 0.001**

For each value, check both the **Scores Plot** and the **Kernel Matrix Heatmap**.

#### Questions:

* Which gamma gives the cleanest smooth color gradient in the scores plot? Is it where you expected?
* Keep the Step 2 result in mind as you go. Does any of these plots start to look familiar?
* Can you describe in words what happens to the heatmap as you move from too-large to too-small gamma?
* At the smallest gamma, compare the scores plot side by side with the SVD result from Step 2. What do you notice?

👉 Here is what you should find, and it is not what most people expect.

**The color organization improves steadily as gamma gets *smaller*.** At γ = 0.05 the plot is a squashed blob; through γ = 0.02, 0.01 and 0.005 the colors are scrambled; and from γ = 0.002 downwards the spiral reappears, cleaner and cleaner, until at γ = 0.001 it is indistinguishable from the linear PCA result you saw in Step 2.

That is not a coincidence, and it is the most satisfying thing in this tutorial. Look at what happens to the RBF formula when γ becomes very small: exp(−γ‖x − y‖²) ≈ 1 − γ‖x − y‖². The exponential flattens into a straight line, the kernel becomes a simple function of squared distance, and centered kernel PCA reduces to **classical multidimensional scaling — which is linear PCA**. You have watched Kernel PCA turn back into ordinary PCA in front of you, by turning one dial.

This is the theoretical unification Ghojogh & Crowley (2022) describe: kernel PCA is a single framework that contains MDS, Isomap, LLE and Laplacian Eigenmaps as special cases, depending on the kernel you choose. The RBF kernel with a tiny gamma is simply sitting at the "linear PCA" corner of that family.

So the honest summary for this dataset: the best Kernel PCA can manage on the Swiss Roll is to **reproduce linear PCA**. There is no setting of gamma that unrolls the sheet. In a real application you would not know this in advance — you would search over gamma exactly as you have just done, using the kernel matrix and the scores plot as your guides, and you would conclude that this kernel is not the right tool for this geometry.

---

## Step 7: Compare linear PCA and Kernel PCA directly

With your best gamma selected, switch back and forth between:

* **SVD** (linear PCA)
* **Kernel PCA** with **Kernel Type → RBF** and your best gamma from Step 6

Compare the **Scores Plot** each time.

#### Questions:

* Is the difference between the two methods subtle or dramatic?
* Which method reveals the 2D structure of the Swiss Roll?
* Look at the scree plot for linear PCA — high explained variance, wrong structure. What does this tell you about using explained variance as the sole measure of PCA quality?
* Can you describe in your own words, without jargon, why one method succeeds and the other does not?

👉 Here is the honest scorecard, and it is not the one most tutorials would give you.

**Neither method unrolled the Swiss Roll.** Linear PCA photographed it from above. Kernel PCA at a mid-range gamma scrambled it, and at a small gamma quietly reproduced the linear result. On this dataset, the very best Kernel PCA achieves is to match linear PCA — never to beat it.

That may feel like an anticlimax. It should not. You have just learned four things that will serve you on real data:

* **A nonlinear method is not automatically an upgrade.** Kernel PCA has more machinery than linear PCA, and here the extra machinery made things worse before it made them equal. Sophistication is not the same as suitability.
* **The kernel is the model.** Choosing the RBF kernel is a claim that straight-line proximity means similarity. On a rolled-up sheet that claim is false, and no amount of parameter tuning repairs a false claim.
* **Explained variance is not a quality score.** Linear PCA's 71% accompanied a failed unrolling; Kernel PCA's flat spectrum accompanied a worse one.
* **A tidy scores plot is not a correct scores plot.** The most orderly picture in this whole tutorial — the Step 2 spiral — is a picture of the method failing.

> The right method depends on the geometry of your data. The way you find out is not by reading about the methods but by doing exactly what you have just done: run them, color the scores by something meaningful, and check whether the answer matches what the structure ought to be.

---

## Step 8: Limitations and real-world relevance

The Swiss Roll is a clean, almost noise-free example designed to make the comparison vivid — the generated points carry only a small random jitter (a standard deviation of about 0.1, against coordinates spanning more than 20 units), just enough to keep the sheet from being mathematically perfect. Real-world data is far messier.

### Challenges of Kernel PCA in practice

* **Kernel choice**: the RBF kernel is the most versatile, but polynomial, sigmoid, and other kernels exist. There is no universal best choice.
* **Gamma tuning**: without knowing the true structure, gamma must be found by cross-validation, by examining the kernel matrix, or by domain knowledge about typical inter-sample distances.
* **Computational cost**: the kernel matrix is n×n — for 1,000 samples it is 1,000,000 entries. For 50,000 samples it would be 2.5 billion entries. Standard Kernel PCA becomes impractical for very large datasets without approximation methods.
* **No loadings**: you cannot directly interpret which original variables drive each component. The scores are interpretable; the components themselves are not.
* **Choosing the right number of components**: the Scree Plot is still available, but the eigenvalue decay pattern in kernel space is different from linear PCA and may not provide as clear an elbow.

### When Kernel PCA is the right tool

Real-world examples of curved manifold structure were introduced earlier in this tutorial. As a general guide, Kernel PCA tends to work well when:

* **You have a lot of data**: enough samples to fill the manifold without large gaps or isolated outliers
* **The intrinsic dimensionality is low**: the data lives on a surface with only a few degrees of freedom
* **The data is evenly distributed on the manifold**: sparse or clustered regions make nonlinear methods less reliable
* **Closeness in the original space really does mean similarity**: this is the one the Swiss Roll violates, and the one most easily overlooked

A sensible working rule — and one this tutorial has just demonstrated the hard way — is to **start linear**. Establish what ordinary PCA gives you, then reach for a nonlinear method only when you have a concrete reason to believe the structure is curved *and* a kernel that matches the curvature you suspect. Jolliffe & Cadima (2016) survey the nonlinear extensions in this spirit, treating them as specialized tools rather than general upgrades.

For data with genuine nonlinear structure, Kernel PCA — or related methods such as Isomap, LLE, UMAP, or t-SNE — can reveal structure that linear PCA cannot. Ghojogh & Crowley (2022) show that several of these are themselves kernel PCA with a different choice of kernel, which is a useful way to hold the whole family in your head: not competing algorithms, but one framework with different notions of what "similar" means.

> The Swiss Roll is deliberately simple, so the failure of linear PCA is unambiguous. In real data, the choice between linear and nonlinear methods requires domain knowledge, exploratory visualization, and exactly the kind of diagnostic comparison you practiced in Step 7.

---

# What you should take away

After completing this exploration, you should be able to:

* Explain why linear PCA fails on the Swiss Roll — not because there are too many variables, but because the structure is curved
* Describe the **kernel trick**: replacing the data covariance matrix with an n×n kernel matrix of pairwise similarities, enabling PCA in a high-dimensional feature space without computing the transformation explicitly
* Interpret the **RBF kernel parameter gamma**: large gamma → local kernel (fragmented, near-empty matrix); small gamma → global kernel (saturated matrix, and the analysis degenerates towards linear PCA); a well-chosen gamma matches the characteristic length scale of the data — though as this tutorial shows, a good gamma cannot rescue a badly matched kernel
* Read the **Kernel Matrix Heatmap** as a diagnostic for whether gamma is well-calibrated
* Explain why **loadings do not exist for Kernel PCA** (components live in the feature space, not in the original variable space) and what this means for interpretation
* Understand the **limitation of Euclidean-distance kernels** on the Swiss Roll: because the RBF kernel knows only straight-line distance, it cannot tell an adjacent spiral arm from a true neighbor — so no gamma unrolls the sheet, and the best it achieves here is to reproduce linear PCA. Unrolling requires a kernel built on geodesic distance, such as Isomap or LLE
* Recognize that **a nonlinear method is not automatically an improvement**: the kernel encodes an assumption about what "similar" means, and if that assumption is wrong the extra flexibility does not help
* Recognize the **computational limitations** of kernel methods — the n×n kernel matrix becomes expensive for large datasets

---

## Final reflection

> You started with just 3 variables — a dataset you could plot directly and see completely. Yet linear PCA, which successfully compressed 700 correlated spectral variables into meaningful components, could not extract the 2D structure from these 3 coordinates. And Kernel PCA, the more powerful tool, did not rescue it either: it asks a different question — not "in which direction does the most variance lie?" but "which samples are similar to which others, at what length scale?" — and on a rolled-up sheet the RBF kernel answers that second question wrongly. The most valuable thing you can take from this dataset is not a method. It is the habit of checking.

Think about these questions:

* What is the difference between a linear manifold (like the structure in Iris or Wine) and a nonlinear manifold (like the Swiss Roll)? Can you give an example of each from the datasets you have explored?
* For linear PCA, the scree plot and loadings together told you whether the analysis had found something meaningful. For Kernel PCA, what tools play those roles?
* The RBF kernel has no way to measure *path length along the manifold* — it only knows Euclidean distance in 3D. Given that, can you explain why *no* value of gamma unrolls the Swiss Roll? What would a kernel need to know instead?
* At a very small gamma, Kernel PCA reproduced the linear PCA result almost exactly. Can you explain, in your own words, why that happens?
* Kernel PCA's components cannot be expressed as loadings on the original variables. Is this a fundamental limitation, or can you still draw useful conclusions from a kernel PCA analysis?
* Could you use Kernel PCA scores as input features for a predictive model — for example, a regressor predicting the `color #target` value of a new sample? What might be the advantage over using the raw X, Y, Z coordinates directly?

---

## References

Schölkopf, B., Smola, A., & Müller, K.-R. (1997). Kernel principal component analysis. In W. Gerstner, A. Germond, M. Hasler, & J.-D. Nicoud (Eds.), *Artificial Neural Networks — ICANN '97*, Lecture Notes in Computer Science, Vol. 1327, pp. 583–588. Springer.

Schölkopf, B., Smola, A., & Müller, K.-R. (1998). Nonlinear component analysis as a kernel eigenvalue problem. *Neural Computation*, 10(5), 1299–1319.

Mika, S., Schölkopf, B., Smola, A., Müller, K.-R., Scholz, M., & Rätsch, G. (1998). Kernel PCA and de-noising in feature spaces. In M. Kearns, S. Solla, & D. Cohn (Eds.), *Advances in Neural Information Processing Systems* (Vol. 11). MIT Press.

Botre, C., Bhonsle, D., Nemade, C., & Wagh, S. (2022). Comparing the performance of Kernel PCA Mix Chart with PCA Mix Chart for monitoring mixed quality characteristics. *PLOS ONE*, 17(9), e0274265. https://doi.org/10.1371/journal.pone.0274265

Ghojogh, B., & Crowley, M. (2022). *Unsupervised and supervised principal component analysis: Tutorial.* arXiv:1906.03148. https://doi.org/10.48550/arXiv.1906.03148 — shows how kernel PCA unifies MDS, Isomap, LLE and Laplacian Eigenmaps within a single framework.

Jolliffe, I. T., & Cadima, J. (2016). Principal component analysis: a review and recent developments. *Philosophical Transactions of the Royal Society A*, 374(2065), 20150202. https://doi.org/10.1098/rsta.2015.0202
