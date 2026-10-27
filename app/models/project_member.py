from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProjectMember(Base):
    __tablename__ = "project_members"

    # a user can only be a member of a project once
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_member"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),  # deleting a project removes its memberships
        index=True,  
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),  # deleting a user removes their memberships
        index=True,  
    )
    role: Mapped[str] = mapped_column(String(50))  
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()  
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),  
        onupdate=func.now(),  
    )

    project = relationship("Project")  # gives member.project
    user = relationship("User")  # gives member.user