import os
import pathlib
import sys

# Configure before ANY core module import so provider-key validation passes
# without a real key. AGENTS_API_TOKEN stays unset (auth is exercised by
# monkeypatching the module global in the tests that need it).
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
os.environ.pop("AGENTS_API_TOKEN", None)

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))