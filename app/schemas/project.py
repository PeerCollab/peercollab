from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    type: Literal["Solo", "Group"]
    deadline: Optional[date] = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    type: str
    status: str
    invite_code: Optional[str] = None
    owner_id: int
    deadline: Optional[date] = None
    created_at: Optional[datetime] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    status: Optional[Literal["Ongoing", "Completed"]] = None
    deadline: Optional[date] = None
