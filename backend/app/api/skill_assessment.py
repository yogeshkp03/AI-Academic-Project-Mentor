import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.student import get_current_student
from app.database.database import get_db, utcnow
from app.models.skill_assessment import SkillAssessmentAttempt
from app.models.student import Student
from app.schemas.skill_assessment import (
    SkillAssessmentAnswer,
    SkillAssessmentAttemptResponse,
    SkillAssessmentDraft,
    SkillAssessmentQuestionResponse,
    SkillAssessmentResumeResponse,
    SkillAssessmentStartResponse,
    SkillAssessmentSubmit,
)
from app.services.skill_assessment import QUESTION_BANK, select_assessment_questions

router = APIRouter(prefix="/skill-assessments", tags=["Skill Assessments"])
QUESTIONS_BY_ID = {question["id"]: question for question in QUESTION_BANK}


def _to_response(attempt: SkillAssessmentAttempt) -> SkillAssessmentAttemptResponse:
    return SkillAssessmentAttemptResponse(
        id=attempt.id,
        skills=json.loads(attempt.skills_json),
        correct_answers=attempt.correct_answers,
        total_questions=attempt.total_questions,
        score=attempt.score,
        status="completed" if attempt.completed_at else "in_progress",
        created_at=attempt.created_at,
        completed_at=attempt.completed_at,
    )


def _get_owned_attempt(
    db: Session,
    attempt_id: int,
    student_id: int,
) -> SkillAssessmentAttempt:
    attempt = (
        db.query(SkillAssessmentAttempt)
        .filter(
            SkillAssessmentAttempt.id == attempt_id,
            SkillAssessmentAttempt.student_id == student_id,
        )
        .first()
    )
    if attempt is None:
        raise HTTPException(status_code=404, detail="Assessment attempt not found.")
    return attempt


def _validate_answers(
    answers: list[SkillAssessmentAnswer],
    question_ids: list[str],
) -> dict[str, str]:
    submitted = {answer.question_id: answer.answer for answer in answers}
    if len(submitted) != len(answers) or not set(submitted).issubset(question_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="An answer does not match this assessment.",
        )
    for question_id, answer in submitted.items():
        question = QUESTIONS_BY_ID.get(question_id)
        if question is None or answer not in question["options"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="An answer does not match the assessment questions.",
            )
    return submitted


@router.post("/attempts", response_model=SkillAssessmentStartResponse)
def start_assessment(
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    # Levels travel with the names so selection can favour the tier the student
    # declared. skills_json still stores names only: the resume and history
    # responses return a plain list of skill names.
    skill_pairs = [(skill.name, skill.level) for skill in current_student.skills]
    if not skill_pairs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add at least one technical skill to your profile before starting an assessment.",
        )

    selected = select_assessment_questions(skill_pairs)
    attempt = SkillAssessmentAttempt(
        student_id=current_student.id,
        question_ids_json=json.dumps([question["id"] for question in selected]),
        skills_json=json.dumps([name for name, _level in skill_pairs]),
        total_questions=len(selected),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return SkillAssessmentStartResponse(
        attempt_id=attempt.id,
        skills=[name for name, _level in skill_pairs],
        questions=[
            SkillAssessmentQuestionResponse(
                id=question["id"],
                skill=question["skill"],
                level=question["level"],
                question=question["question"],
                options=question["options"],
            )
            for question in selected
        ],
    )


@router.get("/attempts/{attempt_id}", response_model=SkillAssessmentResumeResponse)
def get_assessment_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    attempt = _get_owned_attempt(db, attempt_id, current_student.id)
    if attempt.completed_at is not None:
        raise HTTPException(status_code=409, detail="This assessment attempt is already complete.")
    question_ids = json.loads(attempt.question_ids_json)
    questions: list[SkillAssessmentQuestionResponse] = []
    for question_id in question_ids:
        question = QUESTIONS_BY_ID.get(question_id)
        if question is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="This assessment contains an unavailable question.",
            )
        questions.append(
            SkillAssessmentQuestionResponse(
                id=question["id"],
                skill=question["skill"],
                level=question["level"],
                question=question["question"],
                options=question["options"],
            )
        )
    return SkillAssessmentResumeResponse(
        attempt_id=attempt.id,
        skills=json.loads(attempt.skills_json),
        questions=questions,
        answers=json.loads(attempt.answers_json) if attempt.answers_json else {},
    )


@router.patch("/attempts/{attempt_id}/answers", status_code=status.HTTP_204_NO_CONTENT)
def save_assessment_draft(
    attempt_id: int,
    payload: SkillAssessmentDraft,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    attempt = _get_owned_attempt(db, attempt_id, current_student.id)
    if attempt.completed_at is not None:
        raise HTTPException(status_code=409, detail="This assessment attempt is already complete.")
    question_ids = json.loads(attempt.question_ids_json)
    saved: dict[str, str] = (
        json.loads(attempt.answers_json) if attempt.answers_json else {}
    )
    saved.update(_validate_answers(payload.answers, question_ids))
    attempt.answers_json = json.dumps(saved)
    db.commit()


@router.post("/attempts/{attempt_id}/submit", response_model=SkillAssessmentAttemptResponse)
def submit_assessment(
    attempt_id: int,
    payload: SkillAssessmentSubmit,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    attempt = _get_owned_attempt(db, attempt_id, current_student.id)
    if attempt.completed_at is not None:
        raise HTTPException(status_code=409, detail="This assessment attempt is already complete.")

    expected_ids = json.loads(attempt.question_ids_json)
    submitted = _validate_answers(payload.answers, expected_ids)
    if set(submitted) != set(expected_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Submit one answer for every question in this assessment.",
        )

    correct_answers = 0
    for question_id in expected_ids:
        question = QUESTIONS_BY_ID[question_id]
        if submitted[question_id] == question["answer"]:
            correct_answers += 1

    attempt.answers_json = json.dumps(submitted)
    attempt.correct_answers = correct_answers
    attempt.score = round(correct_answers * 100 / len(expected_ids))
    attempt.completed_at = utcnow()
    db.commit()
    db.refresh(attempt)
    return _to_response(attempt)


@router.get("/attempts", response_model=list[SkillAssessmentAttemptResponse])
def list_assessment_attempts(
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    attempts = (
        db.query(SkillAssessmentAttempt)
        .filter(SkillAssessmentAttempt.student_id == current_student.id)
        .order_by(SkillAssessmentAttempt.created_at.desc())
        .limit(20)
        .all()
    )
    return [_to_response(attempt) for attempt in attempts]
