from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base, utcnow


class Faculty(Base):
    __tablename__ = "faculty"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    auth_token: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_mentor_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mentor_expertise: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    evaluations = relationship("FacultyEvaluation", back_populates="faculty")
