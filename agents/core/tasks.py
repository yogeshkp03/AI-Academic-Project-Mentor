from dataclasses import dataclass

from crewai import Agent, Task


@dataclass(frozen=True)
class _TaskSpec:
    """One analysis task: its prompt, its output contract, and who it reads."""

    key: str
    description: str
    expected_output: str
    context: tuple[str, ...] = ()


_TASK_SPECS: tuple[_TaskSpec, ...] = (
    _TaskSpec(
        key="feasibility",
        description=(
            "Analyze the following student project idea: '{student_idea}'\n\n"
            "Use your search tool to briefly check for existing APIs or tools if needed, but do not over-research. "
            "Provide a concrete verdict based on technical and operational reality."
        ),
        expected_output=(
            "A strictly formatted bulleted list with exactly these two headers:\n"
            "- Technical Feasibility: [High/Medium/Low]. [1-2 sentences of concrete justification naming specific tech/APIs].\n"
            "- Operational Feasibility: [High/Medium/Low]. [1-2 sentences on student learning curve and time to build]."
        ),
    ),
    _TaskSpec(
        key="architect",
        description=(
            "Read the feasibility report from your context. "
            "CRITICAL INSTRUCTIONS:\n"
            "1. Identify the exact frontend, backend, and database technologies required.\n"
            "2. Favor Python for analytics/backend logic and Flutter for mobile user interfaces where applicable.\n"
            "3. Recommend free-tier or open-source databases (e.g., Firebase, Supabase, PostgreSQL, SQLite) suitable for students.\n"
            "4. Define a high-level database schema with core tables.\n"
            "5. Do not over-engineer; keep the choices strictly aligned with the college project scope determined in the feasibility report."
        ),
        expected_output=(
            "A highly concise architecture blueprint containing the following exact sections with no introductory text:\n"
            "- Frontend Stack: [Selected technologies]\n"
            "- Backend Stack: [Selected technologies]\n"
            "- Database Selection: [Selected database with free-tier justification]\n"
            "- Database Schema:\n"
            "  * [Table 1 Name]: [Core columns/relationships]\n"
            "  * [Table 2 Name]: [Core columns/relationships]"
        ),
        context=("feasibility",),
    ),
    _TaskSpec(
        key="scope",
        description=(
            "Review the initial project idea and the feasibility report from your context. "
            "1. Identify 3-4 core features required for the Minimum Viable Product (In-Scope).\n"
            "2. Identify 2-3 advanced features to exclude to prevent feature creep (Out-of-Scope).\n"
            "3. Assess the overall skill level required to complete the MVP (Beginner, Intermediate, or Advanced).\n"
            "4. Identify 2 core risks (e.g., steep learning curves, unreliable third-party APIs, or high compute costs)."
        ),
        expected_output=(
            "A strictly formatted list with exactly these headers and no introductory text:\n"
            "- In-Scope (Core MVP):\n"
            "  * [Core Feature 1]\n"
            "  * [Core Feature 2]\n"
            "- Out-of-Scope (Excluded):\n"
            "  * [Complex Feature 1] - [Reason]\n"
            "  * [Complex Feature 2] - [Reason]\n"
            "- Skill Level Required: [Beginner / Intermediate / Advanced]. [1 sentence justification].\n"
            "- Core Risks:\n"
            "  * [Risk 1] - [Brief mitigation strategy]\n"
            "  * [Risk 2] - [Brief mitigation strategy]"
        ),
        context=("feasibility",),
    ),
    _TaskSpec(
        key="timeline",
        description=(
            "Read the architecture blueprint and the scope definition from your context. "
            "CRITICAL INSTRUCTIONS:\n"
            "1. Extract the 'Skill Level Required' from the Scope Agent's output.\n"
            "2. Break the architecture and In-Scope features into actionable week-by-week milestones.\n"
            "3. Calculate the base timeline in weeks (assume a typical capstone allows 8-12 weeks maximum).\n"
            "4. CRITICAL RULE: If the scope context indicates the skill requirement is 'Advanced', "
            "you MUST multiply your base development timeline estimate by 1.5x to accommodate the learning curve, keeping the absolute maximum at 12 weeks."
        ),
        expected_output=(
            "A structured sprint plan containing the following exact sections with zero introductory text:\n"
            "- Skill Level Context: [Beginner / Intermediate / Advanced]\n"
            "- Total Estimated Timeline: [Calculated weeks, explicitly noting if the 1.5x multiplier was applied]\n"
            "- Milestone Plan:\n"
            "  * Week 1-2: [Setup & Core Deliverables]\n"
            "  * Week 3-4: [Feature Development]\n"
            "  * Week [X]: [Integration & Testing]\n"
            "  *(Format as a bulleted list, grouped by weeks based on total timeline)*"
        ),
        context=("architect", "scope"),
    ),
    _TaskSpec(
        key="resource",
        description=(
            "Read the selected tech stack from the architecture blueprint in your context. "
            "For each major technology (Frontend, Backend, Database), provide:\n"
            "1. The official quick-start documentation link, found by running a search with your "
            "Internet Search Tool. Never recall a URL from memory; only report links you saw in "
            "actual search results.\n"
            "2. One highly recommended free learning resource (e.g., specific YouTube channel, freeCodeCamp course, or interactive tutorial), "
            "verified the same way."
        ),
        expected_output=(
            "A strictly formatted list with zero introductory text:\n"
            "- Frontend ([Tech Name]) Resources:\n"
            "  * Docs: [Link]\n"
            "  * Tutorial: [Recommendation]\n"
            "- Backend ([Tech Name]) Resources:\n"
            "  * Docs: [Link]\n"
            "  * Tutorial: [Recommendation]\n"
            "- Database ([Tech Name]) Resources:\n"
            "  * Docs: [Link]"
        ),
        context=("architect",),
    ),
    _TaskSpec(
        key="ui_ux",
        description=(
            "Read the project scope and architecture from the previous tasks. "
            "Design the 3-5 essential MVP screens required for the project. "
            "For each screen, describe its purpose and main UI elements."
        ),
        expected_output=(
            "A bullet-point UI/UX plan containing:\n"
            "- Screen 1: [Name] - [Purpose and main elements]\n"
            "- Screen 2: [Name] - [Purpose and main elements]\n"
            "- Screen 3: [Name] - [Purpose and main elements]"
        ),
        context=("architect", "scope"),
    ),
    _TaskSpec(
        key="planning",
        description=(
            "Read the architecture blueprint, scope definition, timeline, resources, "
            "and UI/UX plan from your context. "
            "Synthesize them into ONE crisp, sequential execution plan for the student. "
            "Do not restate the raw reports; instead output the concrete, ordered "
            "action items the student must do first (phases), including setup, feature "
            "build order, integrations, testing, and documentation."
        ),
        expected_output=(
            "A phase-wise execution plan with zero introductory text:\n"
            "- Phase 1 (Setup): [exact setup action items]\n"
            "- Phase 2 (Build): [ordered feature build steps mapped to the milestone plan]\n"
            "- Phase 3 (Integrate & Test): [integration and QA action items]\n"
            "- Phase 4 (Document & Demo): [README, demo, and handover checklist]"
        ),
        context=("architect", "scope", "timeline", "resource", "ui_ux"),
    ),
    _TaskSpec(
        key="professor",
        description=(
            "Review the feasibility verdict, scope definition, timeline, and the "
            "final execution plan from your context. Create a final QA and grading "
            "checklist. Include edge cases, security checks, documentation "
            "requirements, and demo requirements."
        ),
        expected_output=(
            "A structured QA checklist containing:\n"
            "- Functional Tests\n"
            "- Edge Cases\n"
            "- Security Checks\n"
            "- Documentation Requirements\n"
            "- Demo Requirements"
        ),
        context=("feasibility", "scope", "timeline", "planning"),
    ),
)


#: Canonical execution order of the analysis tasks, matching
#: :data:`AGENT_MODEL_DEFAULTS` in :mod:`core.agents`.
TASK_KEYS: tuple[str, ...] = tuple(spec.key for spec in _TASK_SPECS)


def create_analysis_tasks(agents: dict[str, Agent]) -> list[Task]:
    """Build the 8 sequential analysis tasks bound to agents mapped by role key."""
    built: dict[str, Task] = {}
    tasks: list[Task] = []
    for spec in _TASK_SPECS:
        task = Task(
            description=spec.description,
            expected_output=spec.expected_output,
            agent=agents[spec.key],
            context=[built[key] for key in spec.context],
        )
        built[spec.key] = task
        tasks.append(task)
    return tasks
