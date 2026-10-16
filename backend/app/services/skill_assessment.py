import random
from collections.abc import Sequence
from typing import Literal, TypedDict

QuestionLevel = Literal["beginner", "intermediate", "advanced"]

# The bucket used to top up a short profile. It has no alias group on purpose:
# no student lists "Core software practice", it exists so a one-skill profile
# still receives a full assessment instead of one question.
GENERAL_SKILL = "Core software practice"


class AssessmentQuestion(TypedDict):
    id: str
    skill: str
    level: QuestionLevel
    question: str
    options: list[str]
    answer: str


QUESTION_BANK: tuple[AssessmentQuestion, ...] = (
    # --- React ---------------------------------------------------------------
    {
        "id": "react-state",
        "skill": "React",
        "level": "beginner",
        "question": "Which React hook is used to manage local component state?",
        "options": ["useState", "useRoute", "useClass", "useData"],
        "answer": "useState",
    },
    {
        "id": "react-effect",
        "skill": "React",
        "level": "beginner",
        "question": "Which hook is intended for synchronizing a component with an external system?",
        "options": ["useEffect", "useMemo", "useId", "useState"],
        "answer": "useEffect",
    },
    # --- JavaScript ----------------------------------------------------------
    {
        "id": "javascript-const",
        "skill": "JavaScript",
        "level": "beginner",
        "question": "Which declaration creates a block-scoped binding that cannot be reassigned?",
        "options": ["var", "let", "const", "static"],
        "answer": "const",
    },
    {
        "id": "javascript-filter",
        "skill": "JavaScript",
        "level": "beginner",
        "question": "Which array method creates a new array containing items that pass a condition?",
        "options": ["filter", "forEach", "push", "sort"],
        "answer": "filter",
    },
    # --- Python --------------------------------------------------------------
    {
        "id": "python-dict",
        "skill": "Python",
        "level": "beginner",
        "question": "Which Python collection stores key-value pairs?",
        "options": ["List", "Tuple", "Dictionary", "Set"],
        "answer": "Dictionary",
    },
    {
        "id": "python-list-comprehension",
        "skill": "Python",
        "level": "beginner",
        "question": "Which syntax creates a list of doubled values from numbers?",
        "options": ["[n * 2 for n in numbers]", "{n * 2 for n in numbers}", "(n * 2: numbers)", "numbers => n * 2"],
        "answer": "[n * 2 for n in numbers]",
    },
    # --- SQL -----------------------------------------------------------------
    {
        "id": "sql-select",
        "skill": "SQL",
        "level": "beginner",
        "question": "Which SQL command reads records from a table?",
        "options": ["PUSH", "SELECT", "PULL", "READ"],
        "answer": "SELECT",
    },
    {
        "id": "sql-primary-key",
        "skill": "SQL",
        "level": "beginner",
        "question": "What is the main purpose of a primary key?",
        "options": ["Uniquely identify a row", "Encrypt a table", "Sort every query", "Create a database backup"],
        "answer": "Uniquely identify a row",
    },
    # --- HTML ----------------------------------------------------------------
    {
        "id": "html-heading",
        "skill": "HTML",
        "level": "beginner",
        "question": "Which HTML element represents the primary page heading?",
        "options": ["<heading>", "<h1>", "<title>", "<head>"],
        "answer": "<h1>",
    },
    {
        "id": "html-label",
        "skill": "HTML",
        "level": "beginner",
        "question": "How should a form label be associated with an input?",
        "options": ["Match label for to input id", "Nest the input in <title>", "Use a placeholder only", "Set the label role to button"],
        "answer": "Match label for to input id",
    },
    # --- CSS -----------------------------------------------------------------
    {
        "id": "css-flexbox",
        "skill": "CSS",
        "level": "beginner",
        "question": "Which CSS layout system is designed for one-dimensional rows or columns?",
        "options": ["Float", "Flexbox", "Table", "Position"],
        "answer": "Flexbox",
    },
    {
        "id": "css-box-sizing",
        "skill": "CSS",
        "level": "beginner",
        "question": "What does box-sizing: border-box do?",
        "options": ["Includes padding and border in the set width", "Removes all margins", "Makes an element fixed", "Hides overflow"],
        "answer": "Includes padding and border in the set width",
    },
    # --- Git -----------------------------------------------------------------
    {
        "id": "git-clone",
        "skill": "Git",
        "level": "beginner",
        "question": "Which Git command creates a local copy of a remote repository?",
        "options": ["git clone", "git copy", "git fork-local", "git download"],
        "answer": "git clone",
    },
    {
        "id": "git-commit",
        "skill": "Git",
        "level": "beginner",
        "question": "Which command records staged changes in the local repository?",
        "options": ["git commit", "git publish", "git stage --save", "git branch"],
        "answer": "git commit",
    },
    # --- MongoDB -------------------------------------------------------------
    {
        "id": "mongodb-documents",
        "skill": "MongoDB",
        "level": "beginner",
        "question": "MongoDB primarily stores records as what?",
        "options": ["Documents", "Rows only", "CSS rules", "Binary classes"],
        "answer": "Documents",
    },
    # --- FastAPI -------------------------------------------------------------
    {
        "id": "fastapi-routes",
        "skill": "FastAPI",
        "level": "beginner",
        "question": "What is commonly used to declare a GET endpoint in FastAPI?",
        "options": ["@app.get(...)", "@app.fetch(...)", "class GET(...)", "route.get = true"],
        "answer": "@app.get(...)",
    },
    # --- Flask ---------------------------------------------------------------
    {
        "id": "flask-framework",
        "skill": "Flask",
        "level": "beginner",
        "question": "Flask is a lightweight web framework for which language?",
        "options": ["Python", "Java", "C#", "Go"],
        "answer": "Python",
    },
    # --- TensorFlow ----------------------------------------------------------
    {
        "id": "tensorflow-ml",
        "skill": "TensorFlow",
        "level": "beginner",
        "question": "TensorFlow is commonly used for which type of work?",
        "options": ["Machine learning", "UI styling", "Email delivery", "Version control"],
        "answer": "Machine learning",
    },
    # --- Node.js -------------------------------------------------------------
    {
        "id": "node-runtime",
        "skill": "Node.js",
        "level": "beginner",
        "question": "What does Node.js allow developers to do?",
        "options": ["Run JavaScript outside a browser", "Compile CSS to HTML", "Run SQL without a database", "Design React components visually"],
        "answer": "Run JavaScript outside a browser",
    },
    # --- Core software practice ---------------------------------------------
    {
        "id": "core-version-control",
        "skill": GENERAL_SKILL,
        "level": "beginner",
        "question": "What is the main purpose of version control?",
        "options": ["Track and review code changes", "Increase monitor brightness", "Compress every image", "Design application logos"],
        "answer": "Track and review code changes",
    },
    {
        "id": "core-validation",
        "skill": GENERAL_SKILL,
        "level": "beginner",
        "question": "Which practice helps protect an application from invalid user input?",
        "options": ["Input validation", "Ignoring errors", "Hard-coding passwords", "Disabling logs"],
        "answer": "Input validation",
    },
    # =====================================================================
    # Tier 1 - the AI/LLM skills students in this project actually list.
    # `crewai` and `langchain` had no coverage at all, so a student declaring
    # them received nothing matched from the skill they care about most.
    # =====================================================================
    # --- CrewAI --------------------------------------------------------------
    {
        "id": "crewai-agent",
        "skill": "CrewAI",
        "level": "beginner",
        "question": "In CrewAI, what does an Agent define?",
        "options": ["Its role, goal, and backstory", "Its monthly API budget", "The database schema it writes to", "The browser it renders in"],
        "answer": "Its role, goal, and backstory",
    },
    {
        "id": "crewai-task-context",
        "skill": "CrewAI",
        "level": "intermediate",
        "question": "What is the purpose of Task.context in CrewAI?",
        "options": [
            "Pass the output of earlier tasks into this task",
            "Set the model temperature",
            "Choose which port the server listens on",
            "Encrypt the task result",
        ],
        "answer": "Pass the output of earlier tasks into this task",
    },
    {
        "id": "crewai-hierarchical",
        "skill": "CrewAI",
        "level": "advanced",
        "question": "Which CrewAI process allows agents to delegate work to one another?",
        "options": ["Hierarchical process", "Sequential process", "Parallel process", "Random process"],
        "answer": "Hierarchical process",
    },
    # --- LangChain -----------------------------------------------------------
    {
        "id": "langchain-chains",
        "skill": "LangChain",
        "level": "beginner",
        "question": "In LangChain, what is a chain?",
        "options": [
            "A sequence of calls to models, prompts, or tools",
            "A linked list of database rows",
            "A Git branch strategy",
            "A CSS cascade rule",
        ],
        "answer": "A sequence of calls to models, prompts, or tools",
    },
    {
        "id": "langchain-agent-tools",
        "skill": "LangChain",
        "level": "intermediate",
        "question": "How does a LangChain agent decide what to do next?",
        "options": [
            "An LLM chooses which tool to call from a list",
            "It always runs every tool in order",
            "A hard-coded if/else ladder decides",
            "It waits for a human to pick a tool",
        ],
        "answer": "An LLM chooses which tool to call from a list",
    },
    {
        "id": "langchain-rag",
        "skill": "LangChain",
        "level": "advanced",
        "question": "What problem does retrieval-augmented generation mainly reduce?",
        "options": [
            "Answers based on stale or invented knowledge, by supplying relevant documents",
            "Slow database migrations",
            "CSS layout shifts",
            "Merge conflicts in Git",
        ],
        "answer": "Answers based on stale or invented knowledge, by supplying relevant documents",
    },
    # --- LLM -----------------------------------------------------------------
    {
        "id": "llm-context-window",
        "skill": "LLM",
        "level": "beginner",
        "question": "What is an LLM's context window?",
        "options": [
            "The maximum amount of text it can consider in one call",
            "The speed of its API",
            "The number of users allowed",
            "Its training-data licence",
        ],
        "answer": "The maximum amount of text it can consider in one call",
    },
    {
        "id": "llm-temperature",
        "skill": "LLM",
        "level": "intermediate",
        "question": "What does raising the temperature value do to an LLM's output?",
        "options": [
            "Makes output more varied and less deterministic",
            "Makes output more deterministic",
            "Increases the context window",
            "Reduces API cost",
        ],
        "answer": "Makes output more varied and less deterministic",
    },
    {
        "id": "llm-hallucination",
        "skill": "LLM",
        "level": "advanced",
        "question": "What does hallucination mean for an LLM?",
        "options": [
            "Producing confident output that is factually wrong or unsupported",
            "Refusing to answer a question",
            "Crashing when the API is unreachable",
            "Returning an empty response",
        ],
        "answer": "Producing confident output that is factually wrong or unsupported",
    },
    # =====================================================================
    # Tier 2 - widely-listed student skills the bank did not cover.
    # =====================================================================
    # --- TypeScript ----------------------------------------------------------
    {
        "id": "typescript-annotation",
        "skill": "TypeScript",
        "level": "beginner",
        "question": "How do you declare a typed variable in TypeScript?",
        "options": ["let count: number = 3", "let count<int> = 3", "number count = 3", "var count = 3 : number"],
        "answer": "let count: number = 3",
    },
    {
        "id": "typescript-interface",
        "skill": "TypeScript",
        "level": "intermediate",
        "question": "What is a TypeScript interface mainly used for?",
        "options": [
            "Describing the shape of an object's data",
            "Bundling files for production",
            "Querying a database",
            "Formatting CSS",
        ],
        "answer": "Describing the shape of an object's data",
    },
    {
        "id": "typescript-union",
        "skill": "TypeScript",
        "level": "advanced",
        "question": "What does the type string | null mean?",
        "options": [
            "Either a string or null",
            "A string that may contain null characters",
            "Two strings concatenated",
            "An optional array of strings",
        ],
        "answer": "Either a string or null",
    },
    # --- Docker --------------------------------------------------------------
    {
        "id": "docker-image",
        "skill": "Docker",
        "level": "beginner",
        "question": "In Docker, what is an image?",
        "options": [
            "A read-only template used to create containers",
            "A picture displayed in the UI",
            "A Git tag",
            "A running CPU process",
        ],
        "answer": "A read-only template used to create containers",
    },
    {
        "id": "docker-container",
        "skill": "Docker",
        "level": "intermediate",
        "question": "What is the relationship between a Docker image and a container?",
        "options": [
            "A container is a running instance of an image",
            "An image is a running instance of a container",
            "They are unrelated concepts",
            "A container compiles an image",
        ],
        "answer": "A container is a running instance of an image",
    },
    {
        "id": "dockerfile",
        "skill": "Docker",
        "level": "advanced",
        "question": "What is a Dockerfile?",
        "options": [
            "A text file of instructions for building an image",
            "A binary executable",
            "A Kubernetes secret",
            "A Git hook",
        ],
        "answer": "A text file of instructions for building an image",
    },
    # --- Java ----------------------------------------------------------------
    {
        "id": "java-bytecode",
        "skill": "Java",
        "level": "beginner",
        "question": "Java source code is first compiled into what?",
        "options": ["Bytecode", "Machine code", "HTML", "Shell scripts"],
        "answer": "Bytecode",
    },
    {
        "id": "java-jvm",
        "skill": "Java",
        "level": "intermediate",
        "question": "What runs Java bytecode?",
        "options": ["The Java Virtual Machine", "A web browser", "The Git daemon", "A container registry"],
        "answer": "The Java Virtual Machine",
    },
    # --- C# ------------------------------------------------------------------
    {
        "id": "csharp-dotnet",
        "skill": "C#",
        "level": "beginner",
        "question": "C# is primarily associated with which platform?",
        "options": [".NET", "Ruby on Rails", "Django", "Laravel"],
        "answer": ".NET",
    },
    {
        "id": "csharp-auto-property",
        "skill": "C#",
        "level": "intermediate",
        "question": "Which C# keyword declares a property with automatic backing storage?",
        "options": ["auto", "prop", "field", "define"],
        "answer": "auto",
    },
    # --- AWS -----------------------------------------------------------------
    {
        "id": "aws-ec2",
        "skill": "AWS",
        "level": "beginner",
        "question": "What does Amazon EC2 provide?",
        "options": ["Virtual machines in the cloud", "Object storage", "A content delivery network", "Email delivery"],
        "answer": "Virtual machines in the cloud",
    },
    {
        "id": "aws-s3",
        "skill": "AWS",
        "level": "intermediate",
        "question": "Which AWS service is primarily used for object storage?",
        "options": ["Amazon S3", "Amazon EC2", "Amazon SNS", "Amazon Route 53"],
        "answer": "Amazon S3",
    },
    {
        "id": "aws-iam",
        "skill": "AWS",
        "level": "advanced",
        "question": "What is AWS IAM used for?",
        "options": [
            "Managing identities, permissions, and access to AWS resources",
            "Hosting static websites",
            "Running Docker containers",
            "Sending transactional email",
        ],
        "answer": "Managing identities, permissions, and access to AWS resources",
    },
    # --- Testing -------------------------------------------------------------
    {
        "id": "testing-unit",
        "skill": "Testing",
        "level": "beginner",
        "question": "What is a unit test?",
        "options": [
            "A test of a single small piece of code in isolation",
            "A test written only by the customer",
            "A test that runs against the production database",
            "A test that always requires a browser",
        ],
        "answer": "A test of a single small piece of code in isolation",
    },
    {
        "id": "testing-mock",
        "skill": "Testing",
        "level": "intermediate",
        "question": "What is the purpose of a mock object in a test?",
        "options": [
            "Replace a real dependency so the test stays isolated and fast",
            "Speed up production code",
            "Compress test output",
            "Generate documentation",
        ],
        "answer": "Replace a real dependency so the test stays isolated and fast",
    },
    {
        "id": "testing-fixture",
        "skill": "Testing",
        "level": "advanced",
        "question": "In pytest, what does a fixture provide?",
        "options": [
            "Setup and teardown of data or resources for tests",
            "A way to skip every test",
            "A database migration",
            "A CSS assertion library",
        ],
        "answer": "Setup and teardown of data or resources for tests",
    },
    # --- REST ----------------------------------------------------------------
    {
        "id": "rest-put",
        "skill": "REST",
        "level": "beginner",
        "question": "Which HTTP method is normally used to replace a resource entirely?",
        "options": ["PUT", "POST", "CONNECT", "TRACE"],
        "answer": "PUT",
    },
    {
        "id": "rest-201",
        "skill": "REST",
        "level": "intermediate",
        "question": "Which status code should a successful resource creation normally return?",
        "options": ["201 Created", "200 OK", "404 Not Found", "500 Internal Server Error"],
        "answer": "201 Created",
    },
    {
        "id": "rest-stateless",
        "skill": "REST",
        "level": "advanced",
        "question": "What does stateless mean for a REST API?",
        "options": [
            "Each request carries everything it needs; the server keeps no session between them",
            "The server stores a session for every user",
            "Responses are never cached",
            "The API cannot use HTTPS",
        ],
        "answer": "Each request carries everything it needs; the server keeps no session between them",
    },
    # --- CI/CD ---------------------------------------------------------------
    {
        "id": "cicd-pipeline",
        "skill": "CI/CD",
        "level": "beginner",
        "question": "What does a CI/CD pipeline automate?",
        "options": [
            "Building, testing, and deploying code changes",
            "Writing documentation",
            "Designing database schemas",
            "Hiring developers",
        ],
        "answer": "Building, testing, and deploying code changes",
    },
    {
        "id": "cicd-early-tests",
        "skill": "CI/CD",
        "level": "intermediate",
        "question": "Why run tests on every pull request instead of only before a release?",
        "options": [
            "Problems surface earlier, when they are cheaper to fix",
            "It makes the repository smaller",
            "It removes the need for a staging environment",
            "It increases available API quota",
        ],
        "answer": "Problems surface earlier, when they are cheaper to fix",
    },
    # --- Linux ---------------------------------------------------------------
    {
        "id": "linux-chmod",
        "skill": "Linux",
        "level": "beginner",
        "question": "Which command changes a file's permissions in Linux?",
        "options": ["chmod", "chown", "ls -l", "touch"],
        "answer": "chmod",
    },
    {
        "id": "linux-grep",
        "skill": "Linux",
        "level": "intermediate",
        "question": "What does grep do?",
        "options": [
            "Searches text for lines matching a pattern",
            "Compresses files",
            "Starts a web server",
            "Lists open ports",
        ],
        "answer": "Searches text for lines matching a pattern",
    },
    {
        "id": "linux-pipe",
        "skill": "Linux",
        "level": "advanced",
        "question": "What does the | operator do in a shell command?",
        "options": [
            "Sends the output of one command as input to the next",
            "Runs two commands in parallel",
            "Cancels the current command",
            "Escapes special characters",
        ],
        "answer": "Sends the output of one command as input to the next",
    },
)

