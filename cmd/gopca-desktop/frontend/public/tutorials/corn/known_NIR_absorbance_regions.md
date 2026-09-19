# Known NIR Absorption Regions

A working reference for interpreting near-infrared loading spectra and selecting
wavelength ranges. Written for the GoPCA sample datasets, but general.

Near-infrared spectroscopy (roughly **780–2500 nm**, 12800–4000 cm⁻¹) does not
observe fundamental vibrations. It observes their **overtones** (2ν, 3ν, 4ν) and
**combination bands** (ν₁ + ν₂), which are 10–1000× weaker than the corresponding
mid-infrared fundamentals. Only bonds involving hydrogen — **O–H, C–H, N–H** and,
weakly, **S–H** — have enough anharmonicity to produce useful NIR intensity.

Two consequences follow, and they govern everything below:

* **Bands are broad and overlap heavily.** A feature at a given wavelength is
  rarely attributable to one bond in one molecule. Assignments are indicative.
* **Positions shift.** Hydrogen bonding, temperature, physical state and matrix
  effects move bands by tens of nanometres. Water is the worst offender: its
  1450 nm band moves measurably with temperature alone.

Convention used throughout: the **first** overtone is 2ν, the **second** is 3ν,
the **third** is 4ν.

---

## 1. Quick reference by wavelength

For looking up an observed feature. Ranges are indicative; see the caveats above.

| Wavelength (nm) | Wavenumber (cm⁻¹) | Assignment | Typical origin |
|---|---|---|---|
| 760 | 13160 | O–H 3rd overtone (4ν) | water |
| 880–930 | 11400–10750 | C–H 3rd overtone (4ν) | hydrocarbons |
| 970 | 10310 | O–H **2nd** overtone (3ν) | water |
| 1020 | 9800 | N–H 2nd overtone (3ν) | proteins, amines |
| 1100–1250 | 9090–8000 | C–H 2nd overtone (3ν) | oils, starch, hydrocarbons |
| 1190 | 8400 | O–H combination (ν₁+ν₂+ν₃) | water |
| 1350–1450 | 7400–6900 | C–H combination (stretch + bend) | hydrocarbons, carbohydrates |
| 1400–1470 | 7140–6800 | O–H 1st overtone (2ν) | water, alcohols, carbohydrates |
| 1500–1570 | 6670–6370 | N–H 1st overtone (2ν) | proteins, amides, amines |
| 1540–1600 | 6490–6250 | O–H 1st overtone, hydrogen-bonded | cellulose, starch |
| 1650–1800 | 6060–5560 | C–H 1st overtone (2ν) | oils (1725, 1765), cellulose (1780) |
| 1900–1960 | 5260–5100 | O–H combination (ν₂+ν₃) | water — the moisture band |
| 1950–2050 | 5130–4880 | S–H 1st overtone (2ν) | thiols — very weak, see §5 |
| 2000–2200 | 5000–4550 | N–H combination (amide I/II) | proteins (2050, 2170) |
| 2090–2120 | 4780–4720 | O–H + C–O combination | starch, carbohydrates |
| 2200–2450 | 4550–4080 | C–H combination (stretch + bend) | oils (2310, 2350), starch (2280, 2330) |

---

## 2. By bond type

| Bond | Transition | Wavelength (nm) | Wavenumber (cm⁻¹) | Context |
|---|---|---|---|---|
| **O–H** | 1st overtone (2ν) | 1400–1470 | 7140–6800 | water, alcohols, phenols, carbohydrates |
| | 2nd overtone (3ν) | 950–990 | 10530–10100 | water |
| | Combination (ν_str + ν_bend) | 1900–1960 | 5260–5100 | bulk and bound water |
| | Combination (with C–O) | 2090–2120 | 4780–4720 | carbohydrates |
| **C–H** | 1st overtone (2ν) | 1650–1800 | 6060–5560 | –CH₂–, –CH₃, aromatic C–H |
| | 2nd overtone (3ν) | 1100–1250 | 9090–8000 | aliphatic and aromatic |
| | 3rd overtone (4ν) | 880–930 | 11400–10750 | aliphatic |
| | Combination (str + bend) | 1350–1450 | 7400–6900 | aliphatic |
| | Combination (str + bend) | 2200–2450 | 4550–4080 | fats, lipids, sugars, polymers |
| **N–H** | 1st overtone (2ν) | 1500–1570 | 6670–6370 | amines, amides, proteins |
| | 2nd overtone (3ν) | 1000–1050 | 10000–9520 | proteins |
| | Combination | 2000–2200 | 5000–4550 | peptide backbone, urea |
| **S–H** | 1st overtone (2ν) | 1950–2050 | 5130–4880 | thiols, cysteine — weak |

The S–H fundamental lies near 2550–2615 cm⁻¹, so its first overtone falls close to
2×2570 = 5140 cm⁻¹ (≈1945 nm), shifted longer still by anharmonicity. It is both
weak and buried under the water combination band, and is rarely usable in practice.

---

## 3. By compound class

### Water (H₂O)

The strongest and most troublesome absorber in NIR. Present in almost every
biological sample, and its bands shift with temperature and hydrogen bonding.

| nm | cm⁻¹ | Assignment |
|---|---|---|
| 760 | 13160 | 3rd overtone (4ν) |
| 970 | 10310 | 2nd overtone (3ν) |
| 1190 | 8400 | combination ν₁+ν₂+ν₃ |
| 1450 | 6900 | 1st overtone (2ν); shifts with hydrogen bonding |
| **1940** | **5150** | ν₂+ν₃ combination — the band used for moisture determination |

