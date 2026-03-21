#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_ROOT = ROOT / "templates"

PLACEHOLDER_PATTERN = re.compile(r"__([A-Z0-9_]+)__")

SUPPORTED_STACKS = {
    "mobile-react-native": "mobile-react-native/root",
    "web-nextjs": "web-nextjs/root",
}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    if not slug:
        raise ValueError("name must contain at least one letter or number")
    return slug


def render_text(raw: str, context: dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in context:
            raise KeyError(f"unknown placeholder: {key}")
        return context[key]

    return PLACEHOLDER_PATTERN.sub(replace, raw)


def collect_template_files(template_root: Path) -> list[Path]:
    return sorted(path for path in template_root.rglob("*") if path.is_file())


def ensure_destination(path: Path, force: bool) -> None:
    if path.exists() and any(path.iterdir()) and not force:
        raise ValueError(
            f"destination {path} is not empty; pass --force to write into a non-empty directory"
        )
    path.mkdir(parents=True, exist_ok=True)


def copy_template(
    template_root: Path, destination: Path, context: dict[str, str]
) -> None:
    for source in collect_template_files(template_root):
        relative = source.relative_to(template_root)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        rendered = render_text(source.read_text(encoding="utf-8"), context)
        target.write_text(rendered, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bootstrap a repository from a repo-owned template."
    )
    parser.add_argument(
        "--stack",
        required=True,
        choices=sorted(SUPPORTED_STACKS),
        help="Stack template to use.",
    )
    parser.add_argument(
        "--name",
        required=True,
        help="Repository or app name used for placeholder substitution.",
    )
    parser.add_argument(
        "--target",
        required=True,
        help="Target directory to create or update.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Allow writing into a non-empty destination directory.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    template_root = TEMPLATES_ROOT / SUPPORTED_STACKS[args.stack]
    if not template_root.is_dir():
        print(f"missing template directory: {template_root}", file=sys.stderr)
        return 1

    try:
        repo_name = slugify(args.name)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    destination = Path(args.target).expanduser().resolve()

    try:
        ensure_destination(destination, args.force)
        copy_template(
            template_root,
            destination,
            {
                "APP_NAME": repo_name,
                "REPO_NAME": repo_name,
                "STACK_NAME": args.stack,
            },
        )
    except (OSError, ValueError, KeyError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(f"Bootstrapped {args.stack} into {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