# Canonical question skill -> the other spellings a student may have typed.
#
# Matching is an exact, case-folded lookup built from this table, never a
# substring test. A substring match looks harmless until a new skill is added:
# "java" is a substring of "javascript", and "go" is a substring of "mongodb",
# so the old `key in skill` comparison would have handed JavaScript students a
# Java question the moment Java joined the table.
SKILL_ALIASES: dict[str, tuple[str, ...]] = {
    "React": ("reactjs", "react.js"),
    "JavaScript": ("js", "ecmascript", "vanilla js"),
    "Python": ("python3", "py"),
    "SQL": ("mysql", "postgres", "postgresql", "sqlite", "pl/sql"),
    "HTML": ("html5",),
    "CSS": ("css3", "sass", "scss"),
    "Git": ("github", "gitlab", "version control"),
    "MongoDB": ("mongo", "nosql"),
    "FastAPI": (),
    "Flask": (),
    "TensorFlow": ("tf",),
    "Node.js": ("nodejs", "node", "express"),
    "CrewAI": ("crew ai", "crew-ai"),
    "LangChain": ("lang chain", "langchain.js"),
    "LLM": (
        "llms",
        "large language models",
        "openai",
        "gemini",
        "genai",
        "generative ai",
        "chatgpt",
        "gpt",
    ),
    "TypeScript": ("ts", "typed javascript"),
    "Docker": ("containerisation", "containerization"),
    "Java": ("openjdk", "jdk", "spring"),
    "C#": ("csharp", "c sharp", ".net", "dotnet"),
    "AWS": ("amazon web services", "ec2", "s3"),
    "Testing": ("unit testing", "pytest", "jest", "tdd", "test automation"),
    "REST": ("rest api", "restful", "api design", "http api"),
    "CI/CD": (
        "cicd",
        "ci-cd",
        "continuous integration",
        "continuous delivery",
        "devops",
        "github actions",
        "jenkins",
    ),
    "Linux": ("ubuntu", "bash", "shell", "unix", "terminal"),
}

