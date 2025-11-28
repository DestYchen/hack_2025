import csv
import io
import uuid
from typing import Iterable

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models


def _decode_payload(payload: bytes) -> str:
    try:
        return payload.decode("utf-8")
    except UnicodeDecodeError:
        try:
            return payload.decode("cp1251")
        except UnicodeDecodeError as exc:
            raise ValueError(f"CSV must be utf-8 or cp1251: {exc}") from exc


def _normalize_row(row: dict[str, str | None]) -> dict[str, str | None]:
    return {(k or "").strip().lstrip("\ufeff").lower(): v for k, v in row.items()}


def _parse_int(val: str | None) -> int:
    if val is None or val == "":
        raise ValueError("Missing integer value.")
    try:
        return int(float(val))
    except ValueError as exc:
        raise ValueError(f"Expected integer, got '{val}'.") from exc


def _macro_f1(y_true: Iterable[int], y_pred: Iterable[int]) -> float:
    pairs = list(zip(y_true, y_pred))
    if not pairs:
        return 0.0
    classes = sorted(set(y_true) | set(y_pred))
    f1_total = 0.0
    for cls in classes:
        tp = sum(1 for t, p in pairs if t == cls and p == cls)
        fp = sum(1 for t, p in pairs if t != cls and p == cls)
        fn = sum(1 for t, p in pairs if t == cls and p != cls)
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 0.0 if (prec + rec) == 0 else 2 * prec * rec / (prec + rec)
        f1_total += f1
    return f1_total / len(classes)


async def evaluate_labels(session: AsyncSession, batch_id: uuid.UUID, file: UploadFile) -> float:
    payload = await file.read()
    text = _decode_payload(payload)
    reader = csv.DictReader(io.StringIO(text))

    labels: dict[int, int] = {}
    for row in reader:
        nrow = _normalize_row(row)
        raw_id = nrow.get("id") or nrow.get("id_message") or nrow.get("idcomment") or nrow.get("id_comment")
        raw_label = nrow.get("label") or nrow.get("type_comment") or nrow.get("target")
        if raw_id is None or raw_label is None:
            continue
        id_comment = _parse_int(raw_id)
        label_val = _parse_int(raw_label)
        labels[id_comment] = label_val

    if not labels:
        raise ValueError("CSV must contain columns ID and label with integer values.")

    result = await session.execute(select(models.ClassifiedComment).where(models.ClassifiedComment.id_batch == batch_id))
    preds = {item.id_comment: item.type_comment for item in result.scalars().all()}

    aligned_true = []
    aligned_pred = []
    for id_comment, true_label in labels.items():
        if id_comment in preds:
            aligned_true.append(true_label)
            aligned_pred.append(preds[id_comment])

    if not aligned_true:
        raise ValueError("No overlapping IDs between uploaded labels and classified comments for this batch.")

    score = _macro_f1(aligned_true, aligned_pred)

    summary = await session.get(models.BatchSummary, batch_id)
    if summary:
        summary.f1_metric = score
    else:
        session.add(models.BatchSummary(id_batch=batch_id, f1_metric=score))

    await session.commit()
    return score
