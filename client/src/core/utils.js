/**
 * Calculates the visual radius of a phage blob based on its mass.
 * Uses caching to avoid expensive Math.pow calls.
 * @param {object} b - The blob object.
 * @returns {number} The calculated radius.
 */
export function getBlobRadius(b) {
  if (b.mass !== b.lastMassForRadius) {
    b.radius = Math.pow(b.mass, 0.45) * 2.2;
    b.speedFactor = Math.pow(b.mass, -0.22);
    b.lastMassForRadius = b.mass;
  }
  return b.radius;
}

export function getBlobSpeedFactor(b) {
  if (b.mass !== b.lastMassForRadius) {
    getBlobRadius(b);
  }
  return b.speedFactor;
}
