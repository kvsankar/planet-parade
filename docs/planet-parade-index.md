# Planet Parade Index (PPI)

A composite scoring system that ranks planetary alignment events by combining geometric tightness, planet count, brightness, and visibility into a single number (0–100).

## Motivation

Raw ecliptic longitude span answers "how tight is this cluster?" but not "how good is this parade?" A 31° span of 4 bright naked-eye planets is arguably better than a 90° span of 7 planets where two require binoculars. The PPI captures these tradeoffs in a single score, with user-tunable priorities via four independent sliders and two presets (Visibility and Media).

## Formula

For a combination P = {p1, ..., pk} of k planets from N selected:

```
PPI(P) = (k/N)^alpha  x  exp(-span/sigma)^beta  x  brightness^gamma  x  elongVisibility  x  100
```

where `elongVisibility` is modulated by the `delta` parameter (see below).

Only morning and evening combinations are scored. Straddling combinations (Sun inside the ecliptic arc) are excluded.

---

## The Four Dimensions

### Why four knobs?

Each dimension captures a genuinely independent aspect of parade quality:

| Dimension | Question | Knob |
|-----------|----------|------|
| Count (alpha) | "How many planets?" | Few vs Many |
| Compactness (beta) | "How tight is the grouping?" | Wide OK vs Tight only |
| Brightness (gamma) | "Can I see them with naked eyes?" | All equal vs Bright favoured |
| Elongation gate (delta) | "Are they far enough from the Sun?" | Pure geometry vs Must be visible |

These are orthogonal: changing one doesn't affect the others. Previous versions coupled alpha and beta as alpha + beta = 2.4 ("vote share"), but this was abandoned because count and compactness are conceptually independent — a user may want both high count AND high tightness simultaneously, which a coupled slider cannot express.

### Count: (k/N)^alpha

Fraction of selected planets in the combination, raised to alpha.

| k (of 7) | alpha=0.5 | alpha=1.0 | alpha=1.5 | alpha=2.0 |
|-----------|-----------|-----------|-----------|-----------|
| 7 | 1.00 | 1.00 | 1.00 | 1.00 |
| 5 | 0.85 | 0.71 | 0.61 | 0.51 |
| 3 | 0.65 | 0.43 | 0.28 | 0.18 |

Higher alpha means more planets are strongly favoured over fewer.

### Compactness: exp(-span/sigma)^beta, sigma=180deg

Ecliptic longitude span (wraparound-safe). Exponential decay: the difference between 20deg and 40deg matters far more than 120deg vs 140deg. sigma=180deg was chosen so realistic parades (30deg-90deg span) produce meaningful score differences.

| Span | beta=0.5 | beta=1.0 | beta=2.0 |
|------|----------|----------|----------|
| 10deg | 0.97 | 0.95 | 0.89 |
| 30deg | 0.92 | 0.85 | 0.72 |
| 60deg | 0.85 | 0.72 | 0.51 |
| 90deg | 0.78 | 0.61 | 0.37 |
| 120deg | 0.71 | 0.51 | 0.26 |

Higher beta punishes wide groupings more severely.

### Brightness: geomean(b_i)^gamma

Per-planet weight from apparent visual magnitude on that date:

```
b_i = clamp((6.5 - mag_i) / 6.5,  0.01,  1.0)
```

Geometric mean, raised to gamma.

| Planet | Typical mag | b_i |
|---------|-------------|------|
| Venus | -4.2 | 1.00 |
| Jupiter | -2.3 | 1.00 |
| Mercury | -0.5 | 1.00 |
| Saturn | +0.8 | 0.88 |
| Mars | +1.8 | 0.72 |
| Uranus | +5.7 | 0.12 |
| Neptune | +7.9 | 0.01 |

- gamma=0: Brightness ignored. All planets count the same. Uranus/Neptune are free count-padding.
- gamma=0.25: Mild penalty. Dim planets survive in compelling groupings but don't dominate.
- gamma=0.5: Moderate penalty. Uranus/Neptune effectively excluded from top rankings.
- gamma=1.0+: Strong penalty. Only the brightest combos score well.

