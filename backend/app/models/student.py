from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base, utcnow


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    interests: Mapped[str | None] = mapped_column(Text, nullable=True)

    programming_languages: Mapped[str | None] = mapped_column(Text, nullable=True)
    frameworks: Mapped[str | None] = mapped_column(Text, nullable=True)
    databases: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_ml_skills: Mapped[str | None] = mapped_column(Text, nullable=True)
    cloud_devops_skills: Mapped[str | None] = mapped_column(Text, nullable=True)
    cybersecurity_skills: Mapped[str | None] = mapped_column(Text, nullable=True)

    skill_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Holds a sha256 hex digest (64 chars) for new sessions. The width still
    # accommodates a raw token written before digests were introduced.
    auth_token: Mapped[str | None] = mapped_column(
        String(512), nullable=True, unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )

    projects = relationship("Project", back_populates="student", cascade="all, delete-orphan")