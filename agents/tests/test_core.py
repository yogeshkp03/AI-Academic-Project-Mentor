import asyncio
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from core import tools as core_tools
from core.agents import quota_exhausted
from core.registry import get_agent_spec
from core import agents as core_agents
from core import tasks as core_tasks

import main as api


def _same_model(configured: str, actual: str) -> bool:
    """True when an LLM reports the configured model, with or without prefix.

    crewai's LLM normalizes ``gemini/gemini-3.8-flash`` to ``gemini-3.8-flash``
    while keeping Groq's ``groq/...`` prefix intact.
    """
    return actual == configured or actual == configured.rsplit("/", 1)[-1]


def _request_with(host: str, xff: str | None = None, **headers: str) -> Any:
    """Minimal Request stand-in for the helpers that only read headers/peer."""
    normalized = {k.replace("_", "-"): v for k, v in headers.items()}
    if xff is not None:
        normalized["X-Forwarded-For"] = xff

    class _Request:
        def __init__(self):
            self.client = SimpleNamespace(host=host)
            self.headers = normalized

    return _Request()


@pytest.fixture(autouse=True)
def _clear_cache():
    api._analysis_cache.clear()  # pyright: ignore[reportPrivateUsage]
    api._inflight.clear()  # pyright: ignore[reportPrivateUsage]
    api.analyze_limiter._hits.clear()  # pyright: ignore[reportPrivateUsage]
    api.chat_limiter._hits.clear()  # pyright: ignore[reportPrivateUsage]
    yield


def test_quota_exhausted_detects_http_codes():
    assert quota_exhausted(SimpleNamespace(status_code=429)) is True  # pyright: ignore[reportArgumentType]
    assert quota_exhausted(SimpleNamespace(status_code=409)) is True  # pyright: ignore[reportArgumentType]
    assert quota_exhausted(SimpleNamespace(status_code=404)) is False  # pyright: ignore[reportArgumentType]


def test_quota_exhausted_detects_error_markers():
    assert quota_exhausted(RuntimeError("bard client responded with 403 Forbidden")) is True
    assert quota_exhausted(RuntimeError("rate limit exceeded, retry in 5s")) is True
    assert quota_exhausted(ValueError("connection reset by uncertain network")) is False


def test_feasibility_registry_binds_feasibility_agent():
    spec = get_agent_spec("feasibility")
    assert spec.agent is core_agents.feasibility_agent


def test_timeline_registry_binds_planning_llm_agent():
    spec = get_agent_spec("timeline")
    assert spec.agent is core_agents.timeline_project_manager_agent
    assert spec.supports_chat is True


def test_mentor_has_no_dedicated_agent():
    assert get_agent_spec("mentor").agent is None


def test_planning_registry_binds_planning_agent():
    spec = get_agent_spec("planning")
    assert spec.agent is core_agents.planning_agent
    assert spec.supports_chat is True
    assert spec.dependencies == ("architect", "scope", "timeline", "resource", "ui_ux")


def test_professor_registry_depends_on_planning():
    assert "planning" in get_agent_spec("professor").dependencies


def test_resource_agent_can_search_the_web():
    assert core_agents.resource_agent.tools, "resource agent must be able to verify doc links"
    clones = core_agents.create_analysis_agents(core_agents.groq_llm)
    assert clones["resource"].tools, "cloned resource agent must keep its search tool"


def test_analysis_tasks_are_bound_in_spec_order():
    agents = core_agents.create_analysis_agents(core_agents.groq_llm)
    tasks = core_tasks.create_analysis_tasks(agents)

    expected_keys = (
        "feasibility",
        "architect",
        "scope",
        "timeline",
        "resource",
        "ui_ux",
        "planning",
        "professor",
    )
    assert [task.agent for task in tasks] == [agents[key] for key in expected_keys]
    assert tasks[0].context == []
    assert len(tasks[6].context) == 5, "planning reads architect, scope, timeline, resource, ui_ux"
    assert len(tasks[7].context) == 4, "professor reads feasibility, scope, timeline, planning"


