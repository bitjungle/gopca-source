# Exploring Structure in Data: The Body Measures Dataset and PCA

![Vitruvian Man](./vitruvian_man.jpg)
*Leonardo da Vinci's* Vitruvian Man *(c. 1490) — a Renaissance study of the
proportions of the human body. Five centuries later, we will study the same
question — human size and shape — with PCA. Public-domain illustration via
Wikimedia Commons.*

## Background: measuring the human body

Every two years, the US **National Health and Nutrition Examination Survey
(NHANES)** sends trained examiners to measure a representative sample of the US
population. The **body-measures** component records standardized anthropometric
measurements — weight, height, and a set of lengths and circumferences — taken
with the same protocol for every participant.

This dataset is drawn from the 2017–2018 NHANES cycle. Unlike the Iris and Wine
datasets, which are small curated benchmarks assembled to demonstrate a method,
this is a slice of a **real population survey**: **5096 adults** (age 18 and
over), each described by **seven measurements**:

* Weight (kg)
* Height (cm)
* Upper leg length (cm)
* Upper arm length (cm)
* Arm circumference (cm)
* Waist circumference (cm)
* Hip circumference (cm)

Each person is therefore a point in a **7-dimensional space**.

---

## A different kind of question

In the Iris and Wine tutorials, the data came with **known groups** (flower
species, grape cultivars), and the interesting question was whether PCA could
recover that grouping without being told the labels.

Body measures pose a different question. There are no natural "classes" of
people hiding in these seven numbers. Instead, the measurements are all driven by
a few **underlying factors** — and our goal is to let PCA *reveal what those
factors are*. As you will see, the components PCA finds here are not arbitrary
mathematical axes; they turn out to have clear, interpretable meaning.

This is one of the oldest and most elegant uses of PCA. In a classic 1960 study
of painted turtles, Jolicoeur and Mosimann showed that when you apply PCA to a
set of body measurements, the first component captures overall **size** and the
later components capture **shape** — the proportions that remain once size is
accounted for. We will rediscover exactly this structure in human data.

---

## First look at the data

Below is a *pair plot* of the seven measurements for a sample of adults, colored
by sex. The diagonal shows each variable's distribution; the off-diagonal panels
show every pairwise relationship.

![Body measures pairplot](./body_measures_pairplot.png)

Take a few minutes to study it.

### Reflect:

* Look at the scatter panels. Do the clouds mostly slope **upward** — that is,
  are the measurements **positively correlated**? Is anyone who is larger in one
  dimension tending to be larger in the others?
* Are there panels where the relationship is **weak** (a round, shapeless cloud)?
  Look at hip versus leg length, or hip versus height.
* On the diagonals, where do the two sexes differ most — in the **length**
  variables (height, leg, arm length) or the **girth** variables (waist, hip)?

👉 Almost every panel slopes upward: bigger people tend to be bigger *everywhere*.
This shared "everyone-grows-together" tendency is the signature of a single
dominant factor — overall body size — and it is what PC1 will capture.

👉 On the last question, the answer is **the lengths, by a wide margin**. Measured
as a standardized difference between the sexes, height separates them most
(*d* = 1.9), then arm length (1.4) and leg length (1.3). The girth measurements
barely separate them at all: waist 0.2, arm circumference 0.3.

One measurement runs the other way. **Hip circumference is the only one of the
seven where women's average exceeds men's** (*d* = −0.3). Hold on to that — it
turns out to matter far more than its size suggests, and Step 4 comes back to
it.

---

## Why all these positive correlations matter

The pattern of correlations is easier to read as a heat map:

![Correlation matrix](./body_measures_correlation.png)

Two things stand out:

* **Every correlation is positive.** No measurement shrinks as another grows.
* There are **two blocks**. The *girth/mass* measurements (weight, arm
  circumference, waist, hip) correlate strongly with each other (around
  0.80–0.89). The *length* measurements (height, leg length, arm length)
  correlate strongly with each other (around 0.65–0.81). But the two blocks are
  only weakly related — hip and leg length correlate just 0.03.

Keep this picture in mind. The all-positive structure will produce the **size**
component; the two weakly-connected blocks will produce the **shape** component.

> **A note on why the first component *must* be a size factor.** When every
> variable is positively correlated with every other, a mathematical result
> (the Perron–Frobenius theorem) guarantees that the leading eigenvector of the
> correlation matrix has **all entries of the same sign**. In plain terms: if
> everything grows together, the single direction that best summarizes the data
> is the one where everything increases at once — a general size axis. This is
> not a quirk of this dataset; it is a property of any set of positively
> correlated measurements.

