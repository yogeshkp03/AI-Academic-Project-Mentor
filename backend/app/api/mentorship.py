import hmac
import os
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.api.faculty import get_current_faculty
from app.api.student import get_current_student
from app.database.database import get_db, utcnow
from app.models.faculty import Faculty
from app.models.mentor_appeal import MentorAppeal
from app.models.skill_assessment import SkillAssessmentAttempt
from app.models.student import Student
from app.schemas.mentor_appeal import (
    FacultyMentorProfile,
    GoogleFormsMentorAppeal,
    MentorAppealCreate,
    MentorAppealDecision,
    MentorAppealFacultyView,
    MentorAppealStudentView,
)

router = APIRouter(tags=["Mentorship"])
APPEAL_RESPONSE_WINDOW = timedelta(days=7)


def _expire_pending(db: Session) -> None:
    now = utcnow()
    db.query(MentorAppeal).filter(
        MentorAppeal.status == "pending",
        MentorAppeal.expires_at <= now,
    ).update(
        {MentorAppeal.status: "expired"},
        synchronize_session=False,
    )


def _faculty_profile(faculty: Faculty) -> FacultyMentorProfile:
    return FacultyMentorProfile(
        id=faculty.id,
        name=faculty.name,
        department=faculty.department,
        mentor_expertise=faculty.mentor_expertise,
    )


def _create_appeal(
    db: Session,
    student: Student,
    faculty_id: int,
    course_area: str,
    project_idea: str,
    message: str,
    submission_id: str | None = None,
) -> MentorAppeal:
    if submission_id:
        existing_submission = (
            db.query(MentorAppeal)
            .filter(MentorAppeal.google_form_submission_id == submission_id)
            .first()
        )
        if existing_submission is not None:
            if (
                existing_submission.student_id != student.id
                or existing_submission.faculty_id != faculty_id
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The Google Forms submission ID was already used.",
                )
            return existing_submission
    now = utcnow()
    _expire_pending(db)
    active_mentor = (
        db.query(MentorAppeal)
        .filter(
            MentorAppeal.student_id == student.id,
            MentorAppeal.status == "accepted",
        )
        .first()
    )
    if active_mentor is not None:
        raise HTTPException(status_code=409, detail="You already have an active faculty mentor.")
    pending_count = (
        db.query(MentorAppeal)
        .filter(
            MentorAppeal.student_id == student.id,
            MentorAppeal.status == "pending",
        )
        .count()
    )
    if pending_count >= 3:
        raise HTTPException(status_code=409, detail="You already have three pending mentorship requests.")
    faculty = (
        db.query(Faculty)
        .filter(
            Faculty.id == faculty_id,
            Faculty.is_approved.is_(True),
            Faculty.is_mentor_available.is_(True),
        )
        .first()
    )
    if faculty is None:
        raise HTTPException(
            status_code=404,
            detail="This faculty member is no longer accepting mentorship requests.",
        )
    duplicate = (
        db.query(MentorAppeal)
        .filter(
            MentorAppeal.student_id == student.id,
            MentorAppeal.faculty_id == faculty.id,
            MentorAppeal.status == "pending",
        )
        .first()
    )
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="You already have a pending request to this faculty member.")
    appeal = MentorAppeal(
        student_id=student.id,
        faculty_id=faculty.id,
        course_area=course_area.strip(),
        project_idea=project_idea.strip(),
        message=message.strip(),
        status="pending",
        submitted_at=now,
        expires_at=now + APPEAL_RESPONSE_WINDOW,
        profile_consent_at=now,
        google_form_submission_id=submission_id,
    )
    db.add(appeal)
    db.commit()
    db.refresh(appeal)
    return appeal


def _student_appeal_view(
    appeal: MentorAppeal, faculty: Faculty
) -> MentorAppealStudentView:
    return MentorAppealStudentView(
        id=appeal.id,
        faculty=_faculty_profile(faculty),
        course_area=appeal.course_area,
        project_idea=appeal.project_idea,
        message=appeal.message,
        status=appeal.status,
        submitted_at=appeal.submitted_at,
        expires_at=appeal.expires_at,
        responded_at=appeal.responded_at,
        rejection_reason=appeal.rejection_reason,
    )


