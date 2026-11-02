from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.chat import Message
from app.models.user import User
from app.schemas.chat import MessageResponse


def get_last_messages(db: Session, project_id: int, limit: int = 100) -> list[MessageResponse]:
    stmt = (
        select(Message)
        .options(joinedload(Message.user))  # load each author in the same query
        .where(Message.project_id == project_id)  # only this project's messages
        .order_by(Message.id.desc())  # newest first so limit keeps the latest
        .limit(limit)
    )
    messages = db.execute(stmt).scalars().all()  # scalars() gives Message objects, not row tuples
    return [MessageResponse.model_validate(m) for m in reversed(messages)]  # oldest first


def save_message(db: Session, project_id: int, user: User, content: str) -> MessageResponse:
    message = Message(project_id=project_id, user_id=user.id, content=content)
    db.add(message)
    db.commit()
    db.refresh(message)
    return MessageResponse.model_validate(message)  # message.user is already in the session, so no extra work