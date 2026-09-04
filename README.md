# Insectivores & Viruses Explorer

Interactive companion to a systematic review of viruses reported in Eulipotyphla (shrews, moles and hedgehogs).

## Current release

- seven linked filters covering evidence, result, host, virus, country and method;
- live counts of evidence records, articles, host taxa and virus taxa;
- MDD-based host-species coverage by family;
- interactive host–virus network with family, species/virus and article-level drill-down;
- article tracks whose solid-line width follows the square root of tested hosts; dashed tracks indicate evidence without a usable host denominator;
- study-level evidence table with PubMed or DOI links;
- responsive, keyboard-accessible static interface suitable for GitHub Pages.

The default view shows natural direct-detection evidence. Serology, pooled sequencing, experimental evidence and indirect/contextual evidence remain separate selectable layers.

## Public data

The web files are a reproducible, reduced export of the canonical review workbook dated **2026-08-18**. The full workbook is not published.

| File | Purpose |
| --- | --- |
| `data/detections.csv` | Host–virus evidence, place/period, broad method class and host-level counts |
| `data/studies.csv` | One bibliographic record per study |
| `data/host_reference.csv` | MDD species denominator for coverage calculations |
| `data/README.md` | Public-export scope and derived-field definitions |

Working notes, exact source locations, assay-target detail, sequence accessions, narrative interpretation and taxonomy-mapping notes are excluded.

## Scientific conventions

- Direct detection and serology are not pooled.
- Experimental evidence is kept separate from natural-population evidence.
- A quantitative prevalence is calculated only from rows explicitly marked as non-overlapping overall host-level results and containing numeric tested and positive counts.
- Pooled sequencing can support an association but not individual-host prevalence without a host-level denominator.
- Distinct virus targets are not summed merely because they map to the same genus.
- At article level, the synthesis unit is host taxon × virus taxon × evidence layer × publication; parallel evidence layers remain separate.

## Repository structure

```text
insectivores_viruses/
├── index.html
├── README.md
├── css/style.css
├── js/app.js
└── data/
    ├── README.md
    ├── detections.csv
    ├── studies.csv
    └── host_reference.csv
```

## Local preview

The page loads CSV files with `fetch()`, so serve it locally instead of opening `index.html` directly:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Planned modules

1. Geographic explorer
2. Timeline
3. Evidence-synthesis comparison
