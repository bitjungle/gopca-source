# Exploring Structure in Data: The Iris Dataset and PCA

## Background: A classic dataset

In 1936, the statistician and biologist Ronald Fisher published one of the most famous datasets in data analysis: the **Iris dataset**. The measurements were originally collected by botanist **Edgar Anderson**, who measured 150 iris flowers in the field. Fisher used the data as an example of **linear discriminant analysis (LDA)** — a supervised method for separating known groups.

Here, we will approach the same dataset with **Principal Component Analysis (PCA)** — an *unsupervised* method that reveals structure without using the species labels. This is a deliberately different question: can we discover the grouping on our own, just from the measurements?

The dataset contains measurements of 150 iris flowers belonging to three species:

![Iris setosa](./photo_Iris_setosa.jpeg)
*Iris setosa — Photo: Tia Monto*

![Iris versicolor](./photo_Iris_versicolor.jpeg)
*Iris versicolor — Photo: Charles de Mille-Isles*

![Iris virginica](./photo_Iris_virginica.jpeg)
*Iris virginica — Photo: Frank Mayfield*

For each flower, four variables (features) were measured (in cm):

* Sepal length
* Sepal width
* Petal length
* Petal width

This means each flower is described by **4 variables**, or equivalently, each sample lives in a **4-dimensional space**.

---

## First look at the data

Below you see a *pair plot* of the dataset, showing all pairwise relationships between variables. The diagonal shows the distribution of each individual variable, either as a density curve (KDE), revealing how the values of a single feature are spread (e.g. center, variability, skewness).

![Iris pairplot](./iris_pairplot.png)

Take a few minutes to look at it carefully.

---

### Reflect:

* Can you already see separation between species?
* Which variables seem most important?
* Are some variables strongly correlated?

👉 You are currently looking at **many 2D projections of a 4D dataset**.
This is useful — but also limited.

---

## Could you just use the pairplot?

For the Iris dataset, with only 4 variables, the pairplot is manageable — and the species separation is already visible. So why bother with PCA?

The answer becomes clearer when you scale up. The number of panels in a pairplot grows as *N(N−1)/2*:

| Variables | Pairplot panels |
|----------:|----------------:|
|         4 |               6 |
|        13 |              78 |
|       100 |           4,950 |
|      1000 |         499,500 |

The Wine dataset in this application has 13 variables — that is already 78 panels to inspect. In spectroscopy or genomics, datasets routinely have hundreds or thousands of variables. A pairplot becomes impossible.

PCA solves this by finding the **single 2D projection that retains the most variance** — provably the best linear summary available. The scores plot is not just *a* 2D view of the data; it is the *optimal* one. And the explained variance percentage shown on the axis labels tells you exactly how much information was kept in that projection.

The **biplot** adds a second layer the pairplot cannot provide: the loading vectors show *why* the samples are arranged as they are — which original variables pull in which directions. This connects the compressed view back to the measurements you actually took.

> The pairplot shows you what you measured. The PCA scores plot shows you the structure hidden across all measurements simultaneously.

---

## The challenge

Working directly in 4 dimensions is difficult. Even with pair plots, we only ever see *two variables at a time*.

Your task is to use **Principal Component Analysis (PCA)** to:

> Reduce the dimensionality of the dataset while preserving as much structure as possible.

Think of PCA as:

* A way to **compress** the data
* A way to **rotate the coordinate system**
* A way to find **new axes that reveal patterns more clearly**

---

# Your task: Discover the structure using PCA

You will use the application **GoPCA** to explore the dataset.

Do not try to "get the right answer" immediately.
Instead, **experiment, observe, and reflect**.

---

## Step 1: Load the data and run PCA

> **Settings** — Column-wise: **Mean Center Only** (the default) · Method: **SVD** · Components: **3** (the default for a 4-variable dataset)

* Load the dataset by clicking the **Iris** sample-dataset button — if you opened this tutorial from that button, the data is already loaded
* Leave the preprocessing at its default, **Mean Center Only**, and click **Go PCA!**

Steps 1 to 5 all use these settings. Step 6 deliberately changes them, and it is worth knowing what you were looking at before it does.

### Look at the **Scores Plot (PC1 vs PC2)**

#### Questions:

* Do the species form clusters?
* Is any species clearly separated?
* How much of the data structure seems captured in 2D?