### Elongation gate: delta parameter

Per-planet elongation weight (smoothstep 5°–30°):

```
|elong| ≤ 5deg   ->  0    (invisible -- lost in Sun's glare)
        5-30deg  ->  smoothstep(t), t = (elong - 5) / 25
        ≥ 30deg  ->  1.0  (well placed)
```

The smoothstep `t²(3-2t)` provides a continuous, differentiable transition that avoids artificial step discontinuities in the PPI time series.

The raw weight uses **minimum** across all planets (bottleneck model). The delta parameter modulates how much this gate matters:

```
effectiveWeight = 1 - delta * (1 - rawWeight)
```

- delta=0: Pure geometry. Planets near the Sun still count. Useful for matching media events that include technically-invisible planets (e.g., the May 2000 Great Massing).
- delta=0.25: Mild gate. Near-Sun planets are heavily penalised but not zeroed.
- delta=0.5: Partial gate. Balances visibility with geometric inclusiveness.
- delta=1.0: Full gate. Any planet < 10deg from Sun zeroes the entire combo.

---

## Presets

### Visibility (Default)

```
alpha = 1.0   (moderate count emphasis)
beta  = 2.0   (compactness dominates)
gamma = 0.25  (mild brightness penalty)
delta = 0.25  (mild elongation gate)
```

**Design goal**: Rank events by how visually impressive they would be to a naked-eye observer.

**How we arrived at these values**:

1. **Parameter sweep** (720 combinations: 6 alpha x 6 beta x 4 gamma x 5 delta): Evaluated against 10 well-known planet parade events (2000-2026) from NASA, Space.com, BBC Sky at Night, etc. The sweep optimised for "tightness discrimination" -- the ability to rank the tight Apr 2022 4-planet cluster higher than the wider Jun 2022 5-planet event. Result: alpha=1.0, beta=2.0, gamma=0, delta=0.25.

2. **Manual audit** (top-50 peaks, 2000-2026): With gamma=0, 34 of the 50 top-ranked peaks included Uranus or Neptune -- planets invisible to the naked eye (mag 5.7-7.9). These dim planets were acting as free count-padding, boosting PPI through the alpha factor without any brightness penalty. Examples:
   - 18-Apr-2026: 4p Mer,Mar,Sat,**Nep** (bright=0.29) ranked #2 -- Neptune is invisible
   - 27-Mar-2006: 4p Mer,Ven,**Ura,Nep** (bright=0.16) ranked #21 -- really just a 2-planet pair
   - 13-Dec-2000: 3p Ven,**Ura,Nep** (bright=0.10) -- two invisible planets

