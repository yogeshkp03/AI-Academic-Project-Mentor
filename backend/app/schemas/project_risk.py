from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProjectRiskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    description: str
    likelihood: Literal["low", "medium", "high"]
    impact: Literal["low", "medium", "high"]
    mitigation: str
    status: Literal["open", "mitigated", "accepted"]
    created_at: datetime
    updated_at: datetime


class ProjectRiskUpdate(BaseModel):
    status: Literal["open", "mitigated", "accepted"]


class RiskAssessmentRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    idea: str = Field(..., min_length=10, max_length=4000)
    technology_stack: str = Field("", max_length=500)
    duration: str = Field("", max_length=50)
    project_report: str = Field("", max_length=30000)


class AssessedRisk(BaseModel):
    title: str = Field(..., min_length=2, max_length=160)
    description: str = Field(..., min_length=10, max_length=3000)
    likelihood: Literal["low", "medium", "high"]
    impact: Literal["low", "medium", "high"]
    mitigation: str = Field(..., min_length=10, max_length=3000)

    @field_validator("title", "description", "mitigation")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class RiskAssessmentResponse(BaseModel):
    risks: list[AssessedRisk] = Field(..., min_length=1, max_length=10)
