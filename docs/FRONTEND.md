# Frontend

Frontend guidance is intentionally minimal until a concrete client stack exists.

Until a project-specific exception is documented, use the default frontend stack from `docs/design-docs/harness-engineering-guide.md`:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- tRPC
- Zustand
- WorkOS

When bootstrapping a new repo-owned web frontend, prefer the deterministic `web-nextjs` template driven by `scripts/bootstrap_codebase.py` before falling back to external scaffolding commands.

When a frontend is introduced, document:

- UI architecture
- Design system constraints
- Accessibility requirements
- Test and validation strategy
- Agent-operable browser workflows