---

# Your task: find the hidden factors using PCA

You will use **GoPCA** to explore the dataset. Work through the steps in order —
the sequence is deliberate. Do not rush to "the answer"; **experiment, observe,
and reflect**.

---

## Step 1: Standardize first, then run PCA

> **Settings** — Row-wise: **None** · Column-wise: **Mean Center Only**, then **Standard Scale** · Method: **SVD** · Components: **5**

The seven measurements are on very different scales. Weight is tens of kilograms
with a large spread; arm length is tens of centimetres with a small spread. In
fact the numerical variance of weight is roughly **60 times** that of arm length.

PCA finds directions of maximum variance, so if you feed it the raw numbers it
will fixate on whichever variable happens to have the largest units — here,
weight — and ignore the rest.

Try it both ways.

* First set **Step 2: Column-wise Preprocessing → Mean Center Only** and click
  **Go PCA!**. Open the **Loadings Plot** for PC1.
* Then set it to **Standard Scale (Mean + Std Dev)** and click **Go PCA!** again.
  Compare the PC1 loadings.

#### Questions:

* With **Mean Center Only**, which two or three variables dominate PC1? Do the
  length variables contribute anything?
* With **Standard Scale**, do all seven variables now contribute?

👉 Without standardization, PC1 is essentially "weight + waist + hip" — those
three carry loadings of 0.71, 0.53 and 0.42, while the three length measurements
manage only 0.03 to 0.12. The high-variance columns drown everything else out.
**Standard Scale** divides each variable by its standard deviation, giving all
seven equal footing. Only then does the full size-and-shape structure emerge.

> Keep **Standard Scale (Mean + Std Dev)** active for every remaining step, with
> **Components: 5** — Steps 6 and 7 need the third component.

---

## Step 2: The first component is *size*

> **Settings** — Column-wise: **Standard Scale** · Method: SVD · Components: 5

With Standard Scale active, open the **Scree Plot**.

#### Questions:

* How much variance does PC1 explain on its own?
* How much do PC1 and PC2 together explain?
* Where is the elbow?

You should find that PC1 explains about **60%** of the variance and PC2 about
**29%**, so the two together capture roughly **88%** — a compact, informative 2D
summary.

Now open the **Loadings Plot** and look at **PC1**.

#### Questions:

* What do the **signs** of the seven PC1 loadings have in common?
* Are any of them near zero, or do all seven contribute?

👉 Every PC1 loading has the **same sign**, and all seven are sizeable. That is
the fingerprint of a **general size factor**: moving along PC1 means getting
larger (or smaller) in *all seven measurements at once*. A person high on PC1 is
simply a bigger person — taller, heavier, wider all around.

We can put a number on that reading. If PC1 really is "everything at once", it
should agree with the crudest possible size score: standardize all seven
measurements and simply average them, weighting each equally. It does —
**r = 0.99**. PC1 is, to within one percent, that plain average. Whatever else it
is doing, it is measuring overall size.

### A tempting confirmation that does not survive inspection

BMI is the obvious external check, so let us make it. Set
**Color by → `BMI_class#category`** on the **Scores Plot**. The file carries BMI
twice — as a continuous value and binned into the four WHO categories — and the
categories show the pattern far more plainly, because discrete bands have visible
edges where a smooth color ramp does not.

#### Questions:

* The four classes form bands across the plot. Do the boundaries between them run
  **vertically**, or are they **slanted**?
* If BMI were simply another name for PC1, which of the two would you expect?

👉 The bands are unmistakably **diagonal**. Underweight sits at the upper left and
the classes march down and to the right — Normal, Overweight, Obese — with the
boundaries between them slanting up to the right rather than standing vertical.

Had BMI been a PC1 quantity, those boundaries would be vertical stripes: every
person at a given PC1 would share a BMI class regardless of their PC2. They
plainly do not. Now switch to **Color by → `BMI#target`** and you will see the
same thing as a continuous ramp — dark at the upper left, light at the lower
right — which is the same finding, just harder to see.

Its correlation with PC1 is **+0.79**, and reported on its own that number reads
as clean confirmation. It is not the whole story.

| | correlation with BMI |
|---|---|
| PC1 | **+0.79** |
| PC2 | **−0.58** |

PC1 alone accounts for 63% of the variation in BMI; PC1 and PC2 together account
for **96%**. BMI is very nearly half size and half shape.

That is not a defect in the analysis — it is what BMI *is*. BMI = weight ÷ height²
is deliberately **size-adjusted**: it asks how heavy you are *for your height*.
Being heavy for your height is exactly the girth-versus-length contrast that PC2
encodes, so a large PC2 component is precisely what BMI ought to have. A quantity
built to divide out size cannot be a pure measure of size.