def test_unknown_agent_type_raises_helpful_error():
    with pytest.raises(ValueError, match="Unknown agent type"):
        get_agent_spec("not_a_real_agent")


def test_search_tool_returns_generic_error(monkeypatch: pytest.MonkeyPatch):
    class _ExplodingDDGS:
        def __init__(self, *args: Any, **kwargs: Any):
            raise RuntimeError("Internal API timeout at ddg.example/secret")

    monkeypatch.setattr(core_tools, "DDGS", _ExplodingDDGS)

    result: Any = core_tools.internet_search_tool.func("python web scraping")
    assert "different query" in result
    assert "Internal API timeout" not in result
    assert "ddg.example" not in result


class _FakeResult:
    token_usage = None
    cost = None

    def __init__(self, text: str = "REPORT TEXT"):
        self._text = text

    def __str__(self):
        return self._text


def test_analyze_serves_from_cache(monkeypatch: pytest.MonkeyPatch):
    kickoff_calls: list[Any] = []

    def _fake_crew(llm: Any):
        class _FakeCrew:
            def kickoff(self, inputs: Any = None):
                kickoff_calls.append(inputs)
                return _FakeResult()

        return _FakeCrew()

    monkeypatch.setattr(api, "create_project_crew", _fake_crew)

    client = TestClient(api.app)
    payload = {"idea": "A mobile app that helps local volunteers find nearby community projects"}

    first = client.post("/api/analyze", json=payload)
    assert first.status_code == 200
    assert first.json()["report"] == "REPORT TEXT"
    assert first.json()["from_cache"] is False
    assert first.json()["analysis_id"]

    second = client.post("/api/analyze", json=payload)
    assert second.status_code == 200
    assert second.json()["from_cache"] is True
    assert len(kickoff_calls) == 1


def test_analyze_rejects_short_idea():
    client = TestClient(api.app)
    resp = client.post("/api/analyze", json={"idea": "app"})
    assert resp.status_code == 422


