import { api } from "./api";

export interface MyTask {
  id: string;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  deadline: string | null;
  deadline_urgency: "none" | "soon" | "critical";
  assignee_id: string | null;
  assignee_name: string | null;
  board_id: string;
  board_name: string;
  column_id: string;
  column_name: string;
  is_done: boolean;
}

export type MyTasksView = "mine" | "others";
export type MyTasksSort =
  | "priority"
  | "-priority"
  | "deadline"
  | "-deadline"
  | "assignee";

export type TaskGroupKey = "important" | "inbox" | "done";

export interface TaskGroup {
  key: TaskGroupKey;
  label: string;
  tasks: MyTask[];
}

export interface AssigneeGroup {
  assignee_id: string | null;
  assignee_name: string;
  tasks: MyTask[];
}

interface MyTasksParams {
  view?: MyTasksView;
  sort?: MyTasksSort;
  search?: string;
}

export async function getMyTasks(
  workspaceId: string,
  params?: MyTasksParams
): Promise<MyTask[]> {
  const query = new URLSearchParams();

  if (params?.view) query.set("view", params.view);
  if (params?.sort) query.set("sort", params.sort);

  const search = params?.search?.trim();
  if (search) query.set("search", search);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return api.get<MyTask[]>(
    `/api/v1/workspaces/${workspaceId}/me/tasks${suffix}`
  );
}

export function groupMyTasks(tasks: MyTask[]): TaskGroup[] {
  const groups: TaskGroup[] = [
    {
      key: "important",
      label: "\u0412\u0430\u0436\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438",
      tasks: [],
    },
    { key: "inbox", label: "\u0412\u0445\u043e\u0434\u044f\u0449\u0438\u0435", tasks: [] },
    {
      key: "done",
      label:
        "\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438",
      tasks: [],
    },
  ];

  const important = groups[0];
  const inbox = groups[1];
  const done = groups[2];

  for (const task of tasks) {
    if (task.is_done) {
      done.tasks.push(task);
    } else if (task.priority === "high" || task.priority === "critical") {
      important.tasks.push(task);
    } else {
      inbox.tasks.push(task);
    }
  }

  return groups;
}

export function groupByAssignee(tasks: MyTask[]): AssigneeGroup[] {
  const groups = new Map<string, AssigneeGroup>();

  for (const task of tasks) {
    const key = task.assignee_id ?? "";
    const existing = groups.get(key);

    if (existing) {
      existing.tasks.push(task);
      continue;
    }

    groups.set(key, {
      assignee_id: task.assignee_id,
      assignee_name:
        task.assignee_id === null
          ? "\u0411\u0435\u0437 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f"
          : task.assignee_name ??
            "\u0411\u0435\u0437 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f",
      tasks: [task],
    });
  }

  return [...groups.values()].sort((left, right) => {
    const countDiff = right.tasks.length - left.tasks.length;
    if (countDiff !== 0) return countDiff;
    return left.assignee_name.localeCompare(right.assignee_name);
  });
}
