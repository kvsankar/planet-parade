# Alignment Algorithm Analysis

Research into how planetary alignment events are computed in astronomy, compared to our implementation.

## Coordinate System: Ecliptic Longitude

Our algorithm uses **ecliptic longitude** — the preferred approach for multi-planet alignments.

- The USNO Astronomical Almanac defines conjunction as same ecliptic longitude *or* RA
- Since all planets orbit near the ecliptic plane, ecliptic longitude is the natural coordinate for "parades"
- Skyfield (the gold-standard Python library) uses ecliptic longitude for its `oppositions_conjunctions()` function
- In-The-Sky.org is a notable exception that uses RA for pairwise conjunctions, producing slightly different timestamps

## Our Algorithm (Min Span) Is the Standard Approach

Computing the minimum ecliptic longitude arc spanning all target planets is the most common method. Star Walk reports this as the "sky sector size" in degrees. There is **no formal threshold** — "planetary alignment" is not an official astronomical term, and each source defines it differently.

## Morning/Evening Classification

Elongation from the Sun (measured in ecliptic longitude) is the standard:

- East of Sun = evening object
- West of Sun = morning object

This matches our `wrap180(lon - sunLon)` approach exactly.

## How Sources Differ

| Criterion | Our App | Timeanddate.com | Star Walk | grapeot.me |
|-----------|---------|-----------------|-----------|------------|
| **Metric** | Min ecliptic lon span | Altitude-based visibility | Ecliptic lon sector | Composite score |
| **Visibility** | AM/PM by elongation | Sun ≥6° below, planet ≥6° above horizon | Count-based | 40% weight |
| **Threshold** | None (shows all minima) | Location-dependent | None | Weighted score |

## Validation Results

Cross-validated against 4 well-documented real-world events:

| Event | Closest Minimum | Day Offset | Separation |
|-------|-----------------|------------|------------|
| 5 planets morning (Jun 2022) | Jun 3, 2022 | **0 days** | 90.8° |
| 6-planet evening (Jan 2025) | Jan 16, 2025 | 5 days | 88.8° |
| 7-planet parade (Feb 2025) | Feb 7, 2025 | 7 days | 116.3° |
| 6-planet evening (Feb 2026) | Feb 27, 2026 | **1 day** | 113.3° |

The ±5–7 day offsets on some events are expected because popular sources report the best *visual observing* date (horizon/altitude-dependent), not the geometric minimum span.

## Potential Future Refinements

1. **Altitude/horizon-aware visibility** — factor in planet altitude above horizon and Sun depression below horizon (like timeanddate.com's ≥6° thresholds)
2. **Composite scoring** — grapeot.me uses 40% visibility + 30% linear fit + 30% longitude clustering (inherently subjective weighting)
3. **RA-based computation** — would not improve accuracy, just shift event times slightly; less natural for this use case

## Key Sources

- [USNO Astronomical Almanac Glossary](https://aa.usno.navy.mil/faq/asa_glossary)
- [Skyfield Documentation](https://rhodesmill.org/skyfield/almanac.html)
- [Astronomy Engine (GitHub)](https://github.com/cosinekitty/astronomy)
- [NASA: Planetary Alignments and Planet Parades](https://science.nasa.gov/solar-system/skywatching/planetary-alignments-and-planet-parades/)
- [Timeanddate.com: Planet Parade 2025](https://www.timeanddate.com/news/astronomy/planet-parade-2025)
- [Star Walk: What is a Planet Parade](https://starwalk.space/en/news/what-is-planet-parade)
- [grapeot.me: Using Math to Find Planetary Alignments](https://grapeot.me/planet-alignment-en.html)
- [Jean Meeus: Astronomical Algorithms](https://en.wikipedia.org/wiki/Jean_Meeus)
