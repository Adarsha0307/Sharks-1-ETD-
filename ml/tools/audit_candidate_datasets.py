from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from collections.abc import Iterable, Iterator
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq


EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
URL_RE = re.compile(r"\b(?:https?://|www\.)\S+", re.IGNORECASE)
IPV4_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\s().-]*){7,15}(?!\d)")
LONG_NUMBER_RE = re.compile(r"\b\d{6,}\b")
HTML_RE = re.compile(r"<(?:html|body|a|img|script|form)\b", re.IGNORECASE)
BASE64_RE = re.compile(r"\b[A-Za-z0-9+/]{120,}={0,2}\b")

PHISHING_CUES = re.compile(
    r"\b(?:verify|confirm|validate|update|restore|unlock|suspend(?:ed)?|expire[ds]?|"
    r"password|credential|login|log[ -]?in|account|mailbox|security alert|"
    r"wire transfer|bank account|beneficiary|gift card|invoice payment)\b",
    re.IGNORECASE,
)
SPAM_CUES = re.compile(
    r"\b(?:viagra|cialis|pharmacy|weight loss|replica watch|stock alert|"
    r"unsubscribe|opt out|adult|casino|lottery|marketing list|enlarge(?:ment)?)\b",
    re.IGNORECASE,
)

SUBJECT_FIELDS = ("subject", "Subject", "email_subject")
BODY_FIELDS = ("body", "Body", "text", "Text", "email_body", "Email Text")
COMBINED_FIELDS = ("text_combined", "combined_text", "Email Text")
LABEL_FIELDS = ("label", "Label", "class", "Class")


def configure_csv_limit() -> None:
    limit = sys.maxsize
    while True:
        try:
            csv.field_size_limit(limit)
            return
        except OverflowError:
            limit //= 10


def first_value(row: dict[str, Any], names: tuple[str, ...]) -> str:
    for name in names:
        value = row.get(name)
        if value is not None:
            return str(value)
    return ""


def row_text(row: dict[str, Any]) -> tuple[str, str, str]:
    combined = first_value(row, COMBINED_FIELDS)
    subject = first_value(row, SUBJECT_FIELDS)
    body = first_value(row, BODY_FIELDS)
    if combined and not body:
        body = combined
    return subject, body, f"{subject}\n{body}" if subject else body


def normalize(value: str, *, template: bool = False) -> str:
    value = unicodedata.normalize("NFKC", value).casefold()
    if template:
        value = URL_RE.sub(" URL ", value)
        value = EMAIL_RE.sub(" EMAIL ", value)
        value = LONG_NUMBER_RE.sub(" NUMBER ", value)
    return " ".join(value.split())


def digest(value: str, *, template: bool = False) -> str:
    return hashlib.sha256(normalize(value, template=template).encode("utf-8")).hexdigest()


def normalize_label(value: Any) -> str:
    if value is None:
        return "<null>"
    text = str(value).strip().casefold()
    aliases = {
        "0.0": "0",
        "1.0": "1",
        "ham": "0",
        "legitimate": "0",
        "legit": "0",
        "benign": "0",
        "spam": "1",
        "phishing": "1",
        "phish": "1",
    }
    return aliases.get(text, text or "<empty>")


def csv_rows(path: Path) -> tuple[list[str], Iterator[dict[str, Any]]]:
    handle = path.open("r", encoding="utf-8", errors="replace", newline="")
    reader = csv.DictReader(handle)
    columns = list(reader.fieldnames or [])

    def generate() -> Iterator[dict[str, Any]]:
        try:
            yield from reader
        finally:
            handle.close()

    return columns, generate()


def parquet_batches(path: Path) -> tuple[list[str], Iterable[dict[str, list[Any]]]]:
    parquet = pq.ParquetFile(path)
    columns = parquet.schema_arrow.names

    def generate() -> Iterator[dict[str, list[Any]]]:
        for batch in parquet.iter_batches(batch_size=4096):
            yield batch.to_pydict()

    return columns, generate()


def parquet_rows(batches: Iterable[dict[str, list[Any]]]) -> Iterator[dict[str, Any]]:
    for batch in batches:
        if not batch:
            continue
        size = len(next(iter(batch.values())))
        for index in range(size):
            yield {name: values[index] for name, values in batch.items()}


