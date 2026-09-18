# Dataset Candidate Review

Status: downloaded and structurally inspected in `etd-prepare`; not approved
for training

Date: 13 September 2026

## Scope And Boundary

The two user-provided candidates were downloaded into the connected preparation
VM and inspected without training, model evaluation, email-client rendering,
URL fetching from message content, attachment execution or archive expansion
beyond the reviewed Kaggle CSV-only ZIP. Raw datasets remain outside Git under
`/home/adarsha/etd-datasets/` and must not be copied into a report or repository.

The audit reports only aggregate counts and hashes. It intentionally emits no
message text, email address, phone number, URL or other raw field. Keyword
counts below are diagnostics, not ground-truth relabeling.

## Acquired Artifacts

### Kaggle primary candidate

- Candidate: `naserabdullahalam/phishing-email-dataset`, version 1.
- Kaggle metadata advertises `CC BY-SA 4.0`, 82,486 combined rows, and calls
  label 1 both "spam" and "phishing".
- Download SHA-256:
  `3a21343518a3a5e762d964ef6eced697f3cbde3a6d0ab7c9cbe0c17dc93b98f8`.
- The ZIP passed `unzip -t` and contained only seven top-level CSV files:
  `CEAS_08.csv`, `Enron.csv`, `Ling.csv`, `Nazario.csv`,
  `Nigerian_Fraud.csv`, `SpamAssasin.csv`, and `phishing_email.csv`.
- Extracted size was 261,289,686 bytes. Individual hashes are retained in the
  preparation VM at `reports/kaggle-extracted-SHA256SUMS`.

### Hugging Face alternative

- Candidate revision:
  `K2509118/seven-phishing-email-datasets_pub@86abc2938c53ea12cb64aa941c1a2b105c82112a`.
- Its card declares `license: other`, explicitly says no single license applies,
  and defines label 1 as "phishing/spam".
- Downloaded Parquet hashes matched their Hugging Face LFS object hashes:
  - train: `fbd955e65c2ced6181e9f3177fffd0aff32fd51a80d70eb174071037b477ec5c`
  - eval: `1e5c6e4d787143c99a154950e9f52610a944c8fa3b4cea4c0b6386c3caacfaef`
  - test: `23b8544a3ca164d09e2de949cf3c7cbf9890afa40d5d80bd0736a68190432717`
- The files contain 162,413, 20,300 and 20,304 rows respectively. The schema
  includes text, subject, binary label, optional sender/receiver/date/URL count,
  and source name.
- Hugging Face marked the train Parquet unsafe because a malware signature was
  detected in email data. That is not proof of executable malware, but it
  reinforces the requirement to treat all raw files as inert data and never
  open them in an email or web client.

## Direct Structural Findings

- Kaggle source-row counts are 39,154 CEAS-08; 29,767 Enron; 2,859 Ling;
  1,565 Nazario; 3,332 Nigerian Fraud; and 5,809 SpamAssassin. Its combined CSV
  contains 82,486 rows.
- Kaggle Nazario and Nigerian Fraud contain only positive rows. They need an
  independently selected benign cohort and source-aware grouping.
- Kaggle Enron and Ling provide separate subject/body columns. The final
  `phishing_email.csv` exposes only combined text, losing reliable subject/body
  separation and source provenance.
- The Hugging Face files preserve subject/body and source name, but their
  supplied splits already leak normalized content: 140 unique exact texts occur
  in train and eval, 131 in train and test, 26 in eval and test, and 12 in all
  three. Template normalization increases those counts to 526, 518, 131 and 99.
  The supplied splits therefore must not be used as evaluation splits.
- There are 74,115 exact normalized texts shared between the Kaggle and Hugging
  Face distributions. Major exact overlap includes 29,928 CEAS-08, 22,643
  Enron, 4,343 SpamAssassin and 2,220 Ling hashes in the Hugging Face train
  split alone. The candidates are overlapping repackagings, not independent
  datasets, and must never be blindly merged.
- Within-source duplicate rows exist. Examples include 344 normalized
  duplicates in Kaggle Enron and 191 in Kaggle CEAS-08. Replacing URLs, email
  addresses and long numbers exposes 4,765 template-level duplicate rows in
  CEAS-08, indicating campaign/template leakage risk.
- No exact normalized text was observed with conflicting binary labels. This
  does not establish label correctness because both aggregates inherit broad
  spam labels.
- Both candidates contain PII-like material. Aggregate diagnostics found email
  addresses, phone-like numbers, long numeric strings, IP addresses and URLs;
  the Hugging Face card also warns of names, addresses, phone numbers and email
  addresses. Sender and receiver fields must be excluded from model features
  and raw rows must not be committed or exported.

## Label Suitability

The project predicts `benign` versus `phishing-related`, not `ham` versus all
spam. Most source labels are spam labels:

- TREC 2005-2007 and CEAS 2008 are expressly spam/ham evaluation corpora.
- SpamAssassin is expressly spam versus easy/hard ham; its documentation says
  message copyright remains with original senders.
- Ling-Spam and the Enron-Spam derivative are spam/ham corpora.
- The downloaded positive rows visibly include bulk advertising categories in
  aggregate diagnostics. A spam label cannot be relabeled as phishing without
  a separate adjudication rule or reviewed annotation.
- Nazario is the strongest positive candidate: its source README says messages
  are hand-classified phishing, representative rather than exhaustive, and
  CC-BY-4.0. Earlier messages were anonymized but later ones were not.
