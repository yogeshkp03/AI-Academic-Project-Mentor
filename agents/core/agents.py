import logging
import os
import threading
from typing import Any

from crewai import Agent, LLM
from crewai.utilities.types import LLMMessage
from dotenv import load_dotenv

from core.tools import internet_search_tool

logger = logging.getLogger(__name__)

# Load configuration from the local .env file, but never let the repo's
# .env override credentials already provided by the real environment.
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Model identifiers are configurable so they can be updated without a code
# change if a provider renames its catalog entry.
#
# GEMINI_MODEL and GROQ_MODEL are the provider-wide models: the Gemini tier
# default, the model a Gemini-only plan forces every agent onto, and the model
# a Groq-only plan uses for agents that are not already on Groq's heavy tier.
#
# Verified with live calls on 2026-09-30:
#   - groq/llama-3.3-70b-versatile and groq/llama-3.1-8b-instant were shut down
#     by Groq on 2026-08-16 (their replacement openai/gpt-oss-20b answers);
#   - gemini/gemini-2.5-flash returns 404 "no longer available to new users";
#   - gemini/gemini-3.8-flash answers but 503s on "high demand" often enough to
#     kill a run at its first agent, so flash-lite (a separate per-model quota
#     bucket, and this project's proven workhorse) stays the default.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini/gemini-3.5-flash-lite")
# Groq's free tier caps gpt-oss-120b at 8,000 tokens per minute, which a
# full 8-agent run on that one model cannot fit, so only the heavy tier uses it.
GROQ_MODEL = os.getenv("GROQ_MODEL", "groq/openai/gpt-oss-120b")
GROQ_LIGHT_MODEL = os.getenv("GROQ_LIGHT_MODEL", "groq/openai/gpt-oss-20b")

# One crew run spreads across three tiers:
#   - quality/tool agents (feasibility, architect, resource) stay on Gemini for
#     its reliable function calling and large context for raw search results;
#   - the sequencing agents (timeline, planning) run on the large Groq model;
#   - the formatting agents (scope, ui_ux, professor) run on the small Groq
#     model.
# This cuts Gemini usage from six calls per run to three and keeps the heavy
# Groq model inside its TPM budget, which is what lets a free-tier daily bucket
# survive many runs. Every entry is overridable with MODEL_<AGENT_KEY> (e.g.
# MODEL_UI_UX) in .env.
AGENT_MODEL_DEFAULTS: dict[str, str] = {
    "feasibility": GEMINI_MODEL,
    "architect": GEMINI_MODEL,
    "resource": GEMINI_MODEL,
    "timeline": GROQ_MODEL,
    "planning": GROQ_MODEL,
    "scope": GROQ_LIGHT_MODEL,
    "ui_ux": GROQ_LIGHT_MODEL,
    "professor": GROQ_LIGHT_MODEL,
}

# Structured/creative agents get a slightly higher temperature than the
# default.
AGENT_TEMPERATURES: dict[str, float] = {
    "timeline": 0.2,
    "planning": 0.2,
}

DEFAULT_TEMPERATURE = 0.1

# A hung provider otherwise holds a server worker thread for as long as the
# caller's HTTP client is willing to wait, which is long enough to exhaust the
# whole pool. Crew runs are sequential, so every step needs its own bound.
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "120"))

# Retries on the underlying litellm call. crewai's LLM has no max_retries field
# (passing one is silently discarded by pydantic); the supported route is
# additional_params, which crewai spreads into litellm.completion(...).
#
# Deliberately capped at 1: litellm cannot distinguish a daily-quota 429 — which
# resets at midnight Pacific and can never succeed however often it is retried —
# from an RPM/TPM 429 that a retry would fix. A larger budget would only burn
# wall-clock before the provider fallback in main.py takes over.
LLM_NUM_RETRIES = max(0, int(os.getenv("LLM_NUM_RETRIES", "1")))

# crewai marks the system prompt and the task prompt with its own prompt-caching
# marker (crewai/llms/cache.py). The provider-specific classes under crewai.llms
# drop that marker before sending; the legacy crewai.llm.LLM we construct here
# does not, so it reaches the provider verbatim. Groq's schema validator rejects
# any unknown property on a message — "property 'cache_breakpoint' is
# unsupported" — a 400 that never left the request builder, which is why the
# Groq fallback has never actually served a request.
_CACHE_BREAKPOINT_KEY = "cache_breakpoint"


class ProviderSafeLLM(LLM):
    """LLM that strips crewai's internal cache-breakpoint marker.

    Nothing this project talks to (Groq, Gemini through litellm) consumes the
    marker — it is read only by crewai's own Anthropic handler, which re-derives
    it from its own input — so removing it here costs no caching and is what
    makes the Groq provider reachable at all.
    """

    def _format_messages_for_provider(
        self, messages: list[LLMMessage]
    ) -> list[dict[str, str]]:
        formatted = super()._format_messages_for_provider(messages)
        return [
            {
                key: value
                for key, value in message.items()
                if key != _CACHE_BREAKPOINT_KEY
            }
            for message in formatted
        ]


