import json
import logging
import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.rate_limit import student_key, workspace_limiter
from app.api.student import get_current_student
from app.database.database import SessionLocal, get_db, utcnow
from app.models.chat import ChatMessage
from app.models.agent_run import AgentRun
from app.models.conversation import Conversation
from app.models.project import Project
from app.models.student import Student
from app.schemas.chat import ChatMessageResponse
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
    mark_agent_run_started,
)
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


def run_complete_analysis(project_id: int, student_id: int, run_id: int) -> None:
    db = SessionLocal()
    try:
        run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
        project = db.query(Project).filter(Project.id == project_id).first()
        if not run or not project or project.student_id != student_id:
            return
        if run.status in ("running", "completed"):
            return

        mark_agent_run_started(db, run)
        started = time.perf_counter()
        result = analyze_project(project.idea, student_id=student_id)
        duration_ms = int((time.perf_counter() - started) * 1000)
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
        run.output = result["report"]
        run.completed_at = utcnow()
        project.ai_report = result["report"]
        db.commit()
        db.refresh(run)
    except Exception:
        db.rollback()
        logger.exception("Analysis run %d failed", run_id)
        run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
        if run and run.status != "completed":
            mark_agent_run_failed(
                db,
                run,
                "The analysis could not be completed. Please try again later.",
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


@router.post(
    "/projects/{project_id}/analysis",
    response_model=AgentRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_project_analysis(
    project_id: int,
    background_tasks: BackgroundTasks,
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
    background_tasks.add_task(
        run_complete_analysis,
        project.id,
        current_student.id,
        run.id,
    )
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
            project_blueprint=project.ai_report or "",
            student_id=current_student.id,
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
