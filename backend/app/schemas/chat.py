from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ChatMessageCreate(BaseModel):
    student_id: int
    message: str = Field(..., min_length=1, max_length=2000)


class ChatMessageResponse(BaseModel):
    id: int
    student_id: int
    project_id: int
    role: str
    message: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
