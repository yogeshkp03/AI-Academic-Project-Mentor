import argparse

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.faculty import Faculty


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Review pending faculty sign-ups and approve trusted accounts."
    )
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument(
        "--list-pending",
        action="store_true",
        help="List faculty accounts awaiting approval.",
    )
    actions.add_argument(
        "--approve",
        metavar="EMAIL",
        help="Approve the faculty account with this email.",
    )
    args = parser.parse_args()

    db: Session = SessionLocal()
    faculty_table = Faculty.__table__
    try:
        if args.list_pending:
            pending = db.execute(
                select(faculty_table)
                .where(faculty_table.c.is_approved.is_(False))
                .order_by(faculty_table.c.created_at.asc())
            ).mappings().all()
            if not pending:
                print("No faculty accounts are awaiting approval.")
                return 0
            for faculty in pending:
                print(
                    f"{faculty['email']}\t{faculty['name']}\t{faculty['department']}"
                )
            return 0

        email = args.approve.strip().casefold()
        faculty = db.execute(
            select(
                faculty_table.c.id,
                faculty_table.c.email,
                faculty_table.c.is_approved,
            )
            .where(faculty_table.c.email == email)
        ).mappings().first()
        if faculty is None:
            print("No faculty account with that email was found.")
            return 1
        if faculty["is_approved"]:
            print(f"{faculty['email']} is already approved.")
            return 0
        db.execute(
            update(faculty_table)
            .where(faculty_table.c.id == faculty["id"])
            .values(is_approved=True)
        )
        db.commit()
        print(f"Approved faculty account for {faculty['email']}.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
