from datetime import datetime  # type for the created_at field
from pydantic import BaseModel, ConfigDict, Field  # BaseModel = schema base class, ConfigDict = schema settings

class MessageIn(BaseModel):
    content: str = Field(min_length=1)
    
class MessageResponse(BaseModel):  
    model_config = ConfigDict(from_attributes=True)  # allows MessageOut.model_validate(message_object) to read from a SQLAlchemy object

    id: int  
    user_id: int  
    full_name: str  # author's name (comes from Message.full_name property)
    content: str  
    created_at: datetime  # becomes an ISO string when dumped with mode="json"