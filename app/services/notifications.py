from sqlalchemy.orm import Session

from app.models.notification import Notification


def add_project_notification(
    db: Session,
    *,
    project_id: int,
    user_id: int | None,
    actor_id: int,
    type: str,
    message: str,
) -> None:
    if user_id is None or user_id == actor_id:
        return

    db.add(
        Notification(
            user_id=user_id,
            project_id=project_id,
            type=type,
            message=message,
            is_read=False,
        )
    )
