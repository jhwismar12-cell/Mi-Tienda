# Entry point for uvicorn matching technical specification:
# python -m uvicorn src.api:app --host 0.0.0.0 --port 8000
from backend.main import app

__all__ = ["app"]
