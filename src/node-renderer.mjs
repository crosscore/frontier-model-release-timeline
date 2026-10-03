import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import { drawFrame, FORMATS } from './draw.mjs';

const font = fileURLToPath(new URL('../assets/fonts/Manrope.ttf', import.meta.url));
if (!GlobalFonts.registerFromPath(font, 'Manrope')) throw new Error('Could not load bundled Manrope font');

export function makeRenderer(data, timeline, format = 'landscape', width = FORMATS[format]?.width) {
  if (!FORMATS[format]) throw new Error(`Unknown format: ${format}`);
  if (!Number.isInteger(width) || width < 320 || width > 3840 || width % 2) throw new Error('Width must be an even integer from 320 to 3840');
  const native = FORMATS[format], height = Math.round(width / native.width * native.height / 2) * 2;
  const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
  return { canvas, width, height, frame(seconds) {
    ctx.resetTransform(); ctx.clearRect(0, 0, width, height); ctx.save();
    ctx.scale(width / native.width, height / native.height);
    const state = drawFrame(ctx, data, timeline, seconds, format); ctx.restore(); return state;
  } };
}
