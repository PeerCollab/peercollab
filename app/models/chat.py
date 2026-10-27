from sqlalchemy import Integer, Text, DateTime, ForeignKey, func  
from sqlalchemy.orm import Mapped, mapped_column, relationship  
from datetime import datetime
from app.database import Base  

class Message(Base):  
    __tablename__ = "messages"  # name of the table in the database

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("projects.id"),  # must match a real project
        nullable=False,  # every message belongs to a project
        index=True,  # makes "last 100 messages of this project" fast
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id"),  # must match a real user
        nullable=False,  # every message has an author
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),  
        server_default=func.now(),  
    )

    user: Mapped["User"] = relationship("User")  # gives you message.user (the author's User row)

    @property  # lets you write message.full_name like a normal attribute
    def full_name(self) -> str:
        return self.user.full_name  # read the name from the related User, MessageOut uses this