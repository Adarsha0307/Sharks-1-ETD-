from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score
from sklearn.pipeline import Pipeline

SEED = 26106
MODEL_VERSION = "tfidf-logreg-en-2026.09.1"


def load_partition(path: Path, expected: str) -> tuple[list[str], list[str], list[str]]:
    texts: list[str] = []
    labels: list[str] = []
    ids: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if row["partition"] != expected:
            raise ValueError(f"Unexpected partition in {path}")
        texts.append(f"{row['subject']}\n{row['body']}")
        labels.append(row["label"])
        ids.append(row["id"])
    return texts, labels, ids


def evaluate(model: Pipeline, texts: list[str], labels: list[str]) -> dict[str, object]:
    predicted = model.predict(texts)
    matrix = confusion_matrix(labels, predicted, labels=["benign", "phishing"])
    tn, fp, fn, tp = matrix.ravel()
    return {
        "sampleCount": len(labels),
        "precision": precision_score(labels, predicted, pos_label="phishing", zero_division=0),
        "recall": recall_score(labels, predicted, pos_label="phishing", zero_division=0),
        "f1": f1_score(labels, predicted, pos_label="phishing", zero_division=0),
        "falsePositiveRate": float(fp / (fp + tn)) if fp + tn else 0.0,
        "confusionMatrix": {"labels": ["benign", "phishing"], "values": matrix.tolist()},
        "counts": {"trueNegative": int(tn), "falsePositive": int(fp), "falseNegative": int(fn), "truePositive": int(tp)},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path("ml/data/splits"))
    parser.add_argument("--output", type=Path, default=Path("ml/artifacts"))
    args = parser.parse_args()
    train_text, train_labels, train_ids = load_partition(args.data / "train.jsonl", "train")
    validation_text, validation_labels, validation_ids = load_partition(args.data / "validation.jsonl", "validation")
    test_text, test_labels, test_ids = load_partition(args.data / "test.jsonl", "test")
    if set(train_ids) & set(validation_ids) or set(train_ids) & set(test_ids) or set(validation_ids) & set(test_ids):
        raise ValueError("Split IDs overlap")
    if min(len(train_labels), len(validation_labels), len(test_labels)) == 0:
        raise ValueError("Every fixed partition must contain examples")

    selected_c = 1.0
    best_f1 = -1.0
    for candidate in (0.25, 1.0, 4.0):
        pipeline = Pipeline([
            ("tfidf", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), min_df=1, max_features=50_000, sublinear_tf=True)),
            ("classifier", LogisticRegression(C=candidate, max_iter=1000, random_state=SEED, class_weight="balanced")),
        ])
        pipeline.fit(train_text, train_labels)
        metric = evaluate(pipeline, validation_text, validation_labels)["f1"]
        if isinstance(metric, float) and metric > best_f1:
            selected_c, best_f1 = candidate, metric

    model = Pipeline([
        ("tfidf", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), min_df=1, max_features=50_000, sublinear_tf=True)),
        ("classifier", LogisticRegression(C=selected_c, max_iter=1000, random_state=SEED, class_weight="balanced")),
    ])
    model.fit(train_text, train_labels)
    args.output.mkdir(parents=True, exist_ok=True)
    artifact = args.output / f"{MODEL_VERSION}.joblib"
    joblib.dump(model, artifact, compress=3)
    artifact_hash = hashlib.sha256(artifact.read_bytes()).hexdigest()
    metrics = {
        "modelVersion": MODEL_VERSION,
        "seed": SEED,
        "selectedC": selected_c,
        "trainingCount": len(train_labels),
        "validation": evaluate(model, validation_text, validation_labels),
        "heldOutTest": evaluate(model, test_text, test_labels),
        "limitations": ["English only", "Bundled seed corpus is synthetic and is not real-world accuracy evidence"],
    }
    (args.output / "evaluation.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    manifest = {
        "modelVersion": MODEL_VERSION,
        "artifactFilename": artifact.name,
        "artifactSha256": artifact_hash,
        "language": "en",
        "seed": SEED,
        "datasetManifest": str(Path("ml/data/dataset-manifest.json").resolve()),
    }
    (args.output / "model-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
