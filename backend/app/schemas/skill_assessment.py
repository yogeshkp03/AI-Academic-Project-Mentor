from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SkillAssessmentQuestionResponse(BaseModel):
    id: str
    skill: str
    level: str
    question: str
    options: list[str]


class SkillAssessmentStartResponse(BaseModel):
    attempt_id: int
    questions: list[SkillAssessmentQuestionResponse]
    skills: list[str]


class SkillAssessmentResumeResponse(SkillAssessmentStartResponse):
    answers: dict[str, str] = Field(default_factory=dict)


class SkillAssessmentAnswer(BaseModel):
    question_id: str = Field(..., min_length=1, max_length=80)
    answer: str = Field(..., min_length=1, max_length=500)


class SkillAssessmentSubmit(BaseModel):
    answers: list[SkillAssessmentAnswer] = Field(..., min_length=1, max_length=10)


class SkillAssessmentDraft(BaseModel):
    answers: list[SkillAssessmentAnswer] = Field(..., min_length=1, max_length=10)


class SkillAssessmentAttemptResponse(BaseModel):
    id: int
    skills: list[str]
    correct_answers: int | None = None
    total_questions: int
    score: int | None = None
    status: Literal["in_progress", "completed"]
    created_at: datetime
    completed_at: datetime | None = None
