# SPHEREx Explorer: common tasks. Run `make help` for the list.

BACKEND := backend
FRONTEND := frontend
UV := uv --directory $(BACKEND)

.PHONY: help setup dev dev-api dev-web check lint typecheck test test-live test-e2e build serve snapshot clean

help:
	@echo "make setup      install backend and frontend dependencies"
	@echo "make dev        API on :8000 and the web app with hot reload on :5173"
	@echo "make check      lint, type-check and unit tests for both halves"
	@echo "make test-live  tests that call the real IRSA and JPL services"
	@echo "make test-e2e   browser tests (starts its own servers)"
	@echo "make build      production build of the web app"
	@echo "make serve      one process on :8000 serving the API and the built app"
	@echo "make snapshot   rebuild the demo snapshot from live data"

setup:
	$(UV) sync
	cd $(FRONTEND) && npm ci
	cd $(FRONTEND) && npx playwright install chromium

dev:
	$(MAKE) -j2 dev-api dev-web

dev-api:
	$(UV) run uvicorn spherex_explorer.main:app --reload --port 8000

dev-web:
	cd $(FRONTEND) && npm run dev

lint:
	$(UV) run ruff check .
	$(UV) run ruff format --check .
	cd $(FRONTEND) && npm run lint

typecheck:
	$(UV) run mypy src
	cd $(FRONTEND) && npm run typecheck

test:
	$(UV) run pytest
	cd $(FRONTEND) && npm test

check: lint typecheck test

test-live:
	$(UV) run pytest -m live

test-e2e:
	cd $(FRONTEND) && npm run test:e2e

build:
	cd $(FRONTEND) && npm run build

serve: build
	$(UV) run uvicorn spherex_explorer.main:app --port 8000

snapshot:
	$(UV) run python scripts/build_snapshot.py

clean:
	rm -rf $(FRONTEND)/dist $(BACKEND)/.cache
