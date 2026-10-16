from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base, utcnow


class ProjectPlanProposal(Base):
    __tablename__ = "project_plan_proposals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id"), nullable=False, index=True
    )
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id"), nullable=False, index=True
    )
    check_in_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("project_check_ins.id"), nullable=False, index=True
    )
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    current_milestones_json: Mapped[str] = mapped_column(Text, nullable=False)
    proposed_milestones_json: Mapped[str] = mapped_column(Text, nullable=False)
    baseline_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    student = relationship("Student")
    project = relationship("Project", back_populates="plan_proposals")
    check_in = relationship("ProjectCheckIn", back_populates="plan_proposals")
