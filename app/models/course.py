from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from typing import Optional
from app.database import Base

class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(50), index=True)
    description: Mapped[Optional[str]] = mapped_column(String(200))
    is_general: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    notes: Mapped[list["Note"]] = relationship(back_populates="course", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="course", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("owner_id", "title", name="uq_course_owner_title"),)

    