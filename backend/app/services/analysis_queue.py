from app.celery_app import celery_app
from app.database.database import SessionLocal, utcnow
from app.models.agent_run import AgentRun


def enqueue_analysis(run_id: int) -> None:
    db = SessionLocal()
    try:
        run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
        if run is None or run.status != "queued":
            return
        run.enqueued_at = utcnow()
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    celery_app.send_task(
        "app.tasks.process_analysis_run",
        args=[run_id],
        task_id=f"analysis-run-{run_id}",
    )
