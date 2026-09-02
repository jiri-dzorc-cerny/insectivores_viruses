# Insectivores & Viruses Explorer

Interactive web explorer supporting a systematic review of viruses reported in Eulipotyphla (shrews, moles and hedgehogs).

## Current features

- linked full-text, host-family, detection-method and study-type filters,
- live summary statistics,
- an interactive bipartite host–virus network,
- node and link selection with evidence details,
- a filtered evidence table,
- responsive and keyboard-accessible controls.

The network is generated directly from `data/detections.csv`. No demonstration or inferred biological records are embedded in the interface. The underlying dataset should contain only information explicitly reported in the source articles unless a derived field is clearly labelled as such.

## Data schema

`data/detections.csv` currently expects these columns:

| Column | Content |
| --- | --- |
| `host_taxon` | Host name as recorded in the review dataset |
| `host_family` | Host family used for filtering |
| `virus_taxon` | Virus name or reported taxonomic label |
| `country` | Reported sampling country |
| `sampling_year` | Reported sampling year or period |
| `detection_method` | PCR, sequencing, isolation, serology, antigen, etc. |
| `study_type` | Natural detection, experimental infection, or another review category |
| `source_id` | PMID, DOI, or internal source identifier |
| `notes` | Optional source-grounded note |

## Repository structure

```text
insectivores_viruses/
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   └── app.js
└── data/
    └── detections.csv
```

## Local preview

Because the page loads CSV data with `fetch()`, preview it through a local web server rather than by opening `index.html` directly:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Planned modules

1. Geographic explorer
2. Timeline
3. Evidence / methodology explorer
4. Highlighted experimental infections and possible ecological implications
