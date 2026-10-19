// Machado, Oliveira & Fernandes (2009), full-severity matrices in linear sRGB.
// https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
export const CVD = Object.freeze({
  normal: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  protanopia: [.152286, 1.052583, -.204868, .114503, .786281, .099216, -.003882, -.048116, 1.051998],
  deuteranopia: [.367322, .860646, -.227968, .280085, .672501, .047413, -.011820, .042940, .968881],
});
const clamp = v => Math.max(0, Math.min(1, v));
const linear = v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const encoded = v => v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055;
export function linearRgb(hex) {
  return [1, 3, 5].map(i => linear(parseInt(hex.slice(i, i + 2), 16) / 255));
}
export function simulateColor(hex, mode = 'normal') {
  if (!CVD[mode]) throw new Error(`Unknown color simulation: ${mode}`);
  const rgb = linearRgb(hex), m = CVD[mode];
  return [0, 1, 2].map(j => clamp(rgb.reduce((sum, v, i) => sum + v * m[j * 3 + i], 0)));
}
export function simulatedHex(hex, mode = 'normal') {
  return '#' + simulateColor(hex, mode).map(v => Math.round(encoded(v) * 255).toString(16).padStart(2, '0')).join('');
}
export function oklab([r, g, b]) {
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [
    .2104542553 * l + .793617785 * m - .0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + .4505937099 * s,
    .0259040371 * l + .7827717662 * m - .808675766 * s,
  ];
}
export function colorDistance(a, b, mode = 'normal') {
  const x = oklab(simulateColor(a, mode)), y = oklab(simulateColor(b, mode));
  return Math.hypot(...x.map((v, i) => v - y[i]));
}
export function contrastRatio(a, b) {
  const luminance = hex => linearRgb(hex).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
