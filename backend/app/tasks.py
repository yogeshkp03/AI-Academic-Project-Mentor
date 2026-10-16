import logging
import os
from datetime import timedelta

from sqlalchemy import or_

from app.celery_app import CELERY_TASK_TIME_LIMIT, celery_app
from app.database.database import SessionLocal, utcnow
from app.models.agent_run import AgentRun
from app.models.faculty import Faculty
from app.models.faculty_evaluation import FacultyEvaluation
from app.models.mentor_appeal import MentorAppeal
from app.models.project_milestone import ProjectMilestone
# Celery loads this module without importing the API route that otherwise registers it.
from app.models.project_risk import ProjectRisk as _ProjectRisk
from app.models.skill_assessment import SkillAssessmentAttempt
from app.models.student_skill import StudentSkill
from app.services.analysis_queue import enqueue_analysis

logger = logging.getLogger(__name__)
STALE_RUN_SECONDS = int(
    os.getenv("STALE_RUN_SECONDS", str(CELERY_TASK_TIME_LIMIT + 300))
)
QUEUED_REDISPATCH_SECONDS = int(os.getenv("QUEUED_REDISPATCH_SECONDS", "300"))


@celery_app.task(name="app.tasks.process_analysis_run")
def process_analysis_run(run_id: int) -> None:
    from app.api.workspace import run_complete_analysis

    run_complete_analysis(run_id)


@celery_app.task(name="app.tasks.recover_analysis_runs")
def recover_analysis_runs() -> int:
    now = utcnow()
    running_before = now - timedelta(seconds=STALE_RUN_SECONDS)
    queued_before = now - timedelta(seconds=QUEUED_REDISPATCH_SECONDS)
    db = SessionLocal()
    try:
        stale_runs = (
            db.query(AgentRun)
            .filter(
                AgentRun.agent_type == "complete_analysis",
                or_(
                    (AgentRun.status == "running") & (AgentRun.started_at <= running_before),
                    (AgentRun.status == "queued")
                    & (
                        (AgentRun.enqueued_at <= queued_before)
                        | (
                            AgentRun.enqueued_at.is_(None)
                            & (AgentRun.created_at <= queued_before)
                        )
                    ),
                ),
            )
            .all()
        )
        run_ids = [run.id for run in stale_runs]
        for run in stale_runs:
            run.status = "queued"
            run.started_at = None
            run.attempt_id = None
            run.enqueued_at = now
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to find stale analysis runs")
        raise
    finally:
        db.close()

    for run_id in run_ids:
        try:
            enqueue_analysis(run_id)
        except Exception:
            logger.exception("Could not requeue analysis run %d", run_id)
    return len(run_ids)


@celery_app.task(name="app.tasks.expire_mentor_appeals")
def expire_mentor_appeals() -> int:
    db = SessionLocal()
    try:
        expired_count = (
            db.query(MentorAppeal)
            .filter(
                MentorAppeal.status == "pending",
                MentorAppeal.expires_at <= utcnow(),
            )
            .update(
                {MentorAppeal.status: "expired"},
                synchronize_session=False,
            )
        )
        db.commit()
        return expired_count
    except Exception:
        db.rollback()
        logger.exception("Failed to expire unanswered mentor appeals")
        raise
    finally:
        db.close()
