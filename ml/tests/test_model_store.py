import json
from pathlib import Path

import pytest

from app.model_store import ModelUnavailable, load_approved_model


def test_missing_manifest_is_unavailable(tmp_path: Path) -> None:
    with pytest.raises(ModelUnavailable):
        load_approved_model(str(tmp_path / "missing.json"))


def test_artifact_must_be_colocated(tmp_path: Path) -> None:
    artifact = tmp_path.parent / "outside.joblib"
    artifact.write_bytes(b"not a model")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"artifactFilename": "../outside.joblib", "artifactSha256": "0" * 64, "modelVersion": "test", "language": "en"}))
    with pytest.raises(ModelUnavailable, match="name is invalid"):
        load_approved_model(str(manifest))
