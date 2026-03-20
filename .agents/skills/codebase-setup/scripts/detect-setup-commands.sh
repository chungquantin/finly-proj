#!/usr/bin/env bash
set -euo pipefail

repo_root="$(pwd)"
prompt_text=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --prompt)
      prompt_text="${2:-}"
      shift 2
      ;;
    *)
      repo_root="$1"
      shift
      ;;
  esac
done

cd "$repo_root"

have() {
  [ -e "$1" ]
}

have_any() {
  for path in "$@"; do
    if [ -e "$path" ]; then
      return 0
    fi
  done
  return 1
}

package_manager() {
  if have pnpm-lock.yaml; then
    printf '%s\n' "pnpm"
  elif have yarn.lock; then
    printf '%s\n' "yarn"
  elif have bun.lockb; then
    printf '%s\n' "bun"
  elif have package-lock.json; then
    printf '%s\n' "npm"
  elif have package.json; then
    printf '%s\n' "npm"
  else
    printf '%s\n' ""
  fi
}

has_pkg_script() {
  [ -f package.json ] && rg -q "\"$1\"\\s*:" package.json
}

print_section() {
  printf '\n%s\n' "$1"
}

lower_prompt() {
  printf '%s' "$prompt_text" | tr '[:upper:]' '[:lower:]'
}

infer_profile() {
  local prompt
  prompt="$(lower_prompt)"

  if printf '%s' "$prompt" | rg -q "tauri|desktop app|desktop"; then
    printf '%s\n' "desktop-tauri"
  elif printf '%s' "$prompt" | rg -q "next\.js|nextjs|web app|frontend|react|shadcn|tailwind|supabase|trpc|zustand|workos"; then
    printf '%s\n' "web-nextjs"
  elif printf '%s' "$prompt" | rg -q "rust|clap|tokio|cli app|cli"; then
    printf '%s\n' "rust-cli"
  elif printf '%s' "$prompt" | rg -q "python|pyproject|venv|\.venv|mypy|pyright"; then
    printf '%s\n' "python-app"
  else
    printf '%s\n' "unknown"
  fi
}

print_profile_recommendations() {
  local profile="$1"

  print_section "Prompt-aware scaffold recommendations:"

  case "$profile" in
    web-nextjs)
      printf '%s\n' "- Inferred profile: web-nextjs"
      printf '%s\n' "- Preferred target: apps/web in a pnpm-managed monorepo"
      printf '%s\n' "- Repo-owned bootstrap: python3 scripts/bootstrap_codebase.py --stack web-nextjs --name <app-name> --target <path>"
      printf '%s\n' "- Fallback scaffold: npx create-next-app@latest apps/web --ts --tailwind --eslint --app"
      printf '%s\n' "- Follow-up stack: shadcn/ui, Supabase, tRPC, Zustand, WorkOS"
      printf '%s\n' "- Quality gates: pnpm lint, pnpm exec prettier --check ., pnpm exec tsc --noEmit"
      printf '%s\n' "- CI expectation: run lint, format check, and typecheck on pull requests"
      ;;
    desktop-tauri)
      printf '%s\n' "- Inferred profile: desktop-tauri"
      printf '%s\n' "- Preferred target: apps/desktop with the same frontend stack as the web profile"
      printf '%s\n' "- Scaffold: npm create tauri-app@latest apps/desktop"
      printf '%s\n' "- Follow-up stack: React, TypeScript, Tailwind CSS, shadcn/ui, Supabase, tRPC, Zustand, WorkOS"
      printf '%s\n' "- Quality gates: frontend lint and format checks plus cargo fmt, cargo clippy, and cargo check"
      printf '%s\n' "- CI expectation: validate both the frontend workspace and the Rust shell on pull requests"
      ;;
    rust-cli)
      printf '%s\n' "- Inferred profile: rust-cli"
      printf '%s\n' "- Preferred target: crates/<app-name>"
      printf '%s\n' "- Scaffold: cargo new crates/<app-name> --bin"
      printf '%s\n' "- Runtime stack: clap, interactive prompts only when needed, tokio only for async IO or concurrency"
      printf '%s\n' "- Quality gates: cargo fmt --all -- --check, cargo clippy --all-targets --all-features -- -D warnings, cargo test --all-features"
      printf '%s\n' "- CI expectation: run fmt, clippy, and tests on pull requests"
      ;;
    python-app)
      printf '%s\n' "- Inferred profile: python-app"
      printf '%s\n' "- Preferred target: python/<app-name>"
      printf '%s\n' "- Scaffold: python3 -m venv .venv"
      printf '%s\n' "- Packaging baseline: typed Python code with repo-local dependencies and configuration"
      printf '%s\n' "- Quality gates: python -m ruff check ., python -m ruff format --check ., python -m mypy ."
      printf '%s\n' "- CI expectation: run lint, format check, type check, and tests or smoke checks on pull requests"
      ;;
    *)
      printf '%s\n' "- No stack profile inferred from the prompt."
      printf '%s\n' "- Ask whether the user wants a web app, desktop app, Rust app, or Python app."
      ;;
  esac
}

