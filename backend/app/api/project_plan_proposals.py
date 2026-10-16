import hashlib
import json
import logging
from typing import Any

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.project import ensure_student_owns_project
from app.api.rate_limit import student_key, workspace_limiter
from app.api.student import get_current_student
from app.database.database import get_db, utcnow
from app.models.project_checkin import ProjectCheckIn
from app.models.project_milestone import ProjectMilestone
from app.models.project_plan_proposal import ProjectPlanProposal
from app.models.student import Student
from app.schemas.project_plan_proposal import (
    PlanAdjustmentResult,
    ProjectPlanProposalDecision,
    ProjectPlanProposalResponse,
)
from app.services.ai_service import propose_plan_adjustment

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["Project Plan Proposals"])


def _milestone_snapshot(milestones: list[ProjectMilestone]) -> list[dict[str, Any]]:
    return [
        {
            "id": milestone.id,
            "position": milestone.position,
            "title": milestone.title,
            "description": milestone.description,
            "completed": milestone.completed,
        }
        for milestone in milestones
    ]


def _fingerprint(snapshot: list[dict[str, Any]]) -> str:
    serialized = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _proposal_response(proposal: ProjectPlanProposal) -> dict[str, Any]:
    return {
        "id": proposal.id,
        "student_id": proposal.student_id,
        "project_id": proposal.project_id,
        "check_in_id": proposal.check_in_id,
        "rationale": proposal.rationale,
        "current_milestones": json.loads(proposal.current_milestones_json),
        "milestones": json.loads(proposal.proposed_milestones_json),
        "status": proposal.status,
        "created_at": proposal.created_at,
        "resolved_at": proposal.resolved_at,
    }


@router.get(
    "/{project_id}/plan-proposals",
    response_model=list[ProjectPlanProposalResponse],
)
def list_plan_proposals(
    project_id: int,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    ensure_student_owns_project(db, project_id, current_student.id)
    proposals = (
        db.query(ProjectPlanProposal)
        .filter(
            ProjectPlanProposal.project_id == project_id,
            ProjectPlanProposal.student_id == current_student.id,
        )
        .order_by(ProjectPlanProposal.created_at.desc(), ProjectPlanProposal.id.desc())
        .all()
    )
    return [_proposal_response(proposal) for proposal in proposals]


@router.post(
    "/{project_id}/check-ins/{check_in_id}/plan-proposals",
    response_model=ProjectPlanProposalResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_plan_proposal(
    project_id: int,
    check_in_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    workspace_limiter.check(student_key(request, current_student.id))
    project = ensure_student_owns_project(db, project_id, current_student.id)
    check_in = (
        db.query(ProjectCheckIn)
        .filter(
            ProjectCheckIn.id == check_in_id,
            ProjectCheckIn.project_id == project.id,
            ProjectCheckIn.student_id == current_student.id,
        )
        .first()
    )
    if check_in is None:
        raise HTTPException(status_code=404, detail="Project check-in not found.")

    milestones = (
        db.query(ProjectMilestone)
        .filter(ProjectMilestone.project_id == project.id)
        .order_by(ProjectMilestone.position.asc())
        .all()
    )
    snapshot = _milestone_snapshot(milestones)
    project_report = project.ai_report or ""
    if len(project_report) > 30000:
        marker = "\n\n[Project report excerpt truncated for plan adjustment.]"
        project_report = project_report[: 30000 - len(marker)].rstrip() + marker
    context: dict[str, Any] = {
        "title": project.title,
        "idea": project.idea,
        "technology_stack": project.technology_stack or "",
        "duration": project.duration or "",
        "project_report": project_report,
        "check_in": {
            "completed_work": check_in.completed_work,
            "in_progress": check_in.in_progress,
            "blockers": check_in.blockers,
            "next_week_goal": check_in.next_week_goal,
            "confidence": check_in.confidence,
            "mentor_feedback": check_in.mentor_feedback,
        },
        "current_milestones": snapshot,
    }
    try:
        adjustment = PlanAdjustmentResult.model_validate(
            propose_plan_adjustment(context, current_student.id)
        )
    except (
        RuntimeError,
        ValueError,
        ValidationError,
        requests.exceptions.RequestException,
    ) as error:
        db.rollback()
        logger.exception("Plan proposal generation failed for project %d", project_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A plan proposal could not be generated right now. Please try again.",
        ) from error

    proposal = ProjectPlanProposal(
        student_id=current_student.id,
        project_id=project.id,
        check_in_id=check_in.id,
        rationale=adjustment.rationale,
        current_milestones_json=json.dumps(snapshot),
        proposed_milestones_json=json.dumps(
            [milestone.model_dump() for milestone in adjustment.milestones]
        ),
        baseline_fingerprint=_fingerprint(snapshot),
        status="pending",
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return _proposal_response(proposal)


@router.patch(
    "/{project_id}/plan-proposals/{proposal_id}",
    response_model=ProjectPlanProposalResponse,
)
def decide_plan_proposal(
    project_id: int,
    proposal_id: int,
    decision: ProjectPlanProposalDecision,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    project = ensure_student_owns_project(db, project_id, current_student.id)
    proposal = (
        db.query(ProjectPlanProposal)
        .filter(
            ProjectPlanProposal.id == proposal_id,
            ProjectPlanProposal.project_id == project.id,
            ProjectPlanProposal.student_id == current_student.id,
        )
        .first()
    )
    if proposal is None:
        raise HTTPException(status_code=404, detail="Plan proposal not found.")
    if proposal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This plan proposal has already been resolved.",
        )

    if decision.decision == "reject":
        proposal.status = "rejected"
        proposal.resolved_at = utcnow()
        db.commit()
        db.refresh(proposal)
        return _proposal_response(proposal)

    current = (
        db.query(ProjectMilestone)
        .filter(ProjectMilestone.project_id == project.id)
        .order_by(ProjectMilestone.position.asc())
        .all()
    )
    if _fingerprint(_milestone_snapshot(current)) != proposal.baseline_fingerprint:
        proposal.status = "stale"
        proposal.resolved_at = utcnow()
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The project milestones changed after this proposal was created. Request a fresh proposal.",
        )

    preserved = [milestone for milestone in current if milestone.completed]
    for milestone in current:
        if not milestone.completed:
            db.delete(milestone)
    db.flush()

    for position, milestone in enumerate(preserved, start=1):
        milestone.position = -position
    db.flush()
    for position, milestone in enumerate(preserved, start=1):
        milestone.position = position

    adjustment = PlanAdjustmentResult.model_validate(
        {
            "rationale": proposal.rationale,
            "milestones": json.loads(proposal.proposed_milestones_json),
        }
    )
    db.add_all(
        ProjectMilestone(
            project_id=project.id,
            position=len(preserved) + position,
            title=milestone.title,
            description=milestone.description,
            completed=False,
        )
        for position, milestone in enumerate(adjustment.milestones, start=1)
    )
    resolved_at = utcnow()
    proposal.status = "approved"
    proposal.resolved_at = resolved_at
    (
        db.query(ProjectPlanProposal)
        .filter(
            ProjectPlanProposal.project_id == project.id,
            ProjectPlanProposal.status == "pending",
            ProjectPlanProposal.id != proposal.id,
        )
        .update(
            {"status": "stale", "resolved_at": resolved_at},
            synchronize_session=False,
        )
    )
    db.commit()
    db.refresh(proposal)
    return _proposal_response(proposal)
