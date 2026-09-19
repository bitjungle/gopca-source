# Monitoring a Chemical Reactor: Process Data and Temporal PCA

## Background: Why reactors produce time-series data

In a chemical plant, sensors log dozens of measurements every minute — temperatures, flow rates, concentrations, pressures, valve positions. The goal of **process monitoring** is to detect abnormal behavior early, understand the relationship between variables, and distinguish faults from ordinary process disturbances.

This dataset was simulated from a **non-isothermal Continuous Stirred-Tank Reactor (CSTR)** running an irreversible first-order exothermic reaction:

> **What does non-isothermal mean?** In reactor modeling, *isothermal* means the temperature is assumed constant — a useful simplification when cooling is perfect and instantaneous. *Non-isothermal* means the reactor temperature is a genuine dynamic state variable: it rises and falls in response to changes in feed, flow, or cooling, and must be described by its own differential equation (the energy balance). Having a temperature controller does *not* make the reactor isothermal — the controller is imperfect. It acts through the coolant temperature, which has physical limits, responds with a time lag, and can saturate entirely during a fault. As a result, the reactor temperature still fluctuates, and during the cooling fault it drifts substantially away from setpoint. The word *non-isothermal* tells you how the model is built; the temperature controller tells you how the plant tries — imperfectly — to manage the consequences.

$$\text{A} \rightarrow \text{B} \quad (\text{exothermic})$$

