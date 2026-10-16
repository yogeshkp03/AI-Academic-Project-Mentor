from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.project import FacultyEvaluationResponse


class FacultyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    department: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=12, max_length=128)


class FacultyLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class FacultyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    department: str
    is_approved: bool
    is_mentor_available: bool
    mentor_expertise: str
    created_at: datetime


class FacultyTokenResponse(BaseModel):
    token: str
    faculty: FacultyResponse


class FacultyProjectResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_email: EmailStr
    student_department: str
    title: str
    idea: str
    technology_stack: str | None = None
    duration: str | None = None
    status: str | None = None
    ai_report: str | None = None
    created_at: datetime
    analysis_status: str | None = None
    milestone_count: int
    completed_milestone_count: int
    faculty_evaluation: FacultyEvaluationResponse | None = None


class FacultyEvaluationCreate(BaseModel):
    score: int = Field(..., ge=0, le=100)
    feedback: str = Field(..., min_length=5, max_length=5000)
