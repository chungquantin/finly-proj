set shell := ["zsh", "-cu"]

default:
  @just --list

mobile:
  cd apps/mobile
  pnpm run dev

agent:
  cd apps/agents
  if [[ -x .venv/bin/finly-agents-api ]]; then .venv/bin/finly-agents-api; elif [[ -x .venv/bin/python ]]; then .venv/bin/python main.py; else python3 main.py; fi

dev:
  (cd apps/mobile && pnpm run start) &
  (cd apps/agents && if [[ -x .venv/bin/finly-agents-api ]]; then .venv/bin/finly-agents-api; elif [[ -x .venv/bin/python ]]; then .venv/bin/python main.py; else python3 main.py; fi) &
  wait
