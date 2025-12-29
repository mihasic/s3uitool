.PHONY: test lint format run

test:
	PYTHONPATH=src uv run python -m pytest

lint:
	uv run ruff check .
	uv run mypy .

format:
	uv run ruff format .

run:
	uv run uvicorn src.main:app --reload --port 8000
