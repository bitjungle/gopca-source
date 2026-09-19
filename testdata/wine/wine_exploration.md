# Exploring Structure in Data: The Wine Dataset and PCA

## Background: Chemistry, cultivars, and classification

In 1991, Forina *et al.* published a dataset derived from a chemical analysis of wines produced in the same region of Italy but originating from three different grape cultivars. The data was contributed to the UCI Machine Learning Repository by Stefan Aeberhard (Aeberhard & Forina, 1992) and has since become a standard benchmark in multivariate statistics and machine learning.

The original purpose was **classification**: given a set of chemical measurements, can we identify which cultivar a wine belongs to? This is a supervised question — it uses the known cultivar labels to build a model.

Here, we will approach the same dataset with **Principal Component Analysis (PCA)** — an *unsupervised* method that ignores the labels entirely. The question becomes: can we discover the grouping structure from the chemistry alone?

The dataset contains **178 wine samples** belonging to three cultivar classes:

* *class_0* (59 samples)
* *class_1* (71 samples)
* *class_2* (48 samples)

For each wine, **13 continuous chemical variables** were measured:

* Alcohol
* Malic acid
* Ash
* Alcalinity of ash
* Magnesium
* Total phenols
* Flavanoids
* Nonflavanoid phenols
* Proanthocyanins
* Color intensity
* Hue
* OD280/OD315 of diluted wines — an optical measurement rather than a named compound: the ratio of light absorbed at 280 nm to light absorbed at 315 nm by a diluted sample. Phenolic compounds are built around aromatic rings, which absorb strongly near 280 nm, so this ratio works as a quick stand-in for how much phenolic material a wine contains.
* Proline — an amino acid, and the most abundant one in wine. Yeast needs oxygen to break it down, so most of what the grape accumulated while ripening survives fermentation, and how much that is depends strongly on the cultivar. It is reported in mg/L, which is why its values run into the hundreds and thousands while most variables here stay below 10.

Each wine is described by **13 variables** — each sample lives in a **13-dimensional space**, far beyond anything we can directly visualize.

![Vineyards in Piedmont, Italy](./Piedmont_Italy_pexels-lulo.jpg)
*Vineyards in the Piedmont region of Italy — the origin of the wines in this dataset. Photo: Lulo*

---

## From Iris to Wine: why this dataset is harder

