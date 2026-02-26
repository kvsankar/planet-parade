export interface StarCatalogEntry {
  name: string         // common name, '' if unnamed
  ra: number           // right ascension in hours, J2000
  dec: number          // declination in degrees, J2000
  mag: number          // apparent visual magnitude
  spectral: 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M'
}

// Brightest stars (visual magnitude ≤ ~4.0) for constellation stick figures
// Source: Yale Bright Star Catalogue / Hipparcos (J2000 coordinates)
// 192 total: 26 named + 72 bright + 5 connectors (98–102) + 89 constellation stars (103–191)
export const STAR_CATALOG: StarCatalogEntry[] = [
  // --- Named stars ---
  { name: 'Sirius',      ra:  6.7525, dec: -16.7161, mag: -1.46, spectral: 'A' },
  { name: 'Canopus',     ra:  6.3992, dec: -52.6956, mag: -0.74, spectral: 'F' },
  { name: 'Arcturus',    ra: 14.2612, dec:  19.1824, mag: -0.05, spectral: 'K' },
  { name: 'Vega',        ra: 18.6156, dec:  38.7837, mag:  0.03, spectral: 'A' },
  { name: 'Capella',     ra:  5.2783, dec:  45.9980, mag:  0.08, spectral: 'G' },
  { name: 'Rigel',       ra:  5.2423, dec:  -8.2016, mag:  0.13, spectral: 'B' },
  { name: 'Procyon',     ra:  7.6553, dec:   5.2250, mag:  0.34, spectral: 'F' },
  { name: 'Betelgeuse',  ra:  5.9195, dec:   7.4070, mag:  0.42, spectral: 'M' },
  { name: 'Achernar',    ra:  1.6286, dec: -57.2367, mag:  0.46, spectral: 'B' },
  { name: 'Altair',      ra: 19.8464, dec:   8.8683, mag:  0.77, spectral: 'A' },
  { name: 'Aldebaran',   ra:  4.5987, dec:  16.5093, mag:  0.86, spectral: 'K' },
  { name: 'Antares',     ra: 16.4901, dec: -26.4320, mag:  0.96, spectral: 'M' },
  { name: 'Spica',       ra: 13.4199, dec: -11.1613, mag:  0.97, spectral: 'B' },
  { name: 'Pollux',      ra:  7.7553, dec:  28.0262, mag:  1.14, spectral: 'K' },
  { name: 'Fomalhaut',   ra: 22.9608, dec: -29.6222, mag:  1.16, spectral: 'A' },
  { name: 'Deneb',       ra: 20.6905, dec:  45.2803, mag:  1.25, spectral: 'A' },
  { name: 'Regulus',     ra: 10.1395, dec:  11.9672, mag:  1.35, spectral: 'B' },
  { name: 'Castor',      ra:  7.5767, dec:  31.8883, mag:  1.58, spectral: 'A' },
  { name: 'Bellatrix',   ra:  5.4188, dec:   6.3497, mag:  1.64, spectral: 'B' },
  { name: 'Alnilam',     ra:  5.6036, dec:  -1.2019, mag:  1.69, spectral: 'B' },
  { name: 'Polaris',     ra:  2.5302, dec:  89.2641, mag:  1.98, spectral: 'F' },
  { name: 'Alphard',     ra:  9.4598, dec:  -8.6586, mag:  1.98, spectral: 'K' },
  { name: 'Dubhe',       ra: 11.0621, dec:  61.7510, mag:  1.79, spectral: 'K' },
  { name: 'Mizar',       ra: 13.3988, dec:  54.9254, mag:  2.06, spectral: 'A' },
  { name: 'Alkaid',      ra: 13.7924, dec:  49.3133, mag:  1.86, spectral: 'B' },
  { name: 'Mirfak',      ra:  3.4054, dec:  49.8612, mag:  1.80, spectral: 'F' },

  // --- Unnamed bright stars (mag ≤ 3.0) ---
  // Alpha Centauri A
  { name: '', ra: 14.6600, dec: -60.8353, mag: -0.01, spectral: 'G' },
  // Beta Centauri (Hadar)
  { name: '', ra: 14.0637, dec: -60.3730, mag:  0.61, spectral: 'B' },
  // Acrux (Alpha Crucis)
  { name: '', ra: 12.4433, dec: -63.0990, mag:  0.76, spectral: 'B' },
  // Mimosa (Beta Crucis)
  { name: '', ra: 12.7953, dec: -59.6885, mag:  1.25, spectral: 'B' },
  // Shaula (Lambda Scorpii)
  { name: '', ra: 17.5602, dec: -37.1038, mag:  1.63, spectral: 'B' },
  // Gacrux (Gamma Crucis)
  { name: '', ra: 12.5194, dec: -57.1132, mag:  1.64, spectral: 'M' },
  // Alnair (Alpha Gruis)
  { name: '', ra: 22.1372, dec: -46.9611, mag:  1.74, spectral: 'B' },
  // Alioth (Epsilon UMa)
  { name: '', ra: 12.9005, dec:  55.9598, mag:  1.77, spectral: 'A' },
  // Kaus Australis (Epsilon Sgr)
  { name: '', ra: 18.4029, dec: -34.3847, mag:  1.85, spectral: 'B' },
  // Wezen (Delta CMa)
  { name: '', ra:  7.1399, dec: -26.3932, mag:  1.84, spectral: 'F' },
  // Sargas (Theta Scorpii)
  { name: '', ra: 17.6215, dec: -42.9978, mag:  1.87, spectral: 'F' },
  // Menkalinan (Beta Aur)
  { name: '', ra:  5.9928, dec:  44.9473, mag:  1.90, spectral: 'A' },
  // Avior (Epsilon Car)
  { name: '', ra:  8.3753, dec: -59.5095, mag:  1.86, spectral: 'K' },
  // Alhena (Gamma Gem)
  { name: '', ra:  6.6285, dec:  16.3993, mag:  1.93, spectral: 'A' },
  // Peacock (Alpha Pav)
  { name: '', ra: 20.4275, dec: -56.7351, mag:  1.94, spectral: 'B' },
  // Alsephina (Delta Vel)
  { name: '', ra:  8.7451, dec: -54.7087, mag:  1.96, spectral: 'A' },
  // Mirzam (Beta CMa)
  { name: '', ra:  6.3783, dec: -17.9559, mag:  1.98, spectral: 'B' },
  // Alpheratz (Alpha And)
  { name: '', ra:  0.1398, dec:  29.0905, mag:  2.06, spectral: 'B' },
  // Algieba (Gamma Leo)
  { name: '', ra: 10.3327, dec:  19.8416, mag:  2.08, spectral: 'K' },
  // Hamal (Alpha Ari)
  { name: '', ra:  2.1198, dec:  23.4624, mag:  2.00, spectral: 'K' },
  // Diphda (Beta Cet)
  { name: '', ra:  0.7265, dec: -17.9866, mag:  2.02, spectral: 'K' },
  // Nunki (Sigma Sgr)
  { name: '', ra: 18.9210, dec: -26.2967, mag:  2.02, spectral: 'B' },
  // Miaplacidus (Beta Car)
  { name: '', ra:  9.2200, dec: -69.7172, mag:  1.68, spectral: 'A' },
  // Saiph (Kappa Ori)
  { name: '', ra:  5.7961, dec:  -9.6696, mag:  2.09, spectral: 'B' },
  // Mintaka (Delta Ori)
  { name: '', ra:  5.5334, dec:  -0.2991, mag:  2.23, spectral: 'B' },
  // Alnitak (Zeta Ori)
  { name: '', ra:  5.6791, dec:  -1.9426, mag:  2.05, spectral: 'O' },
  // Rasalhague (Alpha Oph)
  { name: '', ra: 17.5822, dec:  12.5600, mag:  2.08, spectral: 'A' },
  // Denebola (Beta Leo)
  { name: '', ra: 11.8177, dec:  14.5720, mag:  2.14, spectral: 'A' },
  // Naos (Zeta Pup)
  { name: '', ra:  8.0595, dec: -40.0033, mag:  2.25, spectral: 'O' },
  // Algol (Beta Per)
  { name: '', ra:  3.1361, dec:  40.9565, mag:  2.12, spectral: 'B' },
  // Tiaki (Beta Gru)
  { name: '', ra: 22.7111, dec: -46.8847, mag:  2.11, spectral: 'M' },
  // Aspidiske (Iota Car)
  { name: '', ra:  9.2847, dec: -59.2753, mag:  2.25, spectral: 'A' },
  // Suhail (Lambda Vel)
  { name: '', ra:  9.1330, dec: -43.4326, mag:  2.21, spectral: 'K' },
  // Alphecca (Alpha CrB)
  { name: '', ra: 15.5781, dec:  26.7147, mag:  2.23, spectral: 'A' },
  // Etamin (Gamma Dra)
  { name: '', ra: 17.9433, dec:  51.4889, mag:  2.23, spectral: 'K' },
  // Sabik (Eta Oph)
  { name: '', ra: 17.1728, dec: -15.7249, mag:  2.43, spectral: 'A' },
  // Scheat (Beta Peg)
  { name: '', ra: 23.0629, dec:  28.0828, mag:  2.42, spectral: 'M' },
  // Dschubba (Delta Sco)
  { name: '', ra: 16.0055, dec: -22.6217, mag:  2.32, spectral: 'B' },
  // Aludra (Eta CMa)
  { name: '', ra:  7.4016, dec: -29.3031, mag:  2.45, spectral: 'B' },
  // Markab (Alpha Peg)
  { name: '', ra: 23.0793, dec:  15.2053, mag:  2.49, spectral: 'B' },
  // Enif (Epsilon Peg)
  { name: '', ra: 21.7364, dec:   9.8750, mag:  2.39, spectral: 'K' },
  // Phecda (Gamma UMa)
  { name: '', ra: 11.8966, dec:  53.6948, mag:  2.44, spectral: 'A' },
  // Merak (Beta UMa)
  { name: '', ra: 11.0306, dec:  56.3824, mag:  2.37, spectral: 'A' },
  // Ankaa (Alpha Phe)
  { name: '', ra:  0.4380, dec: -42.3061, mag:  2.39, spectral: 'K' },
  // Girtab (Kappa Sco)
  { name: '', ra: 17.7084, dec: -39.0300, mag:  2.41, spectral: 'B' },
  // Alderamin (Alpha Cep)
  { name: '', ra: 21.3096, dec:  62.5856, mag:  2.51, spectral: 'A' },
  // Markeb (Kappa Vel)
  { name: '', ra:  9.3684, dec: -55.0107, mag:  2.50, spectral: 'B' },
  // Sadr (Gamma Cyg)
  { name: '', ra: 20.3704, dec:  40.2567, mag:  2.20, spectral: 'F' },
  // Larawag (Epsilon Sco)
  { name: '', ra: 16.8362, dec: -34.2933, mag:  2.29, spectral: 'K' },
  // Izar (Epsilon Boo)
  { name: '', ra: 14.7497, dec:  27.0742, mag:  2.37, spectral: 'K' },
  // Phact (Alpha Col)
  { name: '', ra:  5.6608, dec: -34.0742, mag:  2.64, spectral: 'B' },
  // Muphrid (Eta Boo)
  { name: '', ra: 13.9113, dec:  18.3977, mag:  2.68, spectral: 'G' },
  // Almach (Gamma And)
  { name: '', ra:  2.0650, dec:  42.3297, mag:  2.26, spectral: 'K' },
  // Caph (Beta Cas)
  { name: '', ra:  0.1526, dec:  59.1498, mag:  2.27, spectral: 'F' },
  // Zubeneschamali (Beta Lib)
  { name: '', ra: 15.2833, dec:  -9.3829, mag:  2.61, spectral: 'B' },
  // Mebsuta (Epsilon Gem)
  { name: '', ra:  6.7327, dec:  25.1311, mag:  2.98, spectral: 'G' },
  // Acrab (Beta Sco)
  { name: '', ra: 16.0913, dec: -19.8053, mag:  2.62, spectral: 'B' },
  // Schedar (Alpha Cas)
  { name: '', ra:  0.6751, dec:  56.5374, mag:  2.23, spectral: 'K' },
  // Regor (Gamma Vel)
  { name: '', ra:  8.1583, dec: -47.3366, mag:  1.78, spectral: 'O' },
  // Epsilon Cen
  { name: '', ra: 13.6647, dec: -53.4664, mag:  2.30, spectral: 'B' },
  // Zeta Cen
  { name: '', ra: 13.9256, dec: -47.2883, mag:  2.55, spectral: 'B' },
  // Eta Cen
  { name: '', ra: 14.5917, dec: -42.1578, mag:  2.31, spectral: 'B' },
  // Delta Cru
  { name: '', ra: 12.2524, dec: -58.7489, mag:  2.80, spectral: 'B' },
  // Alpha Lup
  { name: '', ra: 14.6989, dec: -47.3883, mag:  2.30, spectral: 'B' },
  // Beta Lup
  { name: '', ra: 14.9758, dec: -43.1339, mag:  2.68, spectral: 'B' },
  // Gamma Sgr (Alnasl)
  { name: '', ra: 18.0968, dec: -30.4241, mag:  2.99, spectral: 'K' },
  // Delta Sgr (Kaus Media)
  { name: '', ra: 18.3499, dec: -29.8281, mag:  2.70, spectral: 'K' },
  // Gamma Cas (Navi)
  { name: '', ra:  0.9454, dec:  60.7167, mag:  2.47, spectral: 'B' },
  // Delta Cas (Ruchbah)
  { name: '', ra:  1.3571, dec:  60.2353, mag:  2.68, spectral: 'A' },
  // Beta Ari (Sheratan)
  { name: '', ra:  1.9107, dec:  20.8081, mag:  2.64, spectral: 'A' },
  // Gamma Ori (Bellatrix already named above — skip)
  // Eta Tau (Alcyone)
  { name: '', ra:  3.7914, dec:  24.1053, mag:  2.87, spectral: 'B' },
  // Epsilon CMa (Adhara)
  { name: '', ra:  6.9771, dec: -28.9722, mag:  1.50, spectral: 'B' },

  // --- Connector stars for constellation lines (indices 98–102) ---
  // Megrez (Delta UMa) — Big Dipper bowl corner
  { name: '', ra: 12.2561, dec:  57.0326, mag:  3.31, spectral: 'A' },
  // Segin (Epsilon Cas) — Cassiopeia W tip
  { name: '', ra:  1.9065, dec:  63.6700, mag:  3.37, spectral: 'B' },
  // Algenib (Gamma Peg) — Great Square corner
  { name: '', ra:  0.2206, dec:  15.1836, mag:  2.83, spectral: 'B' },
  // Albireo (Beta Cyg) — Cygnus cross foot
  { name: '', ra: 19.5121, dec:  27.9597, mag:  3.08, spectral: 'K' },
  // Mirach (Beta And) — Andromeda chain middle
  { name: '', ra:  1.1622, dec:  35.6206, mag:  2.05, spectral: 'M' },

  // --- Additional stars for expanded constellations (indices 103+) ---

  // 103 — Taurus
  { name: 'Elnath',       ra:  5.4382, dec:  28.6075, mag:  1.65, spectral: 'B' },  // Beta Tau
  // 104
  { name: '',             ra:  5.6274, dec:  21.1425, mag:  3.01, spectral: 'B' },  // Zeta Tau (south horn)
  // 105
  { name: '',             ra:  4.4769, dec:  19.1806, mag:  3.53, spectral: 'K' },  // Ain (Epsilon Tau)
  // 106
  { name: '',             ra:  4.4764, dec:  15.8708, mag:  3.40, spectral: 'A' },  // Theta2 Tau
  // 107
  { name: '',             ra:  4.3300, dec:  15.6278, mag:  3.65, spectral: 'K' },  // Gamma Tau

  // 108–112 — Virgo
  { name: 'Vindemiatrix', ra: 13.0363, dec:  10.9591, mag:  2.83, spectral: 'G' },  // Epsilon Vir
  // 109
  { name: '',             ra: 12.6944, dec:  -1.4495, mag:  2.74, spectral: 'F' },  // Porrima (Gamma Vir)
  // 110
  { name: '',             ra: 12.9267, dec:   3.3975, mag:  3.38, spectral: 'M' },  // Minelauva (Delta Vir)
  // 111
  { name: '',             ra: 12.3318, dec:  -0.6668, mag:  3.89, spectral: 'A' },  // Zaniah (Eta Vir)
  // 112
  { name: '',             ra: 13.5782, dec:  -0.5958, mag:  3.38, spectral: 'A' },  // Heze (Zeta Vir)

  // 113–117 — Aquarius
  { name: 'Sadalsuud',    ra: 21.5260, dec:  -5.5712, mag:  2.89, spectral: 'G' },  // Beta Aqr
  // 114
  { name: 'Sadalmelik',   ra: 22.0964, dec:  -0.3199, mag:  2.94, spectral: 'G' },  // Alpha Aqr
  // 115
  { name: '',             ra: 22.9108, dec: -15.8208, mag:  3.28, spectral: 'A' },  // Skat (Delta Aqr)
  // 116
  { name: '',             ra: 22.3609, dec:  -1.3874, mag:  3.84, spectral: 'A' },  // Sadachbia (Gamma Aqr)
  // 117
  { name: '',             ra: 22.8769, dec:  -7.5797, mag:  3.74, spectral: 'M' },  // Lambda Aqr

  // 118–122 — Pisces
  { name: '',             ra:  1.5247, dec:  15.3458, mag:  3.62, spectral: 'G' },  // Eta Psc
  // 119
  { name: '',             ra: 23.2860, dec:   3.2823, mag:  3.70, spectral: 'G' },  // Gamma Psc
  // 120
  { name: '',             ra: 23.9885, dec:   6.8636, mag:  4.03, spectral: 'F' },  // Omega Psc
  // 121
  { name: '',             ra:  2.0341, dec:   2.7637, mag:  3.82, spectral: 'A' },  // Alrescha (Alpha Psc)
  // 122
  { name: '',             ra: 23.6658, dec:   5.6274, mag:  4.13, spectral: 'F' },  // Iota Psc

  // 123 — Libra
  { name: '',             ra: 14.8480, dec: -16.0418, mag:  2.75, spectral: 'A' },  // Zubenelgenubi (Alpha2 Lib)

  // 124–125 — Corona Borealis
  { name: '',             ra: 15.4638, dec:  29.1055, mag:  3.68, spectral: 'A' },  // Nusakan (Beta CrB)
  // 125
  { name: '',             ra: 15.7122, dec:  26.2956, mag:  3.84, spectral: 'A' },  // Gamma CrB

  // 126–132 — Draco
  { name: '',             ra: 14.0726, dec:  64.3460, mag:  3.65, spectral: 'A' },  // Thuban (Alpha Dra)
  // 127
  { name: '',             ra: 17.5072, dec:  52.3014, mag:  2.79, spectral: 'G' },  // Rastaban (Beta Dra)
  // 128
  { name: '',             ra: 16.3999, dec:  61.5141, mag:  2.73, spectral: 'G' },  // Eta Dra (Athebyne)
  // 129
  { name: '',             ra: 19.2092, dec:  67.6613, mag:  3.07, spectral: 'G' },  // Altais (Delta Dra)
  // 130
  { name: '',             ra: 17.1464, dec:  65.7146, mag:  3.17, spectral: 'B' },  // Aldhibah (Zeta Dra)
  // 131
  { name: '',             ra: 15.4155, dec:  58.9660, mag:  3.29, spectral: 'K' },  // Edasich (Iota Dra)
  // 132
  { name: '',             ra: 17.8920, dec:  56.8725, mag:  3.75, spectral: 'K' },  // Grumium (Xi Dra)

  // 133–137 — Ophiuchus
  { name: '',             ra: 16.2391, dec:  -3.6940, mag:  2.75, spectral: 'M' },  // Yed Prior (Delta Oph)
  // 134
  { name: '',             ra: 16.3053, dec:  -4.6926, mag:  3.24, spectral: 'G' },  // Yed Posterior (Epsilon Oph)
  // 135
  { name: '',             ra: 16.6193, dec: -10.5670, mag:  2.57, spectral: 'O' },  // Han (Zeta Oph)
  // 136
  { name: '',             ra: 16.9612, dec:   9.3751, mag:  3.19, spectral: 'K' },  // Kappa Oph
  // 137
  { name: '',             ra: 17.9838, dec:  -9.7734, mag:  3.34, spectral: 'K' },  // Sinistra (Nu Oph)

  // 138–139 — Aquila
  { name: 'Tarazed',      ra: 19.7710, dec:  10.6133, mag:  2.71, spectral: 'K' },  // Gamma Aql
  // 139
  { name: '',             ra: 19.9219, dec:   6.4079, mag:  3.87, spectral: 'G' },  // Alshain (Beta Aql)

  // 140–143 — Lyra
  { name: '',             ra: 18.8347, dec:  33.3627, mag:  3.45, spectral: 'B' },  // Sheliak (Beta Lyr)
  // 141
  { name: '',             ra: 18.9824, dec:  32.6896, mag:  3.25, spectral: 'B' },  // Sulafat (Gamma Lyr)
  // 142
  { name: '',             ra: 18.9084, dec:  36.8986, mag:  4.22, spectral: 'M' },  // Delta2 Lyr
  // 143
  { name: '',             ra: 18.7460, dec:  37.6050, mag:  4.36, spectral: 'A' },  // Zeta1 Lyr

  // 144 — Canis Minor
  { name: '',             ra:  7.4525, dec:   8.2894, mag:  2.89, spectral: 'B' },  // Gomeisa (Beta CMi)

  // 145–146 — Ursa Minor
  { name: 'Kochab',       ra: 14.8451, dec:  74.1555, mag:  2.08, spectral: 'K' },  // Beta UMi
  // 146
  { name: '',             ra: 15.3455, dec:  71.8340, mag:  3.05, spectral: 'A' },  // Pherkad (Gamma UMi)

  // 147–150 — Corvus
  { name: '',             ra: 12.2635, dec: -17.5420, mag:  2.59, spectral: 'B' },  // Gienah (Gamma Crv)
  // 148
  { name: '',             ra: 12.5731, dec: -23.3968, mag:  2.65, spectral: 'G' },  // Kraz (Beta Crv)
  // 149
  { name: '',             ra: 12.4975, dec: -16.5153, mag:  2.95, spectral: 'A' },  // Algorab (Delta Crv)
  // 150
  { name: '',             ra: 12.1688, dec: -22.6198, mag:  3.02, spectral: 'K' },  // Minkar (Epsilon Crv)

  // 151–153 — Crater
  { name: '',             ra: 11.3222, dec: -14.7786, mag:  3.56, spectral: 'K' },  // Labrum (Delta Crt)
  // 152
  { name: '',             ra: 10.9961, dec: -18.2989, mag:  4.08, spectral: 'K' },  // Alkes (Alpha Crt)
  // 153
  { name: '',             ra: 11.4144, dec: -17.6839, mag:  4.08, spectral: 'A' },  // Gamma Crt

  // 154–159 — Hydra
  { name: '',             ra: 10.8271, dec: -16.1941, mag:  3.11, spectral: 'K' },  // Nu Hya
  // 155
  { name: '',             ra: 13.3154, dec: -23.1715, mag:  3.00, spectral: 'G' },  // Gamma Hya
  // 156
  { name: '',             ra:  8.9233, dec:   5.9455, mag:  3.11, spectral: 'G' },  // Zeta Hya (head)
  // 157
  { name: '',             ra:  8.7796, dec:   6.4189, mag:  3.38, spectral: 'G' },  // Epsilon Hya (head)
  // 158
  { name: '',             ra:  8.6275, dec:   5.7039, mag:  4.14, spectral: 'A' },  // Delta Hya (head)
  // 159
  { name: '',             ra:  9.2394, dec:   2.3142, mag:  3.88, spectral: 'B' },  // Theta Hya

  // 160–162 — Triangulum
  { name: '',             ra:  1.8847, dec:  29.5794, mag:  3.41, spectral: 'F' },  // Mothallah (Alpha Tri)
  // 161
  { name: '',             ra:  2.1590, dec:  34.9874, mag:  3.00, spectral: 'A' },  // Beta Tri
  // 162
  { name: '',             ra:  2.2886, dec:  33.8473, mag:  4.01, spectral: 'A' },  // Gamma Tri

  // 163–166 — Cancer
  { name: '',             ra:  8.2753, dec:   9.1857, mag:  3.53, spectral: 'K' },  // Tarf (Beta Cnc)
  // 164
  { name: '',             ra:  8.7447, dec:  18.1549, mag:  3.94, spectral: 'K' },  // Asellus Australis (Delta Cnc)
  // 165
  { name: '',             ra:  8.9748, dec:  11.8578, mag:  4.25, spectral: 'A' },  // Acubens (Alpha Cnc)
  // 166
  { name: '',             ra:  8.7781, dec:  28.7600, mag:  4.02, spectral: 'G' },  // Iota Cnc

  // 167–172 — Leo (expanded)
  { name: 'Zosma',        ra: 11.2351, dec:  20.5240, mag:  2.56, spectral: 'A' },  // Delta Leo
  // 168
  { name: '',             ra: 11.2373, dec:  15.4296, mag:  3.33, spectral: 'A' },  // Chertan (Theta Leo)
  // 169
  { name: '',             ra:  9.7642, dec:  23.7743, mag:  2.98, spectral: 'G' },  // Ras Elased (Epsilon Leo)
  // 170
  { name: '',             ra: 10.2782, dec:  23.4173, mag:  3.44, spectral: 'F' },  // Adhafera (Zeta Leo)
  // 171
  { name: '',             ra:  9.8794, dec:  26.0071, mag:  3.88, spectral: 'K' },  // Rasalas (Mu Leo)
  // 172
  { name: '',             ra: 10.1222, dec:  16.7627, mag:  3.48, spectral: 'A' },  // Eta Leo

  // 173–175 — Scorpius (claws / head)
  { name: '',             ra: 15.9809, dec: -26.1141, mag:  2.89, spectral: 'B' },  // Pi Sco (Fang)
  // 174
  { name: '',             ra: 16.3531, dec: -25.5928, mag:  2.88, spectral: 'B' },  // Sigma Sco (Alniyat)
  // 175
  { name: '',             ra: 16.5981, dec: -28.2161, mag:  2.82, spectral: 'B' },  // Tau Sco

  // 176–177 — Cygnus (cross arms)
  { name: '',             ra: 20.7701, dec:  33.9694, mag:  2.48, spectral: 'K' },  // Epsilon Cyg (Aljanah)
  // 177
  { name: '',             ra: 19.7496, dec:  45.1308, mag:  2.87, spectral: 'B' },  // Delta Cyg (Fawaris)

  // 178–181 — Bootes (kite)
  { name: '',             ra: 15.0325, dec:  40.3907, mag:  3.49, spectral: 'G' },  // Nekkar (Beta Boo)
  // 179
  { name: '',             ra: 14.5347, dec:  38.3079, mag:  3.03, spectral: 'A' },  // Seginus (Gamma Boo)
  // 180
  { name: '',             ra: 14.5305, dec:  30.3714, mag:  3.59, spectral: 'K' },  // Rho Boo
  // 181
  { name: '',             ra: 15.2584, dec:  33.3151, mag:  3.46, spectral: 'G' },  // Princeps (Delta Boo)

  // 182–184 — Auriga (pentagon)
  { name: '',             ra:  5.9954, dec:  37.2128, mag:  2.62, spectral: 'A' },  // Mahasim (Theta Aur)
  // 183
  { name: '',             ra:  4.9499, dec:  33.1661, mag:  2.69, spectral: 'K' },  // Hassaleh (Iota Aur)
  // 184
  { name: '',             ra:  5.0328, dec:  43.8233, mag:  2.99, spectral: 'F' },  // Almaaz (Epsilon Aur)

  // 185–188 — Gemini (expanded)
  { name: '',             ra:  6.3827, dec:  22.5139, mag:  2.87, spectral: 'M' },  // Tejat (Mu Gem)
  // 186
  { name: '',             ra:  6.2479, dec:  22.5068, mag:  3.31, spectral: 'M' },  // Propus (Eta Gem)
  // 187
  { name: '',             ra:  6.7548, dec:  12.8961, mag:  3.35, spectral: 'F' },  // Alzirr (Xi Gem)
  // 188
  { name: '',             ra:  7.3354, dec:  21.9823, mag:  3.53, spectral: 'F' },  // Wasat (Delta Gem)

  // 189–191 — Perseus (expanded)
  { name: '',             ra:  3.9022, dec:  31.8836, mag:  2.84, spectral: 'B' },  // Atik (Zeta Per)
  // 190
  { name: '',             ra:  3.9642, dec:  40.0103, mag:  2.88, spectral: 'B' },  // Epsilon Per
  // 191
  { name: '',             ra:  3.7154, dec:  47.7877, mag:  3.01, spectral: 'B' },  // Delta Per
]
