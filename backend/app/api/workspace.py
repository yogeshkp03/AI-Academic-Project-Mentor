import json
import logging
import os
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.rate_limit import student_key, workspace_limiter
from app.api.student import get_current_student
from app.database.database import SessionLocal, get_db, utcnow
from app.models.chat import ChatMessage
from app.models.agent_run import ANALYSIS_STEP_KEYS, AgentRun, AgentRunStep
from app.models.conversation import Conversation
from app.models.project import Project
from app.models.project_milestone import ProjectMilestone
from app.models.student import Student
from app.models.student_skill import StudentSkill
from app.schemas.chat import ChatMessageResponse
from app.schemas.agent_run import AgentRunStepProgress
from app.schemas.conversation import (
    ConversationCreate,
    ConversationMessageCreate,
    ConversationResponse,
    ConversationUpdate,
)
from app.schemas.agent_run import AgentRunResponse
from app.services.ai_service import generate_chat_response
from app.services.ai_service import analyze_project
from app.services.agent_run_service import (
    create_agent_run,
    mark_agent_run_failed,
)
from app.services.analysis_queue import enqueue_analysis
from app.services.conversation_service import (
    create_conversation,
    get_student_conversations,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI Workspace"])

ALLOWED_AGENT_TYPES = {
    "feasibility",
    "architect",
    "scope",
    "timeline",
    "planning",
    "resource",
    "ui_ux",
    "professor",
    "mentor",
}

# Most recent messages sent to the agents service as chat_history. Keeps a long
# conversation inside the agents service's history cap without ever rejecting it.
MAX_HISTORY_MESSAGES = 40
MAX_MENTOR_AGENT_CONTEXT_CHARS = 80000
MAX_MENTOR_PLAN_CONTEXT_CHARS = 20000
MENTOR_PLAN_UPDATE_PREFIX = "[AI_MENTOR_PLAN_UPDATE]\n"
AGENT_REPORT_LABELS = {
    "feasibility": "Feasibility",
    "architect": "Architecture",
    "scope": "MVP scope",
    "timeline": "Timeline",
    "resource": "Learning resources",
    "ui_ux": "UI/UX",
    "planning": "Execution plan",
    "professor": "QA review",
}
AGENTS_PROGRESS_TOKEN = os.getenv("AGENTS_PROGRESS_TOKEN")
if os.getenv("APP_ENV", "").lower() == "production":
    required_service_secrets = {
        "AI_SERVICE_API_KEY": os.getenv("AI_SERVICE_API_KEY"),
        "AGENTS_PROGRESS_TOKEN": AGENTS_PROGRESS_TOKEN,
    }
    missing_service_secrets = [
        name
        for name, value in required_service_secrets.items()
        if not value or len(value) < 32
    ]
    if missing_service_secrets:
        raise RuntimeError(
            "Required production service secrets are missing or shorter than 32 characters: "
            + ", ".join(missing_service_secrets)
        )


def get_owned_project(
    db: Session,
    project_id: int,
    current_student: Student,
) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )
    if project.student_id != current_student.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own project workspace.",
        )
    return project


def get_owned_conversation(
    db: Session,
    conversation_id: int,
    current_student: Student,
) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    if conversation.student_id != current_student.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own conversation.",
        )
    return conversation


def _report_with_milestones(report: str, milestones: list[dict[str, str]]) -> str:
    if not milestones:
        return report
    milestone_lines = [
        f"{position}. **{milestone['title']}** — {milestone['description']}"
        for position, milestone in enumerate(milestones, start=1)
    ]
    return f"{report.rstrip()}\n\n## Project milestones\n\n" + "\n".join(milestone_lines)


