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