👉 **Setosa** is the one that separates cleanly. On PC1 its flowers run from −3.22 to −2.20, while every other flower sits at −0.91 or above — a clear gap with nothing in it. Versicolor and virginica do separate from *each other* along the same axis, but they overlap: 39 of those 100 flowers fall in the band where the two species share territory.

That pattern — one group cleanly apart, two graded into each other — is worth remembering. PCA did not know there were three species; it found this from the four measurements alone.

---

## Step 2: Explore explained structure

> **Settings** — Column-wise: Mean Center Only · Method: SVD · Components: 3

Open the **Scree Plot**. This is the standard tool for deciding how many principal components to keep. Each bar shows how much of the total variance in the dataset is explained by one component. The bars are ranked — PC1 always explains the most, PC2 the second most, and so on.

Two things to look for:

* **The elbow** — the point where the bars stop dropping steeply and start flattening out. Components before the elbow carry real structure; components after it mostly capture noise.
* **The cumulative percentage** — the running total shown above the bars. Once this reaches 80–90%, you have likely captured the main patterns in the data.

#### Questions:

* How much variance does PC1 explain on its own?
* How much do PC1 and PC2 together explain?
* Where is the elbow — after the first component, the second, or later?
* How many components would you keep based on the Scree Plot?

👉 You should find **PC1 ≈ 92.5%** on its own and **PC2 ≈ 5.3%**, so the two together carry **97.8%** — nearly everything. PC3 adds 1.7% and PC4 the remaining 0.5%. The elbow is unusually sharp: it comes straight after PC1, which is why a single axis tells most of this dataset's story.

Try switching to a **3D Scores Plot** and compare with your Scree Plot reading:

* Does the 3D plot reveal additional structure that the 2D plot misses?
* Does PC3's contribution in the Scree Plot justify the added complexity?

> **Something to think about:** GoPCA defaults to **3** components here, one fewer than the dataset has variables. Raise **Components** to **4** and re-run. What is the cumulative explained variance now? Why does a 4-component model explain *exactly* 100% of the variance — and how does the number of variables in this dataset relate to that?
>
> 👉 PCA cannot create more independent directions than there are variables. With 4 variables, the data lives in at most 4-dimensional space, so 4 components account for all of it. There is nothing left to explain. This is why the Scree Plot always has at most as many bars as your dataset has variables — and why adding a fifth component here would be meaningless.

---

## Step 3: Understand *why* the separation happens

> **Settings** — Column-wise: Mean Center Only · Method: SVD · Components: 3

Now open the **Loadings Plot**.

This plot tells you how the original variables contribute to the principal components.

#### Questions:

* Which variables influence PC1 the most?
* Which variables influence PC2?
* Are some variables pointing in similar directions (correlated)?

👉 Reading the plot:

* Variables pointing in the same direction → positively correlated
* Opposite directions → negatively correlated
* Long arrows → strong influence

What you should see: **petal length dominates PC1** at 0.857, with sepal length (0.361) and petal width (0.358) contributing modestly and sepal width almost nothing (−0.085). PC2 is a different story — there it is the two *sepal* measurements that matter (0.657 and 0.730) and the petals that fall away.

The correlations behind this are strong: petal length and petal width move together at **r = 0.96**, and both track sepal length (0.87 and 0.82). Sepal width is the odd one out, correlating weakly and negatively with all three.

> Keep petal length's 0.857 in mind. Step 6 will show that it owes some of that dominance to something other than importance.

---

## Step 4: Combine both views (Biplot)

> **Settings** — Column-wise: Mean Center Only · Method: SVD · Components: 3

Open the **Biplot**, which shows:

* Samples (scores)
* Variables (loadings)

in the same plot.

#### Questions:

* Which variables "pull" the clusters apart?
* Why is one species clearly separated?
* Which measurements seem most important for distinguishing species?

👉 Hint:

* Look especially at **petal-related variables**

---

## Step 5: Use color and grouping

> **Settings** — Column-wise: Mean Center Only · Method: SVD · Components: 3

In GoPCA, set **Color By → `species`** and enable **Confidence Ellipses**.

