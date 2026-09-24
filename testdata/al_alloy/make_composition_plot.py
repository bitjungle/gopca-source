"""Composition profile of the 24 elements in the aluminium alloy dataset.

Generates al_alloy_composition.png used by the Al alloy tutorial. Like the other
testdata scripts it reads and writes relative to the current directory, so run it
from testdata/al_alloy/:

    cd testdata/al_alloy && python make_composition_plot.py

The figure makes two properties of this dataset visible, because both decide how
it must be preprocessed and neither is obvious from a table of numbers.

Left panel, the scale. Concentrations span six orders of magnitude on a log
axis: aluminium reaches 99.99% while beryllium is measured as low as 0.0001%. That spread
is real chemistry, not a choice of units -- every column is a weight fraction of
the same whole -- which is why standardizing this data destroys the structure
instead of revealing it.

Right panel, the sparsity. Most elements are absent from most alloys. An element
present in 3% of rows contributes almost no variance however decisive it is in
the alloys that contain it, which is why PCA finds four components built from
five elements and is blind to the other nineteen.

A log axis cannot show zero, so the left panel describes each element only over
the alloys that actually contain it: the range it covers there, and its average
there. The right panel is what carries the zeros. Splitting the two questions --
"how much, when present" and "how often present" -- keeps every marker on the
left panel inside its own range, which an overall mean would not be: tin averages
0.05% across the file but is never found below 6% in an alloy that contains it.
"""
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

df = pd.read_csv('al_alloy_data.csv')

# The element columns are everything except the identifier and the held-out
# metadata. Naming the exclusions rather than the elements keeps the script
# correct if the element list ever changes.
excluded = ['Sample_ID', 'Name', 'Source', 'Condition',
            'Condition augmented', 'proc_num#category']
elements = [c for c in df.columns if c not in excluded]

# Weight fractions in the file; percent is what a metallurgist reads.
pct = df[elements] * 100

# Zero means "not in this alloy", not "present in a vanishing amount", so the
# left panel's statistics are all conditional on the element being present.
present = pct[pct > 0]

stats = pd.DataFrame({
    'mean_present': present.mean(),
    'max': present.max(),
    'min_present': present.min(),
    'present_pct': (pct > 0).sum() / len(pct) * 100,
    # Kept for the ordering only: sorting by the overall mean puts the elements
    # in the order that matters to a PCA of this data, which is what the tutorial
    # goes on to discuss.
    'mean_overall': pct.mean(),
}).sort_values('mean_overall', ascending=False)

sns.set_theme(style="white")
fig, (ax_scale, ax_present) = plt.subplots(
    1, 2, figsize=(13, 5.5), gridspec_kw={'width_ratios': [1.35, 1]})

y = range(len(stats))

# --- Left: the range each element covers, and its mean -----------------------
ax_scale.hlines(y, stats['min_present'], stats['max'],
                color='#b8c4d0', linewidth=3.5, zorder=1)
ax_scale.scatter(stats['max'], y, s=22, color='#2c7fb8',
                 zorder=3, label='highest measured')
ax_scale.scatter(stats['mean_present'], y, s=46, marker='D', color='#de8f05',
                 edgecolor='white', linewidth=0.6, zorder=4, label='mean when present')
ax_scale.set_xscale('log')
ax_scale.set_yticks(list(y))
ax_scale.set_yticklabels(stats.index)
ax_scale.invert_yaxis()
ax_scale.set_xlabel('concentration where the element is present, weight % (log scale)')
# Computed rather than written down, so the title cannot drift from the data it
# describes. It said "five" while the span was six until that was checked.
decades = np.log10(stats['max'].max() / stats['min_present'].min())
ax_scale.set_title(
    f'{decades:.0f} orders of magnitude separate the elements',
    fontsize=11, pad=10)
ax_scale.grid(axis='x', alpha=0.3)
ax_scale.legend(loc='lower right', frameon=True, fontsize=9)

# --- Right: how many alloys contain the element at all -----------------------
ax_present.barh(list(y), stats['present_pct'], color='#2c7fb8', alpha=0.85)
ax_present.set_yticks(list(y))
ax_present.set_yticklabels([])
ax_present.invert_yaxis()
ax_present.set_xlim(0, 100)
ax_present.set_xlabel('alloys containing the element (%)')
ax_present.set_title('Most elements are absent from most alloys',
                     fontsize=11, pad=10)
ax_present.grid(axis='x', alpha=0.3)

for i, (name, row) in enumerate(stats.iterrows()):
    label = (f"{row['present_pct']:.0f}%" if row['present_pct'] >= 10
             else f"{row['present_pct']:.1f}%")
    ax_present.text(row['present_pct'] + 1.5, i, label,
                    va='center', fontsize=8, color='#555')

fig.suptitle(
    f"Composition of {len(df)} aluminium alloys, {len(elements)} elements",
    fontsize=13, y=0.99)
fig.tight_layout(rect=(0, 0, 1, 0.96))
fig.savefig('al_alloy_composition.png', dpi=110, bbox_inches='tight')
# plt.show()