### Carbohydrates: starch, cellulose, sugars

The dominant constituent of most plant material, and the class most often needed
in food and feed analysis.

| nm | Assignment |
|---|---|
| 1450 | O–H 1st overtone (free) |
| 1540–1580 | O–H 1st overtone, hydrogen-bonded |
| 1780 | C–H 1st overtone — characteristic of cellulose |
| 2100 | O–H + C–O combination — the classic carbohydrate band |
| 2280–2330 | C–H combination |

### Proteins and peptides

| nm | Assignment |
|---|---|
| 1510–1540 | amide N–H 1st overtone; sensitive to secondary structure |
| 2050–2060 | amide N–H combination |
| 2170–2180 | amide combination (N–H stretch + C=O stretch / N–H bend) |

### Lipids, oils and hydrocarbons

| nm | Assignment |
|---|---|
| 1200 | C–H 2nd overtone |
| 1725 & 1765 | C–H 1st overtone doublet, symmetric/asymmetric CH₂ |
| 2310 & 2350 | C–H stretch–bend combination |

### Alcohols (R–OH)

| nm | Assignment |
|---|---|
| 1190–1210 | C–H 2nd overtone (ethyl) |
| 1430–1480 | O–H 1st overtone; free vs hydrogen-bonded monomer |
| 1690–1750 | C–H 1st overtone |
| 2270–2350 | C–H combination (CH₂/CH₃) |

---

## 4. Verification against the Corn dataset

The assignments above were checked against `corn.csv` (80 samples, 1100–2498 nm),
whose four constituents were determined independently by wet chemistry. Correlating
SNV-corrected absorbance with each laboratory value, wavelength by wavelength, gives:

| Constituent | Strongest wavelength | r | Expected region |
|---|---|---|---|
| Oil | **2304 nm** | +0.76 | C–H combination (lipid, 2310) ✓ |
| Protein | **2172 nm** | +0.71 | amide N–H combination (2170) ✓ |
| Moisture | **1918 nm** | +0.77 | O–H combination (water, 1940) ✓ |
| Starch | 1440 nm | +0.42 | O–H 1st overtone ✓ |

Absorption bands located in the mean corn spectrum by second-derivative minima —
1202, 1272, 1358, 1432, 1584, 1702, 1780, 1826, 1924, 2062, 2278 and 2316 nm — are
all accounted for by the table in §1, including the 1780 nm cellulose band and the
1350–1450 nm C–H combination region.

---

## 5. Practical notes

* **Overlap is the rule.** Around 1700–1800 nm, oil, starch and protein all
  absorb. Attributing a loading peak to one constituent needs corroboration —
  reference values, a designed experiment, or a second band for the same species.
* **Water dominates and drifts.** The 1450 and 1940 nm bands are strong enough to
  mask weaker features nearby, and both move with temperature and hydrogen
  bonding. Excluding these regions is a legitimate exploratory step; see Step 6 of
  the Corn tutorial.
* **Weak bands may not be usable.** S–H is the clearest example: real, but too
  weak and too overlapped to exploit in most matrices.
* **Overtone intensity falls steeply.** Each successive overtone is roughly an
  order of magnitude weaker, so 3rd-overtone bands below ~950 nm need long path
  lengths or concentrated samples.
* **These are indicative ranges, not identifications.** NIR band assignment is a
  weight of evidence, not a lookup.

---

## 6. Sources and status

Positions below are consensus values from standard NIR references. Two authoritative
texts are recommended if this document is to be developed further, neither of which
is currently held in `docs/references/`:

* Osborne, B. G., Fearn, T., & Hindle, P. H. (1993). *Practical NIR Spectroscopy
  with Applications in Food and Beverage Analysis* (2nd ed.). Longman.
* Workman, J., & Weyer, L. (2012). *Practical Guide and Spectral Atlas for
  Interpretive Near-Infrared Spectroscopy* (2nd ed.). CRC Press.

**Review history.** This document was reviewed against the physics of overtone
progressions, checked for internal consistency, and validated where possible against
the Corn dataset (§4). Corrections applied at review:

1. **970 nm was labeled the 3rd overtone.** It is the **2nd** overtone (3ν).
   The document's own table sets 1450 nm as the 1st overtone (2ν = 6897 cm⁻¹), and
   10309 / 6897 = 1.49, so 970 nm is the 3ν transition. A genuine 3rd overtone (4ν)
   falls near 760 nm, now listed separately.
2. **S–H 1st overtone was given as 1680–1720 nm.** That range implies a fundamental
   near 2950 cm⁻¹, which is C–H, not S–H (~2570 cm⁻¹). Corrected to 1950–2050 nm,
   with a note that the band is weak and overlapped. As previously written it also
   fell entirely inside the stated C–H 1st overtone range.
3. **No carbohydrate section existed**, despite carbohydrates being the dominant
   constituent of most plant material. Added, including the 2100 nm O–H + C–O band
   and the 1780 nm cellulose C–H band.
4. **The C–H combination region near 1350–1450 nm was missing**, leaving a gap
   between the 2nd overtone and the 1st overtone entries. Corn shows a real band at
   1358 nm.
5. **The C–H 1st overtone range was 1650–1760 nm**, which excludes the 1780 nm
   cellulose band observed in corn. Widened to 1650–1800 nm.
6. All wavelength ↔ wavenumber conversions were recomputed (cm⁻¹ = 10⁷ / nm). Those
   in the original document were correct and have been preserved where unchanged.
