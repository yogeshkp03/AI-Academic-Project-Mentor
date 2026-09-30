from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class StudentCreate(BaseModel):
    name: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)
    department: str
    semester: int

    interests: Optional[str] = None
    programming_languages: Optional[str] = None
    frameworks: Optional[str] = None
    databases: Optional[str] = None
    ai_ml_skills: Optional[str] = None
    cloud_devops_skills: Optional[str] = None
    cybersecurity_skills: Optional[str] = None
    skill_level: Optional[str] = None


class StudentLogin(BaseModel):
    email: EmailStr
    password: str


class StudentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2)
    department: Optional[str] = None
    semester: Optional[int] = None


class StudentResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    department: str
    semester: int
    interests: Optional[str] = None
    programming_languages: Optional[str] = None
    frameworks: Optional[str] = None
    databases: Optional[str] = None
    ai_ml_skills: Optional[str] = None
    cloud_devops_skills: Optional[str] = None
    cybersecurity_skills: Optional[str] = None
    skill_level: Optional[str] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    token: str
    student: StudentResponse