from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib


@dataclass(frozen=True)
class ApprovedModel:
    version: str
    language: str
    pipeline: Any


class ModelUnavailable(RuntimeError):
    pass


def load_approved_model(manifest_path: str | None = None) -> ApprovedModel:
    path = Path(manifest_path or os.environ.get("MODEL_MANIFEST_PATH", "/models/model-manifest.json")).resolve()
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
        artifact_name = manifest["artifactFilename"]
        if Path(artifact_name).name != artifact_name or not artifact_name.endswith(".joblib"):
            raise ModelUnavailable("Model artifact name is invalid")
        artifact = (path.parent / artifact_name).resolve()
        expected_root = path.parent.resolve()
        if artifact.parent != expected_root:
            raise ModelUnavailable("Model artifact must be colocated with its approved manifest")
        digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
        if digest != manifest["artifactSha256"]:
            raise ModelUnavailable("Model artifact integrity check failed")
        pipeline = joblib.load(artifact)
        return ApprovedModel(manifest["modelVersion"], manifest["language"], pipeline)
    except ModelUnavailable:
        raise
    except (OSError, KeyError, ValueError, json.JSONDecodeError) as exc:
        raise ModelUnavailable("Approved model manifest or artifact is unavailable") from exc