In the Iris tutorial, PCA reduced 4 variables to 2 components and captured **95.8% of the total variance** — that figure is for the *standardized* Iris analysis in its Step 6, which is the fair comparison with what we do here. (Iris's default, unstandardized run reaches 97.8%, so you may remember a slightly different number.) Either way the result was nearly complete: almost nothing was lost in the reduction.

Wine is a more realistic challenge. With 13 variables, several things change:

**The pairplot is no longer practical.** Recall from the Iris tutorial that a pairplot has *N(N−1)/2* panels. For 13 variables that is **78 panels** — exactly what was predicted in that table. The pairplot below is included so you can see this problem directly.

![Wine pairplot](./wine_pairplot.png)

Take a moment to look at it. Notice the scale differences across the axis ranges — some variables range from 0 to 2, others from 0 to 1700.

> With 13 variables you can look at individual panels, but you cannot hold the full 13-dimensional picture in your head. PCA can.

**Less variance falls in the first two components.** For Wine, two components explain around 55% of the total variance rather than 96%. The 2D scores plot is still informative, but it is an incomplete summary — more of the story lives in components 3, 4, and beyond.

**Preprocessing becomes essential, not optional.** The 13 variables are measured on completely different scales. Proline ranges from roughly 300 to 1700; nonflavanoid phenols range from 0.1 to 0.7. PCA finds directions of maximum variance — so without rescaling, it will simply find the direction in which Proline varies most, regardless of whether that is chemically interesting. This is not a subtle effect. You will see it clearly in Step 1.

---

# Your task: Discover the structure using PCA

You will use **GoPCA** to explore the dataset. Work through the steps in order — the sequence is deliberate.

---

## Step 1: Run PCA *without* standardization first

> **Settings** — Column-wise: **Mean Center Only** (the default) · Method: **SVD** · Components: **5** (the default)

Load the dataset by clicking the **Wine** sample-dataset button — if you opened this tutorial from that button, the data is already loaded. Leave every setting at its default and click **Go PCA!**.

#### Questions:

* Open the **Scores Plot**. Set **Color by** to `classes`. Do the three cultivar classes form clear clusters?
* Now open the **Loadings Plot** — which variable dominates, and by how much compared to the others?
* Open the **Scree Plot** — how much variance does PC1 alone explain?

👉 The scree plot should read **PC1 = 99.8%**. Not most of the variance — essentially all of it, on a dataset with thirteen variables.

The loadings plot explains why. `proline` has a loading of **1.000**; the next largest is `magnesium` at 0.018, and everything else is smaller still. PC1 is not a combination of the chemistry at all — it is proline, and nothing else.

Proline ranges from 278 to 1680 while most other variables range from 0 to 10, so its numerical variance is roughly **100,000**, against 0.02 for nonflavanoid phenols. PCA is doing exactly what it is designed to do: finding the direction of maximum variance. The problem is that numerical scale is not the same as chemical importance.

Look at the scores plot too. With one variable carrying the whole component, the three cultivars smear along a single axis rather than forming clusters.

---

## Step 2: Apply Standard Scale and compare

> **Settings** — Column-wise: **Standard Scale (Mean + Std Dev)** · Method: SVD · Components: 5

Now switch preprocessing to **Standard Scale (Mean + Std Dev)** and click **Go PCA!** again.

Standard Scale divides each variable by its standard deviation after centering, giving every variable unit variance. This puts all 13 variables on equal footing before PCA begins.

#### Questions:

* How does the scores plot change compared to Step 1?
* Do the three cultivar classes separate more clearly or less clearly?
* Open the Loadings Plot — are all 13 variables now contributing, rather than just one?

👉 With Standard Scale the three cultivar classes separate clearly in the scores plot, and the loadings spread across the whole chemistry: PC1's largest is now `flavanoids` at 0.423, with five other variables above 0.28. PC1 falls from 99.8% to **36.2%** — not because information was lost, but because it is no longer one variable wearing thirteen variables' clothing.

This is why standardization is described as *essential* for datasets with mixed units — not a preference, but a requirement for meaningful results.

> Keep **Standard Scale** active for all remaining steps.

---

## Step 3: How complete is the 2D picture?

> **Settings** — Column-wise: Standard Scale · Method: SVD · Components: 5

Open the **Scree Plot**.

#### Questions:

* How much variance do PC1 and PC2 explain together?
* How many components would you need to capture 85% of the variance?
* Compare this to the Iris dataset — what does the difference tell you?

👉 For Wine the first two components explain **55.4%** of the variance — 36.2% and 19.2%. That is much less than Iris, and it means the 2D scores plot shows you *most of the cultivar separation* but not the complete story.

Reaching 85% takes **six** components, and you will need to raise the component count above the default of 5 to see that in the scree plot. Structure is genuinely spread across components 3, 4 and beyond.

This is normal for real chemical data with 13 correlated variables. The 2D plot is still useful and informative — but you should be aware of what it is not showing.

---

## Step 4: Understand why the separation happens — Loadings and Circle of Correlations

> **Settings** — Column-wise: Standard Scale · Method: SVD · Components: 5

GoPCA offers two complementary views of the variable structure. Open both and compare them.

### The Loadings Plot

The Loadings Plot shows the loading of each variable on **one component at a time** as a bar chart. Switch between PC1 and PC2 using the component selector.

The dashed threshold lines mark **±1/√p**, which for Wine's 13 variables is **±0.277**. That is the loading every variable would have if all thirteen contributed equally, so a bar reaching past the line is carrying more than its even share of that component. It is a reference level, not a significance test.

#### Questions:

* On PC1: which variables have large negative loadings? Which have large positive loadings?
* Do the same variables dominate PC2, or does a different group take over?
* Which variables have small loadings on both components — meaning they contribute little to either?

👉 **PC1** is carried almost entirely by one side: `flavanoids` (0.423), `total_phenols` (0.395), `od280/od315` (0.376), `proanthocyanins` (0.313), `hue` (0.297) and `proline` (0.287) all clear the line positively, while only `nonflavanoid_phenols` (−0.299) clears it negatively. PC1 is essentially a phenolic-richness axis.

**PC2 hands over to a different cast entirely**: `color_intensity` (0.530), `alcohol` (0.484), `proline` (0.365), `ash` (0.316) and `magnesium` (0.300), with `hue` (−0.279) opposing them. Note `proline` appears on both — it is the one variable meaningfully involved in each.

**`malic_acid` and `alcalinity_of_ash` fall below the line on both**, which does not mean they are unimportant. It means their variance lives in PC3 and beyond, and the 2D view is not the place to judge them.

### The Circle of Correlations

Now open the **Circle of Correlations**. This plot shows all 13 variables simultaneously as arrows (vectors) in the PC1–PC2 plane. Two things to read:

* **Direction**: variables pointing in the same direction are positively correlated with each other; variables pointing in opposite directions are negatively correlated. Arrows pointing at 90° are uncorrelated.
* **Length**: an arrow's two coordinates are the variable's correlations with PC1 and PC2 *separately*, so its distance from the origin is their combined magnitude, √(r₁² + r₂²). Because the two axes are uncorrelated, squaring that distance gives the fraction of the variable's variance this plane captures — its *communality*. An arrow reaching 0.92 has 84% of its variation described by PC1 and PC2; one reaching 0.50 has just 25%. The dotted inner circle sits at √½ ≈ 0.707, which is exactly the halfway mark — arrows past it have more than half their variance in this plane, arrows inside have less.

#### Questions:

* Can you identify the **phenolic group** — `flavanoids`, `total_phenols`, `proanthocyanins` and `od280/od315_of_diluted_wines` — pointing in the same direction? What does this tell you about their mutual correlation?
* Where do `color_intensity`, `malic_acid`, and `alcalinity_of_ash` point relative to the phenolic group?
* `hue` points roughly with the phenolics but not quite. Is it one of them?

👉 The four phenolic variables really do travel together — they correlate with one another at **0.69** on average, which is why their arrows nearly coincide. `color_intensity`, `malic_acid` and `alcalinity_of_ash` point away from them, and that opposition is the chemical backbone of PC1.

**`hue` is the interesting case, and it is not a phenolic.** It is a color ratio, and it correlates with the four phenolics at only 0.30 to 0.57 — noticeably weaker than their 0.69 with each other. What it really tracks is the *other* group, negatively: −0.52 with `color_intensity` and −0.56 with `malic_acid`. It sits near the phenolics because deeply colored, acidic wines are also the phenol-poor ones, not because hue measures a phenol. A variable can join a cluster in a biplot by opposing that cluster's opposite.
* No arrow quite reaches the outer circle, and you can now say exactly why. `flavanoids` comes closest at 0.92, so PC1 and PC2 account for 84% of its variance — the best-described variable in the plot, and no coincidence that it is also the largest loading on PC1. Six variables fall *inside* the dotted circle: `proanthocyanins` (47%), `nonflavanoid_phenols` (42%), `malic_acid` (41%), `magnesium` (32%), `alcalinity_of_ash` (27%) and `ash` (25%). For those, this plane describes less than half of what they do, and any conclusion you draw about them from this view is built on a minority of their behavior.
* Here is the satisfying part. Average those thirteen percentages and you get **55.4%** — precisely the variance PC1 and PC2 explain together, straight from Step 3. The scree plot gives you that number for the dataset as a whole; the Circle of Correlations gives you the same number broken out variable by variable. They are two views of one fact.

> **Loadings Plot vs Circle of Correlations — when to use which:**
> Use the **Loadings Plot** to read a variable's contribution to one specific component: the weights that build the axis. Use the **Circle of Correlations** to see two components at once — how the variables relate to one another, and how much of each variable the plane actually captures.
>
> The two answer genuinely different questions. A loading says *how a variable helps build a component*; a correlation says *how well the component describes that variable*. `ash` illustrates the difference: it loads 0.316 on PC2, a respectable contribution to that axis, yet its arrow reaches only 0.499 — barely a quarter of `ash` is explained by this plane at all.

---

## Step 5: Combine both views — the Biplot

> **Settings** — Column-wise: Standard Scale · Method: SVD · Components: 5

Open the **Biplot**.

The biplot places samples (scores) and variables (loadings) in the same plot. Loading arrows point in the direction of increasing variable value; longer arrows indicate stronger influence on those components.

#### Questions:

* Which loading arrows point toward the class_1 cluster?
* Which arrows point toward the class_2 cluster?
* Do any variables separate class_0 from the other two?
* Where do `proline` and `alcohol` point relative to the cultivar clusters?

👉 You can read a chemical story directly from the biplot, but it is not a tidy three-way split — and the reason why is the most interesting thing in this step.

**Two groups of arrows point at two cultivars:**

- The phenolic group pulls toward **`class_0`**, whose wines average 2.98 flavanoids against 2.08 and 0.78 for the other two
- `color_intensity` and `malic_acid` pull toward **`class_2`**, which leads on both (7.40 and 3.33)

**`proline` and `alcohol` point at `class_0` as well** — the same cluster as the phenolics, not at a third one. `class_0` has the highest proline by a wide margin (1116, against 520 and 630) and the highest alcohol (13.74). There is simply no third direction for them to point in.

So what defines the remaining cultivar? **`class_1` is the maximum of nothing.** It has the *lowest* proline, the *lowest* alcohol and the *lowest* color intensity, with middling phenolics. No arrow points at it, because it is not chemically extreme in any of these measurements — it is the wine that is unremarkable in every direction the first two components describe.

That is worth pausing on. A cluster with no arrow pointing at it is not a failure of the biplot; it is the biplot telling you that this group is defined by moderation rather than by excess. It also predicts what Step 6 will show: a group that sits between two others, with nothing pushing it away from either, is the group that will overlap.

The biplot makes the *why* visible. The scores plot shows *that* the classes separate; the biplot shows *what drives the separation* — and, here, what fails to drive it.

---

## Step 6: How well separated are the classes?

> **Settings** — Column-wise: Standard Scale · Method: SVD · Components: 5

Enable **Confidence Ellipses** (95%) on the Scores Plot.

#### Questions:

* Which two cultivar classes overlap most?
* Which class is best separated from the other two?
* What does overlapping ellipses tell you about the difficulty of classification?

👉 Each class has a [centroid](https://en.wikipedia.org/wiki/Centroid): the average position of all its samples, the point sitting at the middle of that cluster. Assign every wine to whichever centroid it lies nearest in the PC1–PC2 plane and the picture is precise:

| | nearest its own centroid |
|---|---|
| class_0 | 58 / 59 (98%) |
| class_1 | 67 / 71 (94%) |
| **class_2** | **48 / 48 (100%)** |

`class_2` is perfectly separated in two dimensions — the deeply colored, acidic, phenol-poor wines are unmistakable. Nearly all the confusion is between **`class_0` and `class_1`**: four wines, one each way plus three more from `class_1`. A fifth wine, also from `class_1`, falls nearest `class_2`. Five misassignments in total, and every one of them belongs to a class that borders another.

This is exactly what Step 5 predicted: `class_1` has no arrow of its own, sits between the other two, and accounts for four of the five.

Try adjusting the confidence level to 90% and 99%:

* At 99%, do the ellipses for the overlapping classes merge completely?
* What does this mean for a classifier trying to distinguish those two cultivars?

👉 Remember what a wider ellipse means: it encloses a larger share of each group, so overlap grows with the confidence level. That is a statement about coverage, not about the groups becoming less distinct. Five misassigned wines out of 178 is a good result, and it comes from a 2D picture holding only 55% of the variance.

---

## Step 7: The 3D scores plot

> **Settings** — Column-wise: Standard Scale · Method: SVD · Components: 5

Switch to the **3D Scores Plot** (PC1 vs PC2 vs PC3).

#### Questions:

* Does the separation between the overlapping cultivar classes improve in 3D?
* Recall that PC1 + PC2 explained ~55% of the variance. How much does PC3 add?
* Does rotating the 3D plot reveal structure that was hidden in the 2D view?

👉 PC3 adds **11.1%**, taking the cumulative from 55.4% to **66.5%** — a substantial addition, and far more than a third component usually contributes once the first two have done their work. That is what a scree plot without a sharp elbow looks like from the inside.

This contrasts with standardized Iris, where PC3 adds 3.7% and the third dimension mostly confirms what the first two already showed.

---

# What you should take away

After completing this exploration, you should be able to:

* Explain why standardization is essential for datasets with mixed measurement units — and demonstrate the difference it makes
* Interpret a scree plot and understand what it means when explained variance is spread across many components
* Read a loadings plot to identify groups of correlated variables
* Use a biplot to connect the separation of groups to specific chemical variables
* Recognize the limits of a 2D PCA summary when explained variance is substantially below 100%

---

## Final reflection

> You started with 13 variables. A pairplot gave you 78 panels — informative but unmanageable. PCA gave you a single optimal 2D projection, with a quantified measure of how much was preserved.

Think about these questions:

* The standardized Iris scores plot captured 95.8% of variance in 2D. The Wine scores plot captures 55.4%. Is the Wine PCA result less useful — or is it doing something more impressive given the complexity of the data?
* Without standardization, proline dominated everything. Yet proline may not be the most chemically interesting variable for distinguishing cultivars. What does this tell you about the relationship between numerical variance and scientific importance?
* The phenolic variables cluster together in the loadings. What does it mean, chemically, that these variables point in the same direction?
* Could you use PCA scores as input features for a supervised classifier? What might be the advantage over using the raw 13 variables directly?

---

## Reference

Aeberhard, S., & Forina, M. (1992). *Wine* [Dataset]. UCI Machine Learning Repository.
https://doi.org/10.24432/C5PC7J
