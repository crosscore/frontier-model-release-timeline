# Manrope

Bundled unmodified variable font from [google/fonts](https://github.com/google/fonts/tree/b31870aff700ab7a1d74fa0c6887d95beb9e0037/ofl/manrope), pinned to commit `b31870aff700ab7a1d74fa0c6887d95beb9e0037`.

- Original filename: `Manrope[wght].ttf`; stored locally as `Manrope.ttf`.
- License: [SIL Open Font License 1.1](OFL.txt).
- `preview/Manrope.ttf` and `preview/OFL.txt` are generated copies for the offline preview page.

The Canvas font parser accepts standard 100–900 weight steps. The renderer normalizes intermediate design weights before assigning `ctx.font`; layout tests catch misparsed or oversized text.

## Fixed-weight render instances

`Manrope-500.ttf` and `Manrope-600.ttf` are weight-axis instances of the same pinned font, produced with fontTools 4.59.0. They remain under the same OFL license (no Reserved Font Name is declared). Explicit instance aliases avoid a native Canvas variable-font rendering issue that otherwise made all weights appear too thin. The variable original remains unchanged for the browser preview.

These small prebuilt files are committed; normal video generation needs no Python installation. To rebuild them from the bundled original:

```bash
uv run --no-project --with fonttools==4.59.0 python -c 'from fontTools.ttLib import TTFont; from fontTools.varLib.instancer import instantiateVariableFont; [instantiateVariableFont(TTFont("assets/fonts/Manrope.ttf"), {"wght": w}).save(f"assets/fonts/Manrope-{w}.ttf") for w in (500,600)]'
```
