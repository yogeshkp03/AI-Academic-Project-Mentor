from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.database import utcnow
from app.models.agent_run import ANALYSIS_STEP_KEYS, AgentRun, AgentRunStep

MAX_VERSION_RETRIES = 5


def create_agent_run(
    db: Session,
    *,
    student_id: int,
    project_id: int,
    agent_type: str,
    input_context: str | None = None,
) -> AgentRun:
    for _ in range(MAX_VERSION_RETRIES):
        latest = (
            db.query(AgentRun)
            .filter(
                AgentRun.project_id == project_id,
                AgentRun.agent_type == agent_type,
            )
            .order_by(AgentRun.version.desc())
            .first()
        )
        next_version = (latest.version + 1) if latest else 1

        db.query(AgentRun).filter(
            AgentRun.project_id == project_id,
            AgentRun.agent_type == agent_type,
            AgentRun.is_active == 1,
        ).update({"is_active": 0}, synchronize_session=False)

        run = AgentRun(
            student_id=student_id,
            project_id=project_id,
            agent_type=agent_type,
            input_context=input_context,
            version=next_version,
            is_active=1,
            status="queued",
            steps=[
                AgentRunStep(step_key=key, position=position, status="pending")
                for position, key in enumerate(ANALYSIS_STEP_KEYS, start=1)
            ] if agent_type == "complete_analysis" else [],
        )
        db.add(run)
        try:
            db.commit()
            db.refresh(run)
            return run
        except IntegrityError:
            # A concurrent request claimed the same (project, agent, version);
            # roll back and recompute the next version.
            db.rollback()

    raise RuntimeError("Could not create a new agent run: too many concurrent analyses.")


def mark_agent_run_started(db: Session, run: AgentRun) -> AgentRun:
    run.status = "running"
    run.started_at = utcnow()
    db.commit()
    db.refresh(run)
    return run


def mark_agent_run_completed(
    db: Session,
    run: AgentRun,
    output: str,
) -> AgentRun:
    run.status = "completed"
    run.output = output
    run.completed_at = utcnow()
    db.commit()
    db.refresh(run)
    return run


def mark_agent_run_failed(
    db: Session,
    run: AgentRun,
    error_message: str,
) -> AgentRun:
    run.status = "failed"
    run.error_message = error_message
    run.completed_at = utcnow()
    run.is_active = 0
    db.commit()
    db.refresh(run)
    return run


def fail_orphaned_runs(db: Session) -> int:
    """Mark runs stuck in queued/running as failed (e.g. after a restart)."""
    orphans = (
        db.query(AgentRun)
        .filter(AgentRun.status.in_(["queued", "running"]))
        .all()
    )
    for run in orphans:
        mark_agent_run_failed(
            db,
            run,
            "Interrupted: the server restarted before this run finished.",
        )
    return len(orphans)