# Every accepted spelling maps to the canonical skill it belongs to, so a
# profile entry resolves to exactly one bucket with no prefix ambiguity.
_QUESTION_SKILL_BY_ALIAS: dict[str, str] = {
    alias.casefold(): skill.casefold()
    for skill, aliases in SKILL_ALIASES.items()
    for alias in (skill, *aliases)
}


def _questions_for_skill(
    skill_key: str, seen: set[str]
) -> list[AssessmentQuestion]:
    """Unseen questions tagged with exactly this canonical skill."""
    return [
        question
        for question in QUESTION_BANK
        if question["skill"].casefold() == skill_key and question["id"] not in seen
    ]


def _questions_for_skills(
    skill_keys: set[str], seen: set[str]
) -> list[AssessmentQuestion]:
    """Unseen questions tagged with any of the given canonical skills."""
    return [
        question
        for question in QUESTION_BANK
        if question["skill"].casefold() in skill_keys and question["id"] not in seen
    ]


def _pick_matching_level(
    pool: list[AssessmentQuestion], declared_level: str
) -> AssessmentQuestion:
    """Prefer the student's declared level, but never fail on a missing tier.

    Most skills have questions at only one or two levels, so insisting on an
    exact match would leave the assessment short. Fall back to the whole pool
    rather than dropping the skill.
    """
    wanted = declared_level.strip().casefold()
    exact = [question for question in pool if question["level"].casefold() == wanted]
    candidates = exact or pool
    random.shuffle(candidates)
    return candidates[0]