def _make_llm(model: str, temperature: float, api_key: str | None) -> LLM:
    """Build a provider-routed LLM.

    crewai rewrites an LLM into a provider-specific class for providers it has
    one for (a gemini/ model becomes GeminiCompletion, which strips the marker
    in BaseLLM._format_messages anyway). Models it has no class for — every
    groq/ model — stay on crewai.llm.LLM and are the ones ProviderSafeLLM is
    here to protect.
    """
    return ProviderSafeLLM(
        model=model,
        temperature=temperature,
        api_key=api_key,
        timeout=LLM_TIMEOUT,
        additional_params={"num_retries": LLM_NUM_RETRIES},
    )


gemini_llm = _make_llm(GEMINI_MODEL, DEFAULT_TEMPERATURE, GEMINI_API_KEY)

# Fallback LLM used when a whole crew run has to retry on a single provider.
groq_llm = _make_llm(GROQ_MODEL, DEFAULT_TEMPERATURE, GROQ_API_KEY)

# One LLM per (model, temperature): agents that share a tier share an instance.
_llm_lock = threading.Lock()
_llm_cache: dict[tuple[str, float], LLM] = {
    (GEMINI_MODEL, DEFAULT_TEMPERATURE): gemini_llm,
    (GROQ_MODEL, DEFAULT_TEMPERATURE): groq_llm,
}


def _provider_of(model: str) -> str:
    return model.split("/", 1)[0]


def agent_model(key: str) -> str:
    """The model one agent runs on.

    MODEL_<AGENT_KEY> in .env wins over the tier default. A model whose
    provider has no API key is swapped for the other configured provider's
    model, so a one-provider configuration still runs every agent.
    """
    configured = os.getenv(f"MODEL_{key.upper()}") or AGENT_MODEL_DEFAULTS[key]
    provider = _provider_of(configured)
    if provider == "gemini" and not GEMINI_API_KEY and GROQ_API_KEY:
        return GROQ_MODEL
    if provider == "groq" and not GROQ_API_KEY and GEMINI_API_KEY:
        return GEMINI_MODEL
    return configured


def agent_llm(key: str, model: str | None = None) -> LLM:
    """Cached LLM for one agent, built from its model and temperature."""
    model = model or agent_model(key)
    temperature = AGENT_TEMPERATURES.get(key, DEFAULT_TEMPERATURE)
    cache_key = (model, temperature)
    with _llm_lock:
        llm = _llm_cache.get(cache_key)
        if llm is None:
            provider_key = GEMINI_API_KEY if _provider_of(model) == "gemini" else GROQ_API_KEY
            llm = _make_llm(model, temperature, provider_key)
            _llm_cache[cache_key] = llm
        return llm


def plan_models(provider: str | None = None) -> dict[str, str]:
    """The agent -> model map for one run.

    With no ``provider`` this is the normal tiered plan. A provider name
    forces every agent onto that provider — the tier shape is preserved, but
    agents whose model belongs to the other provider are moved to that
    provider's model (Gemini agents fall to the light Groq model, so a forced
    Groq plan never floods the heavy model's 8k TPM budget).
    """
    plan: dict[str, str] = {}
    for key in AGENT_MODEL_DEFAULTS:
        model = agent_model(key)
        if provider is not None and _provider_of(model) != provider:
            model = GROQ_LIGHT_MODEL if provider == "groq" else GEMINI_MODEL
        plan[key] = model
    return plan


def available_llms() -> tuple[str, ...]:
    """Names of the providers currently configured on this machine."""
    names: list[str] = []
    if GEMINI_API_KEY:
        names.append("gemini")
    if GROQ_API_KEY:
        names.append("groq")
    return tuple(names)


def fallback_llms() -> tuple[LLM, ...]:
    """Single-provider retry models, Groq first, skipping any without a key.

    Used both by chat (Groq carries the volume; Gemini is the fallback so the
    scarce per-model Gemini quota is not spent on the highest-frequency path)
    and by analysis retries after the tiered first attempt. Attempting an
    unconfigured provider only burns wall-clock time failing before the next
    level, so it is filtered out here.
    """
    providers: list[LLM] = []
    if GROQ_API_KEY:
        providers.append(groq_llm)
    if GEMINI_API_KEY:
        providers.append(gemini_llm)
    return tuple(providers)