def run_complete_analysis(run_id: int) -> None:
    db = SessionLocal()
    attempt_id = secrets.token_urlsafe(32)
    try:
        run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
        if not run or run.agent_type != "complete_analysis":
            return
        claimed = (
            db.query(AgentRun)
            .filter(AgentRun.id == run_id, AgentRun.status == "queued")
            .update(
                {
                    "status": "running",
                    "started_at": utcnow(),
                    "attempt_id": attempt_id,
                },
                synchronize_session=False,
            )
        )
        if claimed != 1:
            return

        db.commit()
        db.refresh(run)
        for step in run.steps:
            step.status = "pending"
            step.started_at = None
            step.completed_at = None
        db.commit()

        project = (
            db.query(Project)
            .filter(Project.id == run.project_id, Project.student_id == run.student_id)
            .first()
        )
        if not project:
            mark_agent_run_failed(db, run, "Project not found for this analysis run.")
            return

        analysis_prompt = "\n\n".join(
            (
                f"Project title: {project.title}",
                f"Project idea: {project.idea}",
                f"Available technologies: {project.technology_stack or 'Not specified'}",
                f"Target duration: {project.duration or 'Not specified'}",
            )
        )
        revision_context = ""
        if (run.input_context or "").startswith(MENTOR_PLAN_UPDATE_PREFIX):
            revision_context = run.input_context[len(MENTOR_PLAN_UPDATE_PREFIX):]
        started = time.perf_counter()
        skills: list[StudentSkill] = (
            db.query(StudentSkill)
            .filter(StudentSkill.student_id == run.student_id)
            .order_by(StudentSkill.normalized_name.asc())
            .all()
        )
        student_context = "\n".join(
            f"- {skill.name} ({skill.level})" for skill in skills
        )
        result = analyze_project(
            analysis_prompt,
            student_id=run.student_id,
            run_id=run.id,
            attempt_id=attempt_id,
            student_context=student_context,
            revision_context=revision_context,
        )
        duration_ms = int((time.perf_counter() - started) * 1000)
        db.refresh(run)
        if run.attempt_id != attempt_id or run.status != "running":
            return
        try:
            run.token_usage = (
                json.dumps(result["token_usage"]) if result.get("token_usage") else None
            )
        except (TypeError, ValueError):
            # Usage metrics are informational. A shape the JSON encoder cannot
            # handle must not turn a successful analysis into a failed run.
            run.token_usage = None
        run.cost = result.get("cost")
        run.duration_ms = duration_ms
        # Status, output and the stored blueprint must land together, or a crash
        # between the two writes leaves a completed run with a stale report.
        # Only a successful analysis may replace the blueprint, so a failed
        # retry never clobbers the previous ai_report.
        run.status = "completed"
        complete_report = _report_with_milestones(
            result["report"],
            result.get("milestones", []),
        )
        run.output = complete_report
        run.completed_at = utcnow()
        if run.is_active == 1:
            project.ai_report = complete_report
            db.query(ProjectMilestone).filter(
                ProjectMilestone.project_id == project.id
            ).delete(synchronize_session=False)
            db.add_all(
                ProjectMilestone(
                    project_id=project.id,
                    position=position,
                    title=milestone["title"],
                    description=milestone["description"],
                    completed=False,
                )
                for position, milestone in enumerate(result.get("milestones", []), start=1)
            )
        db.commit()
        db.refresh(run)
    except Exception:
        db.rollback()
        logger.exception("Analysis run %d failed", run_id)
        run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
        if run and run.status == "running" and run.attempt_id == attempt_id:
            db.query(AgentRunStep).filter(
                AgentRunStep.agent_run_id == run_id,
                AgentRunStep.status == "running",
            ).update(
                {"status": "failed", "completed_at": utcnow()},
                synchronize_session=False,
            )
            mark_agent_run_failed(
                db,
                run,
                (
                    "All agent steps completed, but the final report could not be "
                    "validated or assembled. Any saved individual agent reports remain available."
                    if len(run.steps) == len(ANALYSIS_STEP_KEYS)
                    and all(step.status == "completed" for step in run.steps)
                    else "The analysis could not be completed. Please try again later."
                ),
            )
    finally:
        db.close()


@router.post(
    "/projects/{project_id}/conversations",
    response_model=ConversationResponse,
)
def create_project_conversation(
    project_id: int,
    conversation_data: ConversationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    workspace_limiter.check(student_key(request, current_student.id))
    get_owned_project(db, project_id, current_student)
    if conversation_data.agent_type not in ALLOWED_AGENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported agent type.",
        )

    return create_conversation(
        db,
        student_id=current_student.id,
        project_id=project_id,
        agent_type=conversation_data.agent_type,
        title=conversation_data.title,
    )


