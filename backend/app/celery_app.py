import os

from celery import Celery
from dotenv import load_dotenv

load_dotenv()
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
CELERY_TASK_SOFT_TIME_LIMIT = int(os.getenv("CELERY_TASK_SOFT_TIME_LIMIT", "3660"))
CELERY_TASK_TIME_LIMIT = int(os.getenv("CELERY_TASK_TIME_LIMIT", "3720"))
REDIS_VISIBILITY_TIMEOUT = int(os.getenv("REDIS_VISIBILITY_TIMEOUT", "3900"))

celery_app = Celery(
    "academic_mentor",
    broker=REDIS_URL,
    include=["app.tasks"],
)
celery_app.conf.update(
    accept_content=["json"],
    task_serializer="json",
    result_serializer="json",
    task_ignore_result=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    task_soft_time_limit=CELERY_TASK_SOFT_TIME_LIMIT,
    task_time_limit=CELERY_TASK_TIME_LIMIT,
    broker_transport_options={"visibility_timeout": REDIS_VISIBILITY_TIMEOUT},
    beat_schedule={
        "recover-analysis-runs": {
            "task": "app.tasks.recover_analysis_runs",
            "schedule": 60.0,
        },
        "expire-mentor-appeals": {
            "task": "app.tasks.expire_mentor_appeals",
            "schedule": 60.0,
        },
    },
)