> **Why `species` colors the groups distinctly.** It holds the names, so GoPCA treats it as categorical and gives each species its own color. You will meet versions of this dataset that store the species as the codes 0, 1 and 2 instead — a common convention, and one worth being careful with. A column of codes is read as a *quantity*, so it renders a color ramp, implying that versicolor sits numerically between setosa and virginica. It does not; the codes are arbitrary labels.
>
> If you have such a file, mark the column `#category` in GoCSV — right-click the header and choose **Mark as Category Column**. That tells GoPCA the numbers are labels, and the coloring becomes discrete again.

#### Questions:

* How distinct are the clusters?
* Do ellipses overlap?
* Which species are hardest to distinguish?

👉 Setosa's ellipse sits well clear of the other two. Versicolor and virginica overlap, and they are the pair that is hard to tell apart — the same 39 flowers from Step 1, seen a different way.

Try adjusting the confidence level (90%, 95%, 99%):

* What happens to the overlap as you increase the confidence level?

👉 The ellipses grow, so the overlap grows with them. That is worth thinking about: a wider ellipse is not evidence of worse separation, it is a wider net around the same data. The confidence level is a statement about how much of each group you want enclosed, not about how distinct the groups are.

---

## Step 6: Investigate preprocessing (very important!)

> **Settings** — Column-wise: **Mean Center Only**, then **Standard Scale (Mean + Std Dev)** · Method: SVD · Components: 3

Now repeat the analysis with different preprocessing settings.

In GoPCA, try switching between:

* **Mean Center Only** — subtracts the mean of each variable, but does not rescale
* **Standard Scale** — subtracts the mean *and* divides by the standard deviation, giving each variable unit variance

#### Questions:

* Does the PCA result change between the two settings?
* Which variables dominate when you use **Mean Center Only**?
* Why might **Standard Scale** be important here?

👉 All four variables are measured in cm, so there is no unit mismatch to fix here. What there is instead is one variable with far more spread than the rest:

| Variable | Variance |
|---|---|
| sepal length | 0.686 |
| sepal width | 0.190 |
| **petal length** | **3.116** |
| petal width | 0.581 |

It is not petals against sepals — petal *width* is actually the second **smallest** of the four, below sepal length. It is **petal length alone**, with roughly five times the spread of anything else. That is what PC1 was reporting in Step 3 when it gave petal length a loading of 0.857 against 0.36 or less for everything else.

Standardizing removes that advantage by giving every variable unit variance, and the result changes visibly:

| | PC1 | PC2 | PC1 + PC2 |
|---|---|---|---|
| Mean Center Only | 92.5% | 5.3% | 97.8% |
| Standard Scale | 73.0% | 22.9% | 95.8% |

PC1's share falls by nearly twenty points, and PC2 rises fourfold — because PC1 is no longer largely a report on petal length. Its loadings even out too: 0.580, 0.565 and 0.521 for petal length, petal width and sepal length, with sepal width at −0.269.

Neither answer is "wrong". Without scaling you learn which measurement varies most; with scaling you learn which combination of measurements best distinguishes the flowers. Knowing which question you are asking is the point of this step.

---

## Step 7: Push your understanding further

Try these explorations:

* **Focus only on two species** by filtering the dataset in GoCSV before loading into GoPCA

  * Are two species easier to separate than three?

* **Exclude one variable at a time** directly in GoPCA Desktop — untick a column in the data table below the plot and click **Go PCA!** again. No round trip through another tool is needed.

  * Does separation get worse or better when you remove petal length?
  * What about sepal width?

* **Rotate the 3D plot interactively**

  * Do you see structure not visible in the 2D plot?

---

# What you should take away

After completing this exploration, you should be able to:

* Understand PCA as a **tool for dimensionality reduction**
* Interpret:

  * Scores plots
  * Loadings plots
  * Biplots
* Explain how PCA can:

  * Reveal hidden structure in unlabelled data
  * Compress high-dimensional data into fewer dimensions
* Recognize the importance of:

  * Preprocessing (mean centering vs. standardization)
  * Variable relationships and correlation

---

## Final reflection

Think about this:

> You started with 4 variables and many pairwise plots.
> With PCA, you reduced the dataset to 2–3 dimensions and *revealed its structure more clearly*.

* Did PCA make the data easier to understand?
* What information was preserved — and what might have been lost?
* Fisher used LDA on this same dataset. How do you think PCA and LDA would differ in what they reveal?
