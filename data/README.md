# Public explorer data

These files are derived from the canonical systematic-review workbook dated 2026-08-18. The master workbook is not published in this repository.

## Files

- `detections.csv` contains the source-grounded detection and testing fields required by the interactive evidence explorer.
- `studies.csv` contains one compact bibliographic record per study and joins to detections through `study_id`.
- `host_reference.csv` contains the current MDD Eulipotyphla species names and families required to calculate taxonomic coverage.

## Excluded master-workbook content

The public export omits working notes, exact source locations inside articles, assay-target details, sequence-accession lists, pathology narratives, clinical narratives, author interpretation fields, taxonomy-mapping notes, unused master-workbook columns and the full master workbook.

## Derived fields

The following fields are generated reproducibly from source columns and are not direct quotations from articles:

- `evidence_group`: one of `Natural direct detection`, `Serology`, `Pooled sequencing`, `Experimental evidence`, or `Indirect or contextual evidence`.
- `result_status`: one of `Positive`, `Negative`, or `Uncertain / not applicable`, derived from explicit result wording and numeric positive-host counts.
- `overall_prevalence`: `Yes` only for rows explicitly marked for non-overlapping prevalence analysis in the master workbook.
- `sampling_year_start` and `sampling_year_end`: four-digit years parsed from the reported collection-period text; blank where no year was reported.
- `method_group`: a broad method class derived from the reported method and evidence category. Detailed assay procedures are not published.

Direct detection and serology are never pooled for prevalence. Experimental evidence is not interpreted as natural-population prevalence. Pooled-library detections are retained as associations but are not assigned individual-host prevalence when a host-level denominator is unavailable.
