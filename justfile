set shell := ["zsh", "-cu"]

default:
  @just --list

setup: setup-frontend setup-python

format-fix: format

setup-frontend:
  cd apps/mobile && pnpm install --frozen-lockfile

setup-python:
  cd apps/agents && \
    python3 -m venv .venv && \
    . .venv/bin/activate && \
    pip install -e . && \
    if [[ ! -f .env ]]; then cp .env.example .env; fi
  cd apps/backend && \
    python3 -m venv .venv && \
    . .venv/bin/activate && \
    pip install -e . && \
    if [[ ! -f .env ]]; then cp .env.example .env; fi

mobile:
  cd apps/mobile && pnpm run dev

agent:
  cd apps/agents && if [[ -x .venv/bin/finly-agent-server ]]; then .venv/bin/finly-agent-server; elif [[ -x .venv/bin/python ]]; then .venv/bin/python main.py; else python3 main.py; fi

backend:
  cd apps/backend && if [[ -x .venv/bin/finly-backend-api ]]; then .venv/bin/finly-backend-api; elif [[ -x .venv/bin/python ]]; then .venv/bin/python main.py; else python3 main.py; fi

dev:
  (cd apps/mobile && pnpm run start) &
  (cd apps/agents && if [[ -x .venv/bin/finly-agent-server ]]; then .venv/bin/finly-agent-server; elif [[ -x .venv/bin/python ]]; then .venv/bin/python main.py; else python3 main.py; fi) &
  (cd apps/backend && if [[ -x .venv/bin/finly-backend-api ]]; then .venv/bin/finly-backend-api; elif [[ -x .venv/bin/python ]]; then .venv/bin/python main.py; else python3 main.py; fi) &
  wait

# Auto-format both codebases (matches .github/workflows/auto-format.yml)
format: format-ts format-py

format-ts:
  cd apps/mobile && \
    if [[ ! -x node_modules/.bin/prettier ]]; then pnpm install --frozen-lockfile; fi && \
    pnpm exec prettier --write .

format-py:
  if [[ -x apps/backend/.venv/bin/ruff ]]; then \
    apps/backend/.venv/bin/ruff format apps/agents apps/backend && \
    apps/backend/.venv/bin/ruff check apps/agents apps/backend --fix; \
  elif [[ -x apps/agents/.venv/bin/ruff ]]; then \
    apps/agents/.venv/bin/ruff format apps/agents apps/backend && \
    apps/agents/.venv/bin/ruff check apps/agents apps/backend --fix; \
  elif command -v ruff >/dev/null 2>&1; then \
    ruff format apps/agents apps/backend && \
    ruff check apps/agents apps/backend --fix; \
  else \
    python3 -m ruff format apps/agents apps/backend && \
    python3 -m ruff check apps/agents apps/backend --fix; \
  fi

# CI-like checks for both codebases (excluding tests)
lint: lint-ts lint-py

lint-ts:
  cd apps/mobile && \
    if [[ ! -x node_modules/.bin/prettier || ! -x node_modules/.bin/eslint || ! -x node_modules/.bin/tsc ]]; then pnpm install --frozen-lockfile; fi && \
    pnpm exec prettier --check . && \
    pnpm run lint:check && \
    pnpm run compile

lint-py:
  if [[ -x apps/backend/.venv/bin/python ]]; then \
    PYTHON=apps/backend/.venv/bin/python; \
  elif [[ -x apps/agents/.venv/bin/python ]]; then \
    PYTHON=apps/agents/.venv/bin/python; \
  else \
    PYTHON=python3; \
  fi; \
  "$PYTHON" -m ruff check apps/agents apps/backend && \
  "$PYTHON" -m build apps/agents && \
  "$PYTHON" -m build apps/backend && \
  "$PYTHON" -m py_compile apps/agents/main.py apps/backend/main.py && \
  find apps/agents/src apps/backend/src -name "*.py" -print0 | xargs -0 -n1 "$PYTHON" -m py_compile
