import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas


def _resolve_time(dt: datetime | None) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def list_records(session: AsyncSession) -> list[models.RawComment]:
    result = await session.execute(select(models.RawComment).order_by(models.RawComment.id_comment))
    return result.scalars().all()


async def create_record(session: AsyncSession, payload: schemas.RecordCreate) -> models.RawComment:
    batch_id = payload.id_batch or uuid.uuid4()
    # Find next available id_comment within this batch (sequential).
    result = await session.execute(
        select(func.max(models.RawComment.id_comment)).where(models.RawComment.id_batch == batch_id)
    )
    next_id = (result.scalar() or 0) + 1

    record = models.RawComment(
        id_comment=next_id,
        id_batch=batch_id,
        comment=payload.comment,
        src=payload.src,
        time=_resolve_time(payload.time),
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return record


async def delete_record(session: AsyncSession, record_id: int) -> bool:
    result = await session.execute(select(models.RawComment).where(models.RawComment.id_comment == record_id))
    record = result.scalar_one_or_none()
    if not record:
        return False
    await session.delete(record)
    await session.commit()
    return True


async def count_batch_records(session: AsyncSession, batch_id: uuid.UUID) -> int:
    result = await session.execute(
        select(func.count()).select_from(models.RawComment).where(models.RawComment.id_batch == batch_id)
    )
    return int(result.scalar() or 0)


async def sentiment_share(session: AsyncSession, batch_id: uuid.UUID) -> dict[str, int]:
    result = await session.execute(
        select(models.ClassifiedComment.type_comment, func.count())
        .where(models.ClassifiedComment.id_batch == batch_id)
        .group_by(models.ClassifiedComment.type_comment)
    )
    counts = {row[0]: row[1] for row in result.all()}
    mapping = {0: "negative", 1: "neutral", 2: "positive"}
    return {mapping[k]: counts.get(k, 0) for k in mapping}


async def review_timeseries(session: AsyncSession, batch_id: uuid.UUID, granularity: str) -> list[dict[str, str | int]]:
    if granularity not in {"day", "week", "month"}:
        granularity = "day"
    bucket = func.date_trunc(granularity, models.RawComment.time).label("bucket")
    result = await session.execute(
        select(bucket, func.count())
        .where(models.RawComment.id_batch == batch_id)
        .group_by(bucket)
        .order_by(bucket)
    )
    series = []
    for ts, count in result.all():
        if ts is None:
            continue
        date_value = ts.date().isoformat()
        series.append({"date": date_value, "value": int(count)})
    return series


async def classified_sentiment_timeseries(
    session: AsyncSession,
    batch_id: uuid.UUID,
    granularity: str,
) -> dict[str, list[dict[str, str | int]]]:
    if granularity not in {"day", "week", "month"}:
        granularity = "day"
    bucket = func.date_trunc(granularity, models.ClassifiedComment.time).label("bucket")
    result = await session.execute(
        select(bucket, models.ClassifiedComment.type_comment, func.count())
        .where(models.ClassifiedComment.id_batch == batch_id)
        .group_by(bucket, models.ClassifiedComment.type_comment)
        .order_by(bucket)
    )
    mapping = {0: "negative", 1: "neutral", 2: "positive"}
    series: dict[str, list[dict[str, str | int]]] = {name: [] for name in mapping.values()}
    for ts, type_value, count in result.all():
        if ts is None:
            continue
        label = mapping.get(type_value)
        if not label:
            continue
        series[label].append({"date": ts.date().isoformat(), "value": int(count)})
    return series
