from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.database import Base, utcnow


class MentorAppeal(Base):
    __tablename__ = "mentor_appeals"
    __table_args__ = (
        Index("ix_mentor_appeals_faculty_status", "faculty_id", "status"),
        Index("ix_mentor_appeals_status_deadline", "status", "expires_at"),
        Index(
            "uq_mentor_appeals_form_submission",
            "google_form_submission_id",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    faculty_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_area: Mapped[str] = mapped_column(String(100), nullable=False)
    project_idea: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    profile_consent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_form_submission_id: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
