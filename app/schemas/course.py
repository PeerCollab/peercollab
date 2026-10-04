from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional

class CourseCreate(BaseModel):
    """Fields accepted when creating a course."""

    title: str = Field(min_length=1, max_length=50)
    description: Optional[str] = None

class CourseUpdate(BaseModel):
    """Optional fields accepted when updating an existing course."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=50)
    description: Optional[str] = None

class CourseResponse(BaseModel):
    """Course data returned by the API."""

    id: int
    title: str
    description: Optional[str] = None
    is_general: bool
    created_at: datetime
    task_count: int = 0
    note_count: int = 0
    progress: int = 0

    # Allow the response to be built directly from the SQLAlchemy model.
    model_config = ConfigDict(from_attributes=True)

