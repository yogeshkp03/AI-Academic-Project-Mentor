import hmac
from typing import cast

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.rate_limit import auth_rate_limiter, client_key
from app.api.student import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.database.database import get_db, utcnow
from app.models.agent_run import AgentRun
from app.models.faculty import Faculty
from app.models.faculty_evaluation import FacultyEvaluation
from app.models.mentor_appeal import MentorAppeal
from app.models.project import Project
from app.models.project_milestone import ProjectMilestone
from app.models.student import Student
from app.schemas.faculty import (
    FacultyCreate,
    FacultyEvaluationCreate,
    FacultyLogin,
    FacultyProjectResponse,
    FacultyResponse,
    FacultyTokenResponse,
)
from app.schemas.mentor_appeal import MentorAvailabilityUpdate

router = APIRouter(prefix="/faculty", tags=["Faculty"])
security = HTTPBearer(auto_error=False)


def get_current_faculty(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> Faculty:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Faculty authentication is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])  # pyright: ignore[reportUnknownMemberType]
        if payload.get("role") != "faculty":
            raise ValueError("Token is not a faculty session.")
        faculty_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired faculty authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty or not faculty.auth_token or not hmac.compare_digest(
        faculty.auth_token, hash_token(credentials.credentials)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Faculty session has ended. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not faculty.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your faculty account is awaiting administrator approval.",
        )
    return faculty


@router.post("/register", response_model=FacultyResponse, status_code=status.HTTP_201_CREATED)
def register_faculty(
    payload: FacultyCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    auth_rate_limiter.check(client_key(request))
    email = str(payload.email).strip().casefold()
    if (
        db.query(Faculty).filter(Faculty.email == email).first()
        or db.query(Student).filter(Student.email == email).first()
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    faculty = Faculty(
        name=payload.name.strip(),
        email=email,
        department=payload.department.strip(),
        password_hash=hash_password(payload.password),
        is_approved=False,
    )
    db.add(faculty)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    db.refresh(faculty)
    return faculty


@router.post("/login", response_model=FacultyTokenResponse)
def login_faculty(
    payload: FacultyLogin,
    request: Request,
    db: Session = Depends(get_db),
) -> FacultyTokenResponse:
    auth_rate_limiter.check(client_key(request))
    email = str(payload.email).strip().casefold()
    faculty = db.query(Faculty).filter(Faculty.email == email).first()
    if not faculty or not verify_password(payload.password, faculty.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid faculty email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not faculty.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your faculty account is awaiting administrator approval.",
        )
    token = create_access_token(faculty.id, faculty.email, role="faculty")
    faculty.auth_token = hash_token(token)
    db.commit()
    db.refresh(faculty)
    return FacultyTokenResponse(token=token, faculty=FacultyResponse.model_validate(faculty))


@router.get("/me", response_model=FacultyResponse)
def get_faculty_profile(
    current_faculty: Faculty = Depends(get_current_faculty),
):
    return current_faculty


@router.patch("/mentor-profile", response_model=FacultyResponse)
def update_mentor_profile(
    payload: MentorAvailabilityUpdate,
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty),
) -> Faculty:
    current_faculty.is_mentor_available = payload.is_mentor_available
    current_faculty.mentor_expertise = payload.mentor_expertise.strip()
    db.commit()
    db.refresh(current_faculty)
    return current_faculty


@router.post("/logout")
def logout_faculty(
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty),
):
    current_faculty.auth_token = None
    db.commit()
    return {"message": "Logged out successfully."}


@router.get("/projects", response_model=list[FacultyProjectResponse])
def list_student_projects_for_faculty(
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty),
) -> list[FacultyProjectResponse]:
    projects: list[Project] = (
        db.query(Project)
        .join(Student, Student.id == Project.student_id)
        .join(
            MentorAppeal,
            (MentorAppeal.student_id == Project.student_id)
            & (MentorAppeal.faculty_id == current_faculty.id)
            & (MentorAppeal.status == "accepted"),
        )
        .distinct()
        .order_by(Project.created_at.desc())
        .all()
    )
    if not projects:
        return []

    project_ids = [project.id for project in projects]
    runs: list[AgentRun] = (
        db.query(AgentRun)
        .filter(
            AgentRun.project_id.in_(project_ids),
            AgentRun.agent_type == "complete_analysis",
        )
        .order_by(AgentRun.created_at.desc())
        .all()
    )
    latest_run_by_project: dict[int, AgentRun] = {}
    for run in runs:
        latest_run_by_project.setdefault(run.project_id, run)

    milestone_rows = cast(
        list[tuple[int, bool]],
        db.query(ProjectMilestone.project_id, ProjectMilestone.completed)
        .filter(ProjectMilestone.project_id.in_(project_ids))
        .all(),
    )
    milestone_counts: dict[int, tuple[int, int]] = {}
    for project_id, completed in milestone_rows:
        total, done = milestone_counts.get(project_id, (0, 0))
        milestone_counts[project_id] = (total + 1, done + int(completed))

    return [
        FacultyProjectResponse(
            id=project.id,
            student_id=project.student_id,
            student_name=project.student.name,
            student_email=project.student.email,
            student_department=project.student.department,
            title=project.title,
            idea=project.idea,
            technology_stack=project.technology_stack,
            duration=project.duration,
            status=project.status,
            ai_report=project.ai_report,
            created_at=project.created_at,
            analysis_status=(
                latest_run_by_project[project.id].status
                if project.id in latest_run_by_project
                else None
            ),
            milestone_count=milestone_counts.get(project.id, (0, 0))[0],
            completed_milestone_count=milestone_counts.get(project.id, (0, 0))[1],
            faculty_evaluation=(
                project.faculty_evaluation
                if project.faculty_evaluation is not None
                and project.faculty_evaluation.faculty_id == current_faculty.id
                else None
            ),
        )
        for project in projects
    ]


@router.put("/projects/{project_id}/evaluation", response_model=FacultyProjectResponse)
def save_project_evaluation(
    project_id: int,
    payload: FacultyEvaluationCreate,
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty),
) -> FacultyProjectResponse:
    project = (
        db.query(Project)
        .join(
            MentorAppeal,
            (MentorAppeal.student_id == Project.student_id)
            & (MentorAppeal.faculty_id == current_faculty.id)
            & (MentorAppeal.status == "accepted"),
        )
        .filter(Project.id == project_id)
        .first()
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")

    evaluation = (
        db.query(FacultyEvaluation)
        .filter(FacultyEvaluation.project_id == project.id)
        .first()
    )
    if evaluation is None:
        evaluation = FacultyEvaluation(
            project_id=project.id,
            faculty_id=current_faculty.id,
            score=payload.score,
            feedback=payload.feedback.strip(),
        )
        db.add(evaluation)
    else:
        evaluation.faculty_id = current_faculty.id
        evaluation.score = payload.score
        evaluation.feedback = payload.feedback.strip()
        evaluation.evaluated_at = utcnow()

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another faculty member updated this evaluation. Refresh and try again.",
        )
    db.refresh(project)
    for item in list_student_projects_for_faculty(db, current_faculty):
        if item.id == project_id:
            return item
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="The evaluation was saved but the updated project could not be loaded.",
    )
