from dataclasses import dataclass
from typing import Any

from core.agents import (
    architect_agent,
    feasibility_agent,
    planning_agent,
    professor_agent,
    resource_agent,
    scope_agent,
    timeline_project_manager_agent,
    ui_ux_agent,
)


@dataclass(frozen=True)
class AgentSpec:
    key: str
    label: str
    agent: Any | None
    dependencies: tuple[str, ...] = ()
    supports_chat: bool = True


AGENT_REGISTRY: dict[str, AgentSpec] = {
    "feasibility": AgentSpec(
        key="feasibility",
        label="Feasibility Agent",
        agent=feasibility_agent,
    ),
    "architect": AgentSpec(
        key="architect",
        label="Architect Agent",
        agent=architect_agent,
        dependencies=("feasibility",),
    ),
    "scope": AgentSpec(
        key="scope",
        label="Scope Agent",
        agent=scope_agent,
        dependencies=("feasibility",),
    ),
    "timeline": AgentSpec(
        key="timeline",
        label="Timeline Agent",
        agent=timeline_project_manager_agent,
        dependencies=("architect", "scope"),
    ),
    "resource": AgentSpec(
        key="resource",
        label="Resource Agent",
        agent=resource_agent,
        dependencies=("architect",),
    ),
    "ui_ux": AgentSpec(
        key="ui_ux",
        label="UI/UX Agent",
        agent=ui_ux_agent,
        dependencies=("architect", "scope"),
    ),
    "planning": AgentSpec(
        key="planning",
        label="Planning Agent",
        agent=planning_agent,
        dependencies=("architect", "scope", "timeline", "ui_ux"),
    ),
    "professor": AgentSpec(
        key="professor",
        label="Professor QA Agent",
        agent=professor_agent,
        dependencies=(
            "feasibility",
            "architect",
            "scope",
            "timeline",
            "resource",
            "ui_ux",
            "planning",
        ),
    ),
    "mentor": AgentSpec(
        key="mentor",
        label="AI Mentor",
        agent=None,
    ),
}


def get_agent_spec(agent_type: str) -> AgentSpec:
    try:
        return AGENT_REGISTRY[agent_type]
    except KeyError as error:
        valid_types = ", ".join(AGENT_REGISTRY)
        raise ValueError(
            f"Unknown agent type '{agent_type}'. Valid types: {valid_types}."
        ) from error