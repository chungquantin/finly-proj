# Frontend

Frontend guidance is intentionally minimal until a concrete client stack exists.

For web frontends, use the default web stack from `docs/design-docs/harness-engineering-guide.md`:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- tRPC
- Zustand
- WorkOS

For mobile frontends, use the default iOS stack profile:

- Swift
- SwiftUI
- XcodeGen

When bootstrapping a new repo-owned web frontend, prefer the deterministic `web-nextjs` template driven by `scripts/bootstrap_codebase.py` before falling back to external scaffolding commands.

When bootstrapping a new repo-owned iOS frontend, prefer the deterministic `ios-swiftui` template driven by `scripts/bootstrap_codebase.py`.

When a frontend is introduced, document:

- UI architecture
- Design system constraints
- Accessibility requirements
- Test and validation strategy
- Agent-operable browser workflows