def validate_llm_keys() -> None:
    """Fail fast with a clear message when no LLM provider is configured."""
    if not (GEMINI_API_KEY or GROQ_API_KEY):
        raise RuntimeError(
            "No LLM API key configured. Set GEMINI_API_KEY (or GOOGLE_API_KEY) "
            "and/or GROQ_API_KEY in agents/.env before starting the service."
        )


def quota_exhausted(error: Exception) -> bool:
    """True if the exception means the LLM key is out of quota / credits."""
    message = str(error) or ""
    status_code = getattr(error, "status_code", None)

    response = getattr(error, "response", None)
    if status_code is None and response is not None:
        status_code = getattr(response, "status_code", None)

    if status_code in (403, 409, 429):
        return True

    markers = (
        "429",
        "409",
        "403",
        "RESOURCE_EXHAUSTED",
        "quota",
        "Quota",
        "rate limit",
        "RATE_LIMIT",
        "rate_limit",
        "free_tier",
        "not enough quota",
        "quota exceeded",
        "daily limit",
        "Daily Limit",
        "limit exceeded",
        "PERMISSION_DENIED",
        "insufficient_quota",
        "insufficient quota",
    )
    return any(marker in message for marker in markers)


def _make_agent(
    *,
    role: str,
    goal: str,
    backstory: str,
    llm: Any | None = None,
    tools: list[Any] | None = None,
) -> Agent:
    """Build an agent with the project's standard tuning parameters."""
    return Agent(
        role=role,
        goal=goal,
        backstory=backstory,
        llm=llm or gemini_llm,
        tools=tools or [],
        allow_delegation=False,
        respect_context_window=True,
        max_iter=3,
        max_retry_limit=2,
    )


def _clone_agent(agent: Agent, llm: LLM) -> Agent:
    """Rebuild an agent with the same instructions but a different LLM."""
    return Agent(
        role=agent.role,
        goal=agent.goal,
        backstory=agent.backstory,
        llm=llm,
        tools=getattr(agent, "tools", None) or [],
        allow_delegation=False,
        respect_context_window=True,
        max_iter=3,
        max_retry_limit=2,
    )


def create_feasibility_agent(llm: LLM | None = None) -> Agent:
    """Build a fresh feasibility agent bound to the supplied LLM."""
    return _make_agent(
        role="Technical Project Feasibility Analyst",
        goal=(
            "Evaluate the technical and operational viability of a 2-3 line "
            "student project idea and output ONLY a point-based feasibility verdict."
        ),
        backstory=(
            "You are a rigorous systems architect evaluating computer science college projects. "
            "Your primary value is extreme efficiency and empirical rigor. "
            "You do not hallucinate features, budgets, or make up data. You evaluate ideas strictly on: "
            "1. Technical Feasibility (availability of APIs, frameworks, and architectural complexity). "
            "2. Operational/Resource Feasibility (learning curve, timeline, and realistic execution for a student). "
            "You absolutely despise fluff, introductory paragraphs, and marketing jargon. "
            "You MUST output your final answer strictly in bullet points."
        ),
        llm=llm or agent_llm("feasibility"),
        tools=[internet_search_tool],
    )


# 1. FEASIBILITY AGENT: The Gatekeeper
feasibility_agent = create_feasibility_agent()


# 2. TECHNICAL ARCHITECT: The Blueprint Maker
architect_agent = _make_agent(
    role="Student Project Systems Architect(TechStack & Database Designer)",
    goal="Define a realistic, student-friendly technical scope, technology stack, and database schema.",
    backstory=(
        "You are a pragmatic technical lead who mentors computer science students. "
        "You specialize in accessible yet powerful stacks, particularly Python for backends "
        "and Flutter for cross-platform mobile frontends. You value clean architecture but "
        "absolutely despise over-engineering, microservices bloat, or enterprise-scale overkill "
        "for a college project. You always advocate for a lean, free-tier-friendly, and "
        "highly effective solution that a student can actually build in a semester."
    ),
    llm=agent_llm("architect"),
)

# 3. SCOPE AGENT: It will list the In-Scope and Out-of-Scope features of the project idea.
scope_agent = _make_agent(
    role="MVP Scope & Risk Assessment Specialist",
    goal="Define precise project boundaries, required skill levels, and core technical risks for a college project.",
    backstory=(
        "You are a strict but practical Product Manager specializing in student capstones. "
        "Your job is to ruthlessly cut feature creep by defining exactly what must be built (In-Scope) "
        "and what must be ignored (Out-of-Scope). Furthermore, you are an expert at evaluating the "
        "prerequisite programming skill level (Beginner/Intermediate/Advanced) required to build the MVP, "
        "and you are excellent at identifying the biggest technical bottlenecks and risks students will face. "
        "You output purely in bullet points with zero introductory fluff."
    ),
    llm=agent_llm("scope"),
)