echo "Repository: $repo_root"

if [ -n "$prompt_text" ]; then
  echo "Prompt: $prompt_text"
fi

profile="$(infer_profile)"

print_profile_recommendations "$profile"

print_section "Detected inputs:"
for path in Makefile package.json pnpm-lock.yaml yarn.lock bun.lockb package-lock.json Cargo.toml pyproject.toml requirements.txt setup.py go.mod docker-compose.yml docker-compose.yaml compose.yaml compose.yml .env.example .env.local.example .tool-versions .nvmrc .python-version rust-toolchain.toml rust-toolchain scripts/bootstrap_codebase.py templates/web-nextjs/root/package.json; do
  if have "$path"; then
    printf -- "- %s\n" "$path"
  fi
done

pm="$(package_manager)"

print_section "Likely setup commands:"

if [ -f Makefile ]; then
  for target in setup bootstrap install dev check verify; do
    if rg -q "^${target}:" Makefile; then
      printf -- "- make %s\n" "$target"
    fi
  done
fi

if [ -n "$pm" ]; then
  case "$pm" in
    pnpm)
      printf -- "- pnpm install\n"
      ;;
    yarn)
      printf -- "- yarn install\n"
      ;;
    bun)
      printf -- "- bun install\n"
      ;;
    npm)
      if [ -f package-lock.json ]; then
        printf -- "- npm ci\n"
      else
        printf -- "- npm install\n"
      fi
      ;;
  esac

  for script_name in setup bootstrap db:setup db:migrate migrate seed dev start check verify build; do
    if has_pkg_script "$script_name"; then
      printf -- "- %s run %s\n" "$pm" "$script_name"
    fi
  done
fi

if [ -f Cargo.toml ]; then
  printf -- "- cargo check\n"
  printf -- "- cargo test\n"
fi

if have_any pyproject.toml requirements.txt setup.py; then
  printf -- "- python3 -m venv .venv\n"
  if [ -f requirements.txt ]; then
    printf -- "- python3 -m pip install -r requirements.txt\n"
  fi
  if [ -f pyproject.toml ]; then
    printf -- "- python3 -m pip install -e .\n"
  fi
  printf -- "- pytest\n"
fi

if [ -f go.mod ]; then
  printf -- "- go mod download\n"
  printf -- "- go test ./...\n"
fi

if have_any docker-compose.yml docker-compose.yaml compose.yml compose.yaml; then
  printf -- "- docker compose up -d\n"
fi

if [ -f .env.example ]; then
  printf -- "- cp .env.example .env\n"
fi

if [ -f .env.local.example ]; then
  printf -- "- cp .env.local.example .env.local\n"
fi

print_section "Questions to resolve before setup:"

needs_question=0

if [ -f package.json ] && has_pkg_script dev && has_pkg_script start; then
  printf -- "- Which entrypoint matters for this setup: dev or start?\n"
  needs_question=1
fi

if have_any docker-compose.yml docker-compose.yaml compose.yml compose.yaml; then
  printf -- "- Should local services from Docker Compose be started, or is dependency installation only enough?\n"
  needs_question=1
fi

if have_any .env.example .env.local.example; then
  printf -- "- Are the required secret values available for the env template files?\n"
  needs_question=1
fi

if [ "$needs_question" -eq 0 ]; then
  printf -- "- No obvious clarification points detected from repository files.\n"
fi

if [ "$profile" = "unknown" ]; then
  printf -- "- Which default stack should be used: web-nextjs, desktop-tauri, rust-cli, or python-app?\n"
fi
