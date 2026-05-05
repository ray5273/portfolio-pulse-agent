# Vendored kr-stock-analysis chart renderer

This directory vendors the chart rendering assets from `ray5273/stock-analysis-skill`, specifically the `kr-stock-analysis` `chart-basics.js` workflow.

- Source: https://github.com/ray5273/stock-analysis-skill
- Vendored files from `skills/kr-stock-analysis/scripts/` and `skills/kr-stock-analysis/assets/fonts/`
- Upstream code license: MIT, copied in `LICENSE-stock-analysis-skill-MIT.txt`
- Bundled Noto Sans KR font license: SIL Open Font License 1.1, copied in `assets/fonts/LICENSE-NotoSansKR.txt`

The nested `package.json` keeps these upstream CommonJS scripts executable inside this repository's ESM package.

This vendored renderer uses the bundled Noto Sans KR font. The parent daily CLI prepares `.tmp/krx-chart-font-venv` with Pillow and sets `KR_STOCK_CHART_PYTHON` so `render-text-mask.py` can create high-quality Hangul text masks.
