# Workflows with rulesets, on synthetic data

A worked example for [Fieldwork](https://github.com/digital-twin-ph/fieldwork), **in progress**. It exists to
exercise every feature of the Apply ruleset step on data made to reach each one, and it is the test for Fieldwork
[experiment 188](https://github.com/digital-twin-ph/fieldwork/blob/main/docs/experiments/188-rules-that-compute-and-show-their-table.md):
when Apply ruleset can compute a column and these workflows run, Derive a value is retired.

**What is here now:** the data sets and the answers worked out by hand. **Not yet:** the workflows, their manuals and
the project file. They need the features 188 adds, and come when those are built.

**All the data are made up.** No person, place or count is real. Every value is written in
[scripts/make-data.mjs](scripts/make-data.mjs), and nothing is random, so running it again gives the same files.

## The data sets

All are wide unless stated: one row per subject, one column per variable.

| File | One row per | What it is built to reach |
| --- | --- | --- |
| [data/clinic-visits.csv](data/clinic-visits.csv) | visit (12) | Ages 4, 5 and 6 either side of an under-5 rule and on it; a temperature of exactly 38.0 °C on a fever threshold; two weights and two temperatures not recorded. For a category set under a condition (age band, fever), a value computed under one (a dose from weight, under 5 only), every comparison the editor offers, *is recorded* and *is not recorded*, and a threshold held as a step setting |
| [data/districts.csv](data/districts.csv) | district (5) | Houses minus deaths for every row, with no condition. Deaths per 10,000 houses, which needs a computed value read by a second rule. Harbour has no houses, so that rate divides by zero |
| [data/cumulative-cases-by-week.csv](data/cumulative-cases-by-week.csv) | place and week (40), **long** | New cases from a cumulative count, which reads the previous row. North is clean. East has no row for week 5. South's count falls at week 7, a correction in reporting. West has week 4 twice, with different values. **The rows are not in date order**, so the rule must sort by place and week first |
| [data/cumulative-cases-wide.csv](data/cumulative-cases-wide.csv) | place (3) | The same counts, one column per week, where new cases are a sum within one row. West is left out: a week recorded twice has no single value for one cell. East's week 5 is empty |

**Units**, which the practitioner describes in Fieldwork: `age_years` years, `weight_kg` kilograms, `temperature_c`
degrees Celsius; `houses`, `deaths`, `population` and `cumulative_cases` are counts. A unit that disagrees, such as a
fever threshold in °F, is a case for the editor to refuse while the rule is written, not a property of the data.

## The answers, worked by hand

| File | What it holds |
| --- | --- |
| [expected/districts.csv](expected/districts.csv) | Houses without a death, and deaths ÷ houses × 10,000, in that order of operations, at full double precision. Harbour's rate is empty |
| [expected/new-cases.csv](expected/new-cases.csv) | New cases under each meaning of "previous": the previous **row** recorded, and the previous **week** (empty when that week has no row). `says` names each row that is not plain: first week, previous week missing, cumulative fell, week recorded twice, after a week recorded twice |

West's rows from the repeated week on have no value under either meaning: two rows for one week have no single
previous one, and a guessed value would be worse than none.

## Licence

Data and scripts: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), no rights reserved. See
[LICENSE](LICENSE).
