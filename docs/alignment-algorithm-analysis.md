# Alignment Algorithm Analysis

Research into how planetary alignment events are computed in astronomy, compared to our implementation.

## Coordinate System: Ecliptic Longitude

Our algorithm uses **ecliptic longitude** — the preferred approach for multi-planet alignments.

- The USNO Astronomical Almanac defines conjunction as same ecliptic longitude *or* RA
- Since all planets orbit near the ecliptic plane, ecliptic longitude is the natural coordinate for "parades"
- Skyfield (the gold-standard Python library) uses ecliptic longitude for its `oppositions_conjunctions()` function
- In-The-Sky.org is a notable exception that uses RA for pairwise conjunctions, producing slightly different timestamps

## Our Algorithm: Combination-Based Min Span

Given N selected planets and a minimum size M, the algorithm evaluates every k-planet combination (for k = N down to M, capped at N−3) and finds the tightest ecliptic longitude cluster per category per day.

### Per-day computation

For each day in the time range:
1. Pre-compute Sun longitude and all planet longitudes/elongations (O(N) ephemeris calls).
2. For each combination size k, iterate all N-choose-k combinations.
3. For each combination, compute the minimum ecliptic arc via `computeSpanArc` and classify via `classifyCombination`.
4. Track the tightest span per category (AM/PM/Straddling) across all combinations of that size.

### Combination classification

Each combination is classified as a whole unit — not per-planet. Three cases:

- **All planets on same side of Sun**: All elongations negative → `morning`. All non-negative → `evening`.
- **Mixed sides, Sun inside arc** → `straddling`: Planets are on both sides of the Sun, and the Sun's longitude falls inside the combination's ecliptic arc. The Sun is literally between the planets.
- **Mixed sides, Sun outside arc** → `morning` or `evening`: Planets are on both sides of the Sun, but grouped on the far side (the "midnight cluster" case). The planet closest to the Sun determines classification.

### Results structure

Results are organized in tabs by combination size. Each tab contains a time series with three fields: `morningSep`, `eveningSep`, `straddlingSep` — the tightest span for each category at that date. Local minima are detected per tab and category.

### Per-kind best combination (`findBestPerKind`)

For the current date, the app also computes the best (tightest) combination for each visibility category separately. This drives the 3D alignment cones and Ecliptic Strip shading bands — each category gets its own cone/band showing its specific best cluster.

### Performance

- Ephemeris calls: O(N × days) — pre-computed once before combination iteration.
- Combination iteration: pure array math. Worst case (7 planets, min 4): 56 combinations/day.
- All tabs computed in one pass; tab switching is instant.
- FIFO ephemeris cache (200k entries) ensures no redundant astronomy-engine calls.

## Morning/Evening Classification

Elongation from the Sun (measured in ecliptic longitude) is the standard:

- East of Sun = evening object
- West of Sun = morning object

This matches our `wrap180(lon - sunLon)` approach exactly. Individual planets are still classified per-planet for the data table, but the combination as a whole gets a single classification.

## How Sources Differ

| Criterion | Our App | Timeanddate.com | Star Walk | grapeot.me |
|-----------|---------|-----------------|-----------|------------|
| **Metric** | Min ecliptic lon span (combination-based) | Altitude-based visibility | Ecliptic lon sector | Composite score |
| **Visibility** | AM/PM/Straddling by combination classification | Sun ≥6° below, planet ≥6° above horizon | Count-based | 40% weight |
| **Combinations** | All k-subsets evaluated | N/A | N/A | N/A |
| **Threshold** | None (shows all minima per tab) | Location-dependent | None | Weighted score |

## Validation Results

Cross-validated against 4 well-documented real-world events:

| Event | Closest Minimum | Day Offset | Separation |
|-------|-----------------|------------|------------|
| 5 planets morning (Jun 2022) | Jun 3, 2022 | **0 days** | 90.8° |
| 6-planet evening (Jan 2025) | Mar 7, 2025 | 45 days | 116.3° |
| 7-planet parade (Feb 2025) | Mar 7, 2025 | 7 days | 116.3° |
| 6-planet evening (Feb 2026) | Feb 28, 2026 | **0 days** | 65.7° |

The ±5–7 day offsets on some events are expected because popular sources report the best *visual observing* date (horizon/altitude-dependent), not the geometric minimum span.

## Potential Future Refinements

1. **Altitude/horizon-aware visibility** — factor in planet altitude above horizon and Sun depression below horizon (like timeanddate.com's ≥6° thresholds)
2. **Composite scoring** — grapeot.me uses 40% visibility + 30% linear fit + 30% longitude clustering (inherently subjective weighting)
3. **RA-based computation** — would not improve accuracy, just shift event times slightly; less natural for this use case

## See Also

- [Planet Parade Index](planet-parade-index.md) — PPI scoring formula that builds on alignment spans to rank events by count, compactness, brightness, and visibility
- [Product Specification](specs.md) — Full feature requirements and design decisions

## Key Sources

- [USNO Astronomical Almanac Glossary](https://aa.usno.navy.mil/faq/asa_glossary)
- [Skyfield Documentation](https://rhodesmill.org/skyfield/almanac.html)
- [Astronomy Engine (GitHub)](https://github.com/cosinekitty/astronomy)
- [NASA: Planetary Alignments and Planet Parades](https://science.nasa.gov/solar-system/skywatching/planetary-alignments-and-planet-parades/)
- [Timeanddate.com: Planet Parade 2025](https://www.timeanddate.com/news/astronomy/planet-parade-2025)
- [Star Walk: What is a Planet Parade](https://starwalk.space/en/news/what-is-planet-parade)
- [grapeot.me: Using Math to Find Planetary Alignments](https://grapeot.me/planet-alignment-en.html)
- [Jean Meeus: Astronomical Algorithms](https://en.wikipedia.org/wiki/Jean_Meeus)