@router.get(
    "/projects/{project_id}/conversations",
    response_model=list[ConversationResponse],
)
def list_project_conversations(
    project_id: int,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    get_owned_project(db, project_id, current_student)
    return get_student_conversations(
        db,
        student_id=current_student.id,
        project_id=project_id,
    )


@router.get(
    "/projects/{project_id}/agent-runs",
    response_model=list[AgentRunResponse],
)
def list_project_agent_runs(
    project_id: int,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    get_owned_project(db, project_id, current_student)
    return (
        db.query(AgentRun)
        .filter(
            AgentRun.project_id == project_id,
            AgentRun.student_id == current_student.id,
        )
        .order_by(AgentRun.created_at.desc())
        .all()
    )


@router.post("/internal/agent-runs/{run_id}/steps")
def update_agent_run_step(
    run_id: int,
    progress: AgentRunStepProgress,
    request: Request,
    db: Session = Depends(get_db),
):
    if not AGENTS_PROGRESS_TOKEN:
        logger.error("AGENTS_PROGRESS_TOKEN is not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent progress reporting is unavailable.",
        )
    presented_token = request.headers.get("X-Agents-Progress-Token", "")
    if not secrets.compare_digest(presented_token, AGENTS_PROGRESS_TOKEN):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized.")

    if progress.step_key not in ANALYSIS_STEP_KEYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown analysis step.")
    run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis run not found.")
    if run.status != "running" or run.attempt_id != progress.attempt_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Analysis attempt is no longer active.")
    step = (
        db.query(AgentRunStep)
        .filter(
            AgentRunStep.agent_run_id == run_id,
            AgentRunStep.step_key == progress.step_key,
        )
        .first()
    )
    if not step:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis step not found.")

    if progress.status == "completed" and not (progress.output or "").strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Completed agent steps must include their output.",
        )

    now = utcnow()
    if progress.status == "pending":
        step.status = "pending"
        step.started_at = None
        step.completed_at = None
    elif progress.status == "running":
        if step.status not in ("pending", "running"):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Analysis step already finished.")
        step.status = "running"
        step.started_at = step.started_at or now
    elif progress.status == "completed":
        if step.status != "running":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Analysis step is not running.")
        step.status = "completed"
        step.output = progress.output
        step.completed_at = now
    else:
        if step.status != "running":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Analysis step is not running.")
        step.status = "failed"
        step.completed_at = now

    db.commit()
    return {"status": step.status, "step_key": step.step_key}


@router.post(
    "/projects/{project_id}/analysis",
    response_model=AgentRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_project_analysis(
    project_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    workspace_limiter.check(student_key(request, current_student.id))
    project = get_owned_project(db, project_id, current_student)
    run = create_agent_run(
        db,
        student_id=current_student.id,
        project_id=project.id,
        agent_type="complete_analysis",
        input_context=project.idea,
    )
    try:
        enqueue_analysis(run.id)
    except Exception:
        logger.exception("Could not enqueue analysis run %d", run.id)
        mark_agent_run_failed(
            db,
            run,
            "The analysis could not be queued. Please try again later.",
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Analysis could not be queued. Please try again later.",
        )
    return run


@router.post(
    "/conversations/{conversation_id}/analysis",
    response_model=AgentRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_conversation_plan_update(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    workspace_limiter.check(student_key(request, current_student.id))
    conversation = get_owned_conversation(db, conversation_id, current_student)
    if conversation.agent_type != "mentor":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plan updates can only be generated from an AI Mentor conversation.",
        )
    project = get_owned_project(db, conversation.project_id, current_student)
    active_run = (
        db.query(AgentRun)
        .filter(
            AgentRun.project_id == project.id,
            AgentRun.student_id == current_student.id,
            AgentRun.agent_type == "complete_analysis",
            AgentRun.status.in_(("queued", "running")),
        )
        .first()
    )
    if active_run:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An analysis is already in progress for this project.",
        )

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation.id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(MAX_HISTORY_MESSAGES)
        .all()
    )
    if not any(message.role == "user" for message in messages):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Send a message in this AI Mentor conversation before updating the plan.",
        )
    conversation_context = "\n".join(
        f"{'Student' if message.role == 'user' else 'AI Mentor'}: {message.message}"
        for message in reversed(messages)
    )
    latest_run = (
        db.query(AgentRun)
        .filter(
            AgentRun.project_id == project.id,
            AgentRun.student_id == current_student.id,
            AgentRun.agent_type == "complete_analysis",
            AgentRun.status == "completed",
        )
        .order_by(AgentRun.version.desc())
        .first()
    )
    current_report = (
        (latest_run.output or "").strip()
        if latest_run and latest_run.output
        else (project.ai_report or "").strip()
    )
    report_budget = MAX_MENTOR_PLAN_CONTEXT_CHARS // 2
    if len(current_report) > report_budget:
        current_report = current_report[:report_budget].rstrip() + (
            "\n\n[Current report excerpt truncated.]"
        )
    plan_heading = "Current saved project plan:\n"
    conversation_heading = "\n\nAI Mentor conversation:\n" if current_report else ""
    conversation_budget = max(
        0,
        MAX_MENTOR_PLAN_CONTEXT_CHARS
        - len(plan_heading)
        - len(current_report)
        - len(conversation_heading),
    )
    conversation_context = conversation_context[-conversation_budget:] if conversation_budget else ""
    revision_context = (
        f"{plan_heading}{current_report}{conversation_heading}{conversation_context}"
        if current_report
        else conversation_context[-MAX_MENTOR_PLAN_CONTEXT_CHARS:]
    )
    run = create_agent_run(
        db,
        student_id=current_student.id,
        project_id=project.id,
        agent_type="complete_analysis",
        input_context=MENTOR_PLAN_UPDATE_PREFIX + revision_context,
    )
    try:
        enqueue_analysis(run.id)
    except Exception as error:
        logger.exception("Could not enqueue plan update run %d", run.id)
        mark_agent_run_failed(
            db,
            run,
            "The updated plan could not be queued. Please try again later.",
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The updated plan could not be queued. Please try again later.",
        ) from error
    return run


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[ChatMessageResponse],
)
def list_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    conversation = get_owned_conversation(db, conversation_id, current_student)
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )


