def generate_ai_response(prompt: str) -> str:
    """
    Temporary AI service.

    This will later be connected to the CrewAI agents
    created by Member 5.
    """

    if not prompt.strip():
        return "Please provide a project-related question."

    return f"AI service received your request: {prompt}"