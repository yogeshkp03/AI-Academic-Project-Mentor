from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


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
