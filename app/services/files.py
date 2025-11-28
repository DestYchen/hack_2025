import csv
import io
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.config import get_settings

settings = get_settings()


def _ensure_dirs() -> None:
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.output_dir, exist_ok=True)


def _parse_time(raw: Optional[str]) -> datetime:
    if not raw:
        return datetime.now(timezone.utc)
    try:
        parsed = datetime.fromisoformat(raw)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)


def _normalize_row(row: dict[str, str | None]) -> dict[str, str | None]:
    """Lowercase and strip BOM/whitespace from keys for flexible CSV headers."""
    normalized = {}
    for key, value in row.items():
        norm_key = (key or "").strip().lstrip("\ufeff").lower()
        normalized[norm_key] = value
    return normalized


def _get_first(row: dict[str, str | None], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        val = row.get(key)
        if val not in (None, ""):
            return val
    return None


async def save_upload(file: UploadFile, session: AsyncSession) -> str:
    _ensure_dirs()
    payload = await file.read()
    # Try UTF-8 first; fall back to cp1251 for common Russian datasets.
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = payload.decode("cp1251")
        except UnicodeDecodeError as exc:
            raise ValueError(f"CSV must be utf-8 or cp1251: {exc}") from exc

    path = os.path.join(settings.upload_dir, "latest_upload.csv")
    with open(path, "w", encoding="utf-8", newline="") as fp:
        fp.write(text)

    reader = csv.DictReader(io.StringIO(text))
    batch_uuid = uuid.uuid4()
    rows = []
    for row in reader:
        nrow = _normalize_row(row)
        if not any(val not in (None, "") for val in nrow.values()):
            continue  # skip fully empty rows

        raw_id = _get_first(nrow, ("id", "id_message", "idmessage", "id_comment", "idcomment"))
        if raw_id is None:
            raise ValueError("CSV must contain ID column for id_message.")
        try:
            id_comment = int(raw_id)
        except ValueError as exc:
            raise ValueError(f"ID must be integer: {raw_id}") from exc

        comment = _get_first(nrow, ("comment", "comment_clean", "text"))
        if not comment:
            continue
        src = _get_first(nrow, ("src",))
        time_val = _parse_time(_get_first(nrow, ("time",)))
        rows.append(
            models.RawComment(
                id_comment=id_comment,
                id_batch=batch_uuid,
                comment=comment,
                src=src,
                time=time_val,
            )
        )

    if not rows:
        raise ValueError("CSV is empty or missing 'comment' column.")

    session.add_all(rows)
    await session.commit()
    return str(batch_uuid)


async def export_final(batch_id: uuid.UUID, session: AsyncSession) -> bytes | None:
    result = await session.execute(
        select(models.ClassifiedComment).where(models.ClassifiedComment.id_batch == batch_id)
    )
    records = result.scalars().all()
    if not records:
        return None

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(["id_comment", "id_batch", "comment_clean", "src", "time", "type_comment"])
    for item in records:
        writer.writerow(
            [
                item.id_comment,
                str(item.id_batch),
                item.comment_clean,
                item.src or "",
                item.time.isoformat() if item.time else "",
                item.type_comment,
            ]
        )
    # Prepend BOM so Excel on Windows opens UTF-8 correctly.
    return ("\ufeff" + buf.getvalue()).encode("utf-8-sig")