@router.get(
    "/mentorship/available-faculty",
    response_model=list[FacultyMentorProfile],
)
def list_available_mentors(
    db: Session = Depends(get_db),
    _current_student: Student = Depends(get_current_student),
) -> list[FacultyMentorProfile]:
    _ = _current_student
    faculty_rows = (
        db.query(Faculty)
        .filter(
            Faculty.is_approved.is_(True),
            Faculty.is_mentor_available.is_(True),
        )
        .order_by(Faculty.name.asc())
        .all()
    )
    return [_faculty_profile(faculty) for faculty in faculty_rows]


@router.post(
    "/mentorship/student-appeals",
    response_model=MentorAppealStudentView,
    status_code=status.HTTP_201_CREATED,
)
def create_mentor_appeal(
    payload: MentorAppealCreate,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
) -> MentorAppealStudentView:
    if not payload.share_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent to share your profile, skills, and assessment score is required.",
        )
    faculty = db.query(Faculty).filter(Faculty.id == payload.faculty_id).first()
    if faculty is None:
        raise HTTPException(status_code=404, detail="Faculty not found.")
    appeal = _create_appeal(
        db,
        current_student,
        faculty.id,
        payload.course_area,
        payload.project_idea,
        payload.message,
    )
    return _student_appeal_view(appeal, faculty)


@router.post(
    "/integrations/google-forms/mentor-appeals",
    response_model=MentorAppealStudentView,
    status_code=status.HTTP_201_CREATED,
)
def receive_google_form_appeal(
    payload: GoogleFormsMentorAppeal,
    webhook_secret: str | None = Header(default=None, alias="X-Google-Forms-Secret"),
    db: Session = Depends(get_db),
) -> MentorAppealStudentView:
    expected_secret = os.getenv("GOOGLE_FORMS_WEBHOOK_SECRET", "")
    if not expected_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Forms appeal integration is not configured.",
        )
    if not webhook_secret or not hmac.compare_digest(webhook_secret, expected_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google Forms integration credentials.",
        )
    if not payload.share_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The student must consent to share their profile before submitting.",
        )
    student = (
        db.query(Student)
        .filter(Student.email == str(payload.student_email).strip().casefold())
        .first()
    )
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No student account matches the Google Forms email.",
        )
    appeal = _create_appeal(
        db,
        student,
        payload.faculty_id,
        payload.course_area,
        payload.project_idea,
        payload.message,
        payload.submission_id,
    )
    faculty = db.query(Faculty).filter(Faculty.id == appeal.faculty_id).one()
    return _student_appeal_view(appeal, faculty)


@router.get(
    "/mentorship/student-appeals",
    response_model=list[MentorAppealStudentView],
)
def list_student_mentor_appeals(
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
) -> list[MentorAppealStudentView]:
    _expire_pending(db)
    db.commit()
    appeals = (
        db.query(MentorAppeal)
        .filter(MentorAppeal.student_id == current_student.id)
        .order_by(MentorAppeal.submitted_at.desc())
        .all()
    )
    faculty_by_id = {
        faculty.id: faculty
        for faculty in db.query(Faculty)
        .filter(Faculty.id.in_({appeal.faculty_id for appeal in appeals}))
        .all()
    } if appeals else {}
    return [
        MentorAppealStudentView(
            id=appeal.id,
            faculty=_faculty_profile(faculty_by_id[appeal.faculty_id]),
            course_area=appeal.course_area,
            project_idea=appeal.project_idea,
            message=appeal.message,
            status=appeal.status,
            submitted_at=appeal.submitted_at,
            expires_at=appeal.expires_at,
            responded_at=appeal.responded_at,
            rejection_reason=appeal.rejection_reason,
        )
        for appeal in appeals
    ]


