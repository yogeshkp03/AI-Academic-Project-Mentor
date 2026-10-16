from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class AgentRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    project_id: int
    agent_type: str
    input_context: Optional[str] = None
    output: Optional[str] = None
    version: int
    is_active: int
    status: str
    error_message: Optional[str] = None
    token_usage: Optional[str] = None
    cost: Optional[float] = None
    duration_ms: Optional[int] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    steps: list["AgentRunStepResponse"] = Field(default_factory=list)


class AgentRunStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    step_key: str
    position: int
    status: str
    output: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class AgentRunStepProgress(BaseModel):
    step_key: str = Field(..., min_length=2, max_length=50)
    attempt_id: str = Field(..., min_length=20, max_length=64)
    status: Literal["pending", "running", "completed", "failed"]
    output: Optional[str] = Field(None, max_length=50000)
