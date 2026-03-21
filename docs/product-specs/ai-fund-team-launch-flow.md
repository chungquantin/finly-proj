# Product Spec: AI Fund Team Launch Flow

## Status

Superseded by `lazy-investor-agentic-investment-team-prd.md` (2026-03-19)

## Objective

Define the first mobile user flow that lets a user configure a portfolio profile, review portfolio performance, and interact directly with specialized AI fund agents.

## Platforms And Services

- Mobile app: iOS (SwiftUI)
- Backend API: Python service for user data and orchestration endpoints
- Agent server: Python service for specialized agent execution

## Users

- Retail investor exploring AI-assisted fund execution
- Existing investor managing current holdings and goals

## User Flow

### Step 1: Portfolio Intake

The user must provide:

- Risk level
- Current portfolio holdings
- Current portfolio value in USD
- Investment horizon

Acceptance criteria:

- All four fields are visible and editable in one screen.
- User can continue to Step 2 after input.

### Step 2: Portfolio Dashboard + Team Windows

The user sees:

- Portfolio performance panel
- Four AI team windows:
  - Trader
  - Analyst
  - Fund Advisor
  - Researcher

Acceptance criteria:

- Dashboard screen clearly shows this is step 2.
- Each agent window is individually tappable.
- Agent windows present lightweight animation to communicate liveness.

### Step 3: Full Agent Interaction

When the user taps one agent window:

- Agent opens in full view.
- User can start/stop voice recording to express demand.

Acceptance criteria:

- Agent detail is full-screen.
- Voice recording control is available and stateful (idle, recording, saved/error).
- Microphone permission flow is handled in-app.

## UX Direction

- Visual tone: minimalism
- Illustration style: flat, character-centric windows for each agent
- Interaction: fast transitions, low visual noise, clear hierarchy

## Non-Goals (Current Slice)

- Portfolio analytics accuracy beyond mock display
- Real-time brokerage integrations
- Speech-to-text transcription pipeline
- Multi-user fund operations

## API Contract (Planned)

Python agent server should expose:

- Portfolio summary endpoint for dashboard metrics
- Agent session endpoint to open a selected role context
- Voice upload endpoint for recorded demand

Detailed schema and auth will be defined in a follow-up execution plan.
