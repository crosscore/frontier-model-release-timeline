import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDataset } from '../src/data.mjs';
import { CVD, colorDistance, contrastRatio, simulatedHex } from '../src/color.mjs';
const data = await loadDataset();
test('all five lab colors remain separated in normal, protanopia and deuteranopia simulations', () => {
  for (const mode of Object.keys(CVD)) {
    for (const [i, a] of data.labs.entries()) {
      for (const b of data.labs.slice(i + 1)) {
        // Project regression guard, not a clinical perceptual threshold. Shape and labels remain mandatory.
        assert(colorDistance(a.color, b.color, mode) >= .12, `${mode}: ${a.name}/${b.name} palette collapses`);
      }
    }
  }
  for (const lab of data.labs) assert(contrastRatio(lab.color, '#050A14') >= 4.5, `${lab.name} text contrast`);
  for (const lab of data.labs.slice(0, 3)) assert.equal(simulatedHex(lab.color), lab.color.toLowerCase());
});