> **A habit worth forming.** The +0.79 is correct, and on its own it would have
> let us believe the gradient runs along PC1. It does not. "Is PC1 a size axis?"
> and "does BMI align with PC1?" are different questions, and only the first one
> is answered by that number. Whenever a single statistic is carrying a
> conclusion, ask what else that statistic is equally consistent with.

### Seeing all of this at once

Rather than coloring by one target at a time and squinting at gradients, open
the **Eigencorrelation Plot**. It shows the correlation between every component
and every held-out column in the file (`#target` and `#category` alike) as a heat map — so the BMI row displays
+0.79 under PC1 and −0.58 under PC2 side by side, and the diagonal is obvious
without any inference from the scores plot. Keep it in mind for Steps 4 and 6,
where the same question comes up about sex and about age.

---

## Step 3: The second component is *shape*

> **Settings** — Column-wise: Standard Scale · Method: SVD · Components: 5

If PC1 is size, what is left for PC2 to describe? Once you know how *big* someone
is, the remaining question is how they are *proportioned* — and that is exactly
what PC2 captures.

Open the **Loadings Plot** and switch to **PC2**.

#### Questions:

* Which variables load **positively** on PC2? (Look at height, leg length, arm
  length.)
* Which variables load **negatively**? (Look at waist, hip, arm circumference.)
* So PC2 sets one group *against* another. Which two groups?

👉 On PC2 the **length** variables point one way (height +0.53, leg +0.54, arm
length +0.39) and the **girth** variables point the opposite way (hip −0.36,
waist −0.30, arm circumference −0.22). Weight sits almost on the fence at −0.12,
for reasons the Circle of Correlations below will make clear. Take the average of
the three lengths minus the average of the three girths and you get a contrast
that correlates **0.97** with PC2 — the component is that contrast, near enough.
PC2 is a **shape contrast**: at one end sit people who are long-limbed and tall
relative to their girth (a lean, linear build); at the other end, people who are
wide relative to their height (a rounder, stockier build). Crucially, two people can share the same **size** (same PC1) yet sit at
opposite ends of PC2 — same "amount" of body, different proportions.

> This is the size-and-shape decomposition that Jolicoeur and Mosimann described
> in 1960: PC1 answers *how big?* and PC2 answers *what shape?* The two are
> nearly independent, which is why PCA — whose components are orthogonal by
> construction — separates them so cleanly.

Now open the **Circle of Correlations** to see both components at once.

#### Questions:

* Can you see the length variables (height, leg, arm length) clustering in one
  direction and the girth variables (waist, hip, arm circumference) in another?
* Where does **weight** sit relative to the two groups?

👉 Weight points *between* the two groups — it correlates with both length and
girth, because heavy people tend to be both taller and wider. Weight is the one
measurement that belongs partly to size and partly to both shape groups.

---

## Step 4: Sex and the shape axis

> **Settings** — Column-wise: Standard Scale · Method: SVD · Components: 5

Set **Color by → `Gender#category`** on the **Scores Plot**.

#### Questions:

* Along which axis are the two sexes most offset — PC1, PC2, or both?
* Do the sexes form **separate clusters**, or two **overlapping clouds** that are
  shifted relative to each other?

👉 The sexes are offset along **both** components, and about twice as strongly
along **PC2** (standardized gap *d* = 1.4) as along PC1 (*d* = 0.75). On average
adult men and women differ in body proportions and in how fat is distributed —
men toward a more central, waist distribution, women toward the hips, a
well-documented difference (WHO, 2011) — and PC2 picks that up as a shift along
the shape axis.

But notice they **overlap heavily**. This is nothing like the clean species
separation in Iris: two broad distributions whose *centers* differ, not two
distinct groups. Enable **Confidence Ellipses** (95%) to make the shift visible.

#### Questions:

* The ellipse centers are clearly separated, yet the ellipses overlap
  substantially. Roughly what fraction of people could be classified correctly
  from their position in this plot — and is that overlap the whole story?

👉 This is where the plot will mislead you if you let it.

Open the **Eigencorrelation Plot** and find the `Gender#category_Male` row — third
from the top, since rows are sorted by their PC1 correlation. Read along it,
watching the **colors**:

| | PC1 | PC2 | PC3 | PC4 | PC5 |
|---|---|---|---|---|---|
| share of variance | 59.5% | 29.0% | 4.6% | 2.7% | **2.3%** |
| correlation with sex | 0.35 | 0.58 | 0.13 | 0.13 | **0.30** |

