import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useCreateRoutine,
  useDeleteRoutine,
  useGetAllRoutineCompletions,
  useGetAllRoutines,
  useSetRoutineCompletion,
  useUpdateRoutine,
} from "../hooks/useQueries";
import type { Routine } from "../types";

const ROUTINE_TODAY_KEY = "sha_routine_today";
const ROUTINE_RESET_KEY = "sha_routine_reset_date";
const ROUTINE_HISTORY_KEY = "sha_routine_history";

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function getLocalHistory(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(ROUTINE_HISTORY_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLocalHistory(history: Record<string, string[]>) {
  localStorage.setItem(ROUTINE_HISTORY_KEY, JSON.stringify(history));
}

function getLocalTodayIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ROUTINE_TODAY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveTodayIds(ids: string[]) {
  localStorage.setItem(ROUTINE_TODAY_KEY, JSON.stringify(ids));
}

function checkMidnightReset() {
  const today = getTodayStr();
  const lastReset = localStorage.getItem(ROUTINE_RESET_KEY);
  if (lastReset !== today) {
    // Save yesterday's completions to history before clearing
    if (lastReset) {
      const hist = getLocalHistory();
      const todayIds = getLocalTodayIds();
      if (todayIds.length > 0) {
        hist[lastReset] = todayIds;
        saveLocalHistory(hist);
      }
    }
    saveTodayIds([]);
    localStorage.setItem(ROUTINE_RESET_KEY, today);
    return true;
  }
  return false;
}

export default function RoutineSection() {
  const { data: routines = [], isLoading } = useGetAllRoutines();
  const { data: completions = [] } = useGetAllRoutineCompletions();
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();
  const deleteRoutine = useDeleteRoutine();
  const setCompletion = useSetRoutineCompletion();

  const [todayCompletedIds, setTodayCompletedIds] = useState<Set<string>>(
    () => new Set(getLocalTodayIds()),
  );
  const [newName, setNewName] = useState("");
  const [newTimeOfDay, setNewTimeOfDay] = useState("Anytime");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTimeOfDay, setEditTimeOfDay] = useState("Anytime");

  // Midnight reset on mount
  useEffect(() => {
    checkMidnightReset();
    setTodayCompletedIds(new Set(getLocalTodayIds()));
  }, []);

  // Merge backend completions into local history on load
  useEffect(() => {
    if (completions.length === 0) return;
    const hist = getLocalHistory();
    for (const comp of completions) {
      const ids = comp.completedRoutineIds.map((id) => id.toString());
      hist[comp.date] = ids;
    }
    saveLocalHistory(hist);
    // Sync today's from backend if no local
    const today = getTodayStr();
    const todayBackend = completions.find((c) => c.date === today);
    if (todayBackend && getLocalTodayIds().length === 0) {
      const ids = todayBackend.completedRoutineIds.map((id) => id.toString());
      saveTodayIds(ids);
      setTodayCompletedIds(new Set(ids));
    }
  }, [completions]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const history = useMemo(() => {
    const h = getLocalHistory();
    // Add today
    const today = getTodayStr();
    h[today] = [...todayCompletedIds];
    return h;
  }, [todayCompletedIds]);

  const totalRoutines = routines.length;

  const streak = useMemo(() => {
    if (totalRoutines === 0) return 0;
    let count = 0;
    const d = new Date();
    d.setDate(d.getDate() - 1); // start from yesterday
    for (let i = 0; i < 365; i++) {
      const dateStr = d.toISOString().split("T")[0];
      const done = history[dateStr] || [];
      if (done.length >= totalRoutines) {
        count++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [history, totalRoutines]);

  const weekPct = useMemo(() => {
    if (totalRoutines === 0) return 0;
    let completeDays = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const done = history[dateStr] || [];
      if (done.length >= totalRoutines) completeDays++;
    }
    return Math.round((completeDays / 7) * 100);
  }, [history, totalRoutines]);

  const heatmap = useMemo(() => {
    const days: { date: string; ratio: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const done = (history[dateStr] || []).length;
      const ratio = totalRoutines > 0 ? done / totalRoutines : 0;
      days.push({ date: dateStr, ratio });
    }
    return days;
  }, [history, totalRoutines]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleToggle = async (routineId: string, checked: boolean) => {
    const next = new Set(todayCompletedIds);
    if (checked) next.add(routineId);
    else next.delete(routineId);
    setTodayCompletedIds(next);
    const ids = [...next];
    saveTodayIds(ids);
    // Save to history
    const hist = getLocalHistory();
    hist[getTodayStr()] = ids;
    saveLocalHistory(hist);
    // Sync to backend
    try {
      await setCompletion.mutateAsync({
        date: getTodayStr(),
        completedRoutineIds: ids.map((id) => BigInt(id)),
      });
    } catch {
      // silent
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createRoutine.mutateAsync({
        name: newName.trim(),
        timeOfDay: newTimeOfDay,
      });
      setNewName("");
      setNewTimeOfDay("Anytime");
      toast.success("Routine added");
    } catch {
      toast.error("Failed to add routine");
    }
  };

  const handleDelete = async (id: bigint) => {
    try {
      await deleteRoutine.mutateAsync(id);
      // Remove from today's completions
      const next = new Set(todayCompletedIds);
      next.delete(id.toString());
      setTodayCompletedIds(next);
      saveTodayIds([...next]);
      toast.success("Routine deleted");
    } catch {
      toast.error("Failed to delete routine");
    }
  };

  const startEdit = (r: Routine) => {
    setEditingId(r.id.toString());
    setEditName(r.name);
    setEditTimeOfDay(r.timeOfDay || "Anytime");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await updateRoutine.mutateAsync({
        routineId: BigInt(editingId),
        name: editName.trim(),
        timeOfDay: editTimeOfDay,
      });
      setEditingId(null);
      toast.success("Routine updated");
    } catch {
      toast.error("Failed to update routine");
    }
  };

  const todayDone = todayCompletedIds.size;
  const todayPct =
    totalRoutines > 0 ? Math.round((todayDone / totalRoutines) * 100) : 0;

  const timeColors: Record<string, string> = {
    Morning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    Evening: "bg-indigo-500/15 text-indigo-500 dark:text-indigo-400",
    Anytime: "bg-muted text-muted-foreground",
  };

  return (
    <div className="flex-1 overflow-y-auto pb-6 px-4 pt-4 space-y-4">
      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-4 space-y-4"
      >
        {/* Top stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-xl">{streak > 0 ? "🔥" : "💤"}</p>
            <p className="text-lg font-black text-foreground leading-none mt-1">
              {streak}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              day streak
            </p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-foreground leading-none">
              {weekPct}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">this week</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-foreground leading-none">
              {todayPct}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">today</p>
          </div>
        </div>

        {/* Heatmap */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
            Last 30 days
          </p>
          <div className="grid grid-cols-10 gap-1">
            {heatmap.map((day) => {
              const color =
                day.ratio >= 1
                  ? "bg-emerald-500"
                  : day.ratio > 0
                    ? "bg-yellow-400"
                    : "bg-muted";
              return (
                <div
                  key={day.date}
                  title={day.date}
                  className={`w-full aspect-square rounded-sm ${color} transition-colors`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-emerald-500" />
              <span className="text-[9px] text-muted-foreground">All done</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-yellow-400" />
              <span className="text-[9px] text-muted-foreground">Partial</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-muted" />
              <span className="text-[9px] text-muted-foreground">None</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Today's routines */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Today —{" "}
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (routines as Routine[]).length === 0 ? (
          <div
            data-ocid="routine.empty_state"
            className="bg-card border border-border rounded-xl p-6 text-center"
          >
            <p className="text-muted-foreground text-sm">
              No routines yet. Add one below!
            </p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-2">
              {(routines as Routine[]).map((routine, idx) => {
                const isDone = todayCompletedIds.has(routine.id.toString());
                const isEditing = editingId === routine.id.toString();
                return (
                  <motion.div
                    key={routine.id.toString()}
                    data-ocid={`routine.item.${idx + 1}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`bg-card border rounded-xl px-4 py-3 transition-colors ${
                      isDone
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-border"
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          data-ocid="routine.input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 text-xs"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Select
                            value={editTimeOfDay}
                            onValueChange={setEditTimeOfDay}
                          >
                            <SelectTrigger className="h-7 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Morning">Morning</SelectItem>
                              <SelectItem value="Evening">Evening</SelectItem>
                              <SelectItem value="Anytime">Anytime</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            data-ocid="routine.save_button"
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={updateRoutine.isPending}
                          >
                            {updateRoutine.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                          <Button
                            data-ocid="routine.cancel_button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Checkbox
                          data-ocid={`routine.checkbox.${idx + 1}`}
                          checked={isDone}
                          onCheckedChange={(checked) =>
                            handleToggle(routine.id.toString(), !!checked)
                          }
                          className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                        />
                        <div className="flex-1 min-w-0">
                          <span
                            className={`text-sm font-medium ${
                              isDone
                                ? "line-through text-muted-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {routine.name}
                          </span>
                          {routine.timeOfDay &&
                            routine.timeOfDay !== "Anytime" && (
                              <span
                                className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                  timeColors[routine.timeOfDay] ||
                                  timeColors.Anytime
                                }`}
                              >
                                {routine.timeOfDay}
                              </span>
                            )}
                        </div>
                        <button
                          type="button"
                          data-ocid={`routine.edit_button.${idx + 1}`}
                          onClick={() => startEdit(routine)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          data-ocid={`routine.delete_button.${idx + 1}`}
                          onClick={() => handleDelete(routine.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Add new routine */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Add Routine
        </p>
        <Input
          data-ocid="routine.input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="e.g. Drink water, Meditate, Exercise..."
          className="text-sm"
        />
        <div className="flex gap-2">
          <Select value={newTimeOfDay} onValueChange={setNewTimeOfDay}>
            <SelectTrigger
              data-ocid="routine.select"
              className="h-9 text-sm flex-1"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Morning">🌅 Morning</SelectItem>
              <SelectItem value="Evening">🌙 Evening</SelectItem>
              <SelectItem value="Anytime">⏰ Anytime</SelectItem>
            </SelectContent>
          </Select>
          <Button
            data-ocid="routine.primary_button"
            onClick={handleAdd}
            disabled={createRoutine.isPending || !newName.trim()}
            className="gap-1.5"
          >
            {createRoutine.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pb-2">
        Routines reset automatically at midnight every day
      </p>
    </div>
  );
}
