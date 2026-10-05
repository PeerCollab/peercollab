from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime

class NoteCreate(BaseModel):
    """Fields accepted when creating a note in a course."""

    title: str = Field(min_length=1, max_length=100)
    content: Optional[str] = None

class NoteUpdate(BaseModel):
    """Optional fields accepted when editing an existing note."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    content: Optional[str] = None

class NoteResponse(BaseModel):
    """Note data returned by the API."""

    id: int
    course_id: int
    title: str
    content: Optional[str]
    created_at: datetime

    # Allow serialization directly from the SQLAlchemy note model.
    model_config = ConfigDict(from_attributes=True)

    