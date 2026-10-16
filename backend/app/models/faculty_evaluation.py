from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base, utcnow


class FacultyEvaluation(Base):
    __tablename__ = "faculty_evaluations"
    __table_args__ = (
        Index("ux_faculty_evaluations_project", "project_id", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    faculty_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("faculty.id"), nullable=False, index=True
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    feedback: Mapped[str] = mapped_column(Text, nullable=False)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    project = relationship("Project", back_populates="faculty_evaluation")
    faculty = relationship("Faculty", back_populates="evaluations")
