import type { Board, Task } from "./types";

export function moveTaskInBoard(
  board: Board,
  taskId: string,
  targetColumnId: string,
  position: number
): Board {
  let taskToMove: Task | null = null;

  const columnsWithoutTask = board.columns.map((col) => {
    const taskIdx = col.tasks.findIndex((t) => t.id === taskId);
    if (taskIdx === -1) return col;
    taskToMove = col.tasks[taskIdx];
    return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
  });

  if (!taskToMove) return board;

  const movedTask: Task = { ...(taskToMove as Task), column_id: targetColumnId };

  const finalColumns = columnsWithoutTask.map((col) => {
    if (col.id !== targetColumnId) return col;
    const newTasks = [...col.tasks];
    const clampedPos = Math.min(position, newTasks.length);
    newTasks.splice(clampedPos, 0, movedTask);
    return { ...col, tasks: newTasks };
  });

  return { ...board, columns: finalColumns };
}

export function addTaskToColumn(board: Board, task: Task): Board {
  return {
    ...board,
    columns: board.columns.map((col) => {
      if (col.id !== task.column_id) return col;
      return { ...col, tasks: [...col.tasks, task] };
    }),
  };
}

export function replaceTask(board: Board, task: Task): Board {
  return {
    ...board,
    columns: board.columns.map((col) => ({
      ...col,
      tasks: col.tasks.map((t) => (t.id === task.id ? task : t)),
    })),
  };
}

export function deleteTask(board: Board, taskId: string): Board {
  return {
    ...board,
    columns: board.columns.map((col) => ({
      ...col,
      tasks: col.tasks.filter((t) => t.id !== taskId),
    })),
  };
}
