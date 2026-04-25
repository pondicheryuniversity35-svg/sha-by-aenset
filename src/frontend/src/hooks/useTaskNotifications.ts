import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface TaskForNotif {
  id: bigint;
  title: string;
  date: string;
  completed: boolean;
}

interface TaskMeta {
  startTime?: string;
  endTime?: string;
  dueTime?: string; // legacy
}

const TASK_META_KEY = "sha_task_meta";

function readAllTaskMeta(): Record<string, TaskMeta> {
  try {
    const raw = localStorage.getItem(TASK_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function toHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function useTaskNotifications(allTasks: TaskForNotif[] | undefined) {
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermission>("default");
  const firedRef = useRef(new Set<string>());

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermissionStatus(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then((p) => setPermissionStatus(p));
      }
    }
  }, []);

  useEffect(() => {
    if (!allTasks) return;

    const check = () => {
      const today = new Date().toISOString().split("T")[0];
      const nowHHMM = toHHMM(new Date());
      const allMeta = readAllTaskMeta();

      const todayTasks = allTasks.filter(
        (t) => t.date === today && !t.completed,
      );

      for (const task of todayTasks) {
        const meta = allMeta[task.id.toString()] || {};
        const startTime = meta.startTime || meta.dueTime || "";
        const endTime = meta.endTime || "";

        if (startTime) {
          // 10 min before
          const warnTime = addMinutes(startTime, -10);
          const warnKey = `${task.id}-warn-${today}`;
          if (nowHHMM === warnTime && !firedRef.current.has(warnKey)) {
            firedRef.current.add(warnKey);
            const msg = `Starting in 10 minutes: ${task.title}`;
            toast(msg);
            if (
              typeof Notification !== "undefined" &&
              Notification.permission === "granted"
            ) {
              new Notification(task.title, { body: msg, icon: "/favicon.ico" });
            }
          }

          // At start
          const startKey = `${task.id}-start-${today}`;
          if (nowHHMM === startTime && !firedRef.current.has(startKey)) {
            firedRef.current.add(startKey);
            const msg = `Time to start: ${task.title}`;
            toast(msg);
            if (
              typeof Notification !== "undefined" &&
              Notification.permission === "granted"
            ) {
              new Notification(task.title, { body: msg, icon: "/favicon.ico" });
            }
          }
        }

        if (endTime) {
          // At end
          const endKey = `${task.id}-end-${today}`;
          if (nowHHMM === endTime && !firedRef.current.has(endKey)) {
            firedRef.current.add(endKey);
            const msg = `Task ending: ${task.title}`;
            toast(msg);
            if (
              typeof Notification !== "undefined" &&
              Notification.permission === "granted"
            ) {
              new Notification(task.title, { body: msg, icon: "/favicon.ico" });
            }
          }
        }
      }
    };

    // Run immediately on mount/update
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [allTasks]);

  return { permissionStatus };
}