3. **Three-way gamma comparison**:

   ```
                       gamma=0      gamma=0.25   gamma=0.5
   Ura/Nep in top 50:  34/50        5/50         0/50
   Mean brightness:     0.487        0.889        0.941
   Mean planet count:   3.84         3.36         3.24
   ```

   gamma=0.25 is the sweet spot: dim planets are penalised but not eliminated. The 5 remaining peaks with outer planets are defensible (Uranus at mag 5.7 is technically naked-eye visible, and those combos ranked #34+ not #2). gamma=0.5 over-corrects: 0/50 peaks include any outer planet, effectively treating them as nonexistent.

### Media

```
alpha = 2.0   (count favoured -- media cares about "how many planets")
beta  = 0.25  (very low compactness -- media parades span 90-175°)
gamma = 0.25  (mild brightness penalty)
delta = 0.75  (strong elongation gate -- smooth curve needs higher delta)
```

**Design goal**: Match the dates that media outlets (NASA, Space.com, etc.) report as "planet parade" events, finding the correct number of planets at the right time.

**How we arrived at these values**:

Count-aware parameter sweep (960 combinations: 6 alpha × 8 beta × 4 gamma × 5 delta). For each event, the sweep finds the **closest PPI peak (local maximum) with ≥ expected planet count** to the public date. This "closest count-matched peak" approach measures whether the formula peaks with the right count near the media date — not just where the overall highest PPI is. Fitness function sorted by: (1) most events with a count-matched peak, (2) most count-matched peaks within ±5 days, (3) lowest mean offset.

**Key insight: the two presets need very different beta values.** The Visibility preset wants high beta (2.0) to reward tight clusters. The Media preset wants very low beta (0.25) because media-highlighted events often span wide arcs (5–7 planets over 90–175° of ecliptic longitude). With high beta, the formula penalises these wide spans and finds tighter subsets with fewer planets — the opposite of what the media reports. The moderate alpha (2.0) then lets count favour the score, ensuring the formula picks the widest visible group.

---

## Media Preset vs Public Dates

Current performance using "closest count-matched peak" evaluation (mean |offset| = 6.3 days, **5 of 9** visible events within ±5 days, **9/9 planet-count matches**):

| Event | Public date | Planets | Closest count-matched peak | Found | Offset |
|-------|------------|---------|---------------------------|-------|--------|
| Great Massing May 2000 | 05-May-2000 | 5 | 09-May-2000 | 5p | +4d |
| 5p evening Apr 2002 | 20-Apr-2002 | 5 | 03-May-2002 | 5p | +13d |
| 5p morning Jan 2005 | 01-Jan-2005 | 5 | 23-Dec-2004 | 5p | -9d |
| 6p morning May 2011 | 11-May-2011 | 6 | 11-May-2011 | 7p | 0d |
| 5p morning Feb 2016 | 05-Feb-2016 | 5 | 31-Jan-2016 | 5p | -5d |
| 4p tight Apr 2022 | 15-Apr-2022 | 4 | 15-Apr-2022 | 4p | 0d |
| 5p morning Jun 2022 | 24-Jun-2022 | 5 | 17-Jun-2022 | 7p | -7d |
| 6p evening Jan 2025 | 21-Jan-2025 | 6 | 06-Feb-2025 | 6p | +16d |
| 7p evening Feb 2025 | 28-Feb-2025 | 7 | 26-Feb-2025 | 7p | -2d |
| 6p evening Feb 2026 | 28-Feb-2026 | 6 | 23-Feb-2026 | 6p | -5d |

The previous media preset (α=1.5, β=2.0) matched planet counts on only 3/9 events because the high beta penalised wide spans, causing PPI to find tighter subsets with fewer planets (e.g., finding 2-3 planets when media reported 5-7). The new α=2.0, β=0.25 achieves 9/9 count matches with better date alignment.

### Why offsets exist for some events

The three outliers (>5 day offset) reflect genuine disagreements:

1. **Apr 2002 (+13d)**: Mercury at only 14deg elongation on the public date (marginal). PPI finds a count-matched peak 13 days later when Mercury is better placed.

2. **Jan 2005 (-9d)**: PPI finds the 5-planet peak 9 days before the public date. The planets were broadly aligned across a wide window.

3. **Jan 2025 (+16d)**: PPI finds the 6-planet peak 16 days after the public date when the grouping is slightly better for observation.

---

## Slider UI

Four sliders in the Alignment panel under "Parade Scoring":

```
Few planets ◄━━━━━━━━━━━━━━━► Many planets        (alpha: 0.0 - 3.0)
Wide OK     ◄━━━━━━━━━━━━━━━► Tight only          (beta:  0.0 - 3.0)
All equal   ◄━━━━━━━━━━━━━━━► Bright favoured     (gamma: 0.0 - 2.0)
Geometric   ◄━━━━━━━━━━━━━━━► Visible only        (delta: 0.0 - 1.0)
```

Two preset buttons: **Visibility** and **Media**. When sliders match a preset exactly, the corresponding button highlights. Moving any slider to a non-preset value shows "Custom".

---

## Design Decisions

### Straddling exclusion

Straddling combinations (Sun inside the ecliptic arc) are excluded. A straddling cluster has planets on both sides of the Sun -- some in the morning sky, some in the evening sky. You cannot see all of them at once. The morning and evening subsets are already evaluated independently as AM/PM combos at lower k values, so nothing is lost.

### Minimum elongation (not geometric mean)

The visibility factor uses the **minimum** elongation weight across all planets in the combo, not a geometric mean. With geometric mean, a single planet at 11deg from the Sun (weight 0.3) among 3 well-placed planets only reduced visibility from 1.0 to 0.74 -- far too lenient. With minimum, the whole combo gets 0.3, correctly reflecting that the parade is compromised.

### Single best combo per day

PPI reports a single winner per day across all k values and kinds. This eliminates the need for count-based tabs in the peaks table -- PPI handles cross-k comparison naturally through the alpha exponent.

### Per-count tracking for the timeline chart

While PPI selects a single best combo per day for the peaks table, the timeline chart tracks the best combo *per planet count* per day (`countBests` in `PPIResult`). This allows the chart to show separate lines for 7p, 6p, 5p, etc., each with its own colour, so the user can see how different grouping sizes evolve over time.

---

## Calibration Data

### Known events (2000-2026)

10 well-documented planet parade events used for calibration:

| # | Event | Date | Planets | Kind | Source |
|---|-------|------|---------|------|--------|
| 1 | Great Massing | 2000-05-05 | 5 | AM (invisible) | NSSDCA/NASA |
| 2 | 5p evening | 2002-04-20 | 5 | PM | ESA, Harvard Gazette |
| 3 | 5p morning | 2005-01-01 | 5 | AM | Star Walk |
| 4 | 6p morning | 2011-05-11 | 6 | AM | Space.com |
| 5 | 5p morning | 2016-02-05 | 5 | AM | Space.com |
| 6 | 4p tight | 2022-04-15 | 4 | AM | Visual quality benchmark |
| 7 | 5p morning | 2022-06-24 | 5 | AM | Space.com, NASA |
| 8 | 6p evening | 2025-01-21 | 6 | PM | NASA |
| 9 | 7p evening | 2025-02-28 | 7 | PM | BBC Sky at Night |
| 10 | 6p evening | 2026-02-28 | 6 | PM | National Geographic |

### Parameter sweep

960 weight combinations (6 alpha × 8 beta × 4 gamma × 5 delta) evaluated against all 10 events. Each combination computes PPI in a ±30 day window around each event, finds the top peak, and measures both the date offset and planet-count match.

- **Media fitness**: For each event, finds the closest PPI peak (local maximum) with ≥ expected planet count to the public date. Sorted by (1) most events with a count-matched peak, (2) most count-matched peaks within ±5 days, (3) lowest mean offset. This "closest count-matched peak" approach ensures both the right planet count and good date alignment.
- **Visibility fitness**: Maximise "tightness gap" (Apr 2022 PPI minus Jun 2022 PPI); require all visible events to have non-zero PPI; secondary: highest mean PPI.

The sweep runs in ~54 seconds. Test file: `src/lib/__tests__/ppiSweep.test.ts`.

### Manual audit

Top-50 peaks audit across 2000-2026 with three gamma settings (0, 0.25, 0.5). Test file: `src/lib/__tests__/ppiAudit.test.ts`.

---

## Test Files

| File | Purpose | Runtime |
|------|---------|---------|
| `src/lib/__tests__/ppiScoring.test.ts` | Unit tests for formula components | <1s |
| `src/lib/__tests__/ppiValidation.test.ts` | Unified comparison table + elongation diagnosis | ~2s |
| `src/lib/__tests__/ppiSweep.test.ts` | Parameter sweep (720 combos x 10 events) | ~42s |
| `src/lib/__tests__/ppiAudit.test.ts` | Top-50 peaks audit with gamma comparison | ~3s |

---

## See Also

- [Alignment Algorithm](alignment-algorithm-analysis.md) — The underlying combination-based alignment computation that PPI scores are built on
- [Product Specification](specs.md) — Full feature requirements and design decisions

## Future Work (Pass 2)

Observer-specific refinement for a given location and date:
- Atmospheric extinction (airmass correction to magnitudes)
- Twilight factor (Sun altitude at observer's location)
- Moon interference (illumination x angular distance)
- Horizon obstruction (planets below local horizon)

Pass 2 refines a specific date identified by Pass 1. Not in current scope.
