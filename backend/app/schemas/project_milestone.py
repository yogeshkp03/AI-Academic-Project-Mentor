from pydantic import BaseModel, ConfigDict, Field


class ProjectMilestoneUpdate(BaseModel):
    completed: bool


class ProjectMilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    position: int
    title: str
    description: str
    completed: bool