def inspect_rows(
    identity: str,
    columns: list[str],
    rows: Iterable[dict[str, Any]],
    exact_members: dict[str, set[str]],
    exact_labels: dict[str, set[str]],
    template_members: dict[str, set[str]],
) -> dict[str, Any]:
    labels: Counter[str] = Counter()
    source_labels: dict[str, Counter[str]] = defaultdict(Counter)
    nulls: Counter[str] = Counter()
    diagnostics: Counter[str] = Counter()
    exact_counts: Counter[str] = Counter()
    template_counts: Counter[str] = Counter()
    rows_seen = 0
    empty_text = 0

    for row in rows:
        rows_seen += 1
        for column in columns:
            value = row.get(column)
            if value is None or (isinstance(value, str) and not value.strip()):
                nulls[column] += 1

        label = normalize_label(first_value(row, LABEL_FIELDS))
        labels[label] += 1
        source = str(row.get("dataset_name") or identity)
        source_labels[source][label] += 1

        subject, body, text = row_text(row)
        if not normalize(text):
            empty_text += 1
            continue

        exact_hash = digest(text)
        template_hash = digest(text, template=True)
        exact_counts[exact_hash] += 1
        template_counts[template_hash] += 1
        member = f"{identity}|{source}"
        exact_members[exact_hash].add(member)
        exact_labels[exact_hash].add(label)
        template_members[template_hash].add(member)

        diagnostics["has_subject"] += bool(subject.strip())
        diagnostics["has_body"] += bool(body.strip())
        diagnostics["has_email_address"] += bool(EMAIL_RE.search(text))
        diagnostics["has_url"] += bool(URL_RE.search(text))
        diagnostics["has_ipv4"] += bool(IPV4_RE.search(text))
        diagnostics["has_phone_like_number"] += bool(PHONE_RE.search(text))
        diagnostics["has_long_number"] += bool(LONG_NUMBER_RE.search(text))
        diagnostics["has_html_markup"] += bool(HTML_RE.search(text))
        diagnostics["has_long_base64_token"] += bool(BASE64_RE.search(text))
        diagnostics["has_phishing_cue"] += bool(PHISHING_CUES.search(text))
        diagnostics["has_bulk_spam_cue"] += bool(SPAM_CUES.search(text))
        if label == "1":
            diagnostics["positive_has_phishing_cue"] += bool(PHISHING_CUES.search(text))
            diagnostics["positive_has_bulk_spam_cue"] += bool(SPAM_CUES.search(text))
        if "sender" in row and row.get("sender") not in (None, ""):
            diagnostics["has_sender_field"] += 1
        if "receiver" in row and row.get("receiver") not in (None, ""):
            diagnostics["has_receiver_field"] += 1

    unique_exact = len(exact_counts)
    unique_template = len(template_counts)
    return {
        "identity": identity,
        "columns": columns,
        "rows": rows_seen,
        "labels": dict(sorted(labels.items())),
        "labelsByDeclaredSource": {
            source: dict(sorted(counts.items())) for source, counts in sorted(source_labels.items())
        },
        "nullOrEmptyByColumn": dict(sorted(nulls.items())),
        "emptyTextRows": empty_text,
        "uniqueNormalizedTexts": unique_exact,
        "duplicateRowsAfterNormalization": rows_seen - empty_text - unique_exact,
        "uniqueTemplateTexts": unique_template,
        "duplicateRowsAfterTemplateNormalization": rows_seen - empty_text - unique_template,
        "diagnostics": dict(sorted(diagnostics.items())),
    }


def pairwise_overlap(members: dict[str, set[str]]) -> list[dict[str, Any]]:
    counts: Counter[tuple[str, str]] = Counter()
    for identities in members.values():
        ordered = sorted(identities)
        for left_index, left in enumerate(ordered):
            for right in ordered[left_index + 1 :]:
                counts[(left, right)] += 1
    return [
        {"left": left, "right": right, "sharedUniqueHashes": count}
        for (left, right), count in counts.most_common()
    ]


def provider_overlap(members: dict[str, set[str]]) -> dict[str, int]:
    result = {
        "kaggleAndHuggingFace": 0,
        "huggingFaceTrainAndEval": 0,
        "huggingFaceTrainAndTest": 0,
        "huggingFaceEvalAndTest": 0,
        "allHuggingFaceSplits": 0,
    }
    for identities in members.values():
        providers = {identity.split(":", 1)[0] for identity in identities}
        hf_splits = {
            identity.split("|", 1)[0]
            for identity in identities
            if identity.startswith("huggingface:")
        }
        if providers == {"huggingface", "kaggle"}:
            result["kaggleAndHuggingFace"] += 1
        if {"huggingface:train", "huggingface:eval"} <= hf_splits:
            result["huggingFaceTrainAndEval"] += 1
        if {"huggingface:train", "huggingface:test"} <= hf_splits:
            result["huggingFaceTrainAndTest"] += 1
        if {"huggingface:eval", "huggingface:test"} <= hf_splits:
            result["huggingFaceEvalAndTest"] += 1
        if {"huggingface:train", "huggingface:eval", "huggingface:test"} <= hf_splits:
            result["allHuggingFaceSplits"] += 1
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    configure_csv_limit()

    exact_members: dict[str, set[str]] = defaultdict(set)
    exact_labels: dict[str, set[str]] = defaultdict(set)
    template_members: dict[str, set[str]] = defaultdict(set)
    datasets: list[dict[str, Any]] = []

    for path in sorted((args.root / "extracted" / "kaggle-v1").glob("*.csv")):
        columns, rows = csv_rows(path)
        datasets.append(
            inspect_rows(
                f"kaggle:{path.name}",
                columns,
                rows,
                exact_members,
                exact_labels,
                template_members,
            )
        )

    for split in ("train", "eval", "test"):
        path = args.root / "downloads" / f"hf-{split}.parquet"
        columns, batches = parquet_batches(path)
        datasets.append(
            inspect_rows(
                f"huggingface:{split}",
                columns,
                parquet_rows(batches),
                exact_members,
                exact_labels,
                template_members,
            )
        )

    report = {
        "scope": "Offline structural/content diagnostics only; no model training or evaluation performed.",
        "privacy": "No message text, address, phone number, URL, or other raw field is emitted.",
        "datasets": datasets,
        "uniqueHashOverlapSummary": {
            "exactNormalizedText": provider_overlap(exact_members),
            "templateNormalizedText": provider_overlap(template_members),
        },
        "crossDatasetExactOverlap": pairwise_overlap(exact_members),
        "crossDatasetTemplateOverlap": pairwise_overlap(template_members),
        "normalizedTextsWithConflictingLabels": sum(1 for labels in exact_labels.values() if len(labels) > 1),
        "limitations": [
            "Keyword diagnostics do not establish ground-truth phishing labels.",
            "Template hashes replace URLs, email addresses, and long numbers; they are a conservative duplicate diagnostic, not exhaustive semantic near-duplicate clustering.",
            "Original-source licenses and collection methodology require independent documentary review.",
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
