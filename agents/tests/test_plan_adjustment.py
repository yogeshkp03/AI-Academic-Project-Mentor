import pytest
from fastapi.testclient import TestClient

from core.plan_adjustment import parse_plan_adjustment
import main as api


def test_parse_plan_adjustment_accepts_json_fence():
    result = parse_plan_adjustment(
        """```json
        {
          "rationale": "The API blocker needs an early validation step.",
          "milestones": [
            {
              "title": "Confirm the API contract",
              "description": "Document and test the authentication and response contract."
            }
          ]
        }
        ```"""
    )
    assert result["milestones"][0]["title"] == "Confirm the API contract"


@pytest.mark.parametrize(
    "raw",
    [
        "not json",
        '{"rationale":"Too short","milestones":[]}',
        '{"rationale":"A reasonable adjustment rationale.","milestones":[{"title":"API","description":"Too short"}]}',
        '{"rationale":"A reasonable adjustment rationale.","milestones":[{"title":"Plan work","description":"Split the project into practical milestones."}],"unexpected":true}',
    ],
)
def test_parse_plan_adjustment_rejects_invalid_output(raw: str):
    with pytest.raises(ValueError, match="invalid proposal"):
        parse_plan_adjustment(raw)


def test_plan_adjustment_endpoint_validates_and_returns_structured_proposal(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(api, "AGENTS_API_TOKEN", "test-agents-token")
    monkeypatch.setattr(
        api,
        "generate_plan_adjustment_with_fallback",
        lambda _context: {
            "rationale": "Address the API blocker before expanding the project scope.",
            "milestones": [
                {
                    "title": "Confirm API contract",
                    "description": "Document authentication and the expected response fields.",
                }
            ],
        },
    )
    client = TestClient(api.app)
    response = client.post(
        "/api/plans/adjust",
        headers={"X-Agents-Token": "test-agents-token"},
        json={
            "title": "Study Planner",
            "idea": "Build a planner that helps students organize research tasks.",
            "check_in": {
                "completed_work": "Finished the project requirements.",
                "in_progress": "Building the first prototype.",
                "blockers": "Waiting on the API contract.",
                "next_week_goal": "Complete one end-to-end workflow.",
                "confidence": 3,
                "mentor_feedback": "Confirm the API contract first.",
            },
            "current_milestones": [],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["milestones"][0]["title"] == "Confirm API contract"

    unauthorized = client.post(
        "/api/plans/adjust",
        json={
            "title": "Study Planner",
            "idea": "Build a planner that helps students organize research tasks.",
            "check_in": {
                "completed_work": "Finished the project requirements.",
                "in_progress": "Building the first prototype.",
                "next_week_goal": "Complete one end-to-end workflow.",
                "confidence": 3,
            },
            "current_milestones": [],
        },
    )
    assert unauthorized.status_code == 401