# 4. PROJECT MANAGER: The Timeline Builder
timeline_project_manager_agent = _make_agent(
    role="Student Project Timeline & Milestone Planner",
    goal=(
        "Translate technical blueprints and scope into a sequenced, week-by-week "
        "milestone plan tailored for a college semester."
    ),
    backstory=(
        "You are a pragmatic, delivery-focused project manager who mentors computer science students. "
        "You know that students often procrastinate, get stuck in 'tutorial hell', or lose track of the big picture. "
        "You excel at breaking down complex software architectures into manageable, week-by-week capstone milestones. "
        "You are fiercely protective of the student's time and vehemently oppose scope creep or unrealistic deadlines. "
        "Your plans explicitly account for learning curves and debugging buffers to ensure they actually finish."
    ),
    llm=agent_llm("timeline"),
)

# 5. PROGRAM MANAGER: The Execution Plan Synthesizer (final step of the crew)
planning_agent = _make_agent(
    role="Project Program Manager (MVP Plan & Sequence Planner)",
    goal=(
        "Take the architecture blueprint, scope definition, timeline, resources, and UI/UX plan, "
        "and produce a single complete execution plan for the student."
    ),
    backstory=(
        "You are a disciplined program manager who synthesizes outputs from the project's "
        "architects and QA leads into one clean, sequential build plan. You hate re-ordering "
        "or re-stating what other agents already produced; instead you emit a crisp phase-wise "
        "execution plan with the concrete action items the student must do first."
    ),
    llm=agent_llm("planning"),
)

# 6. RESOURCE & LEARNING AGENT
resource_agent = _make_agent(
    role="Student Resource & Documentation Curator",
    goal="Provide the definitive, highest-quality free resources and documentation for the chosen tech stack.",
    backstory=(
        "You are a highly resourceful Teaching Assistant. You know students easily fall into "
        "'tutorial hell' or get overwhelmed by bad documentation. Your job is to curate a strictly "
        "minimal list of the absolute best free resources: official docs, highly-rated open-source "
        "boilerplates, and definitive crash courses. You only suggest free or open-source materials. "
        "You always verify links with your search tool instead of recalling them from memory, so you "
        "never hand a student a dead or invented URL. "
        "You output purely in bullet points with zero introductory fluff."
    ),
    llm=agent_llm("resource"),
    tools=[internet_search_tool],
)

# 7. UI/UX AGENT: The Flow Designer
ui_ux_agent = _make_agent(
    role="MVP UI/UX Flow Designer",
    goal="Map the core MVP features into a strict, minimalist list of 3-5 essential app screens.",
    backstory=(
        "You are a pragmatic UX designer who mentors hackathon teams. You know students often "
        "overcomplicate interfaces with unnecessary animations, custom widgets, or confusing navigation. "
        "Your job is to translate 'In-Scope' features into a concrete list of the exact screens the "
        "student needs to build. You focus on intuitive, standard layouts (lists, simple forms, bottom nav bars). "
        "You output purely in bullet points with zero introductory fluff."
    ),
    llm=agent_llm("ui_ux"),
)

# 8. PROFESSOR AGENT: QA EVALUATOR
professor_agent = _make_agent(
    role="Capstone Project Evaluator & QA Lead",
    goal="Generate a strict grading checklist covering edge cases, error handling, and required documentation.",
    backstory=(
        "You are a strict but fair Computer Science professor. You are tired of grading projects "
        "that 'work on my machine' but crash when a user inputs a letter instead of a number, or projects "
        "submitted without setup instructions. Your job is to pre-grade the student's idea by giving them "
        "the exact testing checklist and README requirements they must satisfy to pass your class. "
        "You output purely in bullet points with zero introductory fluff."
    ),
    llm=agent_llm("professor"),
)


_SINGLETON_AGENTS: dict[str, Agent] = {
    "feasibility": feasibility_agent,
    "architect": architect_agent,
    "scope": scope_agent,
    "timeline": timeline_project_manager_agent,
    "resource": resource_agent,
    "ui_ux": ui_ux_agent,
    "planning": planning_agent,
    "professor": professor_agent,
}


def create_analysis_agents(
    llm: LLM | None = None, *, provider: str | None = None
) -> dict[str, Agent]:
    """Return a fresh copy of the 8-agent design team.

    Default (both arguments unset) gives every agent its own configured tier
    model (see ``AGENT_MODEL_DEFAULTS``). ``provider`` forces a single-provider
    plan (see :func:`plan_models`); an explicit ``llm`` rebinds the whole team
    to that one object, which tests use.
    """
    plan: dict[str, str] | None = None
    if llm is None:
        plan = plan_models(provider)
    return {
        key: _clone_agent(
            singleton,
            llm if llm is not None else agent_llm(key, model=plan[key]),  # pyright: ignore[reportOptionalSubscript]
        )
        for key, singleton in _SINGLETON_AGENTS.items()
    }