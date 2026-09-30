from sqlalchemy.orm import Session

from app.models.conversation import Conversation


def create_conversation(
    db: Session,
    *,
    student_id: int,
    project_id: int,
    agent_type: str,
    title: str,
) -> Conversation:
    conversation = Conversation(
        student_id=student_id,
        project_id=project_id,
        agent_type=agent_type,
        title=title.strip(),
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def get_student_conversations(
    db: Session,
    *,
    student_id: int,
    project_id: int,
) -> list[Conversation]:
    return (
        db.query(Conversation)
        .filter(
            Conversation.student_id == student_id,
            Conversation.project_id == project_id,
        )
        .order_by(Conversation.updated_at.desc())
        .all()
    )
