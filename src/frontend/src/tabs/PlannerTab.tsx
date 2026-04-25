import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Shirt,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useI18n } from "../contexts/I18nContext";
import {
  useCreateTask,
  useDeletePlannerDayOutfit,
  useDeleteTask,
  useGetAllClothingItems,
  useGetAllOutfits,
  useGetAllPlannerDayOutfits,
  useGetAllTasks,
  useListTasksByDate,
  useSetPlannerDayOutfit,
  useUpdateTask,
} from "../hooks/useQueries";
import { useImageUpload } from "../hooks/useStorageUpload";
import type { ClothingItem, Outfit, PlannerDayOutfit } from "../types";
import { parseDateInput } from "../utils/dateParser";
import RoutineSection from "./RoutineSection";
import { OutfitCollage } from "./WardrobeTab";

type Priority = "None" | "High" | "Medium" | "Low";
type Recurring = "None" | "Daily" | "Weekly" | "Monthly";
interface TaskMeta {
  priority: Priority;
  startTime: string;
  endTime: string;
  recurring: Recurring;
}
const TASK_META_KEY = "sha_task_meta";
function getTaskMeta(taskId: string): TaskMeta {
  try {
    const all = JSON.parse(localStorage.getItem(TASK_META_KEY) || "{}");
    const stored = all[taskId];
    if (!stored)
      return {
        priority: "None",
        startTime: "",
        endTime: "",
        recurring: "None",
      };
    // legacy: map dueTime -> startTime
    if (stored.dueTime && !stored.startTime) stored.startTime = stored.dueTime;
    if (!stored.startTime) stored.startTime = "";
    if (!stored.endTime) stored.endTime = "";
    return stored;
  } catch {
    return { priority: "None", startTime: "", endTime: "", recurring: "None" };
  }
}
function setTaskMeta(taskId: string, meta: TaskMeta) {
  try {
    const all = JSON.parse(localStorage.getItem(TASK_META_KEY) || "{}");
    all[taskId] = meta;
    localStorage.setItem(TASK_META_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type PlannerView = "tasks" | "routine";

export default function PlannerTab() {
  const { t } = useI18n();
  const { resolvePhoto } = useImageUpload();
  const today = new Date();
  const [plannerView, setPlannerView] = useState<PlannerView>("tasks");
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(
    today.toISOString().split("T")[0],
  );
  const [newTitle, setNewTitle] = useState("");
  const [outfitPickerOpen, setOutfitPickerOpen] = useState(false);
  const [previewOutfit, setPreviewOutfit] = useState<Outfit | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newPriority, setNewPriority] = useState<Priority>("None");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newRecurring, setNewRecurring] = useState<Recurring>("None");
  const [dateHint, setDateHint] = useState("");
  const [rawDateInput, setRawDateInput] = useState("");

  const { data: allTasks } = useGetAllTasks();
  const { data: tasks, isLoading } = useListTasksByDate(selectedDate);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const { data: allOutfits = [] } = useGetAllOutfits();
  const { data: clothingItems = [] } = useGetAllClothingItems();
  const { data: plannerOutfits = [] } = useGetAllPlannerDayOutfits();
  const setPlannerOutfit = useSetPlannerDayOutfit();
  const deletePlannerOutfit = useDeletePlannerDayOutfit();

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const datesWithTasks = useMemo(() => {
    const set = new Set<string>();
    for (const task of allTasks || []) {
      set.add(task.date);
    }
    return set;
  }, [allTasks]);

  const plannerOutfitMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const po of plannerOutfits as PlannerDayOutfit[]) {
      map.set(po.date, po.outfitId.toString());
    }
    return map;
  }, [plannerOutfits]);

  const selectedDayOutfitId = plannerOutfitMap.get(selectedDate);
  const selectedDayOutfit = selectedDayOutfitId
    ? (allOutfits as Outfit[]).find(
        (o) => o.id.toString() === selectedDayOutfitId,
      )
    : null;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else setViewMonth(viewMonth + 1);
  };

  const addTask = async () => {
    if (!newTitle.trim()) return;
    let task: Awaited<ReturnType<typeof createTask.mutateAsync>> | undefined;
    try {
      task = await createTask.mutateAsync({
        title: newTitle.trim(),
        description: "",
        date: selectedDate,
      });
    } catch {
      // onError in useCreateTask already shows toast
      return;
    }
    if (
      task &&
      (newPriority !== "None" ||
        newStartTime ||
        newEndTime ||
        newRecurring !== "None")
    ) {
      setTaskMeta(task.id.toString(), {
        priority: newPriority,
        startTime: newStartTime,
        endTime: newEndTime,
        recurring: newRecurring,
      });
    }
    setNewTitle("");
    setNewPriority("None");
    setNewStartTime("");
    setNewEndTime("");
    setNewRecurring("None");
    setShowAdvanced(false);
    setDateHint("");
    setRawDateInput("");
  };

  const toggleTask = (task: {
    id: bigint;
    title: string;
    description: string;
    completed: boolean;
  }) => {
    updateTask.mutate({
      taskId: task.id,
      title: task.title,
      description: task.description,
      completed: !task.completed,
    });
  };

  const handlePickOutfit = async (outfit: Outfit) => {
    try {
      await setPlannerOutfit.mutateAsync({
        date: selectedDate,
        outfitId: outfit.id,
      });
      setOutfitPickerOpen(false);
      toast.success(`Outfit set for ${selectedDate}`);
    } catch {
      toast.error("Failed to set outfit");
    }
  };

  const handleRemoveOutfit = async () => {
    try {
      await deletePlannerOutfit.mutateAsync(selectedDate);
      toast.success("Outfit removed");
    } catch {
      toast.error("Failed to remove outfit");
    }
  };

  const todayStr = today.toISOString().split("T")[0];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* View toggle */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 pt-4 pb-3">
        <button
          type="button"
          data-ocid="planner.tab"
          onClick={() => setPlannerView("tasks")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            plannerView === "tasks"
              ? "bg-accent text-white shadow-md"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          📋 Tasks
        </button>
        <button
          type="button"
          data-ocid="planner.tab"
          onClick={() => setPlannerView("routine")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            plannerView === "routine"
              ? "bg-accent text-white shadow-md"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <RefreshCw className="w-3 h-3" />
          Routine
        </button>
      </div>

      <AnimatePresence mode="wait">
        {plannerView === "routine" ? (
          <motion.div
            key="routine"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <RoutineSection />
          </motion.div>
        ) : (
          <motion.div
            key="tasks"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
            className="flex-1 overflow-y-auto pb-28"
          >
            {/* Calendar */}
            <div className="mx-4">
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    data-ocid="planner.pagination_prev"
                    onClick={prevMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-sm text-foreground">
                    {monthName}
                  </span>
                  <button
                    type="button"
                    data-ocid="planner.pagination_next"
                    onClick={nextMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <div
                      key={d}
                      className="text-center text-xs text-muted-foreground font-medium py-1"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1">
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: spacer cells
                    <div key={`spacer-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                    (day) => {
                      const dateStr = formatDate(viewYear, viewMonth, day);
                      const isToday = dateStr === todayStr;
                      const isSelected = dateStr === selectedDate;
                      const hasTasks = datesWithTasks.has(dateStr);
                      const hasOutfit = plannerOutfitMap.has(dateStr);
                      return (
                        <button
                          type="button"
                          key={dateStr}
                          data-ocid="planner.tab"
                          onClick={() => setSelectedDate(dateStr)}
                          className={`relative flex items-center justify-center w-8 h-8 mx-auto rounded-full text-xs font-medium transition-all ${
                            isSelected
                              ? "bg-accent text-white shadow-glow"
                              : isToday
                                ? "border border-accent text-accent"
                                : "text-foreground hover:bg-muted"
                          }`}
                        >
                          {day}
                          {hasTasks && !isSelected && (
                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
                          )}
                          {hasOutfit && (
                            <span className="absolute -top-0.5 -right-0.5 text-[8px]">
                              👕
                            </span>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            </div>

            {/* Tasks for selected date */}
            <div className="mx-4 mt-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                  undefined,
                  {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  },
                )}
              </p>

              {isLoading ? (
                <div data-ocid="planner.loading_state" className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                  ))}
                </div>
              ) : tasks && tasks.length > 0 ? (
                <motion.div
                  className="space-y-2"
                  initial="hidden"
                  animate="visible"
                >
                  {tasks.map((task, idx) => (
                    <motion.div
                      key={task.id.toString()}
                      data-ocid={`planner.item.${idx + 1}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3"
                    >
                      <button
                        type="button"
                        data-ocid={`planner.checkbox.${idx + 1}`}
                        onClick={() => toggleTask(task)}
                        className="flex-shrink-0"
                      >
                        {task.completed ? (
                          <CheckSquare className="w-5 h-5 text-accent" />
                        ) : (
                          <Square className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-sm ${
                            task.completed
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {task.title}
                        </span>
                        {(() => {
                          const meta = getTaskMeta(task.id.toString());
                          const colors: Record<string, string> = {
                            High: "bg-red-500/15 text-red-600 dark:text-red-400",
                            Medium:
                              "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
                            Low: "bg-green-500/15 text-green-600 dark:text-green-400",
                          };
                          return (
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              {meta.priority !== "None" && (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${colors[meta.priority]}`}
                                >
                                  {meta.priority}
                                </span>
                              )}
                              {meta.startTime && (
                                <span className="text-[9px] text-muted-foreground">
                                  ▶ {meta.startTime}
                                </span>
                              )}
                              {meta.endTime && (
                                <span className="text-[9px] text-muted-foreground">
                                  ⏹ {meta.endTime}
                                </span>
                              )}
                              {meta.recurring !== "None" && (
                                <span className="text-[9px] text-muted-foreground">
                                  ↻ {meta.recurring}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <button
                        type="button"
                        data-ocid={`planner.delete_button.${idx + 1}`}
                        onClick={() => deleteTask.mutate(task.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div
                  data-ocid="planner.empty_state"
                  className="bg-card border border-border rounded-xl p-6 text-center"
                >
                  <p className="text-muted-foreground text-sm">
                    {t.noTasksToday}
                  </p>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
                  <Input
                    data-ocid="planner.input"
                    value={newTitle}
                    maxLength={255}
                    onChange={(e) => setNewTitle(e.target.value.slice(0, 255))}
                    onKeyDown={(e) => e.key === "Enter" && addTask()}
                    placeholder={t.taskTitle}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((p) => !p)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    aria-label="Advanced options"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform${showAdvanced ? " rotate-180" : ""}`}
                    />
                  </button>
                  <Button
                    data-ocid="planner.primary_button"
                    type="button"
                    onClick={addTask}
                    disabled={createTask.isPending || !newTitle.trim()}
                    size="icon"
                  >
                    {createTask.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {showAdvanced && (
                  <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">
                        Priority
                      </span>
                      <Select
                        value={newPriority}
                        onValueChange={(v) => setNewPriority(v as Priority)}
                      >
                        <SelectTrigger
                          data-ocid="planner.select"
                          className="h-7 text-xs flex-1"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            ["None", "High", "Medium", "Low"] as Priority[]
                          ).map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">
                        Start Time
                      </span>
                      <Input
                        data-ocid="planner.input"
                        type="time"
                        value={newStartTime}
                        onChange={(e) => setNewStartTime(e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">
                        End Time
                      </span>
                      <Input
                        data-ocid="planner.input"
                        type="time"
                        value={newEndTime}
                        onChange={(e) => setNewEndTime(e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">
                        Repeat
                      </span>
                      <Select
                        value={newRecurring}
                        onValueChange={(v) => setNewRecurring(v as Recurring)}
                      >
                        <SelectTrigger
                          data-ocid="planner.select"
                          className="h-7 text-xs flex-1"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            [
                              "None",
                              "Daily",
                              "Weekly",
                              "Monthly",
                            ] as Recurring[]
                          ).map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">
                        Date
                      </span>
                      <div className="flex-1">
                        <Input
                          data-ocid="planner.input"
                          value={rawDateInput}
                          onChange={(e) => {
                            setRawDateInput(e.target.value);
                            setDateHint("");
                          }}
                          onBlur={(e) => {
                            const parsed = parseDateInput(e.target.value);
                            if (
                              parsed !== e.target.value &&
                              parsed.match(/^\d{4}-\d{2}-\d{2}$/)
                            ) {
                              setDateHint(parsed);
                            }
                          }}
                          placeholder="today, tomorrow, next Monday…"
                          className="h-7 text-xs"
                        />
                        {dateHint && (
                          <p className="text-[10px] text-accent mt-0.5">
                            → {dateHint}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Outfit for today section */}
              <div className="mt-5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  {t.outfitForToday}
                </p>
                {selectedDayOutfit ? (
                  <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                    <button
                      type="button"
                      data-ocid="planner.open_modal_button"
                      onClick={() => setPreviewOutfit(selectedDayOutfit)}
                      className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-accent transition-all"
                      aria-label="Preview outfit"
                    >
                      <OutfitCollage
                        outfitId={selectedDayOutfit.id.toString()}
                        photoUrl={selectedDayOutfit.photoUrl}
                        clothingItems={clothingItems as ClothingItem[]}
                        resolvePhoto={resolvePhoto}
                        className="rounded-lg"
                      />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {selectedDayOutfit.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedDayOutfit.occasion}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveOutfit}
                      className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                      aria-label="Remove outfit"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <Button
                    data-ocid="planner.secondary_button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => setOutfitPickerOpen(true)}
                  >
                    <Shirt className="w-4 h-4" />
                    {t.pickOutfit}
                  </Button>
                )}
              </div>
            </div>

            {/* Outfit Picker Sheet */}
            {createPortal(
              <AnimatePresence>
                {outfitPickerOpen && (
                  <>
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/60"
                      style={{ zIndex: 9998 }}
                      onClick={() => setOutfitPickerOpen(false)}
                    />
                    {/* Flexbox centering wrapper — avoids framer x/y % transforms that clip in some viewports */}
                    <div
                      className="fixed inset-0 flex items-center justify-center pointer-events-none"
                      style={{ zIndex: 9999 }}
                    >
                      <motion.div
                        data-ocid="planner.modal"
                        initial={{ scale: 0.92, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.92, opacity: 0 }}
                        transition={{
                          type: "spring",
                          damping: 25,
                          stiffness: 300,
                        }}
                        style={{
                          transformOrigin: "center center",
                          pointerEvents: "auto",
                        }}
                        className="w-[90vw] max-w-[400px] bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-4 px-5 pt-4">
                          <h3 className="font-bold text-sm text-foreground">
                            {t.pickOutfit}
                          </h3>
                          <button
                            type="button"
                            data-ocid="planner.close_button"
                            onClick={() => setOutfitPickerOpen(false)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        {(allOutfits as Outfit[]).length === 0 ? (
                          <div className="text-center py-8">
                            <Shirt className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                              {t.noOutfits}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[70vh] overflow-y-auto px-5 pb-6">
                            {(allOutfits as Outfit[]).map((outfit, idx) => (
                              <button
                                type="button"
                                key={outfit.id.toString()}
                                data-ocid={`planner.item.${idx + 1}`}
                                onClick={() => handlePickOutfit(outfit)}
                                className="w-full bg-card border border-border rounded-xl p-3 flex items-center gap-3 hover:border-accent transition-colors"
                              >
                                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                                  <OutfitCollage
                                    outfitId={outfit.id.toString()}
                                    photoUrl={outfit.photoUrl}
                                    clothingItems={
                                      clothingItems as ClothingItem[]
                                    }
                                    resolvePhoto={resolvePhoto}
                                    className="rounded-lg"
                                  />
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">
                                    {outfit.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {outfit.occasion}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </>
                )}
              </AnimatePresence>,
              document.body,
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Outfit Preview Modal */}
      {createPortal(
        <AnimatePresence>
          {previewOutfit && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70"
                style={{ zIndex: 300 }}
                onClick={() => setPreviewOutfit(null)}
              />
              <motion.div
                data-ocid="planner.modal"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[360px] bg-background border border-border rounded-2xl overflow-hidden shadow-2xl"
                style={{ zIndex: 301 }}
              >
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <h3 className="font-bold text-base text-foreground">
                    {previewOutfit.name}
                  </h3>
                  <button
                    type="button"
                    data-ocid="planner.close_button"
                    onClick={() => setPreviewOutfit(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="w-full" style={{ height: 280 }}>
                  <OutfitCollage
                    outfitId={previewOutfit.id.toString()}
                    photoUrl={previewOutfit.photoUrl}
                    clothingItems={clothingItems as ClothingItem[]}
                    resolvePhoto={resolvePhoto}
                    className="w-full h-full object-cover"
                  />
                </div>
                {previewOutfit.occasion ? (
                  <div className="px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      {previewOutfit.occasion}
                    </p>
                  </div>
                ) : null}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
