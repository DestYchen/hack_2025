import io
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.db import get_session
from app.services import evaluation, files, pipeline, records

router = APIRouter()


@router.post("/upload_csv", response_model=schemas.UploadResponse, responses={400: {"model": schemas.ErrorResponse}})
async def upload_csv(file: UploadFile = File(...), session: AsyncSession = Depends(get_session)):
    try:
        batch_id = await files.save_upload(file, session)
        # Auto-run the pipeline so the batch is ready for export immediately.
        batch_uuid = uuid.UUID(batch_id)
        await pipeline.process_batch(session, batch_uuid)
        await pipeline.run_model(session, batch_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "status": "success",
        "file_id": batch_id,
        "message": "CSV file uploaded successfully.",
    }


@router.get("/records", response_model=schemas.RecordsResponse)
async def list_records(session: AsyncSession = Depends(get_session)):
    recs = await records.list_records(session)
    return {"status": "success", "records": recs}


@router.post("/records", response_model=schemas.RecordResponse, responses={400: {"model": schemas.ErrorResponse}})
async def create_record(payload: schemas.RecordCreate, session: AsyncSession = Depends(get_session)):
    if not payload.comment:
        raise HTTPException(status_code=400, detail="comment is required.")
    rec = await records.create_record(session, payload)
    return {"status": "success", "record": rec}


@router.delete("/records/{record_id}", response_model=schemas.BaseResponse, responses={404: {"model": schemas.ErrorResponse}})
async def delete_record(record_id: int, session: AsyncSession = Depends(get_session)):
    ok = await records.delete_record(session, record_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Запись с id не найдена.")
    return {"status": "success", "message": "Record deleted successfully."}


@router.post("/process_batch", response_model=schemas.BaseResponse, responses={400: {"model": schemas.ErrorResponse}})
async def process_batch(payload: schemas.BatchActionRequest, session: AsyncSession = Depends(get_session)):
    try:
        await pipeline.process_batch(session, payload.file_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"status": "success", "message": "Batch processed."}


@router.post("/run_model", response_model=schemas.BaseResponse, responses={400: {"model": schemas.ErrorResponse}})
async def run_model(payload: schemas.BatchActionRequest, session: AsyncSession = Depends(get_session)):
    try:
        await pipeline.run_model(session, payload.file_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"status": "success", "message": "Model run stub completed."}


@router.get("/export_csv", responses={200: {"content": {"text/csv": {}}, "description": "CSV file"}, 404: {"model": schemas.ErrorResponse}})
async def export_csv(file_id: str, session: AsyncSession = Depends(get_session)):
    try:
        batch_uuid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id.")
    data = await files.export_final(batch_uuid, session)
    if not data:
        raise HTTPException(status_code=404, detail="Файл не найден или не готов.")
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename=\"{batch_uuid}.csv\"'},
    )


@router.post("/upload_labels", response_model=schemas.MetricsResponse, responses={400: {"model": schemas.ErrorResponse}})
async def upload_labels(file_id: str, file: UploadFile = File(...), session: AsyncSession = Depends(get_session)):
    try:
        batch_uuid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id.")
    try:
        score = await evaluation.evaluate_labels(session, batch_uuid, file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"status": "success", "file_id": str(batch_uuid), "f1_metric": score, "message": "Labels evaluated."}


@router.get("/batch_summary", response_model=schemas.BatchSummaryResponse, responses={404: {"model": schemas.ErrorResponse}})
async def get_batch_summary(file_id: str, session: AsyncSession = Depends(get_session)):
    try:
        batch_uuid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id.")
    summary = await session.get(models.BatchSummary, batch_uuid)
    if not summary:
        raise HTTPException(status_code=404, detail="Batch summary not found.")
    return {"status": "success", "summary": summary}


@router.get("/batch_count", response_model=schemas.BatchCountResponse, responses={400: {"model": schemas.ErrorResponse}})
async def get_batch_count(file_id: str, session: AsyncSession = Depends(get_session)):
    try:
        batch_uuid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id.")
    total = await records.count_batch_records(session, batch_uuid)
    return {"status": "success", "file_id": str(batch_uuid), "total": total}


@router.get("/sentiment_share", response_model=schemas.SentimentShareResponse, responses={400: {"model": schemas.ErrorResponse}})
async def get_sentiment_share(file_id: str, session: AsyncSession = Depends(get_session)):
    try:
        batch_uuid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id.")
    share = await records.sentiment_share(session, batch_uuid)
    return {"status": "success", "file_id": str(batch_uuid), "share": share}


@router.get("/review_series", response_model=schemas.ReviewSeriesResponse, responses={400: {"model": schemas.ErrorResponse}})
async def get_review_series(
    file_id: str,
    granularity: str = "day",
    session: AsyncSession = Depends(get_session),
):
    try:
        batch_uuid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id.")
    granularity = granularity if granularity in {"day", "week", "month"} else "day"
    series = await records.review_timeseries(session, batch_uuid, granularity)
    return {"status": "success", "file_id": str(batch_uuid), "series": series}


@router.get(
    "/classified",
    response_model=schemas.ClassifiedListResponse,
    responses={404: {"model": schemas.ErrorResponse}},
)
async def get_classified_comments(
    file_id: str,
    limit: int = 10,
    session: AsyncSession = Depends(get_session),
):
    try:
        batch_uuid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id.")
    if limit <= 0:
        raise HTTPException(status_code=400, detail="limit must be positive.")
    result = await session.execute(
        select(models.ClassifiedComment)
        .where(models.ClassifiedComment.id_batch == batch_uuid)
        .order_by(models.ClassifiedComment.id_comment)
        .limit(limit)
    )
    items = result.scalars().all()
    if not items:
        raise HTTPException(status_code=404, detail="No classified comments found for this batch.")
    return {"status": "success", "items": items}


@router.put(
    "/classified",
    response_model=schemas.ClassifiedResponse,
    responses={404: {"model": schemas.ErrorResponse}},
)
async def update_classified_comment(
    payload: schemas.ClassifiedUpdateRequest,
    session: AsyncSession = Depends(get_session),
):
    batch_uuid = payload.file_id
    result = await session.execute(
        select(models.ClassifiedComment).where(
            models.ClassifiedComment.id_batch == batch_uuid,
            models.ClassifiedComment.id_comment == payload.id_comment,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Classified comment not found for this batch/id_comment.")

    item.type_comment = payload.type_comment

    # Keep validation table in sync if entry exists
    val = await session.get(models.ValidationComment, (payload.id_comment, batch_uuid))
    if val:
        val.type_comment = payload.type_comment

    await session.commit()
    await session.refresh(item)
    return {"status": "success", "item": item}
