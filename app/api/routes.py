import io
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app import schemas
from app.db import get_session
from app.services import files, pipeline, records

router = APIRouter()


@router.post("/upload_csv", response_model=schemas.UploadResponse, responses={400: {"model": schemas.ErrorResponse}})
async def upload_csv(file: UploadFile = File(...), session: AsyncSession = Depends(get_session)):
    try:
        file_id = await files.save_upload(file, session)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"status": "success", "file_id": file_id, "message": "CSV file uploaded successfully."}


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
