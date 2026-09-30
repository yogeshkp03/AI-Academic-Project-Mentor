import hashlib
import hmac
import secrets
from datetime import timedelta

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.rate_limit import auth_rate_limiter, client_key
from app.core.config import get_jwt_secret
from app.database.database import get_db, utcnow
from app.models.student import Student
from app.schemas.student import StudentCreate, StudentLogin, StudentResponse, StudentUpdate, TokenResponse

router = APIRouter(prefix="/students", tags=["Students"])
security = HTTPBearer()
SECRET_KEY = get_jwt_secret()
ALGORITHM = "HS256"

LEGACY_SALT = b"ai-project-mentor"
PBKDF2_ITERATIONS = 100000

# Verified against when no student matches, so a login attempt for an unknown
# email costs the same as one for a known email. Without this the response
# time alone reveals which addresses are registered.
_DUMMY_HASH_PARTS = ("pbkdf2_sha256", "00" * 16, "00" * 32)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${salt.hex()}${digest.hex()}"


def _derive(password: str, salt_hex: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        PBKDF2_ITERATIONS,
    ).hex()


def _verify_legacy(password: str, stored: str) -> bool:
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), LEGACY_SALT, PBKDF2_ITERATIONS
    )
    return secrets.compare_digest(digest.hex(), stored)


def _is_legacy_hash(stored: str) -> bool:
    return bool(stored) and "pbkdf2_sha256$" not in stored


def verify_password(password: str, stored: str) -> bool:
    # A missing or truncated hash is treated as a failed verification rather
    # than allowed to raise. Rows backfilled by the schema migration carry an
    # empty password_hash, and an exception here would surface as a 500 that
    # locks the account out permanently.
    if not _is_legacy_hash(stored):
        parts = stored.split("$", 2)
        if len(parts) != 3:
            return False
        try:
            digest = _derive(password, parts[1])
        except ValueError:
            return False
        return secrets.compare_digest(digest, parts[2])
    return _verify_legacy(password, stored)


def hash_token(token: str) -> str:
    """Store a digest of the session token, never the token itself.

    A database leak then yields no directly usable credential, and the digest is
    fixed-length so it fits the column for every email length.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _token_matches(student: Student, presented: str) -> bool:
    """Compare a presented token against the stored digest.

    Falls back to a raw comparison so sessions issued before digests were
    stored keep working; the first login rewrites the row in digest form.
    """
    stored = student.auth_token
    if not stored:
        return False
    if len(stored) == 64:
        return hmac.compare_digest(stored, hash_token(presented))
    return hmac.compare_digest(stored, presented)


def create_access_token(student_id: int, email: str) -> str:
    now = utcnow()
    expires_at = now + timedelta(hours=12)
    payload = {
        "sub": str(student_id),
        "email": email,
        "jti": secrets.token_hex(8),
        "iat": now,
        "exp": expires_at,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)  # pyright: ignore[reportUnknownMemberType]


def get_current_student(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Student:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])  # pyright: ignore[reportUnknownMemberType]
        student_id = int(payload["sub"])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Student not found for this token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Single active session per student: only the most recently issued token is
    # valid. A missing auth_token means the student logged out (or never
    # logged in) and the presented token must be rejected.
    if not student.auth_token or not _token_matches(student, credentials.credentials):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been replaced or ended. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return student


@router.post("/register", response_model=StudentResponse)
def register_student(
    student: StudentCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    auth_rate_limiter.check(client_key(request))
    existing = db.query(Student).filter(Student.email == student.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A student with this email already exists.",
        )

    new_student = Student(
        name=student.name.strip(),
        email=student.email.lower(),
        password_hash=hash_password(student.password),
        department=student.department,
        semester=student.semester,
        interests=student.interests,
        programming_languages=student.programming_languages,
        frameworks=student.frameworks,
        databases=student.databases,
        ai_ml_skills=student.ai_ml_skills,
        cloud_devops_skills=student.cloud_devops_skills,
        cybersecurity_skills=student.cybersecurity_skills,
        skill_level=student.skill_level,
    )

    db.add(new_student)
    try:
        db.commit()
    except IntegrityError:
        # Another request registered the same address between the check above
        # and this insert. Losing that race is a normal 400, not a 500.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A student with this email already exists.",
        )
    db.refresh(new_student)
    return new_student


@router.post("/login", response_model=TokenResponse)
def login_student(
    student_login: StudentLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    auth_rate_limiter.check(client_key(request))
    email = student_login.email.lower().strip()
    db_student = db.query(Student).filter(Student.email == email).first()
    if db_student is None:
        # Spend the same password-hashing work as a real attempt. Returning
        # early here would make the response time alone reveal which addresses
        # are registered, defeating the generic error message below.
        verify_password(
            student_login.password,
            "$".join(_DUMMY_HASH_PARTS),
        )
    if not db_student or not verify_password(
        student_login.password, db_student.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(db_student.id, db_student.email)
    if _is_legacy_hash(db_student.password_hash):
        # Upgrade legacy fixed-salt hashes to a fresh per-user salt on first
        # successful login so the stored format is uniformly strong going forward.
        db_student.password_hash = hash_password(student_login.password)
    db_student.auth_token = hash_token(token)
    db.commit()

    return {
        "token": token,
        "student": {
            "id": db_student.id,
            "name": db_student.name,
            "email": db_student.email,
            "department": db_student.department,
            "semester": db_student.semester,
            "interests": db_student.interests,
            "programming_languages": db_student.programming_languages,
            "frameworks": db_student.frameworks,
            "databases": db_student.databases,
            "ai_ml_skills": db_student.ai_ml_skills,
            "cloud_devops_skills": db_student.cloud_devops_skills,
            "cybersecurity_skills": db_student.cybersecurity_skills,
            "skill_level": db_student.skill_level,
        },
    }


@router.post("/logout")
def logout_student(
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    current_student.auth_token = None
    db.commit()
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=StudentResponse)
def get_current_student_profile(current_student: Student = Depends(get_current_student)):
    return current_student


@router.patch("/me", response_model=StudentResponse)
def update_current_student_profile(
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    if payload.name is not None:
        current_student.name = payload.name.strip()
    if payload.department is not None:
        current_student.department = payload.department.strip()
    if payload.semester is not None:
        current_student.semester = payload.semester
    db.commit()
    db.refresh(current_student)
    return current_student


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    if student_id != current_student.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own student profile.",
        )

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found.",
        )
    return student


@router.get("/", response_model=list[StudentResponse])
def list_students(
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    return db.query(Student).filter(Student.id == current_student.id).all()