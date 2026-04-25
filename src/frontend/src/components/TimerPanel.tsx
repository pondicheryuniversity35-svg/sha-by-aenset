import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pause, Play, RefreshCw, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface Note {
  id: bigint;
  title: string;
  body: string;
}

interface TimerPanelProps {
  onClose: () => void;
  notes: Note[];
  onSaveToNote: (noteId: bigint, sessionText: string) => Promise<void>;
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatStopwatch(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function TimerPanel({ onClose, notes, onSaveToNote }: TimerPanelProps) {
  const [mode, setMode] = useState<"stopwatch" | "timer">("stopwatch");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerInput, setTimerInput] = useState({ mins: 5, secs: 0 });
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerDone, setTimerDone] = useState(false);
  const [saveTargetId, setSaveTargetId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const baseElapsedRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startStopwatch = () => {
    startTimeRef.current = Date.now();
    baseElapsedRef.current = elapsed;
    intervalRef.current = setInterval(() => {
      setElapsed(baseElapsedRef.current + (Date.now() - startTimeRef.current));
    }, 10);
    setRunning(true);
  };

  const pauseStopwatch = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
  };

  const resetStopwatch = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setElapsed(0);
  };

  const startTimer = () => {
    const totalMs = (timerInput.mins * 60 + timerInput.secs) * 1000;
    if (totalMs <= 0) return;
    setTimerRemaining(totalMs);
    setTimerDone(false);
    startTimeRef.current = Date.now();
    baseElapsedRef.current = totalMs;
    intervalRef.current = setInterval(() => {
      const remaining =
        baseElapsedRef.current - (Date.now() - startTimeRef.current);
      if (remaining <= 0) {
        setTimerRemaining(0);
        setTimerDone(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
        setRunning(false);
        return;
      }
      setTimerRemaining(remaining);
    }, 100);
    setRunning(true);
  };

  const resetTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setTimerDone(false);
    setTimerRemaining(0);
  };

  const handleSaveToNote = async () => {
    if (!saveTargetId) return;
    const noteId = BigInt(saveTargetId);
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    const text = `\u23f1 Study session: ${mins}m ${secs}s`;
    setSaving(true);
    try {
      await onSaveToNote(noteId, text);
      toast.success("Session saved to note");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl mx-4 mt-4 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">
          {mode === "stopwatch" ? "Stopwatch" : "Timer"}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              resetStopwatch();
              resetTimer();
              setMode(mode === "stopwatch" ? "timer" : "stopwatch");
            }}
            className="text-xs text-accent font-medium px-2 py-1 rounded-lg bg-accent/10"
          >
            Switch
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {mode === "stopwatch" ? (
        <div className="text-center">
          <div className="text-4xl font-mono font-bold text-foreground my-3">
            {formatStopwatch(elapsed)}
          </div>
          <div className="flex justify-center gap-2 mb-3">
            <Button
              size="sm"
              variant="outline"
              onClick={running ? pauseStopwatch : startStopwatch}
              className="gap-1"
            >
              {running ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {running ? "Pause" : "Start"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={resetStopwatch}
              className="gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
          </div>
          {!running && elapsed > 0 && notes.length > 0 && (
            <div className="mt-2 space-y-2">
              <Select value={saveTargetId} onValueChange={setSaveTargetId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Pick a note to save to" />
                </SelectTrigger>
                <SelectContent>
                  {notes.map((n) => (
                    <SelectItem key={n.id.toString()} value={n.id.toString()}>
                      {n.title || "Untitled"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="w-full"
                onClick={handleSaveToNote}
                disabled={!saveTargetId || saving}
              >
                {saving ? "Saving..." : "Save to Note"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center">
          {!running && timerRemaining === 0 && !timerDone ? (
            <div className="flex items-center justify-center gap-2 my-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Min</p>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={timerInput.mins}
                  onChange={(e) =>
                    setTimerInput((p) => ({
                      ...p,
                      mins: Math.max(0, Number.parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-16 text-center text-2xl font-mono font-bold bg-muted rounded-lg py-2 text-foreground border border-border"
                />
              </div>
              <span className="text-2xl font-bold text-foreground">:</span>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Sec</p>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={timerInput.secs}
                  onChange={(e) =>
                    setTimerInput((p) => ({
                      ...p,
                      secs: Math.min(
                        59,
                        Math.max(0, Number.parseInt(e.target.value) || 0),
                      ),
                    }))
                  }
                  className="w-16 text-center text-2xl font-mono font-bold bg-muted rounded-lg py-2 text-foreground border border-border"
                />
              </div>
            </div>
          ) : (
            <div
              className={`text-4xl font-mono font-bold my-3 ${
                timerDone ? "text-destructive animate-pulse" : "text-foreground"
              }`}
            >
              {timerDone ? "Time's Up! ⏰" : formatTime(timerRemaining)}
            </div>
          )}
          <div className="flex justify-center gap-2">
            {!running && timerRemaining === 0 && !timerDone ? (
              <Button size="sm" onClick={startTimer} className="gap-1">
                <Play className="w-4 h-4" /> Start
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={resetTimer}
                className="gap-1"
              >
                <RefreshCw className="w-4 h-4" /> Reset
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TimerPanel;