- Nigerian Fraud is fraud/scam content and is plausibly `phishing-related` for
  this project's broad label, but its original-source licensing and exact
  collection provenance remain unverified.

## Licensing Result

The Kaggle aggregate license cannot override restrictions or copyrights in its
components. Original-source checks found:

- Nazario: CC-BY-4.0 with attribution, according to the source README/license.
- TREC 2005, 2006, 2007 and CEAS 2008: research-only usage agreements; no
  corpus or material-portion redistribution; disclosure of contained personal
  information prohibited. These conditions conflict with treating the whole
  aggregate as freely redistributable CC BY-SA data.
- SpamAssassin: offered for spam-filter testing, but copyright in message text
  remains with original senders and headers may retain real addresses.
- Enron: public research resource with explicit privacy warnings and historical
  redaction requests; no blanket open-content license was found.
- Ling-Spam, Enron-Spam derivative and Nigerian Fraud: authoritative licensing
  remains unresolved in this review.

Consequently, neither aggregate is approved for repository redistribution, and
the Hugging Face alternative is not an independent licensing fallback.

## Selection Decision

### Conditionally suitable

- `Nazario.csv` positives, after validating each row against the source corpus,
  removing empty/corrupt records, defanging URLs, stripping headers/PII from
  features, deduplicating campaigns, and preserving CC-BY attribution.
- `Nigerian_Fraud.csv` may be considered only after authoritative provenance
  and license are resolved and a manual label audit confirms that the chosen
  project label includes advance-fee fraud.
- A privacy-reviewed benign subset may be drawn from sources whose terms allow
  this local research use. It must be source-balanced and must not make source
  identity a shortcut for class.

### Not suitable as-is

- `phishing_email.csv`: source provenance is removed and spam is conflated with
  phishing.
- All positive rows from Enron, Ling, CEAS, SpamAssassin or TREC: their
  labels mean spam, not necessarily phishing.
- The supplied Hugging Face train/eval/test partitions: exact and template-level
  leakage was directly measured.
- A merged Kaggle plus Hugging Face corpus: at least 74,115 exact normalized
  texts overlap.

## Required Cleaning And Split Gate

1. Resolve authoritative license/provenance per retained source and record URLs,
   version dates, file hashes and attribution. Reject unresolved sources.
2. Define an annotation policy distinguishing credential theft, impersonation,
   payment diversion and advance-fee fraud from bulk marketing, adult/pharmacy
   ads, malware-only mail and generic spam.
3. Manually double-review a stratified positive-label sample per source and
   quarantine ambiguous rows. Broad spam positives require complete relabeling
   or exclusion, not automatic conversion to phishing.
4. Parse only text fields with inert tooling. Remove attachment payloads,
   scripts and HTML markup; never visit URLs. Defang retained URL tokens. Exclude
   sender, receiver, dates, source names and raw headers from model features.
5. Redact email addresses, phone/account-like numbers, personal names where
   feasible, and secrets. Retain only irreversible hashes for dedup evidence.
6. Canonicalize Unicode/whitespace and remove exact duplicates. Cluster quoted
   threads and near-duplicate campaigns using template hashes plus token
   similarity. Assign an entire cluster to exactly one partition.
7. Split by campaign/thread and source-aware time, before feature extraction.
   Reserve a final held-out set that is untouched during tuning. Do not reuse
   either provider's supplied random split.
8. Verify zero exact/template overlap across final partitions, publish aggregate
   class/source counts, and manually review near-neighbor pairs straddling
   partitions. Fit TF-IDF only on training data.
9. Store the sanitized fixed split and manifest in the preparation VM, then
   clone it into disconnected `etd-test`. Training and evaluation remain blocked
   until host inspection and `sandbox/preflight.sh` pass.

## Evidence Locations

- Raw/cache root: `/home/adarsha/etd-datasets/` in `etd-prepare` only.
- Download hashes: `reports/download-SHA256SUMS`.
- Extracted Kaggle hashes: `reports/kaggle-extracted-SHA256SUMS`.
- Aggregate content audit: `reports/content-audit.json`, SHA-256
  `06719a332218852875816b422fbf22195e38782a0c8d84c7ead8e0f170acd8af`.
- Audit utility source: `ml/tools/audit_candidate_datasets.py`.

No model was trained or evaluated, no candidate was approved, and no reported
metric is a detector-performance result.

## Documentary Sources Checked

- Kaggle metadata/API and dataset version 1 download:
  `https://www.kaggle.com/datasets/naserabdullahalam/phishing-email-dataset`.
- Hugging Face card/API and revision `86abc2938c53ea12cb64aa941c1a2b105c82112a`:
  `https://huggingface.co/datasets/K2509118/seven-phishing-email-datasets_pub`.
- Nazario source README and CC-BY-4.0 license:
  `https://monkey.org/~jose/phishing/`.
- SpamAssassin public corpus README:
  `https://spamassassin.apache.org/old/publiccorpus/readme.html`.
- CMU Enron corpus description and privacy warning:
  `https://www.cs.cmu.edu/~enron/`.
- NIST TREC spam-track index:
  `https://trec.nist.gov/data/spam.html`.
- Archived TREC 2005/2006/2007 and CEAS 2008 usage agreements, which restrict
  use to research/development and prohibit corpus redistribution and personal
  information disclosure.
- Dataset-associated paper: Al-Subaiey et al., arXiv:2405.11619.

This is an engineering suitability review, not legal advice. Unresolved source
rights require exclusion or an explicit rights decision before redistribution.
