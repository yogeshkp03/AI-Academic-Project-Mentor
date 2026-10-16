import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.project import router as project_router
from app.api.student import router as student_router
from app.api.faculty import router as faculty_router
from app.api.mentorship import router as mentorship_router
from app.api.skill_assessment import router as skill_assessment_router
from app.api.project_risks import router as project_risks_router
from app.api.project_checkins import router as project_checkins_router
from app.api.project_plan_proposals import router as project_plan_proposals_router
from app.api.workspace import router as workspace_router
from app.database.database import Base, engine, upgrade_existing_schema

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

upgrade_existing_schema()
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Academic Project Mentor API",
    description="Backend API for the AI Academic Project Mentor",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ],
    # Authentication travels in an Authorization header, not a cookie, so
    # credentialed cross-origin requests are never needed. Leaving this off
    # avoids the wildcard-plus-credentials foot-gun if the list ever widens.
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(student_router)
app.include_router(project_router)
app.include_router(faculty_router)
app.include_router(mentorship_router)
app.include_router(skill_assessment_router)
app.include_router(project_risks_router)
app.include_router(project_checkins_router)
app.include_router(project_plan_proposals_router)
app.include_router(workspace_router)


@app.get("/")
def root():
    return {"message": "AI Academic Project Mentor Backend is running!"}


@app.get("/health")
def health():
    return {"status": "ok"}