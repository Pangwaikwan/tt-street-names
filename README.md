# TT Final Project — Website (#26 Hong Kong street-name translation)

Static site (HTML + CSS + JS + one JSON data file). No build step, no server.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Corpus explorer: search, category + human\_checked filters, 5 linked visualisations (bar chart, donut, category × street-type heatmap, treemap, word cloud), full 500-entry table with sorting and CSV export |
| `codebook.html` | Codebook v0.2 (definitions are **DRAFT** — rewrite in your own words, brief 0.3.3) |
| `report.html` | Learning report (draft): method, results, change log, QC status, AI declaration. §4 "What I learned" is a placeholder for you to write |
| `style.css` | Shared styles |
| `app.js` | Explorer logic + EN / 繁體中文 toggle (EN is the default) |
| `data/corpus.json` | The 500 coded entries (from `corpus_sample_500_coded_DRAFT.csv`, plus street type from the Road Centreline record) |

## How to publish on GitHub Pages

1. Create a new public repository on GitHub (any name, e.g. `tt-street-names`).
2. Upload everything in this folder to the repository (keep the folder structure, so `data/corpus.json` stays under `data/`). **Check after uploading: the repository must contain a `data` folder with `corpus.json` inside — without it, the Explorer page shows no entries.** Hidden files such as `.nojekyll` are easy to miss when selecting files; make sure it is uploaded too.
3. In the repository: Settings → Pages → Build and deployment → Source: **Deploy from a branch** → Branch: **main**, folder **/ (root)** → Save.
4. Wait about a minute, then open the Pages URL GitHub shows you (looks like `https://<your-username>.github.io/<repo-name>/`).
5. Submit that Pages URL **and** the repository URL for the project.

## Before you submit

- [ ] Rewrite the 4 codebook definitions in your own words (`codebook.html` + the codebook docx). The site currently shows the draft definitions with a DRAFT banner.
- [ ] Review the 28 medium-confidence entries (see the coding report) and change any code you disagree with — then regenerate `data/corpus.json` from the edited CSV.
- [ ] Hand-check the QC 50 (`corpus_qc50_seed20261206.csv`), mark `human_checked = yes`, record the errors found, and update the Report page §1 and §4.
- [ ] Write §4 "What I learned" in your own words.
- [ ] Check the charts against the table (brief tip: AI can make charts that look right and are wrong). The charts on this site are computed from the same `corpus.json` as the table, so they agree by construction — re-check after any data edit.
- [ ] Prepare the 5-minute oral (origin, gap, main findings, one classification example).

## Local preview

From this folder, run `python3 -m http.server 8000` and open `http://localhost:8000/`.
Opening `index.html` directly from the file system will not load `data/corpus.json` (browsers block `fetch` from `file://`).