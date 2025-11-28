import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db import Base


class RawComment(Base):
    __tablename__ = "raw_comments"

    id_comment = Column(Integer, primary_key=True, autoincrement=False)
    id_batch = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    comment = Column(String, nullable=False)
    src = Column(String, nullable=True)
    time = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CleanedComment(Base):
    __tablename__ = "cleaned_comments"

    id_comment = Column(Integer, primary_key=True, autoincrement=False)
    id_batch = Column(UUID(as_uuid=True), primary_key=True, index=True)
    comment_clean = Column(String, nullable=False)
    src = Column(String, nullable=True)
    time = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ClassifiedComment(Base):
    __tablename__ = "classified_comments"

    id_comment = Column(Integer, primary_key=True, autoincrement=False)
    id_batch = Column(UUID(as_uuid=True), primary_key=True, index=True)
    comment_clean = Column(String, nullable=False)
    src = Column(String, nullable=True)
    time = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    type_comment = Column(Integer, nullable=False, default=0)


class ValidationComment(Base):
    __tablename__ = "validation_comments"

    id_comment = Column(Integer, primary_key=True, autoincrement=False)
    id_batch = Column(UUID(as_uuid=True), primary_key=True, index=True)
    comment_clean = Column(String, nullable=False)
    src = Column(String, nullable=True)
    time = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    type_comment = Column(Integer, nullable=False, default=0)
    validation = Column(Boolean, nullable=False, default=False)


class BatchSummary(Base):
    __tablename__ = "batch_summary"

    id_batch = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    time = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    f1_metric = Column(Float, nullable=False, default=0.0)
