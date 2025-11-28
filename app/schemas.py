from datetime import datetime
from typing import List, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RecordBase(BaseModel):
    comment: str
    src: str | None = None
    time: datetime | None = None
    id_batch: UUID | None = None


class RecordCreate(RecordBase):
    pass


class RecordRead(RecordBase):
    id_comment: int
    model_config = ConfigDict(from_attributes=True)


class RecordResponse(BaseModel):
    status: Literal["success"]
    record: RecordRead


class RecordsResponse(BaseModel):
    status: Literal["success"]
    records: List[RecordRead]


class BaseResponse(BaseModel):
    status: Literal["success"]
    message: str


class UploadResponse(BaseModel):
    status: Literal["success"]
    file_id: str
    message: str


class ErrorResponse(BaseModel):
    status: Literal["error"]
    message: str


class BatchActionRequest(BaseModel):
    file_id: UUID
