"""Unified CLI entrypoint for running VVWA quality gates locally and in CI."""

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.quality import (  # noqa: E402
    GateName,
    check_barrels,
    check_file_limits,
    classify_changed_files,
    execute_gate,
    git_changed_files,
    load_quality_config,
    print_result,
    validate_commit_message,
)

_ORDERED_GATES: tuple[GateName, ...] = ("hygiene", "docs", "backend", "frontend", "infra")


def _parse_args(argv: list[str]) -> argparse.Namespace:
    """Parse CLI arguments for the quality gate runner.

    Args:
        argv: Command-line argument vector excluding program name.

    Returns:
        Parsed argparse Namespace.
    """
    parser = argparse.ArgumentParser(description="VVWA Quality Gate Runner")
    parser.add_argument(
        "--gate",
        choices=["hygiene", "docs", "backend", "frontend", "infra", "all"],
        help="Run a specific quality gate or all gates.",
    )
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Automatically select gates based on git status changed files.",
    )
    parser.add_argument(
        "--allow-main",
        action="store_true",
        help="Allow 'main' branch during hygiene check (used in CI).",
    )
    parser.add_argument(
        "--check-commit-msg",
        type=Path,
        help="Validate a commit message file against Conventional Commits.",
    )
    parser.add_argument(
        "--check-file-limits",
        action="store_true",
        help="Run only the <=350 LOC file limit checker.",
    )
    parser.add_argument(
        "--check-barrels",
        action="store_true",
        help="Run only the barrel export and import boundary checker.",
    )
    return parser.parse_args(argv)


def _run_standalone_check(args: argparse.Namespace) -> int | None:
    """Execute single-purpose pre-commit flags when requested.

    Args:
        args: Parsed CLI arguments.

    Returns:
        Exit code if a standalone check ran, otherwise None.
    """
    if args.check_commit_msg is not None:
        message = args.check_commit_msg.read_text(encoding="utf-8")
        return 0 if print_result(validate_commit_message(message)) else 1
    if args.check_file_limits:
        config = load_quality_config(REPO_ROOT)
        return 0 if print_result(check_file_limits(REPO_ROOT, config)) else 1
    if args.check_barrels:
        config = load_quality_config(REPO_ROOT)
        return 0 if print_result(check_barrels(REPO_ROOT, config)) else 1
    return None


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint returning POSIX exit code 0 on success or 1 on failure.

    Args:
        argv: Optional argument list override for testing.

    Returns:
        Exit code integer (0 for pass, 1 for fail).
    """
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    standalone_exit = _run_standalone_check(args)
    if standalone_exit is not None:
        return standalone_exit

    if args.auto:
        selected = classify_changed_files(git_changed_files(REPO_ROOT))
        gates_to_run = [gate for gate in _ORDERED_GATES if gate in selected]
        print(f"Auto-selected gates: {', '.join(gates_to_run)}")
    elif args.gate == "all":
        gates_to_run = list(_ORDERED_GATES)
    elif args.gate is not None:
        gates_to_run = [args.gate]
    else:
        print("Specify --auto, --gate <name>, or a standalone --check-* flag.")
        return 1

    all_passed = all(
        execute_gate(gate, REPO_ROOT, allow_main=args.allow_main) for gate in gates_to_run
    )
    return 0 if all_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
