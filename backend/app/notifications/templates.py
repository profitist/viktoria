from __future__ import annotations

from html import escape
from typing import Any


def task_assigned_html(task: Any, user: Any) -> str:
    task_title = escape(str(task.title))
    user_name = escape(str(user.name))
    return f"""\
<!doctype html>
<html>
  <body>
    <h1>Task assigned</h1>
    <p>{user_name}, you were assigned to task: <strong>{task_title}</strong>.</p>
  </body>
</html>
"""


def comment_added_html(task: Any, comment: Any, user: Any) -> str:
    task_title = escape(str(task.title))
    comment_body = escape(str(comment.body))
    user_name = escape(str(user.name))
    return f"""\
<!doctype html>
<html>
  <body>
    <h1>New comment</h1>
    <p>{user_name} added a comment to task: <strong>{task_title}</strong>.</p>
    <blockquote>{comment_body}</blockquote>
  </body>
</html>
"""
