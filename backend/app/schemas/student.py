from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class StudentSkillInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    level: Literal["Beginner", "Intermediate", "Advanced"]

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return value.strip()


class StudentSkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    level: str


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
    skills: list[StudentSkillInput] | None = Field(None, max_length=30)

    @field_validator("skills")
    @classmethod
    def validate_skills(
        cls, value: list[StudentSkillInput] | None
    ) -> list[StudentSkillInput] | None:
        if value is None:
            return value
        normalized_names = [skill.name.casefold() for skill in value]
        if any(not name for name in normalized_names):
            raise ValueError("Skill names cannot be blank.")
        if len(normalized_names) != len(set(normalized_names)):
            raise ValueError("Skill names must be unique.")
        return value


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    skills: list[StudentSkillResponse] = Field(default_factory=list)


class TokenResponse(BaseModel):
    token: str
    student: StudentResponse