def select_assessment_questions(
    skills: Sequence[tuple[str, str]], limit: int = 5
) -> list[AssessmentQuestion]:
    """Pick up to `limit` questions matched to a student's declared skills.

    `skills` is a sequence of (name, level) pairs from the student profile. Each
    matched skill contributes one question, preferring the declared level. The
    result is then topped up in order of relevance: the student's own skills
    first, then the general bucket, then anything left - so a short profile is
    padded with questions the student might still answer, not with unrelated
    ones drawn at random.
    """
    candidates: list[AssessmentQuestion] = []
    seen: set[str] = set()
    matched_skills: set[str] = set()

    for name, level in skills:
        skill_key = _QUESTION_SKILL_BY_ALIAS.get(name.strip().casefold())
        if skill_key is None or skill_key in matched_skills:
            continue
        matched_skills.add(skill_key)
        pool = _questions_for_skill(skill_key, seen)
        if not pool:
            continue
        chosen = _pick_matching_level(pool, level)
        candidates.append(chosen)
        seen.add(chosen["id"])

    general_key = GENERAL_SKILL.casefold()
    top_ups = (
        _questions_for_skills(matched_skills, seen),
        _questions_for_skill(general_key, seen),
        [question for question in QUESTION_BANK if question["id"] not in seen],
    )
    for pool in top_ups:
        random.shuffle(pool)
        while pool and len(candidates) < limit:
            chosen = pool.pop()
            candidates.append(chosen)
            seen.add(chosen["id"])
        if len(candidates) >= limit:
            break

    random.shuffle(candidates)
    return candidates[:limit]