The cell under PC5 is warm — very nearly the shade of the PC1 cell — while the two
between them are washed out. **PC5 carries 2.3% of the variance and tracks sex
about as strongly as PC1, which carries 59.5%.** A component the scree plot would
have you discard without a second thought holds nearly as much of this particular
signal as the dominant one.

That is the lesson in one row of a heat map: **principal components are chosen to
maximize variance, not to separate groups.** Nothing requires the direction that
best distinguishes two groups to be one of the directions along which the data
spreads most — and when it is not, a scores plot shows heavy overlap even though
the groups are highly distinguishable. It is the Swiss Roll lesson from the
opposite side: there a tidy plot was the wrong answer, here an untidy one
understates the difference. Both mistake *variance* for *meaning*.

How far does it go? Fitting a classifier — which GoPCA does not do, so take these
as context rather than an exercise — position in the PC1–PC2 plane identifies sex
correctly for about **82%** of these adults, and all seven measurements for about
**93%**, against 51% for always guessing the more common sex. The single direction
that best separates the sexes lies **88% outside** the PC1–PC2 plane.

The measurement doing most of that work is the one flagged at the pair plot: **hip
circumference**, the only one of the seven where women's average exceeds men's.
Alone it is a weak discriminator; held against weight and waist it becomes the
strongest sex signal in the set. No single component isolates that comparison,
which is why it is invisible here.

> Two notes on reading this plot. Correlation signs are omitted above because PCA
> fixes each component only up to its sign — whether a cell reads + or − is a
> convention, not a finding. And the PC5 cell carries no printed number because
> GoPCA labels a cell only when |*r*| ≥ 0.3 — the test is on magnitude, so −0.58 is
> labeled just as +0.58 is. This one is 0.2975, under the line by a whisker.
> Compare its color against the PC1 cell, labeled 0.35.

> **A caution about interpretation.** That these measurements predict sex well in
> aggregate says nothing about any individual: even the best of these models
> misclassifies roughly one person in fourteen, and the two distributions overlap
> across their entire range. PCA reports *statistical* axes of variation in this
> sample — a description of a population, not a boundary between two kinds of
> people.

---

## Step 5: Put size and shape together — the Biplot

> **Settings** — Column-wise: Standard Scale · Method: SVD · Components: 5

Open the **Biplot**, which shows samples (scores) and variables (loading arrows)
in the same plot.

#### Questions:

* Which arrows point along the size axis (PC1) — do all seven point broadly the
  same way along it?
* Along the shape axis (PC2), which arrows point *up* and which point *down*?
* Find a lean, tall build and a short, round build on the plot. Are they far
  apart along PC2 but potentially close along PC1?

👉 The biplot makes the whole story visible at once: all seven arrows lean the
same way along PC1 (size), while along PC2 the length arrows and girth arrows
split apart (shape). Every person's position is a combination of *how big* they
are and *how they are proportioned*.

---

## Step 6: What PCA does *not* show — color by Age

> **Settings** — Column-wise: Standard Scale · Method: SVD · Components: 5

It is tempting to assume that principal components will line up with whatever
metadata you have. Let us test that. Set **Color by → `Age#target`**.

#### Questions:

* Does age form a gradient in any direction across the plot, the way BMI did?
* Or are the colors mixed throughout, with no direction at all?

👉 Age shows **almost no alignment** with either component: its correlation with
PC1 is −0.02, essentially nothing, and with PC2 only −0.19. Among adults, overall
body size is not strongly tied to age, so PCA — which only knows about the seven
measurements — has no reason to produce an "age axis."

Open the **Eigencorrelation Plot** again and read across the `Age#target` row.
The interesting entry is not under PC1 or PC2 but under **PC3**, where it reaches
**0.43** in magnitude — the limb-proportion axis worth only 4.6% of the variance.
Check the PC3 loadings to see which way it runs: leg length and arm length carry
opposite signs, and age follows the arm-length end. Older adults in this sample have shorter upper legs
relative to their arms. It is the same point Step 4 made about sex: a signal you
care about can sit in a small component, and reading only the first two would
have missed it entirely.

This is an important lesson: **PCA finds the directions of greatest variance in
the data you give it, and those need not correspond to any particular variable
you care about.** If you want to study age specifically, PCA
of body measurements is the wrong tool; a method that uses age directly would be
better.

---

## Step 7: Push your understanding further

> **Settings** — Column-wise: Standard Scale · Method: SVD · Components: 5, except where noted

Try these explorations:

