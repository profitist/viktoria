#!/usr/bin/env python3
"""Синхронизация статусов задач в project/KANBAN.md с GitHub Issues.

Источник истины: GitHub Issues с лейблами iter:I-XX.
Назначение: ячейки Status и Owner в markdown-таблицах внутри KANBAN.md.

Запускается как `python scripts/sync-kanban.py` локально или из GitHub Actions.
Требует `gh` в PATH и аутентификацию.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

KANBAN_PATH = Path("project/KANBAN.md")
ITER_LABEL_PREFIX = "iter:"

ITERATION_HEADER_RE = re.compile(r"^## Iteration (I-\d+)", re.MULTILINE)
TABLE_ROW_RE = re.compile(
    r"^\| (T-\d+) \| ([^|]+) \| ([^|]+) \| ([^|]*) \| ([^|]+) \| ([^|]*) \| ([^|]+) \|$",
    re.MULTILINE,
)


class SyncError(Exception):
    """Ошибка синхронизации KANBAN."""


def run_gh(args: list[str]) -> str:
    """Запустить gh CLI и вернуть stdout. Падает при ненулевом коде."""
    result = subprocess.run(
        ["gh", *args], capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        raise SyncError(
            f"gh {' '.join(args)} failed (rc={result.returncode}): {result.stderr.strip()}"
        )
    return result.stdout


def fetch_all_issues() -> list[dict]:
    """Получить все issues репо с лейблами, ассигни и состоянием."""
    output = run_gh([
        "issue", "list",
        "--state", "all",
        "--limit", "500",
        "--json", "number,state,assignees,labels",
    ])
    return json.loads(output)


def iter_label(issue: dict) -> str | None:
    """Вернуть лейбл iter:I-XX или None."""
    for label in issue["labels"]:
        name = label["name"]
        if name.startswith(ITER_LABEL_PREFIX):
            return name
    return None


def derive_status(issue: dict) -> str:
    """state+assignees → status для KANBAN."""
    if issue["state"].upper() == "CLOSED":
        return "done"
    if issue["assignees"]:
        return "in progress"
    return "todo"


def derive_owner(issue: dict) -> str:
    """Первый assignee с @ или прочерк."""
    if not issue["assignees"]:
        return "—"
    return f"@{issue['assignees'][0]['login']}"


def build_issue_map(issues: list[dict]) -> dict[int, dict]:
    """{ issue_number → {status, owner, iter} } только для issues с iter-лейблом."""
    mapping: dict[int, dict] = {}
    for issue in issues:
        label = iter_label(issue)
        if label is None:
            continue
        mapping[issue["number"]] = {
            "status": derive_status(issue),
            "owner": derive_owner(issue),
            "iter": label.removeprefix(ITER_LABEL_PREFIX),
        }
    return mapping


def parse_issue_number(cell: str) -> int | None:
    """Из ячейки 'Issue' (например '#42' или '—') достать номер."""
    match = re.search(r"#(\d+)", cell)
    return int(match.group(1)) if match else None


def update_row(line: str, issue_map: dict[int, dict]) -> tuple[str, bool]:
    """Обновить одну строку таблицы. Возвращает (новая строка, было ли изменение)."""
    match = TABLE_ROW_RE.match(line)
    if not match:
        return line, False
    task_id, title, module, owner, status, issue_cell, files = match.groups()
    issue_num = parse_issue_number(issue_cell)
    if issue_num is None or issue_num not in issue_map:
        return line, False
    info = issue_map[issue_num]
    new_owner = f" {info['owner']} "
    new_status = f" {info['status']} "
    if owner.strip() == info["owner"] and status.strip() == info["status"]:
        return line, False
    new_line = (
        f"| {task_id} |{title}|{module}|{new_owner}|{new_status}|{issue_cell}|{files}|"
    )
    return new_line, True


def sync_kanban(kanban_text: str, issue_map: dict[int, dict]) -> tuple[str, int]:
    """Применить обновления ко всему файлу. Возвращает (новый текст, число изменений)."""
    new_lines: list[str] = []
    changes = 0
    for line in kanban_text.splitlines():
        new_line, changed = update_row(line, issue_map)
        if changed:
            changes += 1
        new_lines.append(new_line)
    return "\n".join(new_lines) + ("\n" if kanban_text.endswith("\n") else ""), changes


def main() -> int:
    if not KANBAN_PATH.exists():
        raise SyncError(f"KANBAN не найден: {KANBAN_PATH}")
    issues = fetch_all_issues()
    issue_map = build_issue_map(issues)
    if not issue_map:
        print("Нет issues с лейблом iter:*. Нечего синхронизировать.")
        return 0
    original = KANBAN_PATH.read_text(encoding="utf-8")
    updated, changes = sync_kanban(original, issue_map)
    if changes == 0:
        print(f"KANBAN.md уже актуален ({len(issue_map)} issues проверено).")
        return 0
    KANBAN_PATH.write_text(updated, encoding="utf-8")
    print(f"Обновлено строк: {changes} (из {len(issue_map)} issues).")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SyncError as exc:
        print(f"sync-kanban: {exc}", file=sys.stderr)
        sys.exit(1)