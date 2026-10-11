from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, func
from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(10), nullable=False)  # Solo / Group
    status = Column(String(20), nullable=False,
                    default="Ongoing")  # Ongoing / Completed
    invite_code = Column(String(8), unique=True, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    deadline = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())
