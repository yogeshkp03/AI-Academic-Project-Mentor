from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class FacultyMentorProfile(BaseModel):
    id: int
    name: str
    department: str
    mentor_expertise: str


class MentorAppealCreate(BaseModel):
    faculty_id: int
    course_area: str = Field(..., min_length=2, max_length=100)
    project_idea: str = Field(..., min_length=10, max_length=5000)
    message: str = Field(..., min_length=10, max_length=3000)
    share_profile: bool


class MentorAppealDecision(BaseModel):
    decision: str = Field(pattern="^(accept|reject)$")
    rejection_reason: str | None = Field(None, max_length=2000)


class GoogleFormsMentorAppeal(BaseModel):
    submission_id: str = Field(..., min_length=1, max_length=200)
    student_email: EmailStr
    faculty_id: int
    course_area: str = Field(..., min_length=2, max_length=100)
    project_idea: str = Field(..., min_length=10, max_length=5000)
    message: str = Field(..., min_length=10, max_length=3000)
    share_profile: bool


class MentorAppealStudentView(BaseModel):
    id: int
    faculty: FacultyMentorProfile
    course_area: str
    project_idea: str
    message: str
    status: str
    submitted_at: datetime
    expires_at: datetime
    responded_at: datetime | None
    rejection_reason: str | None


class MentorAppealFacultyView(BaseModel):
    id: int
    student_name: str
    student_email: str
    student_department: str
    student_semester: int
    student_skills: list[dict[str, str]]
    assessment_score: int | None
    assessment_correct_answers: int | None
    assessment_total_questions: int | None
    assessment_completed_at: datetime | None
    course_area: str
    project_idea: str
    message: str
    status: str
    submitted_at: datetime
    expires_at: datetime
    responded_at: datetime | None
    rejection_reason: str | None


class MentorAvailabilityUpdate(BaseModel):
    is_mentor_available: bool
    mentor_expertise: str = Field(default="", max_length=500)
