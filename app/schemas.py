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


class MetricsResponse(BaseModel):
    status: Literal["success"]
    file_id: str
    f1_metric: float
    message: str


class BatchSummaryRead(BaseModel):
    id_batch: UUID
    time: datetime | None = None
    f1_metric: float
    model_config = ConfigDict(from_attributes=True)


class BatchSummaryResponse(BaseModel):
    status: Literal["success"]
    summary: BatchSummaryRead


class ClassifiedRead(BaseModel):
    id_comment: int
    id_batch: UUID
    comment_clean: str
    src: str | None = None
    time: datetime | None = None
    type_comment: int
    model_config = ConfigDict(from_attributes=True)


class ClassifiedListResponse(BaseModel):
    status: Literal["success"]
    items: List[ClassifiedRead]


class ClassifiedUpdateRequest(BaseModel):
    file_id: UUID
    id_comment: int
    type_comment: int


class ClassifiedResponse(BaseModel):
    status: Literal["success"]
    item: ClassifiedRead
