# Planet Parade Index (PPI)

A composite scoring system that ranks planetary alignment events by combining geometric tightness, planet count, brightness, and visibility into a single number.

## Motivation

Raw ecliptic longitude span (our current metric) answers "how tight is this cluster?" but not "how good is this parade?" A 35° span of 5 bright naked-eye planets is arguably better than a 90° span of 7 planets where two require binoculars. The PPI captures these tradeoffs in a single score, with user-tunable priorities.

## Formula

For a combination P = {p₁, ..., pₖ} of k planets from N selected:

```
PPI(P) = Count(k)^α  ×  Compactness(span)^β  ×  Brightness(mags)^γ  ×  Visibility(ε)  ×  100
```

Only morning and evening combinations are scored. Straddling combinations (where the Sun falls inside the ecliptic arc) are excluded — you cannot see all planets in a straddling cluster at once, and their visible morning/evening subsets are already evaluated as separate combos at lower k.

The single highest-scoring combination per day (across all k values and AM/PM kinds) is reported.

---

## Components

### Count(k) = k / N

Fraction of selected planets included in the combination.

| k (of 7) | Count |
|-----------|-------|
| 7         | 1.00  |
| 6         | 0.86  |
| 5         | 0.71  |
| 4         | 0.57  |

### Compactness(span) = exp(−span / σ), σ = 180°

Ecliptic longitude span computed via `computeMaxSpan` (wraparound-safe). Exponential decay because the difference between 20° and 40° matters far more than between 120° and 140°.

| Span | Compactness |
|------|-------------|
| 10°  | 0.95        |
| 30°  | 0.85        |
| 60°  | 0.72        |
| 90°  | 0.61        |
| 120° | 0.51        |
| 180° | 0.37        |

The scale constant σ=180° was chosen empirically — σ=90° (original) crushed all scores below 10 for realistic parades.

### Brightness(mags) = geometricMean(b_i)

Per-planet weight from actual apparent magnitude on that date:

```
b_i = clamp((6.5 − m_i) / 6.5,  0.01,  1.0)
```

| Planet  | Typical mag | b_i  |
|---------|-------------|------|
| Venus   | −4.2        | 1.00 |
| Jupiter | −2.3        | 1.00 |
| Mercury | −0.5        | 1.00 |
| Saturn  | +0.8        | 0.88 |
| Mars    | +1.8        | 0.72 |
| Uranus  | +5.7        | 0.12 |
| Neptune | +7.9        | 0.01 |

Uses geometric mean so one dim planet pulls down the score proportionally. The 0.01 floor prevents Neptune from completely zeroing the score — the combination system can always find the k−1 subset without it if that scores better.

### Visibility(ε) = min(v_i)

Hard physical constraint — the least-visible planet is the bottleneck. Not user-tunable:

```
|ε| < 10°   →  0      (invisible — lost in Sun's glare)
    10–20°  →  0.3    (marginal — low in bright twilight)
    20–30°  →  0.7    (visible but low)
    > 30°   →  1.0    (well placed)
```

Uses **minimum** (not geometric mean) because a parade with one planet lost in the Sun's glare is fundamentally compromised — you can't see the full lineup regardless of how well-placed the other planets are. With geometric mean, a single planet at 11° elongation (weight 0.3) among 3 well-placed planets only reduced visibility to 0.74, which was far too lenient.

A planet at 5° elongation is genuinely invisible regardless of user preference. This component has no exponent — it acts as a gate.

---

## User-Tunable Weights

### Why vote-share, not independent sliders

With the multiplicative formula, only the **ratio** of exponents affects ranking — doubling all exponents is a monotonic transform that produces the same ordering. Independent sliders would have a hidden redundancy where multiple settings produce identical results. Vote-share (α + β = constant) eliminates this degeneracy and forces the user to express relative priority.

### Slider 1: Count vs Tightness (α + β = 2.4)

```
Planet count ◄━━━━━━━━━━━━━━━► Tightness
```

Controls how the exponent budget is split between Count and Compactness:

| Position       | α   | β   | Effect                                |
|----------------|-----|-----|---------------------------------------|
| Left (count)   | 2.0 | 0.4 | Strongly favors more planets          |
| Center-left    | 1.6 | 0.8 | Favors count, tightness secondary     |
| **Center**     | 1.2 | 1.2 | **Balanced (default)**                |
| Center-right   | 0.8 | 1.6 | Favors tightness, count secondary     |
| Right (tight)  | 0.4 | 2.0 | Strongly favors tight clusters        |

### Slider 2: Brightness importance (γ)

