/**
 * Module-level singleton store for planetarium view orientation.
 */
export const planetariumStore = {
  yaw: Math.PI,                           // current view azimuth (radians), start looking south
  pitch: 0.15,                            // current view altitude (radians)
}
