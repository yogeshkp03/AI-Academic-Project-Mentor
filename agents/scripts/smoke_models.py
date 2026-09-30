"""Probe LLM models with a trivial one-token request.

With no arguments it probes the configured tier models (GEMINI_MODEL,
GROQ_MODEL, GROQ_LIGHT_MODEL plus any MODEL_<AGENT_KEY> overrides), so you can
tell in seconds whether a crew run will get past its first agent. Pass model
IDs to probe candidates instead:

    uv run python scripts/smoke_models.py
    uv run python scripts/smoke_models.py gemini/gemini-3.8-flash groq/openai/gpt-oss-120b

Exits 1 if any probed model fails.
"""

import os
import sys
from pathlib import Path

import litellm
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

CONFIG_KEYS = (
    "GEMINI_MODEL",
    "GROQ_MODEL",
    "GROQ_LIGHT_MODEL",
    "MODEL_FEASIBILITY",
    "MODEL_ARCHITECT",
    "MODEL_SCOPE",
    "MODEL_TIMELINE",
    "MODEL_RESOURCE",
    "MODEL_UI_UX",
    "MODEL_PLANNING",
    "MODEL_PROFESSOR",
)


def configured_models() -> list[str]:
    return sorted({os.environ[key] for key in CONFIG_KEYS if os.environ.get(key)})


def probe(model: str) -> bool:
    try:
        response = litellm.completion(
            model=model,
            messages=[{"role": "user", "content": "Reply with exactly: ok"}],
            max_tokens=256,
            temperature=0,
            timeout=30,
            num_retries=1,
        )
        print(f"OK   {model} -> {response.choices[0].message.content!r}")
        return True
    except Exception as error:
        print(f"FAIL {model} -> {type(error).__name__}: {str(error)[:400]}")
        return False


def main() -> int:
    models = sys.argv[1:] or configured_models()
    if not models:
        print("No models passed and none configured in .env")
        return 1
    failures = sum(not probe(model) for model in models)
    print(f"{len(models) - failures}/{len(models)} models answered")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