> **A chemistry note:** This is a *unimolecular* first-order reaction — A spontaneously converts into B without requiring a second reactant. Real examples include thermal decomposition, isomerization, and cracking reactions. The key physics is the [Arrhenius temperature](https://en.wikipedia.org/wiki/Arrhenius_equation) dependence of the rate constant, $k(T) = k_0\, e^{-E/RT}$: higher temperature accelerates the reaction, releasing more heat, which drives the temperature higher still. That thermal feedback is what makes the CSTR a classic system for studying nonlinear process dynamics. No catalyst is modeled explicitly — the effect of any catalyst is absorbed into the kinetic pre-factor $k_0$.

A CSTR is one of the most studied systems in chemical engineering [Uppal, Ray & Poore, 1974]. Reactant A flows in continuously, the reaction occurs inside the tank, and product B flows out. Because the reaction releases heat, a coolant circuit controls the reactor temperature.

> **A note on the feed stream:** Although the model tracks only the reacting species A and product B explicitly, the reactor is assumed to contain a bulk liquid phase — typically a solvent such as water — that carries heat and dissolved reactants through the system. The solvent is not included as a separate state variable because its concentration changes negligibly compared to the reacting species. Its thermal effects appear implicitly through parameters such as the heat capacity and the overall heat-transfer coefficient `heat_transfer_UA_kJ_min_K`.

> **Rich nonlinear dynamics:** Uppal, Ray & Poore (1974) showed analytically that, depending on the [Damköhler number](https://en.wikipedia.org/wiki/Damköhler_numbers) and the heat of reaction, a CSTR can have one or three steady states, and can exhibit *intrinsic* self-sustaining oscillations (limit cycles) arising purely from the Arrhenius thermal feedback — with no external forcing whatsoever. The simulation in this tutorial is tuned to a single stable operating point, so you will not encounter multiple steady states here. The 40-minute oscillation you will identify in Temporal PCA is an *externally imposed* feed flow disturbance, not an Arrhenius-driven limit cycle. In a real plant operating near a limit cycle boundary, oscillations would persist even after the external disturbance was removed — a substantially harder fault scenario to diagnose.

### The PI temperature controller

A [proportional-integral (PI) controller](https://en.wikipedia.org/wiki/PID_controller#PI_controller) manipulates the coolant temperature T_c to keep the reactor temperature T near the setpoint (365 K). When T rises above setpoint, the controller requests colder coolant; when it falls, warmer coolant. Anti-windup logic prevents the controller from accumulating a large integral error when the coolant valve is fully open or closed.

This controller introduces **closed-loop dynamics** into the data — disturbances cause transients, the controller responds, and variables return to steady state. Temporal PCA can capture all of this.

> A temporal PCA analysis of this dataset teaches something deeper than a single-snapshot PCA: not just *which variables are correlated*, but *how process dynamics evolve through time*. That is exactly why dynamic PCA became central to chemical process monitoring.

![CSTR P&ID — process variables and instrumentation](./cstr_diagram.png)
*P&ID for the simulated CSTR process. TCV-201 is a three-way mixing valve: it blends cold coolant supply (from TK-201) with warm bypass tapped from the coolant return header to produce the coolant inlet temperature T_c — the manipulated variable of the PI controller. The mixed stream enters the cooling jacket at the bottom-left; spent coolant exits at the top-right. The signal line (dashed) shows TIC-201 driving the valve actuator.*

### The dataset

The simulation runs for **800 minutes** at a 1-minute sampling rate, producing **801 observations** across **12 process variables**:

| Column | Symbol | Units | Description |
|---|---|---|---|
| `T_K` | *T* | K | Reactor temperature (controlled variable) |
| `Tc_out_K` | *T*_c,out | K | Coolant outlet temperature (measured) |
| `Tf_K` | *T*_f | K | Feed temperature |
| `CA_mol_L` | *C*_A | mol/L | Reactant A concentration in reactor |
| `CB_mol_L` | *C*_B | mol/L | Product B concentration in reactor |
| `CAf_mol_L` | *C*_A,f | mol/L | Reactant A concentration in feed |
| `F_L_min` | *F* | L/min | Volumetric feed flow rate |
| `cooling_duty_kJ_min` | *Q* | kJ/min | Heat removed by coolant system |
| `reaction_rate_mol_L_min` | *r*_A | mol/L/min | Rate of reaction A→B |
| `conversion_fraction` | *X*_A | — | Fraction of A converted to B |
| `heat_transfer_UA_kJ_min_K` | *UA* | kJ/(min·K) | Overall heat-transfer coefficient |
| `residence_time_min` | *τ* | min | Hydraulic residence time (V/F) |

The dataset also includes three string columns that label the operating state at each time point. All three are automatically excluded from PCA by GoPCA and are available for score-plot coloring.

| Column | Distinct values | Description |
|---|---|---|
| `event` | 6 values | Fine-grained scenario label: `normal`, `feed_conc_high`, `feed_temp_high`, `flow_oscillation`, `cooling_fault`, `recovery` |
| `regime` | 4 values | Coarser grouping: `normal` (baseline + recovery), `feed_disturbance` (both feed steps combined), `oscillation`, `cooling_fault` |
| `fault_active` | `yes` / `no` | Binary flag: `no` during normal operation and recovery, `yes` during all disturbance and fault periods |

All three describe the same 800-minute timeline at different levels of detail — `event` is the most specific, `fault_active` the broadest. **Use `regime` as your color target**: four clearly named categories are easier to read than six, and both feed steps are disturbances of the same kind — a change on the feed side that the controller absorbs and recovers from. They do not, however, produce *identical* signatures: the concentration step displaces the process considerably further than the temperature step, and you will see them as two separate clumps of the same color. Switch to `event` whenever you want them told apart.

### Operating scenarios

The simulation passes through six distinct operating phases designed to produce recognizable signatures in Temporal PCA:

| Time (min) | Scenario | What happens |
|---|---|---|
| 0 – 120 | **Normal** | Reactor near steady state. Use this period to establish your mental baseline. |
| 120 – 240 | **Feed concentration step** | Feed concentration rises +10 %. Reactant A rises, more heat is released, controller corrects temperature. |
| 240 – 360 | **Feed temperature step** | Feed enters +7 K hotter. Thermal disturbance; controller compensates with colder coolant. |
| 360 – 520 | **Flow oscillation** | Feed flow oscillates ±8 % at a **40-minute period**. Creates periodic variation across nearly all variables. |
| 520 – 680 | **Cooling fault** | Heat-transfer coefficient drops 28 % — partial fouling or cooling water problem. Reactor temperature drifts upward; controller saturates. |
| 680 – 800 | **Recovery** | Nominal conditions restored. |

---

## Key process time constants — choose your lag L wisely

Before running Temporal PCA, you need to decide how many lags L to include. The right choice depends on the dynamics you want to capture:

| Dynamic | Time constant | Recommended L |
|---|---|---|
| Residence time τ = V/F | ≈ 1 min | L = 2–5 |
| PI integral time τ_I | 8 min | L = 8–16 (captures one controller action) |
| Step response settling | ≈ 20–30 min | L = 20–30 |
| Flow oscillation period | 40 min | L = 40–80 (to fully resolve) |

Start with **L = 10** to see the controller dynamics clearly. Then try L = 5 (faster dynamics) and L = 20 (slower trends). Note: at L = 10–20 the 40-minute oscillation will appear as a low-frequency oscillatory pair of components — which is exactly what you want to identify.

---

# Your task: Monitor the reactor using Temporal PCA

Work through the steps in order. Each step builds on the previous one.

> **Settings carry over.** Every step below opens with a **Settings** line giving the full configuration it expects. Where a step changes nothing, the line simply repeats the previous settings — so you never have to scroll back to work out what state the app should be in, and you can drop into any step directly. Anything a step actively changes is shown **in bold**.

---

## Step 1: Establish a baseline with SVD PCA

Before introducing time lags, run a standard SVD PCA first. This lets you see exactly what Temporal PCA adds.

> **Settings** — Method: **SVD** · Components: **5** · Preprocessing: **Standard Scale**

Load the dataset by clicking the **CSTR (time series)** sample-dataset button — if you opened this tutorial from that button, the data is already loaded, with `regime` pre-selected as the color variable. Then set:

* **PCA Method** → **SVD**
* **Number of Components** → **5**
* **Preprocessing** → **Standard Scale**

Click **Go PCA!**.

> **Why Standard Scale?** The 12 variables have completely different units and magnitudes — temperatures in the hundreds of Kelvin, flow rates in hundreds of L/min, concentrations below 1 mol/L, heat duty in thousands of kJ/min. Without scaling, PCA would be dominated by whichever variable has the largest numerical variance, not the most process-relevant variation.

Open the **Biplot** (color by `regime`).

> **Reading a biplot:** A biplot overlays the scores (one point per observation, colored by regime) and the loadings (one arrow per variable) in the same panel. The direction and length of each arrow show how strongly that variable contributes to each PC — a long arrow means high variance explained. The angle between two arrows approximates the correlation between those variables: arrows pointing the same way are positively correlated; opposite arrows are negatively correlated. Note that the score points and the loading arrows live in different coordinate scales, so the absolute distance between a score point and an arrowhead is not directly meaningful.

#### Questions:

* Can you identify clusters corresponding to normal operation, feed disturbances, the cooling fault, and the oscillation regime?
* PC1 typically captures **overall reaction intensity** — which loading arrows point most strongly along PC1? You would expect `T_K`, `reaction_rate_mol_L_min`, and `conversion_fraction` to dominate, since they are all tightly coupled through the energy and mass balances at steady state. Do the cooling fault points lie in the direction these arrows point?
* Look at PC2. It is dominated by `F_L_min` (strongly negative — arrow pointing down) and `residence_time_min` (strongly positive — arrow pointing up). These two are mathematically coupled — τ = V/F, so they are exact inverses of each other. PC2 is essentially a **flow rate axis**. Does this explain why the oscillation period scatters along PC2 rather than PC1?
* The **cooling fault** should appear far from the normal cluster along PC1. If it does, the biplot lets you read the cause directly: which loading arrows point toward the cooling fault cluster? Does the large offset compress the rest of the score plot into a small region on the left side?
* Now look at the **flow oscillation** period. Rather than forming a compact cluster, it scatters broadly across the full vertical range of the plot. Why? SVD PCA has no sense of time — each measurement at minute 362 is treated as an independent sample, not as part of a repeating cycle. The oscillation appears as diffuse scatter rather than a recognizable structure.

👉 SVD PCA sees the process at a **single instant in time**. It can detect large regime shifts (the cooling fault stands out clearly), but it cannot understand *how* a disturbance propagates through the process, *how quickly* the controller responds, or *whether* a periodic signal is present. The oscillation period looks like noise. That is the key limitation — and what Temporal PCA is designed to fix.

---

## Step 2: Switch to Temporal PCA

> **Settings** — Method: **Temporal PCA** · Time Lags: **L = 10** · Components: **8** · Preprocessing: Standard Scale

Change:

* **PCA Method** → **Temporal PCA** — do this first; the lag control only appears once Temporal PCA is selected
* **Number of Time Lags (L)** → **10**
* **Number of Components** → **8**
* **Preprocessing** → **Standard Scale** (unchanged from Step 1)

Click **Go PCA!**.

> **Why keep Standard Scale?** GoPCA applies column-wise preprocessing to the original 12 variables *before* constructing the lag-embedded trajectory matrix. This means each lagged copy of a variable (e.g. `T_K` at lag 0, lag 1, …, lag 10) inherits the same scale as the original — which is exactly what you want. A change in `T_K` one minute ago should carry the same weight as a change right now. The mixed-unit argument from Step 1 applies equally here: without Standard Scale, the high-magnitude variables would dominate the trajectory matrix just as they would a standard PCA.
>
> **A note on industrial practice:** Here, Standard Scale is computed on all 800 minutes of data, including the fault period. In a real plant application you would compute the mean and standard deviation from the *normal-operation baseline only* (minutes 0–120), then apply those fixed scale factors to the full record. For this dataset the difference is small — the fault period is only 20% of the record — but in a real monitoring system this distinction matters: the model should describe what "normal" looks like, not what "fault" looks like.

### What GoPCA is doing under the hood

Instead of describing each minute as a single vector of 12 sensor values, Temporal PCA describes it as a short **sequence** of L consecutive time points — a sliding window L minutes long. Each window becomes one row of a larger **trajectory matrix**, to which SVD is then applied.

> **What L counts.** In GoPCA, L is the **window length**: the number of consecutive time points in each window, not the number of steps taken into the past on top of the current one. L = 10 therefore means a 10-minute window — the current minute plus the nine before it. This is the standard convention in singular spectrum analysis, where L is the embedding dimension (Vautard & Ghil, 1989).

For this dataset with L = 10:

| | SVD PCA (Step 1) | Temporal PCA (Step 2) |
|---|---|---|
| Rows | 801 (one per minute) | 792 (one per window position, = 801 − L + 1) |
| Columns | 12 (sensor variables) | 120 (12 variables × 10 time steps) |

The columns are grouped by time step: the first 12 columns hold all 12 variables at the **earliest** minute of the window, the next 12 hold them one minute later, and so on. Column 13 is therefore `T_K` at the second time step of the window, column 25 is `T_K` at the third, and the final block holds the most recent minute. SVD on this wider matrix finds directions of variance that capture not just *which variables correlate at any instant*, but *how those correlations evolve across the 10-minute window*.

**Why L = 10?** Looking at the process time constants table at the top of this tutorial: the PI integral time τ_I = 8 minutes is the dominant controller dynamics. L = 10 covers slightly more than one full controller action — enough to see the transient response shape, but compact enough to keep the trajectory matrix manageable. At L = 10 the 40-minute flow oscillation covers only 25% of one period, so it will not appear as a clean oscillatory pair (we address that in Step 6).

---

## Step 3: Read the Scree Plot — how many components carry information?

> **Settings** — Method: Temporal PCA · Time Lags: L = 10 · Components: 8 · Preprocessing: Standard Scale

Nothing to change — this step reads a different plot from the same analysis you just ran. Open the **Scree Plot**.

#### Questions:

* Where is the elbow — after the first component, the second, or later?
* How many components are needed to reach 80% cumulative variance?
* How does the Scree Plot for this dataset compare to Iris (4 variables, clean separation) or Wine (13 variables, ~55% in 2D)?

👉 A CSTR at steady state has only a few degrees of freedom (temperature, concentration, flow are tightly coupled through the energy and mass balances). During disturbances and faults, additional variation enters from different directions. The Scree Plot reflects this: a few large components capturing steady-state variation, then smaller components capturing the specific disturbance signatures. You should find that just **3 components exceed 80%** cumulative variance — efficient for a 12-variable process dataset with 10 lags.

---

## Step 4: The scores plot — reading a process trajectory

> **Settings** — Method: Temporal PCA · Time Lags: L = 10 · Components: 8 · Preprocessing: Standard Scale

Still the same analysis. Open the **Scores Plot (PC1 vs PC2)** and color by `regime`.

For time-series data, the scores form a **time-ordered trajectory** through PC space. This is different from a static dataset like Iris or Wine, where each point is an independent sample. Here, consecutive points are connected in time — the path the reactor traces through multivariate space.

**How to read a process trajectory:**

* **Tight cluster** → reactor operating in a stable, repeating condition
* **Smooth diagonal path away from cluster** → step disturbance followed by a transient response. The input changes instantaneously, but the reactor takes many minutes to settle — the trajectory traces this transient. Look for the feed disturbance (orange) doing exactly this.
* **Slow drift** → gradual process change (e.g., fouling, catalyst deactivation)
* **Closed loop or ellipse** → periodic oscillation (the 40-minute flow cycle would appear this way at L ≥ 40; at L = 10 the loop is too compressed to close)
* **Failure to return** → fault that the controller cannot correct

### Tip: use Row Index coloring to see time flow directly

The **Color by** dropdown above the scores plot offers a **Row Index** option. Because the rows are sorted in time, the row index is a proxy for time — and coloring by it maps the continuous progression of the experiment onto a color gradient from dark (early) to light (late).

Try this: switch **Color by** → **Row Index**, then switch back to **regime**. The two colorings complement each other:

| Color by | What it shows |
|---|---|
| `regime` | Which operating state each point belongs to — categorical, easy to identify clusters |
| **Row Index** | When each point occurred — the color gradient makes the direction of time flow through the plot immediately readable |

With Row Index coloring you can immediately see, for example, that the diagonal trajectory of the feed disturbance runs from an intermediate color (the transition into the disturbance) back toward the early-time cluster (the controller correcting), and that the cooling fault points in the far-right region carry the latest colors (high row numbers = late in the experiment). This makes the temporal sequence of process events readable in a single glance — no regime labels needed.

#### Questions:

* Can you identify which region of the plot corresponds to normal operation?
* The feed disturbance period (orange) forms **two** tight clumps rather than one, joined by a trail. Why two? *(Hint: the `regime` label groups two separate events — color by `event` to confirm.)*
* Each step shows the same pattern: a fast excursion away from the normal cluster, then a slower return as the controller compensates. How many minutes pass between the step and the furthest point of the excursion?
* Where does the cooling fault period appear — close to normal operation or far from it? Is it more spread out along PC1 than it was in the SVD scores plot?
* Does the flow oscillation period trace a recognizable loop? How large is it compared to the steady-state cluster?
* Does the reactor return to the normal region during the recovery period?
* Switch to **Row Index** coloring. Does the color gradient confirm the temporal sequence you expected — early dark colors in the normal cluster, transitioning through the disturbance periods, and the latest colors in the cooling fault and recovery region?

> **Chemical engineering connection:** This is the same logic as a yield–selectivity map in a reaction engineering course. When you plot yield vs. selectivity over time during a runaway, the trajectory moves away from the optimal operating point. The scores plot is a multivariate generalization of that idea — it shows where the process is in a compressed, multi-dimensional operating space.

---

## Step 5: The Temporal Loadings — what dynamics are in each component?

> **Settings** — Method: Temporal PCA · Time Lags: L = 10 · Components: 8 · Preprocessing: Standard Scale

Still the same analysis; this step uses two complementary plots. Start with the **Variable Importance** plot to find out which variables drive which components, then switch to the **Temporal Loadings** plot to read the lag structure of those components. (Both appear in the plot dropdown only when Temporal PCA is the selected method, which is why neither carries a "Temporal" prefix in the menu.)

### 5a: Identify dominant variables with Variable Importance

Open the **Variable Importance** plot. Its full title is *Variable Importance (RMS Aggregated Across Lags)*: the heatmap shows the root-mean-square loading of each variable across all lags, giving one importance value per (component, variable) cell. Bright cells identify the dominant variable(s) for each component.

#### Questions:

* Which component is most strongly driven by `Tf_K` (feed temperature)? This component captures the feed temperature step disturbance.
* Which components are dominated by `F_L_min` (feed flow) and `residence_time_min`? These two variables are mathematically linked — τ = V/F — so they tend to appear together.
* PC1 loads **seven** variables at almost identical importance (≈0.11 each) — reactor temperature, both concentrations, reaction rate, conversion, heat-transfer coefficient and coolant outlet temperature — while feed flow, residence time and feed composition sit near zero. What does that pattern tell you about what PC1 represents? *(Hint: which of these are reactor **states**, and which are **inputs** the operator or a disturbance sets?)*
* Find `cooling_duty_kJ_min`. Its importance is modest everywhere and highest in the *lowest*-variance components. Does that mean the cooling fault is invisible? Hold the question until Step 7 — the answer is a useful surprise, and it is not the component you would guess from this heatmap alone.

### 5b: Read the lag structure with Temporal Loadings

Open the **Temporal Loadings**. Display at least 8 components.

Each curve shows how one component's loading evolves across the window, from lag 0 to lag L − 1 (ten points for L = 10). The x-axis is **position within the window**: lag 0 is the *oldest* minute in the window and lag L − 1 is the most recent, so time runs left to right. The y-axis shows the loading magnitude at that position.

The Variable Importance plot told you *which variables matter*; this plot tells you *when within the window* they matter most. Each curve is the loading profile of that component's dominant variable, which is why cross-referencing the two plots is worthwhile.

**Three patterns to look for:**

| Shape | Interpretation |
|---|---|
| **Flat at a constant level** | No temporal structure — the component weights every lag equally, so it captures variance that is present throughout the window rather than a pattern that develops across it |
| **Monotone ramp** | Step-response or slow drift — controller or first-order process dynamics |
| **Sinusoidal oscillation** | Periodic variation — oscillatory process behavior |

#### Questions:

* Which components show a monotone ramp shape? What time constant does the ramp suggest?
* Compare the ramp time constant to the PI integral time τ_I = 8 minutes. Do they match?
* Can you find any components with a curved or peaked loading curve? This is a partial trace of the 40-minute oscillation — with only L = 10 lags you are seeing less than one quarter of one cycle, so a clean sinusoid is not expected.
* Pick the component that the Variable Importance heatmap identified as dominated by `Tf_K`. Does the temporal loading curve for that component rise, fall, or stay flat across the 10 lags? The shape reflects the transient that the feed temperature step creates.

> **Delayed thermal coupling — a closer look:** The reactor has thermal inertia: a change in coolant temperature (`Tc_out_K`) takes several minutes to propagate into a change in reactor temperature (`T_K`). This coupling is physically real, but at L = 10 it is subtle — both variables load broadly across many components at this lag length. To make the delay clearly visible, a longer window (L = 20–30) is needed so that the cause (`Tc_out_K` changing) and the effect (`T_K` responding) are separated by enough lags to be distinguishable. Keep this in mind when you compare lag settings in Step 8.

> **Hint:** A sinusoidal temporal loading pattern means that component is tracking a variable that oscillates in time. The period can be estimated from the zero-crossings: if you count *k* zero-crossings across a window of L minutes, the oscillation period ≈ 2L/k minutes. For a 40-minute oscillation seen through a 10-minute window, you have only **one quarter of a cycle** (10/40 = 0.25) — far too little to recognize a clean sinusoid. Try L = 40 to resolve the full period.

---

## Step 6: Identify the oscillatory pair

> **Settings** — Method: Temporal PCA · Time Lags: L = 10 · Components: 8 · Preprocessing: Standard Scale
>
> This step starts on the settings you already have, so you can see what a *too-short* window looks like, then changes them partway through.

Temporal PCA (SSA) represents a single oscillation as a **pair of components**. The correct way to identify such a pair is by the **shape of the temporal loading curves**:

1. Both curves are sinusoidal at the same frequency
2. One is approximately 90° phase-shifted relative to the other (a sine and a cosine)

This pairing occurs because a sine wave requires both a sine and a cosine component to be fully represented.

> **On equal explained variance:** For a pure, noise-free sinusoidal signal, SSA theory guarantees that an oscillatory pair will have exactly equal eigenvalues. In practice, however, two completely unrelated dynamics can explain the same percentage of variance by coincidence — so equal variance is a *supporting indicator*, not a reliable primary criterion. Always start from the shape of the temporal loading curves, and treat similar variance as confirmation, not identification.

> **Important — you will not see a clean pair at L = 10.** The flow oscillation has a 40-minute period. With L = 10, the lag window covers only 10/40 = 25% of one cycle. SSA cannot decompose an oscillation into a sine/cosine pair when the window is too short to contain even a half cycle. At L = 10, the oscillation appears as slow-varying trend components rather than recognizable sinusoids.

**What you will actually see at L = 10:**

- **PC1, PC3 and PC4 are flat lines**, each sitting at its own constant level rather than at zero. Between them they carry about 78% of the variance. A flat curve means the component weights every lag in the window identically — it has found variation that is simply *present* across the whole window, with no pattern developing through it.
- **PC2 is a shallow arc**, barely curved. Not yet structure worth interpreting.
- **PC5, PC6 and PC7 are clean monotone ramps**, sweeping from one extreme to the other across the ten lags. These are the transient responses — something changing steadily over the window.
- **PC8 is the only curved, peaked one**, rising to a maximum near the middle of the window and falling away again. This is your partial trace of the oscillation, and it carries just 0.2% of the variance.

Notice the pattern in that list, because it is the real lesson of this step: at L = 10 the components carrying almost all the variance are **flat**, and everything with genuine temporal shape has been pushed down into components worth a fraction of a percent. A ten-minute window is simply too short to see a forty-minute cycle, so the oscillation cannot compete for variance — and no sine/cosine pair can form. Do not expect equal explained variance here either: the equal-eigenvalue property of a pure sinusoidal SSA pair only holds once the oscillation is actually resolved.

**To actually find the oscillatory pair, switch to L = 40:**

> **Settings** — Method: Temporal PCA · Time Lags: **L = 40** · Components: **10** · Preprocessing: Standard Scale

Run the analysis again with the new settings. Now the lag window spans one full oscillation period. Open the **Temporal Loadings**. The oscillatory pair should become clearly visible as two adjacent components whose loading curves are both sinusoidal and approximately 90° phase-shifted from each other:

* Two adjacent components with nearly equal explained variance
* One with a cosine-shaped temporal loading — one full wave across the 40-lag window, peaking near the center
* One with a sine-shaped temporal loading — also one full wave, but shifted approximately 10 lags (= 90° for a 40-minute period) relative to the cosine component

> **Sign convention:** SSA eigenvectors have arbitrary sign — GoPCA may flip the sign of a loading curve relative to what you expect. A cosine that "starts high, passes through zero, and goes negative" and one that "starts low, rises to a peak, and returns to low" are the same component with opposite sign. Focus on the *shape* (one full sinusoidal wave) and the *phase offset between the two curves*, not on whether a curve starts positive or negative.

To identify which process variable drives this pair, cross-reference with the **Variable Importance** heatmap from Step 5a. The Temporal Loadings plot shows one aggregated curve per component with no variable labels — it cannot tell you which variable dominates on its own.

#### Questions (at L = 40):

* Can you identify the oscillatory pair? Which component numbers are they, and what are their explained variances?
* Estimate the oscillation period from the zero-crossings of the cosine component: if it crosses zero at lag *a* and lag *b*, the half-period = *b* − *a*, and the full period = 2(*b* − *a*) minutes. Does this match the 40-minute flow oscillation designed into the simulation?
* Are the two loading curves approximately 90° shifted from each other? (For a 40-minute period, 90° = 10 lags.)
* Check the Variable Importance heatmap for the component numbers you identified. Which variable has the highest importance for this pair? Does it match your expectation from the simulation?
* Compare the Scree Plot at L = 40 to L = 10. Why does the explained variance of the top components drop when L increases?

---

## Step 7: Fault detection — does Temporal PCA see the cooling fault?

> **Settings** — Method: Temporal PCA · Time Lags: L = 40 · Components: 10 · Preprocessing: Standard Scale
>
> Keep the settings from the end of Step 6. The fault is just as visible at L = 10 if you prefer to switch back — this step works at either window length.

The cooling fault (minutes 520–680) reduces the heat-transfer coefficient by 28 %. The controller tries to compensate by lowering T_c, but eventually saturates at its minimum value.

Return to the **Scores Plot** and color by `regime`.

#### Questions:

* Is the cooling fault period clearly separated from the normal operation cluster in PC1–PC2 space? Along which axis does the separation mostly run?
* Switch **Color by** to **Row Index**. Can you see the moment the fault begins, and how quickly the trajectory leaves the normal region?
* Now go back to the **Variable Importance** heatmap from Step 5a and look at the row for the component that does the separating. Which variables load on it?

> Note that the **Loadings Plot** and **Diagnostic Plot** are not available for Temporal PCA — a component here is a pattern spread across variables *and* lags, so there is no single loading per variable to plot. **Variable Importance** is the temporal replacement for the Loadings Plot, and **Temporal Loadings** shows the lag structure.

👉 Here is the surprise promised in Step 5a. The cooling fault is separated almost completely by **PC1** — the largest component, not some obscure high-numbered one. Everything you need was in the very first component all along.

That is worth pausing on, because it contradicts a natural expectation. Looking at the Variable Importance heatmap you would have picked `cooling_duty_kJ_min` as the fault variable — it is the one whose name matches the fault. But its importance is modest, and highest in components carrying a fraction of a percent of the variance. Meanwhile PC1 loads `heat_transfer_UA_kJ_min_K` — the quantity the fault actually changes — at almost the same weight as reactor temperature, both concentrations, reaction rate and conversion.

That is the physics showing through. A drop in UA does not stay local: less heat leaves the reactor, so the temperature rises, which accelerates the Arrhenius rate, which converts more A into B and releases more heat still. The whole coupled reactor state moves together, and PC1 *is* that coupled state. The fault is legible in the dominant component precisely because it disturbs everything at once.

The lesson generalizes beyond this dataset: **do not look for a fault in the variable whose name matches it.** Look for the component that moves, then read the heatmap to find out what moved with it. A tightly coupled process rarely fails in one variable alone.

#### Questions to take further:

* How early in the fault period does the trajectory leave the normal region — within minutes, or only after the controller saturates?
* The controller fights the fault until it saturates. Would the fault have been *easier* to detect with no controller at all?

#### Extension:

* In industrial practice, control charts are placed on the scores of a PCA model built on normal data only. Any new sample whose scores fall outside the 95% confidence ellipse is flagged as abnormal. Does the cooling fault period fall outside the 95% confidence ellipse for normal operation?

---

## Step 8: Compare lag settings — no lags, L = 5, L = 10, L = 20

> **Settings** — this step deliberately changes the settings four times; each run is listed below. Keep Components at 8 and Preprocessing at Standard Scale throughout.

Run the analysis four times and compare the Scree Plots, Temporal Loadings and Scores Plots across all four (keep 8 components and Standard Scale throughout):

1. **PCA Method → SVD** — this is the no-lag baseline you already produced in Step 1
2. **Temporal PCA, L = 5**
3. **Temporal PCA, L = 10**
4. **Temporal PCA, L = 20**

> **Why not "L = 0"?** A window has to contain at least two time points before there is any temporal structure to find, so GoPCA requires **L ≥ 2**. The no-lag case is not a Temporal PCA setting at all — it is ordinary PCA, which you reach by selecting the SVD method. Setting L = 1 would be the same thing written a longer way: a one-minute window is just the original data matrix.

#### Questions:

* Take the SVD run as your baseline. What does Temporal PCA at L = 5 show that ordinary PCA could not?
* Does increasing L reveal more temporal structure (more sinusoidal components)?
* At L = 5, does the Scree Plot still show a clear elbow?
* At L = 20, how many components do you need to explain 80% of the variance? Why does the number increase with L?
* Which lag setting gives you the most useful separation between normal operation and the cooling fault in the scores plot?
* Look at which variables dominate the early PCs across all four settings. In the SVD baseline, fast variables (feed flow, coolant temperature) and slow variables (reactor temperature, concentrations) appear mixed together. As L increases, do you notice any separation of **fast dynamic modes** from **slow process modes** in the component structure? Fast variables (feed flow, coolant control) evolve on the timescale of the residence time (≈1 min); slow variables (reactor temperature, concentrations) evolve on the timescale of the PI integral time (8 min) and thermal inertia. Temporal PCA can separate these time scales into different components.

> **Rule of thumb:** L should be at least as large as the longest process time constant you want to capture. For controller dynamics (τ_I = 8 min), L ≥ 10 is sensible. For the full flow oscillation (40 min), you need L ≥ 40. Larger L improves frequency resolution but increases the size of the trajectory matrix — for 801 observations and L = 40, each window spans 40 time steps and covers 480 columns (12 × 40), leaving 762 usable rows (801 − 40 + 1).

---

# What you should take away

After completing this exploration, you should be able to:

* Explain why **Standard Scale is essential** for process datasets with mixed units
* Read a **process trajectory** in a scores plot — identifying stable operation, disturbances, oscillations, and faults
* Recognize the **time constant** of process dynamics from the shape of temporal loading curves
* Identify a **paired oscillatory component** in the Scree Plot and Temporal Loadings
* Select an appropriate **lag parameter L** based on the process time constants you want to capture
* Describe how **Temporal PCA could be used for fault detection** in a real plant

---

## Final reflection

> You started with 12 process variables measured every minute for 800 minutes. A conventional pairwise analysis would give you 66 panels and no information about how the variables evolve together over time.

If you have worked through the other GoPCA tutorials, you have now seen PCA applied across four fundamentally different data structures:

| Dataset | What PCA discovers |
|---|---|
| **Iris / Wine** | Geometric and chemical structure — clusters and correlations among static samples |
| **Corn (NIR)** | Correlated wavelength structure — hundreds of channels carrying the same compositional signal |
| **Swiss Roll** | Nonlinear manifold geometry — a curved surface that linear PCA flattens, and a lesson in why a nonlinear method is not automatically the fix |
| **CSTR (time series)** | Dynamic process modes — time-dependent structure, delayed coupling, oscillations, fault propagation |

Each dataset required a different analytical lens. The CSTR dataset shows that by embedding lagged process history into the data matrix, PCA gains the ability to *see time* — revealing not just which variables are related, but how they influence each other across minutes and hours. That conceptual bridge connects standard PCA to the full toolkit of dynamic process monitoring used in industrial practice.

Think about these questions:

* The PI controller reduces temperature variation — it actively fights the disturbances. Does this make Temporal PCA harder or easier? What would the scores plot look like without any controller?
* The cooling fault changes `heat_transfer_UA_kJ_min_K` directly. But which other variables are affected indirectly, and how quickly? Can you trace the fault propagation through the scores trajectory?
* In a real plant, you would build the Temporal PCA model on normal data only, then apply it to new data in real time. What would you need to store — the loadings? The mean and standard deviation for scaling? The lag structure?
* The flow oscillation was designed as a process disturbance. Could it also be a deliberate sinusoidal test signal, used to identify the process frequency response? How would Temporal PCA help you characterize the plant dynamics?

---

## References

Uppal, A., Ray, W. H., & Poore, A. B. (1974). On the dynamic behavior of continuous stirred tank reactors. *Chemical Engineering Science*, 29(4), 967–985. — Foundational analysis of CSTR multiplicity and limit cycles; establishes analytically the full classification of dynamic behavior as a function of the Damköhler number and heat of reaction.

Seborg, D. E., Edgar, T. F., Mellichamp, D. A., & Doyle, F. J. III. *Process Dynamics and Control* (4th ed.). Wiley. — Standard chemical engineering reference for CSTR modeling and PI control.

Vautard, R., & Ghil, M. (1989). Singular spectrum analysis in nonlinear dynamics, with applications to paleoclimatic time series. *Physica D*, 35(3), 395–424. — Foundational paper for SSA (the mathematical basis of Temporal PCA).

Qin, S. J. (2003). Statistical process monitoring: basics and beyond. *Journal of Chemometrics*, 17(8–9), 480–502. — PCA-based fault detection in process industries.

Kantor, J. C. *CBE30338: Simulation of an Exothermic CSTR*. — Open-source chemical engineering course material used as reference for this simulation.
