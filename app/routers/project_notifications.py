from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.project_notifications import (
    ProjectNotificationOut,
    ProjectNotificationsOut,
    UnreadNotificationCount,
)
from app.utils.dependencies import get_current_user, get_project_for_member

router = APIRouter(
    prefix="/api/projects/{project_id}/notifications",
    tags=["Project Notifications"],
)


def unread_filter():
    return or_(Notification.is_read.is_(False), Notification.is_read.is_(None))


@router.get("", response_model=ProjectNotificationsOut)
def list_project_notifications(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_project_for_member(project_id, db, current_user)
    notifications = db.execute(
        select(Notification)
        .where(
            Notification.project_id == project_id,
            Notification.user_id == current_user.id,
        )
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(100)
    ).scalars().all()
    unread_count = db.execute(
        select(func.count(Notification.id)).where(
            Notification.project_id == project_id,
            Notification.user_id == current_user.id,
            unread_filter(),
        )
    ).scalar_one()
    return {
        "notifications": [
            {
                "id": notification.id,
                "type": notification.type,
                "message": notification.message,
                "is_read": bool(notification.is_read),
                "created_at": notification.created_at,
            }
            for notification in notifications
        ],
        "unread_count": unread_count,
    }


@router.get("/unread-count", response_model=UnreadNotificationCount)
def get_project_unread_count(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_project_for_member(project_id, db, current_user)
    unread_count = db.execute(
        select(func.count(Notification.id)).where(
            Notification.project_id == project_id,
            Notification.user_id == current_user.id,
            unread_filter(),
        )
    ).scalar_one()
    return {"unread_count": unread_count}


@router.patch("/{notification_id}/read", response_model=ProjectNotificationOut)
def mark_project_notification_read(
    project_id: int,
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_project_for_member(project_id, db, current_user)
    notification = db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.project_id == project_id,
            Notification.user_id == current_user.id,
        )
    ).scalars().first()
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.patch("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_project_notifications_read(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_project_for_member(project_id, db, current_user)
    db.execute(
        update(Notification)
        .where(
            Notification.project_id == project_id,
            Notification.user_id == current_user.id,
            unread_filter(),
        )
        .values(is_read=True)
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
