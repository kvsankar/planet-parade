export interface Constellation {
  name: string
  lines: [number, number][] // pairs of STAR_CATALOG indices
}

export const CONSTELLATIONS: Constellation[] = [
  {
    name: 'Orion',
    lines: [[7,18], [7,51], [18,50], [51,19], [19,50], [51,49], [50,5]],
  },
  {
    name: 'Big Dipper',
    lines: [[24,23], [23,33], [33,98], [98,22], [98,67], [22,68], [68,67]],
  },
  {
    name: 'Cassiopeia',
    lines: [[79,83], [83,93], [93,94], [94,99]],
  },
  {
    name: 'Crux',
    lines: [[28,31], [29,88]],
  },
  {
    name: 'Scorpius',
    lines: [[82,63], [63,11], [11,74], [74,70], [70,36], [36,30]],
  },
  {
    name: 'Sagittarius',
    lines: [[91,92], [92,34], [34,47], [47,91]],
  },
  {
    name: 'Gemini',
    lines: [[17,13], [17,81], [13,39]],
  },
  {
    name: 'Leo',
    lines: [[16,44], [44,53]],
  },
  {
    name: 'Canis Major',
    lines: [[0,42], [0,35], [35,97], [35,64]],
  },
  {
    name: 'Centaurus',
    lines: [[26,27], [27,85], [85,86], [86,87]],
  },
  {
    name: 'Carina',
    lines: [[1,38], [38,57], [57,48]],
  },
  {
    name: 'Vela',
    lines: [[84,41], [41,72], [72,58], [58,84]],
  },
  {
    name: 'Pegasus',
    lines: [[65,62], [62,43], [43,100], [100,65]],
  },
  {
    name: 'Cygnus',
    lines: [[15,73], [73,101]],
  },
  {
    name: 'Bootes',
    lines: [[2,75], [2,77]],
  },
  {
    name: 'Auriga',
    lines: [[4,37]],
  },
  {
    name: 'Andromeda',
    lines: [[43,102], [102,78]],
  },
  {
    name: 'Perseus',
    lines: [[25,55]],
  },
  {
    name: 'Aries',
    lines: [[45,95]],
  },
  {
    name: 'Lupus',
    lines: [[89,90]],
  },
  {
    name: 'Summer \u25B3',
    lines: [[3,15], [15,9], [9,3]],
  },
  {
    name: 'Winter \u25B3',
    lines: [[0,7], [7,6], [6,0]],
  },
]
