from __future__ import annotations

from pathlib import Path
from typing import Iterable, List

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


class SentimentModel:
    """Wrapper around a local Transformers classifier."""

    def __init__(self, model_dir: str | Path | None = None, max_length: int = 256, batch_size: int = 32):
        base_path = Path(__file__).parent
        self.model_path = Path(model_dir) if model_dir else base_path / "sentiment_model"
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model path '{self.model_path}' not found.")

        self.max_length = max_length
        self.batch_size = batch_size
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_path)

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.device = device
        self.model.to(self.device)
        self.model.eval()

    def predict(self, texts: Iterable[str]) -> List[int]:
        """Return predicted class ids for provided texts."""
        batched_labels: List[int] = []
        buffer: List[str] = []

        def _flush(batch: List[str]) -> None:
            if not batch:
                return
            inputs = self.tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=self.max_length,
                return_tensors="pt",
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            with torch.no_grad():
                logits = self.model(**inputs).logits
                preds = torch.argmax(logits, dim=-1).cpu().tolist()
                batched_labels.extend(int(p) for p in preds)

        for text in texts:
            buffer.append(text or "")
            if len(buffer) >= self.batch_size:
                _flush(buffer)
                buffer = []

        if buffer:
            _flush(buffer)

        return batched_labels
