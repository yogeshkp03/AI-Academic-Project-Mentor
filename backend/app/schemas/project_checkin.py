from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectCheckInCreate(BaseModel):
    completed_work: str = Field(..., min_length=3, max_length=3000)
    in_progress: str = Field(..., min_length=3, max_length=3000)
    blockers: str = Field("", max_length=3000)
    next_week_goal: str = Field(..., min_length=3, max_length=2000)
    confidence: int = Field(..., ge=1, le=5)


class ProjectCheckInResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    project_id: int
    completed_work: str
    in_progress: str
    blockers: str
    next_week_goal: str
    confidence: int
    mentor_feedback: str
    created_at: datetime
