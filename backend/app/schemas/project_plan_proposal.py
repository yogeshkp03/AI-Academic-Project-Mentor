from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProposedMilestone(BaseModel):
    title: str = Field(..., min_length=3, max_length=160)
    description: str = Field(..., min_length=10, max_length=2000)


class ProjectMilestoneSnapshot(BaseModel):
    id: int
    position: int
    title: str
    description: str
    completed: bool


class PlanAdjustmentResult(BaseModel):
    rationale: str = Field(..., min_length=20, max_length=3000)
    milestones: list[ProposedMilestone] = Field(..., min_length=1, max_length=20)

    @field_validator("milestones")
    @classmethod
    def require_distinct_titles(
        cls,
        milestones: list[ProposedMilestone],
    ) -> list[ProposedMilestone]:
        titles = [milestone.title.strip().casefold() for milestone in milestones]
        if len(set(titles)) != len(titles):
            raise ValueError("Proposed milestones must have distinct titles.")
        return milestones


class ProjectPlanProposalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    project_id: int
    check_in_id: int
    rationale: str
    current_milestones: list[ProjectMilestoneSnapshot]
    milestones: list[ProposedMilestone]
    status: Literal["pending", "approved", "rejected", "stale"]
    created_at: datetime
    resolved_at: datetime | None


class ProjectPlanProposalDecision(BaseModel):
    decision: Literal["approve", "reject"]
