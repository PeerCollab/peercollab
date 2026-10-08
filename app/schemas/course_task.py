from enum import Enum
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime, date

class PriorityEnum(str, Enum):
    """Supported task priority values exposed to clients."""

    low = "Low"
    medium = "Medium"
    high = "High"

class StatusEnum(str, Enum):
    """Supported task workflow states exposed to clients."""

    to_do = "To Do"
    in_progress = "In Progress"
    done = "Done"  

class TaskCreate(BaseModel):
    """Fields accepted when creating a task."""

    title: str = Field(min_length=1, max_length=100)
    due_date: Optional[date] = None
    # New tasks start with the least urgent priority and an open status.
    priority: PriorityEnum = PriorityEnum.low
    status: StatusEnum = StatusEnum.to_do

class TaskUpdate(BaseModel):
    """Optional fields accepted when editing an existing task."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    due_date: Optional[date] = None
    priority: Optional[PriorityEnum] = None
    status: Optional[StatusEnum] = None

class TaskResponse(BaseModel):
    """Task data returned by the API."""

    id: int
    title: str
    due_date: Optional[date] = None
    priority: PriorityEnum
    status: StatusEnum
    created_at: datetime
    course_id: int

    # Allow serialization directly from the SQLAlchemy task model.
    model_config = ConfigDict(from_attributes=True)
    
    