```
All planets equal ◄━━━━━━━━━━━━► Bright planets favored
```

Controls how much apparent magnitude affects scoring:

| Position         | γ   | Effect                                     |
|------------------|-----|--------------------------------------------|
| Left (equal)     | 0   | Brightness ignored — all planets count same |
| **Center-left**  | 0.5 | **Mild brightness preference (default)**    |
| Center           | 1.0 | Moderate brightness weighting               |
| Center-right     | 1.5 | Strong brightness preference                |
| Right (bright)   | 2.0 | Dim planets heavily penalized               |

Default γ=0.5 was chosen empirically. At γ=1.0, Neptune's bw=0.01 in a geometric mean overwhelmed the score, making any combo including outer planets uncompetitive. At γ=0, brightness is ignored entirely, ranking invisible-to-naked-eye combos (Uranus/Neptune) alongside bright ones. γ=0.5 (square root of the geometric mean) is a good middle ground.

These two sliders are genuinely orthogonal: "count vs tightness" is a geometric question, "bright vs dim" is an observing-style question.

---

## Example Scores (default weights: α=1.2, β=1.2, γ=0.5)

### 4 bright planets at 31° span, all well placed (2022-04-15)
```
Count:       (4/7)^1.2  = 0.50
Compactness: exp(-31/180)^1.2 = 0.842^1.2 = 0.809
Brightness:  geomean(Ven,Mar,Jup,Sat) ≈ 0.90, ^0.5 = 0.95
Visibility:  min = 1.0 (all > 30°)
PPI = 0.50 × 0.809 × 0.95 × 1.0 × 100 ≈ 38
```

### 5 morning planets at 81° span (2022-06-08)
```
Count:       (5/7)^1.2  = 0.67
Compactness: exp(-81/180)^1.2 = 0.638^1.2 = 0.576
Brightness:  geomean(Ven,Mar,Jup,Sat,Ura) ≈ 0.62, ^0.5 = 0.79
Visibility:  min = 1.0 (all > 30°)
PPI = 0.67 × 0.576 × 0.79 × 1.0 × 100 ≈ 30
```

### 4 tight planets at 5° but one near Sun (2026-04-18)
```
Count:       (4/7)^1.2  = 0.50
Compactness: exp(-5/180)^1.2 = 0.973^1.2 = 0.967
Brightness:  geomean(Mer,Mar,Sat,Nep) ≈ 0.29, ^0.5 = 0.54
Visibility:  min = 0.7 (Mercury at 20°)
PPI = 0.50 × 0.967 × 0.54 × 0.7 × 100 ≈ 18
```

The 2022 4-planet parade (PPI 38) correctly outscores 2026's tightest alignment (PPI 18) — 2022 had genuinely brighter, better-placed planets in a reasonably tight cluster.

---

## Design Decisions

### Straddling exclusion

Straddling combinations (Sun inside the ecliptic arc) are skipped entirely in PPI computation. Rationale: a straddling cluster has planets on both sides of the Sun — some in the morning sky, some in the evening sky. You literally cannot see all of them at once. The morning and evening subsets of a straddling combo are already evaluated independently as AM/PM combos at lower k values, so nothing is lost.

### Minimum elongation (not geometric mean)

The visibility factor uses the **minimum** elongation weight across all planets in the combo, not a geometric mean. With geometric mean, a single planet at 11° from the Sun (weight 0.3) among 3 well-placed planets only reduced visibility from 1.0 to 0.74 — far too lenient. With minimum, the whole combo gets 0.3, correctly reflecting that the parade is compromised.

### Single best combo per day

Unlike the span-based system which tracks the best combo per kind per tab, PPI reports a single winner per day across all k values and kinds. This eliminates the need for count-based tabs in the peaks table — PPI handles cross-k comparison naturally.

---

## Integration with Existing System

### Peaks table

Replaces the old span-minima table. Each row shows: date, PPI score, span, planet count, kind (AM/PM), planet symbols. Default sort: PPI descending.

### Sliders

Two range sliders in the Alignment panel under "Parade Scoring", below the min-planets control. Debounced at 300ms.

### Existing span chart

The span chart with per-count tabs and per-kind series remains unchanged. PPI chart is future work.

### Combination classification

Same as the current system. Each combination is classified as AM/PM/Straddling based on whether the Sun falls inside its ecliptic arc.

### Pass 2 (future)

Observer-specific refinement for a given location and date, adding:
- Atmospheric extinction (airmass correction to magnitudes)
- Twilight factor (Sun altitude)
- Moon interference (illumination × angular distance)

Pass 2 refines a specific date identified by Pass 1. Not in initial scope.