* **Why isn't BMI one of the input features?** BMI = weight ÷ height² is an exact
  function of two variables already in the dataset — but not a *linear* one, and
  PCA is a linear method, so dropping it in is not the harmless no-op you might
  expect. Add it as an eighth feature and the structure shifts: PC1 rises from
  59% to 61%, while height's PC1 loading falls from 0.29 to 0.20 and leg length's
  from 0.23 to 0.15. The extra column double-weights the weight-and-girth signal
  and pushes the lengths down. Tellingly, the eighth component ends up carrying
  just **0.07%** of the variance — the signature of a variable that is *almost*
  redundant without being exactly so. If BMI were a linear combination of two
  columns, that figure would be zero. Leaving it out keeps the seven measurements
  on an equal footing, which is why BMI is supplied as a coloring target instead.
  (Try adding it back in GoCSV and compare the loadings.)

* **Look at PC3.** Switch to the **3D Scores Plot** (PC1 vs PC2 vs PC3), or select
  PC3 in the Loadings Plot. PC3 explains only about 5% of the variance and
  contrasts **leg length against arm length** — a subtle limb-proportion axis.
  Does the Scree Plot suggest PC3 is worth keeping?

* **Split the sexes.** In GoCSV, filter to only males or only females before
  loading into GoPCA. Does the size-and-shape structure still appear within a
  single sex? It does: PC1 keeps all-positive loadings and about 60% of the
  variance in each group, and PC2 keeps the same lengths-against-girths contrast.
  Size and shape are not *created* by mixing sexes. Watch what PC2 gives up,
  though — it drops from 29% to roughly 25–27%, because part of what it was
  carrying across the whole sample was the shift between the two groups from
  Step 4.

---

# What you should take away

After completing this exploration, you should be able to:

* Recognize that PCA components can be **interpretable factors**, not just
  abstract axes — here, **size** (PC1) and **shape** (PC2)
* Explain why a set of **positively correlated** measurements produces a first
  component with all-same-sign loadings (a general size factor)
* Distinguish a **shift between overlapping distributions** (the sexes here) from
  a **clean separation into clusters** (the species in Iris)
* Check the meaning of a component against an external variable — and check it
  with more than one number, since BMI's +0.79 with PC1 concealed a −0.58 with PC2
* Read an **Eigencorrelation Plot** to see every component against every external
  variable at once
* Recognize that a group difference can be **highly predictable yet invisible** in
  a scores plot, because components maximize variance rather than separation
* Accept that PCA need **not** align with every variable you have (age here) —
  and know when that means PCA is the wrong tool for a question

---

## Final reflection

> You began with seven body measurements and no labels. PCA reduced them to two
> axes that together explain about 88% of the variation — and those two axes
> turned out to *mean* something: how big a person is, and how they are shaped.
> You also found the limit of that summary: the sharpest difference between two
> groups in the data was hiding in the 12% those two axes left behind.

Think about these questions:

* PC1 explained ~60% of the variance with all-positive loadings. If you measured
  ten more body dimensions (finger length, foot width, …), do you expect PC1
  would still be a size factor? Why?
* BMI correlated +0.79 with PC1 *and* −0.58 with PC2, yet we never gave PCA the
  BMI column. What does it mean that PCA "rediscovered" a size axis and a
  girth-versus-length axis on its own — and why should a size-adjusted index like
  BMI have landed across both of them rather than on one?
* The sexes overlapped heavily in the scores plot, yet all seven measurements
  classify sex correctly about 93% of the time. Explain how both facts can be
  true at once. What does that tell you about using a scores plot to judge
  whether two groups are distinguishable?
* Jolicoeur and Mosimann found the same size-then-shape structure in turtles in
  1960. Why might this pattern appear across such different organisms?

---

## References

* Jolicoeur, P., & Mosimann, J. E. (1960). *Size and shape variation in the
  painted turtle: A principal component analysis.* Growth, 24, 339–354.
  (The classic demonstration that PC1 = size and later PCs = shape.)
* Jolliffe, I. T., & Cadima, J. (2016). *Principal component analysis: a review
  and recent developments.* Philosophical Transactions of the Royal Society A,
  374, 20150202. https://doi.org/10.1098/rsta.2015.0202
* World Health Organization (2011). *Waist Circumference and Waist–Hip Ratio:
  Report of a WHO Expert Consultation, Geneva, 8–11 December 2008.*
  https://iris.who.int/handle/10665/44583
  (Sex differences in body-fat distribution.)
* Centers for Disease Control and Prevention, National Center for Health
  Statistics. *NHANES 2017–2018 Body Measures (BMX_J).*
  https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/BMX_J.htm
