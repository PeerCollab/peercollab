from sqlalchemy import ForeignKey, Integer, String, DateTime, Date, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date
from app.database import Base
from typing import Optional

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    course_id: Mapped[int] = mapped_column(Integer, ForeignKey("courses.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(100))
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    priority: Mapped[str] = mapped_column(String(20), default="Low")
    status: Mapped[str] = mapped_column(String(20), default="To Do")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    course: Mapped["Course"] = relationship(back_populates="tasks")