from datetime import datetime

from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    agent_type: str = Field(..., min_length=2, max_length=50)
    title: str = Field(..., min_length=1, max_length=200)


class ConversationMessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class ConversationUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class ConversationResponse(BaseModel):
    id: int
    student_id: int
    project_id: int
    agent_type: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
