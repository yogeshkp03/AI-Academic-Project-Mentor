from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.student import get_current_student
from app.database.database import get_db
from app.models.project import Project
from app.models.student import Student
from app.schemas.project import ProjectCreate, ProjectResponse

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