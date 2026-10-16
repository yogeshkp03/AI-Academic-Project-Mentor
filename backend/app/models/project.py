from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base, utcnow
from app.models.project_checkin import ProjectCheckIn
from app.models.project_milestone import ProjectMilestone
from app.models.project_plan_proposal import ProjectPlanProposal


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    idea: Mapped[str] = mapped_column(Text, nullable=False)
    technology_stack: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str | None] = mapped_column(String(50), default="submitted")
    ai_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )

    student = relationship("Student", back_populates="projects")
    milestones = relationship(
        "ProjectMilestone",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by=lambda: ProjectMilestone.position,
    )
    faculty_evaluation = relationship(
        "FacultyEvaluation",
        back_populates="project",
        cascade="all, delete-orphan",
        uselist=False,
    )
    risks = relationship(
        "ProjectRisk",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    check_ins = relationship(
        "ProjectCheckIn",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by=lambda: ProjectCheckIn.created_at.desc(),
    )
    plan_proposals = relationship(
        ProjectPlanProposal,
        back_populates="project",
        cascade="all, delete-orphan",
    )
