import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Value shipped in .env.example. Copying the example file verbatim leaves the
# signing key public, so it is reported loudly at startup rather than silently
# accepted. It is a warning rather than a hard failure so an untouched local
# checkout still starts.
_PLACEHOLDER_SECRET = "replace-with-a-long-random-secret"
_MIN_SECRET_LENGTH = 32


def get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY")
    if not secret:
        raise RuntimeError(
            "JWT_SECRET_KEY is not set. Create a backend/.env file with a "
            "long random value before starting the API."
        )
    if secret == _PLACEHOLDER_SECRET:
        logger.warning(
            "JWT_SECRET_KEY is still the placeholder from .env.example. "
            "Generate a real secret, for example: "
            "python -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
    elif len(secret) < _MIN_SECRET_LENGTH:
        logger.warning(
            "JWT_SECRET_KEY is only %d characters long; use at least %d.",
            len(secret),
            _MIN_SECRET_LENGTH,
        )
    return secret
