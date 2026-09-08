from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from .model_store import ModelUnavailable, load_approved_model

app = FastAPI(title="Private ETD ML Inference", version="0.1.0", docs_url=None, redoc_url=None)


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject: str = Field(max_length=1000)
    body: str = Field(max_length=2_000_000)
    modelVersion: str = Field(min_length=1, max_length=128)


class PredictionResponse(BaseModel):
    modelVersion: str
    label: str
    score: float = Field(ge=0, le=1)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, str]:
    try:
        model = load_approved_model()
        return {"status": "ready", "modelVersion": model.version}
    except ModelUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/v1/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest) -> PredictionResponse:
    try:
        model = load_approved_model()
    except ModelUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if request.modelVersion != model.version:
        raise HTTPException(status_code=409, detail="Requested model version is not loaded")
    text = f"{request.subject}\n{request.body}"
    probabilities = model.pipeline.predict_proba([text])[0]
    classes = list(model.pipeline.classes_)
    phishing_index = classes.index("phishing")
    score = float(probabilities[phishing_index])
    label = "phishing" if score >= 0.5 else "benign"
    return PredictionResponse(modelVersion=model.version, label=label, score=score)
