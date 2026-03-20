# Reliability

Reliability constraints should be encoded before scale makes them expensive.

## Current Requirements

- Repository structure checks must pass in CI
- Core harness docs must remain present and linked
- Non-trivial work should be tracked in execution plans

## Future Requirements

When runtime code exists, define:

- Startup expectations
- Performance budgets
- SLOs and alerting signals
- Failure handling and rollback strategy
- Agent-visible logs, metrics, and traces
