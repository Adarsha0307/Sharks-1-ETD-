# Rules Scoring Version 2026.09.1

The rules risk index is a deterministic ranking from 0 to 100, not a calibrated
probability. ML output remains separate. A low index is not a guarantee of
safety.

Individual finding contributions are stored with each immutable analysis.
Category caps prevent closely related evidence from being counted repeatedly:

| Category | Cap |
| --- | ---: |
| Sender identity | 25 |
| URL | 30 |
| Content combinations | 40 |
| Attachment metadata | 30 |

Bands are low 0-19, guarded 20-39, elevated 40-64, and high 65-100. Checks that
are unavailable affect completeness and evidence confidence rather than
silently subtracting risk. Authentication passes are not negative points. When
verified authentication coexists with suspicious findings, the contradiction
is displayed rather than making the message benign.

These initial weights are engineering defaults, not empirically calibrated
thresholds. Sandbox tests must establish determinism and cap behavior; later
evaluation must report any quality target honestly.
