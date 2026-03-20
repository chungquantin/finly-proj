---
name: codebase-setup
description: Set up a local repository or project workspace by discovering the toolchain, asking only the missing clarifying questions, running the required setup commands, and verifying the result. Use when the user asks to set up a codebase, bootstrap a repo, install dependencies, get a project running locally, initialize env files, prepare databases, or says things like "Can you help to set up the code base?" or "set up this repo for me".
---

# Codebase Setup

Set up the project end to end instead of stopping at advice.

## Workflow

1. Inspect the repository before asking questions.
2. Read `docs/design-docs/harness-engineering-guide.md` before choosing a default stack.
3. Run `bash ./.agents/skills/codebase-setup/scripts/detect-setup-commands.sh --prompt "<user request>"` from the repo root to identify likely setup commands and any scaffold profile inferred from the request.
4. If the prompt already implies a stack such as Next.js, Tauri, Rust CLI, or Python app, do not ask the user to restate it.
5. Ask only the missing questions that materially affect the setup path. Keep them concrete:
   - Is this a web app, desktop app, Rust app, or Python app when the request is ambiguous?
   - What should the app or package be named?
   - Which app or package should be run if the repo contains multiple entry points?
   - Is local-only setup enough, or should external services such as Docker, databases, or cloud CLIs also be configured?
   - Are secrets already available via `.env`, `.env.local`, or a secret manager?
6. Default to monorepo-friendly locations from the harness engineering guide:
   - `apps/web` for web
   - `apps/desktop` for desktop
   - `crates/<name>` for Rust
   - `python/<name>` for Python
7. Prefer repo-native commands over invented ones. When a supported stack has a repo-owned bootstrap path, use it first:
   - Web Next.js app: `python3 scripts/bootstrap_codebase.py --stack web-nextjs --name <name> --target <path>`
8. When bootstrapping a new codebase without a repo-owned template yet, prefer the most direct official scaffold for the inferred stack:
   - Next.js web app: scaffold TypeScript first, then layer Tailwind CSS, shadcn/ui, Supabase, tRPC, Zustand, and WorkOS
   - Tauri desktop app: scaffold the desktop shell and keep the same frontend stack as the web profile
   - Rust app: scaffold a CLI with `clap`, add interactive prompts only when needed, and add `tokio` only if async work is required
   - Python app: create a local `.venv`, install typed Python tooling, and configure formatter, linter, and type checks
9. Execute the setup commands yourself. If network or sandbox restrictions block required work, rerun the failed command with escalation instead of stopping at analysis.
10. Initialize env files only from checked-in examples such as `.env.example` or `.env.local.example`. Do not fabricate secret values.
11. Ensure formatter, linter, and CI coverage are part of the setup plan from the beginning.
12. Verify the setup with the highest-signal local command available:
   - `make check`
   - repo `check` or `verify` script
   - otherwise a narrow smoke command such as `cargo check`, `pytest`, or `pnpm check` only if it is clearly the project norm
13. Report what was run, what still needs user input, and any remaining blockers.

## Guardrails

- Do not run destructive reset or cleanup commands unless the user explicitly asks.
- Do not claim setup is complete if required secrets, services, or network installs are still missing.
- When multiple setup paths are plausible, prefer the smallest path that gets one target running and say what you assumed.
- If the repo already looks installed, still verify rather than assuming it works.
- Treat linting, formatting, and CI as setup requirements, not optional follow-up polish.

## Notes

- Use the helper script output as a starting point, not as an authority.
- Read nearby docs such as `README.md`, `docs/`, or language-specific manifests before choosing between conflicting commands.
- When the project contains multiple ecosystems, set up prerequisites first and then the app-specific target the user cares about.
- Follow the default stack policy in `docs/design-docs/harness-engineering-guide.md` unless the user explicitly asks for a different stack.
