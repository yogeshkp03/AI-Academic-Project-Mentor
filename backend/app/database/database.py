import os
from datetime import datetime, timezone

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine.interfaces import DBAPIConnection, PoolProxiedConnection
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./academic_mentor.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    future=True,
)


def _enable_sqlite_pragmas(
    dbapi_connection: DBAPIConnection,
    connection_record: PoolProxiedConnection,
) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def utcnow() -> datetime:
    """Naive UTC timestamp, matching what datetime.utcnow() used to return.

    The DateTime columns store naive values, so an aware datetime here would
    make freshly computed timestamps incomparable with the ones read back.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


if DATABASE_URL.startswith("sqlite"):
    event.listen(engine, "connect", _enable_sqlite_pragmas)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)

Base = declarative_base()

# Created on both fresh databases (via models) and existing ones (via
# upgrade_existing_schema below).
INDEX_DDL = [
    "CREATE INDEX IF NOT EXISTS ix_agent_runs_project_agent ON agent_runs (project_id, agent_type)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_agent_runs_version ON agent_runs (project_id, agent_type, version)",
    "CREATE INDEX IF NOT EXISTS ix_conversations_student_project ON conversations (student_id, project_id)",
    "CREATE INDEX IF NOT EXISTS ix_chat_messages_conversation_created ON chat_messages (conversation_id, created_at)",
]


def upgrade_existing_schema():
    """Add columns introduced after the original SQLite database was created."""
    column_defaults = {
        "students": {
            "password_hash": "TEXT NOT NULL DEFAULT ''",
            "auth_token": "TEXT",
            "created_at": "DATETIME",
            "updated_at": "DATETIME",
        },
        "projects": {
            "ai_report": "TEXT",
            "technology_stack": "TEXT",
            "duration": "TEXT",
            "created_at": "DATETIME",
            "updated_at": "DATETIME",
        },
        "chat_messages": {
            "conversation_id": "INTEGER",
        },
        "agent_runs": {
            "version": "INTEGER NOT NULL DEFAULT 1",
            "is_active": "INTEGER NOT NULL DEFAULT 1",
            "token_usage": "TEXT",
            "cost": "FLOAT",
            "duration_ms": "INTEGER",
        },
    }

    with engine.begin() as connection:
        inspector = inspect(connection)
        existing_tables = set(inspector.get_table_names())
        for table_name, columns in column_defaults.items():
            if table_name not in existing_tables:
                continue
            existing_columns = {
                column["name"] for column in inspector.get_columns(table_name)
            }
            for column_name, definition in columns.items():
                if column_name not in existing_columns:
                    connection.execute(
                        text(
                            f"ALTER TABLE {table_name} "
                            f"ADD COLUMN {column_name} {definition}"
                        )
                    )
        for statement in INDEX_DDL:
            table_name = statement.split(" ON ", 1)[1].split(" ", 1)[0]
            if table_name in existing_tables:
                connection.execute(text(statement))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()