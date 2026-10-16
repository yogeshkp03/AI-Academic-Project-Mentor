from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.student import get_current_student
from app.database.database import get_db
from app.models.agent_run import AgentRun
from app.models.chat import ChatMessage
from app.models.conversation import Conversation
from app.models.project import Project
from app.models.project_checkin import ProjectCheckIn
from app.models.project_milestone import ProjectMilestone
from app.models.project_plan_proposal import ProjectPlanProposal
from app.models.student import Student
from app.schemas.project import ProjectCreate, ProjectResponse
from app.schemas.project_milestone import (
    ProjectMilestoneResponse,
    ProjectMilestoneUpdate,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


def ensure_student_owns_project(db: Session, project_id: int, student_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )
    if project.student_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This student does not own this project.",
        )
    return project


@router.post("/", response_model=ProjectResponse)
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    if project.student_id != current_student.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create projects for your own student account.",
        )

    student = db.query(Student).filter(Student.id == project.student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found.",
        )

    new_project = Project(
        student_id=project.student_id,
        title=project.title.strip(),
        idea=project.idea.strip(),
        technology_stack=project.technology_stack,
        duration=project.duration,
        status="submitted",
    )

    db.add(new_project)
    try:
        db.commit()
    except IntegrityError:
        # A concurrent request created a conflicting row. Surface it as a
        # client error instead of an unhandled 500.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create the project. Please try again.",
        )
    db.refresh(new_project)

    return new_project


@router.get("/student/{student_id}", response_model=list[ProjectResponse])
def get_projects_by_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    if student_id != current_student.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own project list.",
        )

    projects = (
        db.query(Project)
        .filter(Project.student_id == student_id)
        .order_by(Project.created_at.desc())
        .all()
    )
    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    student_id: int = Query(..., description="Student id required to verify project ownership."),
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    if student_id != current_student.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own project details.",
        )
    return ensure_student_owns_project(db, project_id, student_id)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    project = ensure_student_owns_project(db, project_id, current_student.id)
    active_run = (
        db.query(AgentRun)
        .filter(
            AgentRun.project_id == project.id,
            AgentRun.status.in_(("queued", "running")),
        )
        .first()
    )
    if active_run:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This project has an analysis in progress. Wait for it to finish before deleting the project.",
        )

    db.query(ChatMessage).filter(ChatMessage.project_id == project.id).delete(
        synchronize_session=False
    )
    db.query(ProjectPlanProposal).filter(
        ProjectPlanProposal.project_id == project.id
    ).delete(synchronize_session=False)
    db.query(ProjectCheckIn).filter(
        ProjectCheckIn.project_id == project.id
    ).delete(synchronize_session=False)
    for conversation in (
        db.query(Conversation)
        .filter(Conversation.project_id == project.id)
        .all()
    ):
        db.delete(conversation)
    for run in (
        db.query(AgentRun)
        .filter(AgentRun.project_id == project.id)
        .all()
    ):
        db.delete(run)
    for milestone in (
        db.query(ProjectMilestone)
        .filter(ProjectMilestone.project_id == project.id)
        .all()
    ):
        db.delete(milestone)
    db.delete(project)

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The project could not be deleted because related data is still in use. Please retry.",
        ) from error


@router.get(
    "/{project_id}/milestones",
    response_model=list[ProjectMilestoneResponse],
)
def list_project_milestones(
    project_id: int,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    ensure_student_owns_project(db, project_id, current_student.id)
    return (
        db.query(ProjectMilestone)
        .filter(ProjectMilestone.project_id == project_id)
        .order_by(ProjectMilestone.position.asc())
        .all()
    )


@router.patch(
    "/{project_id}/milestones/{milestone_id}",
    response_model=ProjectMilestoneResponse,
)
def update_project_milestone(
    project_id: int,
    milestone_id: int,
    payload: ProjectMilestoneUpdate,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    ensure_student_owns_project(db, project_id, current_student.id)
    milestone = (
        db.query(ProjectMilestone)
        .filter(
            ProjectMilestone.id == milestone_id,
            ProjectMilestone.project_id == project_id,
        )
        .first()
    )
    if milestone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project milestone not found.",
        )
    milestone.completed = payload.completed
    db.commit()
    db.refresh(milestone)
    return milestone


@router.get("/", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    return (
        db.query(Project)
        .filter(Project.student_id == current_student.id)
        .order_by(Project.created_at.desc())
        .all()
    )