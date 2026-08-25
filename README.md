# Insectivores & Viruses Explorer

Interactive web explorer supporting a systematic review of viruses reported in Eulipotyphla (shrews, moles and hedgehogs).

## Project goals

The site is intended to provide an interactive view of the evidence base, including:

- host–virus associations,
- geographic distribution,
- temporal distribution,
- detection methods and study types,
- evidence strength and data gaps.

The underlying data should contain only information explicitly reported in the source articles unless a derived field is clearly labelled as such.

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

## Development status

Initial GitHub Pages-ready scaffold. The current version contains no biological records yet.

## Local preview

Because the page loads CSV data with `fetch()`, preview it through a simple local web server rather than by opening `index.html` directly.

For example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Planned modules

1. Overview / summary statistics
2. Host–virus network
3. Geographic explorer
4. Timeline
5. Evidence / methodology explorer
6. Highlighted experimental infections and possible ecological implications
