import uuid
from datetime import datetime, timezone
from typing import Sequence

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.config import get_settings

settings = get_settings()

REMOTE_BATCH_SIZE = 3000
BASE_URL = "https://breathlessly-glowing-turnstone.cloudpub.ru".rstrip("/")


async def _predict_labels(texts: Sequence[str]) -> list[int]:
    texts = list(texts)
    if not texts:
        return []

    all_labels: list[int] = []

    async with httpx.AsyncClient(
        base_url=BASE_URL,
        timeout=60,          # побольше, чем 30
        follow_redirects=True,
        http2=False,         # как у curl – HTTP/1.1
        verify=True,         # сертификат у тебя нормальный, verify=False уже не нужно
    ) as client:
        for i in range(0, len(texts), REMOTE_BATCH_SIZE):
            chunk = texts[i:i + REMOTE_BATCH_SIZE]
            payload = {"texts": chunk}

            resp = await client.post("/predict", json=payload)
            resp.raise_for_status()

            try:
                data = resp.json()
            except ValueError as exc:
                raise ValueError("Model service returned invalid JSON.") from exc

            labels = data.get("labels")
            if not isinstance(labels, list):
                raise ValueError(f"Model service response missing 'labels' list: {data}")
            if len(labels) != len(chunk):
                raise ValueError(
                    f"Model service returned unexpected number of predictions: "
                    f"{len(labels)} for {len(chunk)} texts"
                )

            try:
                all_labels.extend(int(item) for item in labels)
            except (TypeError, ValueError) as exc:
                raise ValueError("Model service returned non-integer predictions.") from exc

    return all_labels


async def process_batch(session: AsyncSession, batch_id: uuid.UUID) -> None:
    raw_rows = (
        await session.execute(select(models.RawComment).where(models.RawComment.id_batch == batch_id))
    ).scalars().all()
    if not raw_rows:
        raise ValueError("�?��' �?���?�?�<�: �?�>�? �?��������?�?�?�?�? batch_id.")

    await session.execute(delete(models.CleanedComment).where(models.CleanedComment.id_batch == batch_id))

    cleaned = [
        models.CleanedComment(
            id_comment=row.id_comment,
            id_batch=batch_id,
            comment_clean=row.comment,
            src=row.src,
            time=row.time,
        )
        for row in raw_rows
    ]
    session.add_all(cleaned)
    await session.commit()


async def run_model(session: AsyncSession, batch_id: uuid.UUID) -> None:
    cleaned_rows = (
        await session.execute(select(models.CleanedComment).where(models.CleanedComment.id_batch == batch_id))
    ).scalars().all()
    if not cleaned_rows:
        raise ValueError("�?��' �?�ؐ�%��?�?�<�: �?���?�?�<�: �?�>�? �?��������?�?�?�?�? batch_id. ���?���ؐ��>�� �?�<���?�?��'�� /process_batch.")

    await session.execute(delete(models.ClassifiedComment).where(models.ClassifiedComment.id_batch == batch_id))
    await session.execute(delete(models.ValidationComment).where(models.ValidationComment.id_batch == batch_id))

    comments = [row.comment_clean for row in cleaned_rows]
    predictions = await _predict_labels(comments)
    if len(predictions) != len(cleaned_rows):
        raise RuntimeError("Prediction count mismatch.")

    classified: list[models.ClassifiedComment] = []
    validation: list[models.ValidationComment] = []
    for row, label in zip(cleaned_rows, predictions):
        classified_item = models.ClassifiedComment(
            id_comment=row.id_comment,
            id_batch=batch_id,
            comment_clean=row.comment_clean,
            src=row.src,
            time=row.time,
            type_comment=int(label),
        )
        classified.append(classified_item)
        validation.append(
            models.ValidationComment(
                id_comment=row.id_comment,
                id_batch=batch_id,
                comment_clean=row.comment_clean,
                src=row.src,
                time=row.time,
                type_comment=int(label),
                validation=False,
            )
        )

    session.add_all(classified + validation)

    summary = await session.get(models.BatchSummary, batch_id)
    now = datetime.now(timezone.utc)
    if summary:
        summary.time = now
        summary.f1_metric = 0.0
    else:
        session.add(models.BatchSummary(id_batch=batch_id, time=now, f1_metric=0.0))

    await session.commit()