@router.patch(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
)
def rename_conversation(
    conversation_id: int,
    conversation_data: ConversationUpdate,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    conversation = get_owned_conversation(db, conversation_id, current_student)
    conversation.title = conversation_data.title.strip()
    db.commit()
    db.refresh(conversation)
    return conversation


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    conversation = get_owned_conversation(db, conversation_id, current_student)
    db.delete(conversation)
    db.commit()
    return None


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=ChatMessageResponse,
)
def send_conversation_message(
    conversation_id: int,
    message_data: ConversationMessageCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    workspace_limiter.check(student_key(request, current_student.id))
    conversation = get_owned_conversation(db, conversation_id, current_student)
    project = get_owned_project(db, conversation.project_id, current_student)

    user_message = ChatMessage(
        student_id=current_student.id,
        project_id=project.id,
        conversation_id=conversation.id,
        role="user",
        message=message_data.message.strip(),
    )
    db.add(user_message)
    db.flush()

    # Load only the recent tail of the conversation. Reading every message both
    # grows without bound and overflows the agents service's chat_history cap,
    # which it rejects outright, so a long chat would stop working for good.
    previous_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(MAX_HISTORY_MESSAGES)
        .all()
    )
    skills: list[StudentSkill] = (
        db.query(StudentSkill)
        .filter(StudentSkill.student_id == current_student.id)
        .order_by(StudentSkill.normalized_name.asc())
        .all()
    )
    student_context = "\n".join(
        f"- {skill.name} ({skill.level})" for skill in skills
    )
    latest_analysis = (
        db.query(AgentRun)
        .filter(
            AgentRun.project_id == project.id,
            AgentRun.student_id == current_student.id,
            AgentRun.agent_type == "complete_analysis",
        )
        .order_by(AgentRun.created_at.desc())
        .first()
    )
    agent_report_sections: list[str] = []
    remaining_context = MAX_MENTOR_AGENT_CONTEXT_CHARS
    if latest_analysis:
        for step in latest_analysis.steps:
            output = (step.output or "").strip()
            if not output or remaining_context <= 0:
                continue
            label = AGENT_REPORT_LABELS.get(step.step_key, step.step_key)
            section = f"## {label}\n\n{output}"
            clipped = section[:remaining_context]
            agent_report_sections.append(clipped)
            remaining_context -= len(clipped) + 2
    latest_agent_context = "\n\n".join(agent_report_sections)
    if latest_agent_context:
        latest_heading = "## Latest saved specialist outputs\n\n"
        latest_agent_context = latest_agent_context[
            : MAX_MENTOR_AGENT_CONTEXT_CHARS - len(latest_heading) - 2
        ]
        mentor_blueprint = latest_heading + latest_agent_context
        if project.ai_report:
            previous_heading = "## Previous finalized project report\n\n"
            remaining_context = (
                MAX_MENTOR_AGENT_CONTEXT_CHARS
                - len(mentor_blueprint)
                - len(previous_heading)
                - 2
            )
            truncation_note = "\n\n[Previous report excerpt truncated to fit chat context.]"
            if remaining_context > len(truncation_note):
                previous_report = project.ai_report
                if len(previous_report) > remaining_context:
                    previous_report = (
                        previous_report[: remaining_context - len(truncation_note)].rstrip()
                        + truncation_note
                    )
                mentor_blueprint = (
                    previous_heading
                    + previous_report
                    + "\n\n"
                    + mentor_blueprint
                )
    else:
        mentor_blueprint = project.ai_report or ""
    history_text = "\n".join(
        f"{message.role}: {message.message}" for message in reversed(previous_messages)
    )
    try:
        answer = generate_chat_response(
            project_idea=project.idea,
            project_title=project.title,
            chat_history=history_text,
            user_question=message_data.message,
            agent_type=conversation.agent_type,
            project_blueprint=mentor_blueprint,
            student_id=current_student.id,
            student_context=student_context,
        )
    except RuntimeError:
        # Keep the conversation atomic: without an assistant reply the user
        # message must not be persisted, otherwise it looks abandoned.
        db.rollback()
        logger.exception("Chat reply generation failed for conversation %d", conversation_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat is temporarily unavailable. Please try again later.",
        )

    assistant_message = ChatMessage(
        student_id=current_student.id,
        project_id=project.id,
        conversation_id=conversation.id,
        role="assistant",
        message=answer,
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    return assistant_message
