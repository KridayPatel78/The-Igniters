# Human overrides

Put corrections here as `extract/overrides/<PSI-ID>.json`. Overrides beat everything
(CSV, rules and the LLM) the next time `python -m extract.normalize` runs, and the field's
provenance becomes `"override"`.

- Only **Data contract** keys are allowed (see AGENTS.md); anything else is an error.
- Include only the fields you are correcting.
- Every value must still trace to PSI: put where it came from in `"_source"` (the JSON field
  and the exact sentence, or the CSV file + column). Keys starting with `_` are notes, not data;
  `_source` is shown in `provenance.json` and `extract/REVIEW.md`.

Example (the real `PSI-98.json`):

```json
{
  "_source": "json:approach - \"The Saffire-1 experiments was performed on the Orbital Science’s Cygnus resupply vehicle after it deberthed from the ISS.\"",
  "platform": "Cygnus resupply vehicle (after it deberthed from the ISS)"
}
```
