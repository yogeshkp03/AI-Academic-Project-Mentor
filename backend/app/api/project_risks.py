import hashlib
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pydantic import ValidationError
import requests

from app.api.rate_limit import student_key, workspace_limiter
from app.api.student import get_current_student
from app.database.database import get_db, utcnow
from app.models.project import Project
from app.models.project_risk import ProjectRisk
from app.models.student import Student
from app.schemas.project_risk import (
    ProjectRiskResponse,
    ProjectRiskUpdate,
    RiskAssessmentRequest,
    RiskAssessmentResponse,
)
from app.services.ai_service import assess_project_risks

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["Project Risks"])


def _get_owned_project(db: Session, project_id: int, student_id: int) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.student_id == student_id)
        .first()
    )
    if project is None:
        exists = db.query(Project.id).filter(Project.id == project_id).first()
        if exists:
            raise HTTPException(status_code=403, detail="You can only access your own project risks.")
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


@router.get("/{project_id}/risks", response_model=list[ProjectRiskResponse])
def list_project_risks(
    project_id: int,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    _get_owned_project(db, project_id, current_student.id)
    return (
        db.query(ProjectRisk)
        .filter(ProjectRisk.project_id == project_id)
        .order_by(ProjectRisk.updated_at.desc(), ProjectRisk.id.desc())
        .all()
    )


@router.post("/{project_id}/risks/assess", response_model=list[ProjectRiskResponse])
def assess_risks(
    project_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    workspace_limiter.check(student_key(request, current_student.id))
    project = _get_owned_project(db, project_id, current_student.id)
    payload = RiskAssessmentRequest(
        title=project.title,
        idea=project.idea,
        technology_stack=project.technology_stack or "",
        duration=project.duration or "",
        project_report=project.ai_report or "",
    )
    try:
        assessed = assess_project_risks(payload.model_dump(), current_student.id)
        response = RiskAssessmentResponse.model_validate(assessed)
    except (RuntimeError, ValueError, ValidationError, requests.exceptions.RequestException) as error:
        logger.exception("Risk assessment failed for project %d", project_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Risk assessment is unavailable right now. Please try again later.",
        ) from error

    for risk in response.risks:
        fingerprint = hashlib.sha256(risk.title.casefold().strip().encode("utf-8")).hexdigest()
        saved = (
            db.query(ProjectRisk)
            .filter(
                ProjectRisk.project_id == project.id,
                ProjectRisk.fingerprint == fingerprint,
            )
            .first()
        )
        if saved is None:
            saved = ProjectRisk(
                project_id=project.id,
                fingerprint=fingerprint,
                title=risk.title,
                description=risk.description,
                likelihood=risk.likelihood,
                impact=risk.impact,
                mitigation=risk.mitigation,
                status="open",
            )
            db.add(saved)
        else:
            saved.title = risk.title
            saved.description = risk.description
            saved.likelihood = risk.likelihood
            saved.impact = risk.impact
            saved.mitigation = risk.mitigation
            if saved.status != "open":
                saved.status = "open"
            saved.updated_at = utcnow()

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        logger.exception("Could not save risk assessment for project %d", project_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The risk register changed during assessment. Refresh and assess again.",
        ) from error

    return (
        db.query(ProjectRisk)
        .filter(ProjectRisk.project_id == project_id)
        .order_by(ProjectRisk.updated_at.desc(), ProjectRisk.id.desc())
        .all()
    )


@router.patch("/{project_id}/risks/{risk_id}", response_model=ProjectRiskResponse)
def update_project_risk(
    project_id: int,
    risk_id: int,
    payload: ProjectRiskUpdate,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    _get_owned_project(db, project_id, current_student.id)
    risk = (
        db.query(ProjectRisk)
        .filter(ProjectRisk.id == risk_id, ProjectRisk.project_id == project_id)
        .first()
    )
    if risk is None:
        raise HTTPException(status_code=404, detail="Project risk not found.")
    risk.status = payload.status
    risk.updated_at = utcnow()
    db.commit()
    db.refresh(risk)
    return risk
