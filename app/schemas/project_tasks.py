from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.course_task import PriorityEnum


class TaskStatus(str, Enum):
    to_do = "To Do"
    doing = "Doing"
    done = "Done"


class ProjectTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=2000)
    priority: PriorityEnum = PriorityEnum.low
    due_date: Optional[date] = None
    assignee_id: Optional[int] = None


class ProjectTaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=2000)
    priority: Optional[PriorityEnum] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[date] = None
    assignee_id: Optional[int] = None


class ProjectTaskMove(BaseModel):
    status: TaskStatus
    position: int = Field(ge=0)


class ProjectTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    description: Optional[str] = None
    priority: PriorityEnum
    status: TaskStatus
    position: int
    due_date: Optional[date] = None
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    created_by_id: Optional[int] = None
    comment_count: int = 0
    created_at: datetime


class TaskCommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class TaskCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    user_id: int
    full_name: str
    content: str
    created_at: datetime

class AssigneeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str    