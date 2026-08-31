from fastapi import FastAPI
from app.services.ai_service import generate_ai_response

app = FastAPI(
    title="AI Academic Project Mentor API",
    description="Backend API for the AI Academic Project Mentor",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "AI Academic Project Mentor Backend is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/ai/test")
def test_ai():
    response = generate_ai_response(
        "I want to build an AI project mentor."
    )

    return {
        "response": response
    }