@router.get(
    "/mentorship/faculty-appeals",
    response_model=list[MentorAppealFacultyView],
)
def list_faculty_mentor_appeals(
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty),
) -> list[MentorAppealFacultyView]:
    _expire_pending(db)
    db.commit()
    appeals = (
        db.query(MentorAppeal)
        .filter(MentorAppeal.faculty_id == current_faculty.id)
        .order_by(MentorAppeal.submitted_at.desc())
        .all()
    )
    if not appeals:
        return []

    students = {
        student.id: student
        for student in db.query(Student)
        .filter(Student.id.in_({appeal.student_id for appeal in appeals}))
        .all()
    }
    assessments = (
        db.query(SkillAssessmentAttempt)
        .filter(
            SkillAssessmentAttempt.student_id.in_(
                {appeal.student_id for appeal in appeals}
            ),
            SkillAssessmentAttempt.completed_at.is_not(None),
        )
        .order_by(SkillAssessmentAttempt.completed_at.desc())
        .all()
    )
    latest_assessment: dict[int, SkillAssessmentAttempt] = {}
    for attempt in assessments:
        latest_assessment.setdefault(attempt.student_id, attempt)

    result: list[MentorAppealFacultyView] = []
    for appeal in appeals:
        student = students[appeal.student_id]
        assessment = latest_assessment.get(student.id)
        result.append(
            MentorAppealFacultyView(
                id=appeal.id,
                student_name=student.name,
                student_email=student.email,
                student_department=student.department,
                student_semester=student.semester,
                student_skills=[
                    {"name": skill.name, "level": skill.level}
                    for skill in student.skills
                ],
                assessment_score=assessment.score if assessment else None,
                assessment_correct_answers=(
                    assessment.correct_answers if assessment else None
                ),
                assessment_total_questions=(
                    assessment.total_questions if assessment else None
                ),
                assessment_completed_at=(
                    assessment.completed_at if assessment else None
                ),
                course_area=appeal.course_area,
                project_idea=appeal.project_idea,
                message=appeal.message,
                status=appeal.status,
                submitted_at=appeal.submitted_at,
                expires_at=appeal.expires_at,
                responded_at=appeal.responded_at,
                rejection_reason=appeal.rejection_reason,
            )
        )
    return result


@router.put(
    "/mentorship/faculty-appeals/{appeal_id}/decision",
    response_model=MentorAppealFacultyView,
)
def decide_mentor_appeal(
    appeal_id: int,
    payload: MentorAppealDecision,
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty),
) -> MentorAppealFacultyView:
    now = utcnow()
    _expire_pending(db)
    appeal = (
        db.query(MentorAppeal)
        .filter(
            MentorAppeal.id == appeal_id,
            MentorAppeal.faculty_id == current_faculty.id,
        )
        .with_for_update()
        .first()
    )
    if appeal is None:
        raise HTTPException(status_code=404, detail="Mentorship request not found.")
    if appeal.status == "expired":
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This mentorship request has expired.",
        )
    if appeal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This mentorship request has already been resolved.",
        )
    reason = (payload.rejection_reason or "").strip()
    if payload.decision == "reject" and len(reason) < 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide a rejection reason of at least 5 characters.",
        )

    if payload.decision == "accept":
        locked_student = (
            db.query(Student)
            .filter(Student.id == appeal.student_id)
            .with_for_update()
            .first()
        )
        if locked_student is None:
            raise HTTPException(status_code=404, detail="Student account not found.")
        accepted_elsewhere = (
            db.query(MentorAppeal)
            .filter(
                MentorAppeal.student_id == appeal.student_id,
                MentorAppeal.status == "accepted",
            )
            .with_for_update()
            .first()
        )
        if accepted_elsewhere:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The student already has an active mentor.",
            )
        appeal.status = "accepted"
        appeal.rejection_reason = None
        db.query(MentorAppeal).filter(
            MentorAppeal.student_id == appeal.student_id,
            MentorAppeal.id != appeal.id,
            MentorAppeal.status == "pending",
        ).update(
            {
                MentorAppeal.status: "closed",
                MentorAppeal.responded_at: now,
            },
            synchronize_session=False,
        )
    else:
        appeal.status = "rejected"
        appeal.rejection_reason = reason
    appeal.responded_at = now
    db.commit()
    db.refresh(appeal)
    student = db.query(Student).filter(Student.id == appeal.student_id).one()
    assessment = (
        db.query(SkillAssessmentAttempt)
        .filter(
            SkillAssessmentAttempt.student_id == student.id,
            SkillAssessmentAttempt.completed_at.is_not(None),
        )
        .order_by(SkillAssessmentAttempt.completed_at.desc())
        .first()
    )
    return MentorAppealFacultyView(
        id=appeal.id,
        student_name=student.name,
        student_email=student.email,
        student_department=student.department,
        student_semester=student.semester,
        student_skills=[
            {"name": skill.name, "level": skill.level} for skill in student.skills
        ],
        assessment_score=assessment.score if assessment else None,
        assessment_correct_answers=assessment.correct_answers if assessment else None,
        assessment_total_questions=assessment.total_questions if assessment else None,
        assessment_completed_at=assessment.completed_at if assessment else None,
        course_area=appeal.course_area,
        project_idea=appeal.project_idea,
        message=appeal.message,
        status=appeal.status,
        submitted_at=appeal.submitted_at,
        expires_at=appeal.expires_at,
        responded_at=appeal.responded_at,
        rejection_reason=appeal.rejection_reason,
    )
