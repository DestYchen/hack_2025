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


async def save_upload(file: UploadFile, session: AsyncSession) -> str:
    _ensure_dirs()
    payload = await file.read()
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError(f"CSV must be utf-8: {exc}") from exc

    batch_id = uuid.uuid4()
    path = os.path.join(settings.upload_dir, f"{batch_id}.csv")
    with open(path, "w", encoding="utf-8", newline="") as fp:
        fp.write(text)

    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        comment = row.get("comment") or row.get("comment_clean") or row.get("text")
        if not comment:
            continue
        src = row.get("src")
        time_val = _parse_time(row.get("time"))
        rows.append(
            models.RawComment(
                id_batch=batch_id,
                comment=comment,
                src=src,
                time=time_val,
            )
        )

    if not rows:
        raise ValueError("CSV is empty or missing 'comment' column.")

    session.add_all(rows)
    await session.commit()
    return str(batch_id)


async def export_final(batch_id: uuid.UUID, session: AsyncSession) -> bytes | None:
    result = await session.execute(
        select(models.ClassifiedComment).where(models.ClassifiedComment.id_batch == batch_id)
    )
    records = result.scalars().all()
    if not records:
        return None

    buf = io.StringIO()
    writer = csv.writer(buf)
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
    return buf.getvalue().encode("utf-8")
