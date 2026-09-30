import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.project import router as project_router
from app.api.student import router as student_router
from app.api.workspace import router as workspace_router
from app.database.database import Base, SessionLocal, engine, upgrade_existing_schema
from app.services.agent_run_service import fail_orphaned_runs

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

upgrade_existing_schema()
Base.metadata.create_all(bind=engine)

with SessionLocal() as startup_db:
    fail_orphaned_runs(startup_db)

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
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(student_router)
app.include_router(project_router)
app.include_router(workspace_router)


@app.get("/")
def root():
    return {"message": "AI Academic Project Mentor Backend is running!"}


@app.get("/health")
def health():
    return {"status": "ok"}