# Project Feasibility AI API

FastAPI service that sends a project idea through a CrewAI workflow
(feasibility -> architecture -> scope -> timeline -> UI/UX -> execution plan
-> professor QA -> learning resources) and returns a Markdown feasibility report.
Also serves follow-up chat via an AI mentor or any individual specialist agent.

## Setup

1. Create and activate a Python 3.13+ virtual environment:

   ```powershell
   uv sync
   ```

2. Copy `.env.example` to `.env` and set at least one provider key:
   - `GEMINI_API_KEY` (feasibility, architect, resource by default)
   - `GROQ_API_KEY` (used by the structural and formatting agents by default)

   Either key alone works: an agent whose model belongs to a provider with no
   key is transparently moved to the configured one.

   The seven core analysis tasks finish before the separate Resource Agent starts.
   The resource call has a shorter timeout (`RESOURCE_LLM_TIMEOUT_SECONDS`, default
   30 seconds), no LLM retries, one agent iteration, and bounded search requests.
   If it still fails, the combined report completes with a clear resource
   verification note instead of rerunning or failing the core analysis.

### Models

Each agent runs its own model, so one crew run spreads across providers
instead of draining a single free-tier quota. Defaults (override per agent
with `MODEL_<AGENT_KEY>`, or per provider with the three knobs):

| Tier | Agents | Default model |
| --- | --- | --- |
| Quality / tool calling | feasibility, architect, resource | `GEMINI_MODEL` (`gemini/gemini-3.5-flash-lite`) |
| Sequencing | timeline, planning | `GROQ_MODEL` (`groq/openai/gpt-oss-120b`, 8k TPM cap) |
| Formatting | scope, ui_ux, professor | `GROQ_LIGHT_MODEL` (`groq/openai/gpt-oss-20b`) |

`GET /health` reports the active model for every agent. A run that fails
retries as a Groq-only plan, then a Gemini-only plan (both keep the tier shape
so no single model exceeds its rate limits).

   Configure `AGENTS_API_TOKEN` and the matching backend
   `AI_SERVICE_API_KEY`; the backend sends the token in `X-Agents-Token`.
   Set `APP_ENV=production` on deployment so startup fails if the token is
   missing. Keep this API on a private network.
   Configure `BACKEND_PROGRESS_URL` and `BACKEND_PROGRESS_TOKEN` to report
   each completed agent step to the backend. The backend must have the matching
   `AGENTS_PROGRESS_TOKEN`.

## Run

```powershell
uvicorn main:app --host 127.0.0.1 --port 8001
```

The API is available at `http://127.0.0.1:8001` (the backend expects it here
by default; configure with `AGENTS_BASE_URL` in `backend/.env`).

### Analyze a project idea

```json
{
  "idea": "A mobile app for local volunteering"
}
```

`POST /api/analyze` returns the full blueprint report. Identical ideas are
served from an in-memory TTL cache (1 hour) to avoid re-billing the LLMs;
the response includes an `analysis_id`.
Backend-triggered requests also include a persistent run ID and attempt token;
the agents service uses them only to send authenticated step progress to the
backend and does not own run persistence.

### Chat about a blueprint

`POST /api/chat` with fields: `project_idea`, `project_title`,
`project_blueprint` (the report from `/api/analyze`), `analysis_id`, the
`chat_history` accumulated so far, and `question`.

### Propose a project plan adjustment

The authenticated `POST /api/plans/adjust` endpoint accepts project context, a
saved weekly check-in, and the current milestone snapshot. It returns a
structured rationale and proposed remaining milestones. The backend persists
the proposal and applies it only after the student approves it; completed
milestones are preserved.

### Health check

`GET /health` reports provider availability and cache size (no auth needed).

## CLI

```powershell
uv run python main.py "A mobile app for local volunteering"
```

Analyzes the idea, prints the blueprint, then starts an interactive Q&A
session about it (type `exit` to quit).

## Tests

```powershell
uv sync --extra dev
uv run pytest
```

All tests run with `pytest-timeout` (60s cap) and mocking; no live API keys
or network are required.

### Live smoke tests

`scripts/` holds two tools that DO call real providers (keys in `.env`):

```powershell
uv run python scripts/smoke_models.py                          # do the configured tier models answer?
uv run python scripts/smoke_models.py gemini/gemini-3.8-flash  # probe candidate model IDs instead
uv run python scripts/e2e_analyze.py --health-only             # print providers + tier plan, spend nothing
uv run python scripts/e2e_analyze.py                           # full live /api/analyze run (~2 min, one crew run's tokens)
```

Exit code 1 means a probe or the run failed; use `smoke_models.py` after any
`GEMINI_MODEL`/`GROQ_MODEL` change to catch a retired or flaky model ID before
burning a full run on it.