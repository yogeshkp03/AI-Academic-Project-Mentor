from typing import Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    student_id: int
    title: str = Field(..., min_length=2, max_length=200)
    idea: str = Field(..., min_length=10, max_length=4000)
    technology_stack: Optional[str] = None
    duration: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    student_id: int
    title: str
    idea: str
    technology_stack: Optional[str] = None
    duration: Optional[str] = None
    status: str
    ai_report: Optional[str] = None

    class Config:
        from_attributes = True