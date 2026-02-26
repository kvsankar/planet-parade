export interface Constellation {
  name: string
  lines: [number, number][] // pairs of STAR_CATALOG indices
}

export const CONSTELLATIONS: Constellation[] = [
  // ===== Enhanced existing constellations =====
  {
    name: 'Orion',
    // Betelgeuse(7)-Bellatrix(18), belt: Alnitak(51)-Alnilam(19)-Mintaka(50), Saiph(49)-Rigel(5)
    lines: [[7,18], [7,51], [18,50], [51,19], [19,50], [51,49], [50,5]],
  },
  {
    name: 'Big Dipper',
    // Alkaid(24)-Mizar(23)-Alioth(33)-Megrez(98)-Dubhe(22), bowl: Megrez(98)-Phecda(67)-Merak(68)-Dubhe(22)
    lines: [[24,23], [23,33], [33,98], [98,22], [98,67], [67,68], [68,22]],
  },
  {
    name: 'Cassiopeia',
    // W shape: Caph(79)-Schedar(83)-Navi(93)-Ruchbah(94)-Segin(99)
    lines: [[79,83], [83,93], [93,94], [94,99]],
  },
  {
    name: 'Crux',
    // Southern Cross: Acrux(28)-Gacrux(31), Mimosa(29)-DeltaCru(88)
    lines: [[28,31], [29,88]],
  },
  {
    name: 'Scorpius',
    // Claws: PiSco(173)-Dschubba(63)-Acrab(82)
    // Head: PiSco(173)-SigmaSco(174)-Antares(11)-TauSco(175)
    // Tail: Antares(11)-Larawag(74)-Girtab(70)-Sargas(36)-Shaula(30)
    lines: [
      [173,63], [63,82],
      [173,174], [174,11], [11,175],
      [11,74], [74,70], [70,36], [36,30],
    ],
  },
  {
    name: 'Sagittarius',
    // Teapot: GammaSgr(91)-DeltaSgr(92)-KausAustralis(34)-Nunki(47)-GammaSgr(91)
    lines: [[91,92], [92,34], [34,47], [47,91]],
  },
  {
    name: 'Gemini',
    // Heads: Castor(17)-Pollux(13)
    // Castor body: Castor(17)-Mebsuta(81)-Tejat(185)-Propus(186)
    // Pollux body: Pollux(13)-Wasat(188)-Alzirr(187)-Alhena(39)
    lines: [
      [17,13],
      [17,81], [81,185], [185,186],
      [13,188], [188,187], [187,39],
    ],
  },
  {
    name: 'Leo',
    // Sickle: Regulus(16)-EtaLeo(172)-Algieba(44)-Adhafera(170)-RasElased(169)
    // Body: Algieba(44)-Zosma(167)-Denebola(53), Zosma(167)-Chertan(168)-Denebola(53)
    lines: [
      [16,172], [172,44], [44,170], [170,169],
      [44,167], [167,168], [168,53], [167,53],
    ],
  },
  {
    name: 'Canis Major',
    // Sirius(0)-Mirzam(42), Sirius(0)-Wezen(35)-Adhara(97), Wezen(35)-Aludra(64)
    lines: [[0,42], [0,35], [35,97], [35,64]],
  },
  {
    name: 'Centaurus',
    // AlphaCen(26)-BetaCen(27)-EpsCen(85)-ZetaCen(86)-EtaCen(87)
    lines: [[26,27], [27,85], [85,86], [86,87]],
  },
  {
    name: 'Carina',
    // Canopus(1)-Avior(38)-Aspidiske(57)-Miaplacidus(48)
    lines: [[1,38], [38,57], [57,48]],
  },
  {
    name: 'Vela',
    // Regor(84)-Alsephina(41)-Markeb(72)-Suhail(58)-Regor(84)
    lines: [[84,41], [41,72], [72,58], [58,84]],
  },
  {
    name: 'Pegasus',
    // Great Square: Markab(65)-Scheat(62)-Alpheratz(43)-Algenib(100)-Markab(65)
    lines: [[65,62], [62,43], [43,100], [100,65]],
  },
  {
    name: 'Cygnus',
    // Northern Cross spine: Albireo(101)-Sadr(73)-Deneb(15)
    // Cross arms: EpsCyg(176)-Sadr(73)-DelCyg(177)
    lines: [[101,73], [73,15], [176,73], [73,177]],
  },
  {
    name: 'Bootes',
    // Kite: Arcturus(2)-Izar(75)-Seginus(179)-Nekkar(178)-RhoBoo(180)-Arcturus(2)
    // Arm: Arcturus(2)-Muphrid(77)
    lines: [
      [2,75], [75,179], [179,178], [178,180], [180,2],
      [2,77],
    ],
  },
  {
    name: 'Auriga',
    // Pentagon: Capella(4)-Menkalinan(37)-ThetaAur(182)-Hassaleh(183)-Almaaz(184)-Capella(4)
    lines: [[4,37], [37,182], [182,183], [183,184], [184,4]],
  },
  {
    name: 'Andromeda',
    // Chain: Alpheratz(43)-Mirach(102)-Almach(78)
    lines: [[43,102], [102,78]],
  },
  {
    name: 'Perseus',
    // Mirfak(25) hub: Mirfak(25)-DeltaPer(191), Mirfak(25)-EpsPer(190)-ZetaPer(189), Mirfak(25)-Algol(55)
    lines: [[25,191], [25,190], [190,189], [25,55]],
  },
  {
    name: 'Aries',
    // Hamal(45)-Sheratan(95)
    lines: [[45,95]],
  },
  {
    name: 'Lupus',
    // AlphaLup(89)-BetaLup(90)
    lines: [[89,90]],
  },

  // ===== New constellations =====
  {
    name: 'Taurus',
    // Hyades V: Aldebaran(10)-Ain(105), Aldebaran(10)-Theta2Tau(106)-GammaTau(107)
    // Horns: Aldebaran(10)-Elnath(103), Aldebaran(10)-ZetaTau(104)
    lines: [
      [10,105], [10,106], [106,107],
      [10,103], [10,104],
    ],
  },
  {
    name: 'Virgo',
    // Spica(12)-Porrima(109)-Vindemiatrix(108), Porrima(109)-DeltaVir(110)-Vindemiatrix(108)
    // Extensions: Spica(12)-Heze(112), Porrima(109)-Zaniah(111)
    lines: [
      [12,109], [109,108], [109,110], [110,108],
      [12,112], [109,111],
    ],
  },
  {
    name: 'Aquarius',
    // Sadalmelik(114)-Sadalsuud(113), Sadalmelik(114)-Sadachbia(116)-Skat(115)-LambdaAqr(117)
    lines: [[114,113], [114,116], [116,115], [115,117]],
  },
  {
    name: 'Pisces',
    // Cord: GammaPsc(119)-IotaPsc(122)-OmegaPsc(120)-Alrescha(121)-EtaPsc(118)
    lines: [[119,122], [122,120], [120,121], [121,118]],
  },
  {
    name: 'Libra',
    // Balance beam: Zubeneschamali(80)-Zubenelgenubi(123)
    lines: [[80,123]],
  },
  {
    name: 'Corona Borealis',
    // Arc: Nusakan(124)-Alphecca(59)-GammaCrB(125)
    lines: [[124,59], [59,125]],
  },
  {
    name: 'Draco',
    // Head: Etamin(60)-Rastaban(127), Etamin(60)-Grumium(132)
    // Body: Etamin(60)-EtaDra(128)-ZetaDra(130)-IotaDra(131)-Thuban(126)
    // Tail: ZetaDra(130)-Altais(129)
    lines: [
      [60,127], [60,132],
      [60,128], [128,130], [130,131], [131,126],
      [130,129],
    ],
  },
  {
    name: 'Ophiuchus',
    // Rasalhague(52)-KappaOph(136)-ZetaOph(135)-YedPosterior(134)-YedPrior(133)
    // Legs: Rasalhague(52)-Sabik(61)-NuOph(137), ZetaOph(135)-Sabik(61)
    lines: [
      [52,136], [136,135], [135,134], [134,133],
      [52,61], [61,137],
      [135,61],
    ],
  },
  {
    name: 'Aquila',
    // Tarazed(138)-Altair(9)-Alshain(139)
    lines: [[138,9], [9,139]],
  },
  {
    name: 'Lyra',
    // Triangle: Vega(3)-Sheliak(140)-Sulafat(141)-Vega(3)
    // Parallelogram hint: Vega(3)-Zeta1Lyr(143)-Delta2Lyr(142)
    lines: [[3,140], [140,141], [141,3], [3,143], [143,142]],
  },
  {
    name: 'Canis Minor',
    // Procyon(6)-Gomeisa(144)
    lines: [[6,144]],
  },
  {
    name: 'Ursa Minor',
    // Little Dipper: Polaris(20)-Kochab(145)-Pherkad(146)
    lines: [[20,145], [145,146]],
  },
  {
    name: 'Corvus',
    // Quadrilateral: Gienah(147)-Algorab(149)-Kraz(148)-Minkar(150)-Gienah(147)
    lines: [[147,149], [149,148], [148,150], [150,147]],
  },
  {
    name: 'Crater',
    // Cup: Labrum(151)-Alkes(152)-GammaCrt(153)-Labrum(151)
    lines: [[151,152], [152,153], [153,151]],
  },
  {
    name: 'Hydra',
    // Head: DeltaHya(158)-EpsHya(157)-ZetaHya(156)
    // Body: ZetaHya(156)-ThetaHya(159)-Alphard(21)-NuHya(154)-GammaHya(155)
    lines: [
      [158,157], [157,156],
      [156,159], [159,21], [21,154], [154,155],
    ],
  },
  {
    name: 'Triangulum',
    // AlphaTri(160)-BetaTri(161)-GammaTri(162)-AlphaTri(160)
    lines: [[160,161], [161,162], [162,160]],
  },
  {
    name: 'Cancer',
    // Tarf(163)-Acubens(165)-AsAustralis(164)-IotaCnc(166)
    lines: [[163,165], [165,164], [164,166]],
  },

  // ===== Asterisms =====
  {
    name: 'Summer \u25B3',
    // Vega(3)-Deneb(15)-Altair(9)
    lines: [[3,15], [15,9], [9,3]],
  },
  {
    name: 'Winter \u25B3',
    // Sirius(0)-Betelgeuse(7)-Procyon(6)
    lines: [[0,7], [7,6], [6,0]],
  },
]