def test_api_requires_token_when_configured(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(api, "AGENTS_API_TOKEN", "s3cr3t")

    def _fake_crew(llm: Any):
        class _FakeCrew:
            def kickoff(self, inputs: Any = None):
                return _FakeResult()

        return _FakeCrew()

    monkeypatch.setattr(api, "create_project_crew", _fake_crew)

    client = TestClient(api.app)
    payload = {"idea": "A mobile app that helps local volunteers find nearby community projects"}

    assert client.post("/api/analyze", json=payload).status_code == 401
    assert client.post("/api/analyze", json=payload, headers={"X-Agents-Token": "wrong"}).status_code == 401
    ok = client.post("/api/analyze", json=payload, headers={"X-Agents-Token": "s3cr3t"})
    assert ok.status_code == 200


def test_health_is_public_and_reports_providers():
    client = TestClient(api.app)
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    # The active per-agent model plan, so /health is enough to verify config.
    assert set(body["models"]) == set(core_agents.AGENT_MODEL_DEFAULTS)


def test_chat_validates_question():
    client = TestClient(api.app)
    assert client.post("/api/chat", json={"question": "   "}).status_code == 400
    assert client.post("/api/chat", json={"question": "x" * 2001}).status_code == 422


def test_chat_rejects_unknown_agent_type_without_calling_the_llm(monkeypatch: pytest.MonkeyPatch):
    def _explode(**kwargs: Any):
        raise AssertionError("must not reach the LLM for an unknown agent type")

    monkeypatch.setattr(api, "generate_chatbot_reply_with_fallback", _explode)
    monkeypatch.setattr(api, "generate_specialist_reply_with_fallback", _explode)

    client = TestClient(api.app)
    resp = client.post("/api/chat", json={"question": "How do I start?", "agent_type": "nope"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Unsupported agent type."


def test_analyze_rejects_whitespace_only_idea():
    client = TestClient(api.app)
    assert client.post("/api/analyze", json={"idea": " " * 40}).status_code == 400


def test_chat_returns_mentor_answer(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        api,
        "generate_chatbot_reply_with_fallback",
        lambda **kwargs: "Here is your mentor answer.",  # pyright: ignore[reportUnknownLambdaType, reportUnknownArgumentType]
    )
    client = TestClient(api.app)
    resp = client.post(
        "/api/chat",
        json={
            "project_title": "Volunteer App",
            "project_idea": "A mobile app for local volunteering",
            "project_blueprint": "## Blueprint\nDo the thing.",
            "chat_history": "",
            "question": "How do I start?",
            "agent_type": "mentor",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["answer"] == "Here is your mentor answer."


def test_crew_contains_all_eight_tasks_bound_to_the_right_agents():
    crew = api.create_project_crew()
    expected_roles = [
        core_agents.feasibility_agent.role,
        core_agents.architect_agent.role,
        core_agents.scope_agent.role,
        core_agents.timeline_project_manager_agent.role,
        core_agents.resource_agent.role,
        core_agents.ui_ux_agent.role,
        core_agents.planning_agent.role,
        core_agents.professor_agent.role,
    ]
    assert len(crew.tasks) == 8
    assert [task.agent.role for task in crew.tasks] == expected_roles
    # Fresh copies: concurrent API runs must never share crew state.
    assert crew.tasks[6].agent is not core_agents.planning_agent
    assert crew.tasks[7].agent is not core_agents.professor_agent


def test_agents_run_a_tiered_model_plan(monkeypatch: pytest.MonkeyPatch):
    for key in core_agents.AGENT_MODEL_DEFAULTS:
        monkeypatch.delenv(f"MODEL_{key.upper()}", raising=False)
    model_for = core_agents.agent_model

    # Quality/tool agents on Gemini: three calls per run, down from six.
    for key in ("feasibility", "architect", "resource"):
        assert model_for(key) == core_agents.GEMINI_MODEL, key
    # Only the sequencing pair uses the heavy Groq model — its free-tier TPM
    # budget (8k/min) cannot fit a whole 8-agent run.
    for key in ("timeline", "planning"):
        assert model_for(key) == core_agents.GROQ_MODEL, key
    for key in ("scope", "ui_ux", "professor"):
        assert model_for(key) == core_agents.GROQ_LIGHT_MODEL, key
    # The light tier must not be the heavy model, or the tiering buys nothing.
    assert core_agents.GROQ_LIGHT_MODEL != core_agents.GROQ_MODEL


def test_provider_forced_plan_keeps_every_agent_on_that_provider():
    groq_plan = core_agents.plan_models("groq")
    assert all(model.startswith("groq/") for model in groq_plan.values())
    assert (
        sum(1 for model in groq_plan.values() if model == core_agents.GROQ_MODEL) == 2
    ), "a forced Groq plan must keep only timeline+planning on the 8k-TPM model"

    gemini_plan = core_agents.plan_models("gemini")
    assert all(model.startswith("gemini/") for model in gemini_plan.values())


def test_model_env_override_wins_over_the_tier(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("MODEL_SCOPE", "groq/custom-scope-model")
    assert core_agents.agent_model("scope") == "groq/custom-scope-model"


def test_unkeyed_provider_is_dropped_from_the_tier_plan(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(core_agents, "GEMINI_API_KEY", None)
    models = {
        key: core_agents.agent_model(key)
        for key in core_agents.AGENT_MODEL_DEFAULTS
    }
    assert all(not model.startswith("gemini/") for model in models.values())
    assert [llm.model for llm in core_agents.fallback_llms()] == [core_agents.GROQ_MODEL]
    assert api._retry_providers() == ("groq",)  # pyright: ignore[reportPrivateUsage]


def test_unkeyed_provider_is_never_attempted_by_the_crew_run(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(core_agents, "GEMINI_API_KEY", None)
    attempted: list[Any] = []

    def _factory(provider: Any = None):
        class _FakeCrew:
            def kickoff(self, inputs: Any = None):
                attempted.append(provider or "tiered")
                if len(attempted) == 1:
                    raise RuntimeError("tiered run failed")
                return _FakeResult("GROQ ONLY REPORT")

        return _FakeCrew()

    monkeypatch.setattr(api, "create_project_crew", _factory)
    resp = TestClient(api.app).post(
        "/api/analyze", json={"idea": _IDEA}, headers={"X-Student-Id": "1"}
    )
    assert resp.status_code == 200
    assert attempted == ["tiered", "groq"]


def test_fallback_levels_are_groq_then_gemini():
    levels = [llm.model for llm in core_agents.fallback_llms()]
    assert len(levels) == 2
    assert _same_model(core_agents.GROQ_MODEL, levels[0])
    assert _same_model(core_agents.GEMINI_MODEL, levels[1])


def test_crew_uses_the_tiered_models_by_default():
    crew = api.create_project_crew()
    for task, key in zip(crew.tasks, core_tasks.TASK_KEYS):
        assert _same_model(core_agents.agent_model(key), task.agent.llm.model), key


def test_cache_key_changes_when_a_tier_model_changes(monkeypatch: pytest.MonkeyPatch):
    baseline = api._cache_key(_IDEA)  # pyright: ignore[reportPrivateUsage]
    monkeypatch.setenv("MODEL_ARCHITECT", "groq/another-model")
    changed = api._cache_key(_IDEA)  # pyright: ignore[reportPrivateUsage]
    assert baseline != changed, "a model change must stop stale reports being served"


_IDEA = "A mobile app that helps local volunteers find nearby community projects"


def _stub_crew(calls: list[Any], report: str = "REPORT TEXT"):
    def _factory(llm: Any):
        class _FakeCrew:
            def kickoff(self, inputs: Any = None):
                calls.append(inputs)
                return _FakeResult(report)

        return _FakeCrew()

    return _factory


def test_rate_limit_is_per_student_not_global(monkeypatch: pytest.MonkeyPatch):
    """Every call arrives from the backend, so the peer IP must not be the key."""
    calls: list[Any] = []
    monkeypatch.setattr(api, "create_project_crew", _stub_crew(calls))
    client = TestClient(api.app)

    # Ten analyses for one student exhausts that student's budget...
    for index in range(10):
        resp = client.post("/api/analyze", json={"idea": f"{_IDEA} number {index}"}, headers={"X-Student-Id": "1"})
        assert resp.status_code == 200, resp.text
    blocked = client.post("/api/analyze", json={"idea": f"{_IDEA} eleven"}, headers={"X-Student-Id": "1"})
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers

    # ...and must not throttle a different student.
    other = client.post("/api/analyze", json={"idea": f"{_IDEA} other"}, headers={"X-Student-Id": "2"})
    assert other.status_code == 200, other.text


def test_analysis_id_does_not_leak_across_students(monkeypatch: pytest.MonkeyPatch):
    calls: list[Any] = []
    monkeypatch.setattr(api, "create_project_crew", _stub_crew(calls, report="STUDENT ONE REPORT"))
    client = TestClient(api.app)

    first = client.post("/api/analyze", json={"idea": _IDEA}, headers={"X-Student-Id": "1"})
    assert first.status_code == 200
    analysis_id = first.json()["analysis_id"]
    assert analysis_id

    seen: dict[str, Any] = {}

    def _capture(**kwargs: Any):
        seen["blueprint"] = kwargs["project_blueprint"]
        return "answer"

    monkeypatch.setattr(api, "generate_chatbot_reply_with_fallback", _capture)

    payload = {"question": "How do I start?", "agent_type": "mentor", "analysis_id": analysis_id}

    client.post("/api/chat", json=payload, headers={"X-Student-Id": "1"})
    assert seen["blueprint"] == "STUDENT ONE REPORT"

    # A different student presenting the same id must not receive the report.
    client.post("/api/chat", json=payload, headers={"X-Student-Id": "2"})
    assert seen["blueprint"] == ""


def test_same_idea_from_two_students_gets_distinct_analysis_ids(monkeypatch: pytest.MonkeyPatch):
    calls: list[Any] = []
    monkeypatch.setattr(api, "create_project_crew", _stub_crew(calls))
    client = TestClient(api.app)

    one = client.post("/api/analyze", json={"idea": _IDEA}, headers={"X-Student-Id": "1"}).json()
    two = client.post("/api/analyze", json={"idea": _IDEA}, headers={"X-Student-Id": "2"}).json()

    assert one["analysis_id"] != two["analysis_id"]
    # Same idea, same report content, but each student paid for their own run.
    assert one["report"] == two["report"] == "REPORT TEXT"
    assert len(calls) == 2


def test_concurrent_duplicate_analyses_run_one_crew(monkeypatch: pytest.MonkeyPatch):
    calls: list[Any] = []
    release = threading.Event()

    def _slow_crew(llm: Any):
        class _FakeCrew:
            def kickoff(self, inputs: Any = None):
                calls.append(inputs)
                release.wait(5)
                return _FakeResult()

        return _FakeCrew()

    monkeypatch.setattr(api, "create_project_crew", _slow_crew)
    client = TestClient(api.app)

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [
            pool.submit(
                client.post,
                "/api/analyze",
                json={"idea": _IDEA},
                headers={"X-Student-Id": "1"},
            )
            for _ in range(3)
        ]
        # Give the single-flight followers time to attach to the leader.
        time.sleep(0.5)
        release.set()
        responses = [future.result() for future in futures]

    assert all(resp.status_code == 200 for resp in responses), [r.status_code for r in responses]
    assert len(calls) == 1, f"expected a single crew run, got {len(calls)}"
    assert sum(1 for r in responses if r.json()["from_cache"] is False) == 1


def test_analysis_falls_back_to_the_second_provider(monkeypatch: pytest.MonkeyPatch):
    attempted: list[Any] = []

    def _factory(provider: Any = None):
        class _FakeCrew:
            def kickoff(self, inputs: Any = None):
                attempted.append(provider or "tiered")
                if len(attempted) == 1:
                    raise RuntimeError("429 RESOURCE_EXHAUSTED quota exhausted")
                return _FakeResult("SECOND PROVIDER REPORT")

        return _FakeCrew()

    monkeypatch.setattr(api, "create_project_crew", _factory)
    client = TestClient(api.app)

    resp = client.post("/api/analyze", json={"idea": _IDEA}, headers={"X-Student-Id": "1"})
    assert resp.status_code == 200
    assert resp.json()["report"] == "SECOND PROVIDER REPORT"
    # Tiered first attempt, then the Groq-only retry (Groq is checked first).
    assert attempted == ["tiered", "groq"]


def test_analysis_returns_503_when_every_provider_fails(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        api,
        "create_project_crew",
        lambda llm: type("C", (), {"kickoff": lambda self, inputs=None: (_ for _ in ()).throw(RuntimeError("boom"))})(),  # pyright: ignore[reportUnknownLambdaType, reportUnknownArgumentType]
    )
    client = TestClient(api.app)
    resp = client.post("/api/analyze", json={"idea": _IDEA}, headers={"X-Student-Id": "1"})
    assert resp.status_code == 503
    # The internal reason must not reach the caller.
    assert "boom" not in resp.text
    # And a failure must not be cached as a result.
    assert len(api._analysis_cache) == 0  # pyright: ignore[reportPrivateUsage]


def test_analysis_cache_is_bounded_and_expires(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(api, "create_project_crew", _stub_crew([]))

    cache = api._AnalysisCache(ttl=60.0, max_entries=3)  # pyright: ignore[reportPrivateUsage]
    for index in range(5):
        cache.put("student:1", f"key{index}", {"analysis_id": f"id{index}", "report": f"r{index}"})

    assert len(cache) == 3, "cache must never exceed its configured maximum"
    # The two oldest were evicted, and their reports went with them.
    assert cache.get("student:1", "key0") is None
    assert cache.get_report("student:1", "id0") == ""
    assert cache.get("student:1", "key4") is not None
    assert cache.get_report("student:1", "id4") == "r4"

    expired = api._AnalysisCache(ttl=-1.0, max_entries=3)  # pyright: ignore[reportPrivateUsage]
    expired.put("student:1", "key", {"analysis_id": "id", "report": "gone"})
    assert expired.get("student:1", "key") is None
    assert len(expired) == 0


def test_analysis_deadline_returns_503_and_keeps_the_slot_until_the_crew_finishes(
    monkeypatch: pytest.MonkeyPatch,
):
    """A wedged run must not hold the request open forever, nor free its slot early.

    Freeing the slot on timeout would let a stream of stuck crews exceed
    MAX_CONCURRENT_ANALYSES and exhaust the server's thread pool.
    """
    monkeypatch.setattr(api, "ANALYSIS_DEADLINE_SECONDS", 0.2)
    release = threading.Event()
    started = threading.Event()

    def _wedged_crew(llm: Any):
        class _FakeCrew:
            def kickoff(self, inputs: Any = None):
                started.set()
                release.wait(10)
                return _FakeResult()

        return _FakeCrew()

    monkeypatch.setattr(api, "create_project_crew", _wedged_crew)
    free_before = api._analyze_slots._value  # pyright: ignore[reportPrivateUsage]

    response = TestClient(api.app).post(
        "/api/analyze", json={"idea": _IDEA}, headers={"X-Student-Id": "1"}
    )

    assert response.status_code == 503
    assert "longer than expected" in response.json()["detail"]
    assert started.is_set(), "the crew should have been started before the deadline"
    # Still running, so the slot must still be held.
    assert api._analyze_slots._value == free_before - 1  # pyright: ignore[reportPrivateUsage]

    release.set()
    for _ in range(100):
        if api._analyze_slots._value == free_before:  # pyright: ignore[reportPrivateUsage]
            break
        time.sleep(0.05)
    assert api._analyze_slots._value == free_before, "slot was never released"  # pyright: ignore[reportPrivateUsage]


def test_analysis_deadline_not_tripped_by_a_normal_run(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(api, "ANALYSIS_DEADLINE_SECONDS", 30.0)
    monkeypatch.setattr(api, "create_project_crew", _stub_crew([]))
    free_before = api._analyze_slots._value  # pyright: ignore[reportPrivateUsage]

    response = TestClient(api.app).post(
        "/api/analyze", json={"idea": _IDEA}, headers={"X-Student-Id": "1"}
    )

    assert response.status_code == 200
    assert api._analyze_slots._value == free_before, "slot leaked on the success path"  # pyright: ignore[reportPrivateUsage]
    assert api._inflight == {}, "single-flight record leaked"  # pyright: ignore[reportPrivateUsage]


def test_forwarded_for_is_ignored_unless_the_proxy_is_trusted(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(api, "TRUSTED_PROXIES", frozenset[str]())
    assert api._client_host(_request_with("9.9.9.9", xff="1.2.3.4")) == "9.9.9.9"  # pyright: ignore[reportPrivateUsage]

    monkeypatch.setattr(api, "TRUSTED_PROXIES", frozenset({"9.9.9.9"}))
    assert api._client_host(_request_with("9.9.9.9", xff="1.2.3.4")) == "1.2.3.4"  # pyright: ignore[reportPrivateUsage]


def test_api_token_comparison_rejects_empty_and_wrong_values(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(api, "AGENTS_API_TOKEN", "s3cr3t")
    # Missing header and wrong header are both rejected; the correct one passes.
    for headers in ({}, {"X-Agents-Token": "wrong"}):
        with pytest.raises(HTTPException) as caught:
            asyncio.run(api.require_api_token(_request_with("testclient", **headers)))
        assert caught.value.status_code == 401
    caller = asyncio.run(
        api.require_api_token(_request_with("testclient", **{"X-Agents-Token": "s3cr3t"}))
    )
    assert caller == "ip:testclient"
