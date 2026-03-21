#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parent.parent

REQUIRED_FILES = [
    "AGENTS.md",
    "README.md",
    "ARCHITECTURE.md",
    "scripts/bootstrap_codebase.py",
    "docs/PLANS.md",
    "docs/DESIGN.md",
    "docs/FRONTEND.md",
    "docs/PRODUCT_SENSE.md",
    "docs/QUALITY_SCORE.md",
    "docs/RELIABILITY.md",
    "docs/SECURITY.md",
    "docs/design-docs/index.md",
    "docs/design-docs/core-beliefs.md",
    "docs/design-docs/harness-engineering-guide.md",
    "docs/design-docs/harness-template.md",
    "docs/exec-plans/TEMPLATE.md",
    "docs/exec-plans/tech-debt-tracker.md",
    "docs/generated/README.md",
    "docs/product-specs/index.md",
    "docs/references/index.md",
    "templates/web-nextjs/root/package.json",
    "templates/web-nextjs/root/pnpm-workspace.yaml",
    "templates/web-nextjs/root/.github/workflows/ci.yml",
    "templates/web-nextjs/root/apps/web/package.json",
]

REQUIRED_DIRS = [
    "docs/exec-plans/active",
    "docs/exec-plans/completed",
]


def read_text(rel_path: str) -> str:
    return (ROOT / rel_path).read_text(encoding="utf-8")


def main() -> int:
    errors: list[str] = []

    for rel_path in REQUIRED_FILES:
        path = ROOT / rel_path
        if not path.is_file():
            errors.append(f"missing required file: {rel_path}")

    for rel_path in REQUIRED_DIRS:
        path = ROOT / rel_path
        if not path.is_dir():
            errors.append(f"missing required directory: {rel_path}")

    if errors:
        print("\n".join(errors))
        return 1

    agents = read_text("AGENTS.md")
    if len(agents.splitlines()) > 100:
        errors.append("AGENTS.md should stay at or under 100 lines")

    if "docs/" not in agents or "exec-plans" not in agents:
        errors.append("AGENTS.md must point to docs/ and execution plans")
    if "harness-template.md" not in agents:
        errors.append("AGENTS.md must reference docs/design-docs/harness-template.md")

    readme = read_text("README.md")
    if "check_harness_readiness.py" not in readme:
        errors.append("README.md should describe the harness readiness check")
    if "bootstrap_codebase.py" not in readme:
        errors.append("README.md should describe the bootstrap entrypoint")

    design_index = read_text("docs/design-docs/index.md")
    if "core-beliefs.md" not in design_index:
        errors.append("docs/design-docs/index.md must reference core-beliefs.md")
    if "harness-template.md" not in design_index:
        errors.append("docs/design-docs/index.md must reference harness-template.md")
    if "harness-engineering-guide.md" not in design_index:
        errors.append(
            "docs/design-docs/index.md must reference harness-engineering-guide.md"
        )

    harness_template = read_text("docs/design-docs/harness-template.md")
    if "AGENTS.md" not in harness_template or "execution plans" not in harness_template:
        errors.append(
            "docs/design-docs/harness-template.md must describe the core harness components"
        )

    harness_guide = read_text("docs/design-docs/harness-engineering-guide.md")
    if "bootstrap_codebase.py" not in harness_guide:
        errors.append(
            "docs/design-docs/harness-engineering-guide.md must reference the bootstrap script"
        )
    if "web-nextjs" not in harness_guide:
        errors.append(
            "docs/design-docs/harness-engineering-guide.md must document the first supported repo-owned stack"
        )

    plans_doc = read_text("docs/PLANS.md")
    if "TEMPLATE.md" not in plans_doc:
        errors.append("docs/PLANS.md must reference docs/exec-plans/TEMPLATE.md")

    setup_skill = read_text(".agents/skills/codebase-setup/SKILL.md")
    if "bootstrap_codebase.py" not in setup_skill:
        errors.append(
            "codebase setup skill must prefer the bootstrap script for supported stacks"
        )

    quality = read_text("docs/QUALITY_SCORE.md")
    if "Current Gaps" not in quality:
        errors.append("docs/QUALITY_SCORE.md must track current gaps")

    if errors:
        print("\n".join(errors))
        return 1

    print("Harness readiness check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
