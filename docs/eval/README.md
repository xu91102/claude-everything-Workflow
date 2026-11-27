# Evaluator and sanitized evidence

This package separates measurement tools from workflow instructions. It contains no raw model
transcripts, credentials, provider configuration, native session bodies or hidden reasoning.

## Recorded cohort

`data/final-2026-10-27/` records the complete original 28 real-task and 60 routing attempts,
including errors and timeouts. The measured workflow versions are main `42dda805` and candidate
`817b0ec`; later plugin fallback fixes and the PR split have **not** been model-benchmarked.

Both arms passed the original task tests in 14/14 runs and the independent quality checks in
12/14. Candidate real-task tokens decreased 21.03% and mean agent time decreased 7.11%.
Numerical, authorization-routing and completion gates remain **FAIL**. These data do not establish
general speed gains or acceptance of the later workflow changes.

- `analysis.json`, `paired-stats.json`, `routing-summary.json`: all-attempt summaries and pairs.
- `trial-outcomes.json`, `patches.json`: all 88 outcomes and patches, with original result hashes.
- `tasks.json`, `routing-scenarios.json`: pinned replay inputs, original regressions and routing cases.
- `numeric-programs.json`, `numeric-results.json`: unchanged Python programs, 60 supported inputs,
  outputs for both arms and diagnostic controls; no style checks replace behavioral assertions.
- `replay-stability.json`: two read-only replays of each of the four numeric artifacts, with the
  same 60 assertions and matching original pass patterns; all four remain quality failures.
- `environment.json`, `i18n-results.json`, `independent-review.json`: runtime, configuration equality,
  compiled translation evidence and the actual-artifact review. Outside review model is unknown.
- `prior-attempts.json`: previous invalid setup and complete failed cohort, excluded from this cohort.
- `manifest.json`: hashes of every public evidence file plus the original private artifact binding.

The private raw artifacts remain archived locally. Their published hashes establish provenance,
but cannot reconstruct private sessions or independently reproduce provider billing. Public final
routing responses replace the private evidence-root prefix with `<EVIDENCE_ROOT>`.

## Verify and replay

```sh
npm ci --ignore-scripts
npm run test:eval
npm run test:evidence
node docs/eval/tools/verify-evidence.js
```

Evidence integrity can pass while recorded task acceptance fails; the verifier reports both.
For a provisioned frozen numeric artifact checkout, replay all 60 assertions twice without a model:

```sh
node docs/eval/tools/replay-numeric.js --checkout /path/to/artifact \
  --version gpt-fixed-r1 --python /path/to/python3.12 --repeat 2
```

The source must match its recorded SHA256 and have its original `more_itertools` support files.
The replay runs the published Python programs with bytecode writing disabled. It checks repeat
consistency and the original pass pattern; stable failures remain failures. Original task inputs
and source patches are supplied in `tasks.json` and `patches.json` for reconstructing the checkout.

`run-trial.js` requires a separately provisioned `CEW_EVAL_ROOT` with private homes, repository
fixtures, virtualenvs and a task manifest. Its 49 regression tests use isolated fake CLIs and local
Git fixtures; they make no model calls. The split does not start another model experiment.
