from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from implementation import SentimentModel


app = FastAPI(title="Sentiment Model Service", version="1.0.0")
model = SentimentModel()


class PredictRequest(BaseModel):
    texts: list[str]


class PredictResponse(BaseModel):
    labels: list[int]


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest) -> PredictResponse:
    if not request.texts:
        return PredictResponse(labels=[])
    try:
        labels = model.predict(request.texts)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}") from exc
    return PredictResponse(labels=[int(label) for label in labels])
