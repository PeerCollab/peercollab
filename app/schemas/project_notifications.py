from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectNotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    message: str
    is_read: bool
    created_at: datetime | None


class ProjectNotificationsOut(BaseModel):
    notifications: list[ProjectNotificationOut]
    unread_count: int


class UnreadNotificationCount(BaseModel):
    unread_count: int
