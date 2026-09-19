# CSTR Temporal PCA Dataset

Simulated dataset for the GoPCA Temporal PCA tutorial.
Covers process monitoring of a non-isothermal CSTR through six operating scenarios: normal, two feed disturbances, a flow oscillation, a cooling fault, and recovery.

## Files

| File | Purpose |
|------|---------|
| `cstr_temporal_pca.csv` | Ready-to-use dataset (801 rows, 15 columns) |
| `simulate_cstr_temporal_pca_dataset.py` | ODE simulator that generates the CSV |
| `draw_cstr_diagram.py` | Generates the P&ID diagram (`cstr_diagram.png`) |
| `cstr_diagram.png` | P&ID for the tutorial (committed, regenerate if you change the diagram script) |
| `cstr_exploration.md` | Tutorial text (source of truth; synced to the GoPCA frontend by `scripts/sync-docs.sh`) |

## Quick start

```bash
cd testdata
python -m venv .venv && source .venv/bin/activate
pip install numpy pandas scipy matplotlib
```

Regenerate the default dataset:

```bash
python simulate_cstr_temporal_pca_dataset.py
# Writes cstr_temporal_pca.csv in the current directory
```

Regenerate the P&ID diagram:

```bash
python draw_cstr_diagram.py
# Writes cstr_diagram.png in the current directory
```

## Simulator options

```
usage: simulate_cstr_temporal_pca_dataset.py [options]

  --output PATH        Output CSV path (default: cstr_temporal_pca.csv)
  --duration FLOAT     Simulation duration in minutes (default: 800)
  --sample-time FLOAT  Sampling interval in minutes (default: 1.0)
  --seed INT           Random seed for reproducible noise (default: 42)
  --noise-level FLOAT  Noise scale factor: 0 = noiseless, 1 = realistic (default: 1.0)
```

Example — generate a noiseless version for validation:

```bash
python simulate_cstr_temporal_pca_dataset.py --noise-level 0 --output cstr_noiseless.csv
```

## Model summary

Non-isothermal CSTR, irreversible first-order exothermic reaction A -> B.

Three ODEs integrated with LSODA (SciPy):

```
dC_A/dt = (F/V)(C_Af - C_A) - k(T) * C_A
dC_B/dt = (F/V)(0   - C_B) + k(T) * C_A
dT/dt   = (F/V)(T_f - T) + (-dH / rho*Cp) * k(T)*C_A - (UA / rho*Cp*V) * (T - T_c)
```

Arrhenius rate: `k(T) = k0 * exp(-E/R / T)`

A PI controller with anti-windup manipulates coolant temperature `T_c` to hold the reactor at `T_sp = 365 K`.

**Key parameters** (see `CSTRParameters` dataclass):

| Parameter | Value | Description |
|-----------|-------|-------------|
| `V` | 100 L | Reactor volume |
| `F_nom` | 100 L/min | Nominal feed flow |
| `tau` | V/F = 1 min | Hydraulic residence time |
| `k0` | 7.2e10 1/min | Arrhenius pre-factor |
| `E_over_R` | 8750 K | Activation energy / R |
| `deltaH` | -5.0e4 J/mol | Heat of reaction |
| `UA` | 5.0e4 J/(min*K) | Heat-transfer coefficient (nominal) |
| `Kc` | 3.0 | PI proportional gain |
| `tau_I` | 8 min | PI integral time |

## Operating scenarios

| Time (min) | Scenario | Change applied |
|-----------|---------|---------------|
| 0 - 120 | Normal | Steady-state baseline |
| 120 - 240 | Feed concentration step | C_Af +10% |
| 240 - 360 | Feed temperature step | T_f +7 K |
| 360 - 520 | Flow oscillation | F +/-8% at 40-min period |
| 520 - 680 | Cooling fault | UA reduced 28% |
| 680 - 800 | Recovery | UA ramped back to nominal over 20 min |

## Process time constants

| Dynamic | Time constant | Suggested L for Temporal PCA |
|---------|--------------|------------------------------|
| Residence time | ~1 min | L = 2-5 |
| PI integral time | 8 min | L = 8-16 |
| Step settling | ~20-30 min | L = 20-30 |
| Flow oscillation | 40 min | L = 40-80 |

## How to modify the simulator

**Change a scenario** — edit `scenario_inputs()`. Each `if/elif` block covers one time range. Return a modified `F`, `CAf`, `Tf`, or `UA_factor`.

**Change physical parameters** — edit the `CSTRParameters` dataclass. All ODEs and derived quantities reference `p.*` fields.

**Add a new scenario** — add an `elif` block in `scenario_inputs()` with the desired time range, set the inputs, and assign a new `event` string. Add the new label to the `regime` mapping in `simulate()` if you want a distinct coarse-grained group.

**Add a new output column** — compute the derived quantity inside the `for i, t in enumerate(time)` loop in `simulate()` and append a key to the `rows.append({...})` dict. GoPCA treats numeric columns as PCA variables and string columns as categorical automatically.

**Re-run and commit** — after modifying, regenerate the CSV and verify the tutorial steps still produce expected results:

```bash
python simulate_cstr_temporal_pca_dataset.py
```

Load the new CSV in GoPCA Desktop and manually verify the key Temporal PCA signatures described in `cstr_exploration.md` before committing.

## Notes on physical correctness

- `C_B` is an independent ODE state. Using `C_B = C_Af - C_A` is only valid at steady state; during transients `C_B` has its own residence-time dynamics.
- The feed stream is assumed to be a liquid solution: reactant A is dissolved in a bulk solvent (water). The solvent is not modeled as a separate state because its concentration is effectively constant. Its thermal properties appear implicitly through `rho`, `Cp`, and `UA`.
- At nominal steady state (T = 365 K, F = 100 L/min): k ~= 2.74 min^-1, C_A ~= 0.267 mol/L, C_B ~= 0.733 mol/L.

## References

Uppal, A., Ray, W. H., & Poore, A. B. (1974). On the dynamic behavior of continuous stirred tank reactors. *Chemical Engineering Science*, 29(4), 967-985.

Seborg, D. E., Edgar, T. F., Mellichamp, D. A., & Doyle, F. J. III. *Process Dynamics and Control* (4th ed.). Wiley.

Kantor, J. C. *CBE30338: Simulation of an Exothermic CSTR*. https://jckantor.github.io/CBE30338/07.04-Simulation-of-an-Exothermic-CSTR.html
