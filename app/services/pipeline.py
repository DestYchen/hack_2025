import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models


async def process_batch(session: AsyncSession, batch_id: uuid.UUID) -> None:
    raw_rows = (await session.execute(select(models.RawComment).where(models.RawComment.id_batch == batch_id))).scalars().all()
    if not raw_rows:
        raise ValueError("Нет данных для указанного batch_id.")

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
    cleaned_rows = (await session.execute(select(models.CleanedComment).where(models.CleanedComment.id_batch == batch_id))).scalars().all()
    if not cleaned_rows:
        raise ValueError("Нет очищенных данных для указанного batch_id. Сначала вызовите /process_batch.")

    await session.execute(delete(models.ClassifiedComment).where(models.ClassifiedComment.id_batch == batch_id))
    await session.execute(delete(models.ValidationComment).where(models.ValidationComment.id_batch == batch_id))

    classified = [
        models.ClassifiedComment(
            id_comment=row.id_comment,
            id_batch=batch_id,
            comment_clean=row.comment_clean,
            src=row.src,
            time=row.time,
            type_comment=0,
        )
        for row in cleaned_rows
    ]
    validation = [
        models.ValidationComment(
            id_comment=row.id_comment,
            id_batch=batch_id,
            comment_clean=row.comment_clean,
            src=row.src,
            time=row.time,
            type_comment=0,
            validation=False,
        )
        for row in cleaned_rows
    ]

    session.add_all(classified + validation)

    summary = await session.get(models.BatchSummary, batch_id)
    now = datetime.now(timezone.utc)
    if summary:
        summary.time = now
        summary.f1_metric = 0.0
    else:
        session.add(models.BatchSummary(id_batch=batch_id, time=now, f1_metric=0.0))

    await session.commit()
