// Wrapper around the core-infrastructure useActor hook.
// Binds the app's createActor function (from backend.ts) and exposes a fully-typed actor.
// Also calls registerCaller() immediately when actor becomes available so ALL
// backend write operations work without needing a separate registration step elsewhere.
import { useActor as _useActor } from "@caffeineai/core-infrastructure";
import { useEffect, useRef } from "react";
import { createActor } from "../backend";
import type {
  BudgetLimit,
  ClothingItem,
  Entry,
  FinanceSummary,
  Folder,
  Note,
  Outfit,
  PlannerDayOutfit,
  Routine,
  RoutineCompletion,
  Task,
  UserProfileView,
} from "../types";

/** Fully-typed interface for all backend actor methods used by this app. */
export interface BackendActor {
  // Profile
  getCallerUserProfile(): Promise<UserProfileView | null>;
  saveCallerUserProfile(profile: UserProfileView): Promise<void>;
  updatePreferences(
    language: string,
    darkMode: boolean,
    geminiApiKey: string,
    currency: string,
  ): Promise<void>;

  // Tasks
  getAllTasks(): Promise<Task[]>;
  listTasksByDate(date: string): Promise<Task[]>;
  createTask(title: string, description: string, date: string): Promise<Task>;
  updateTask(
    taskId: bigint,
    title: string,
    description: string,
    completed: boolean,
  ): Promise<Task>;
  deleteTask(taskId: bigint): Promise<void>;

  // Finance
  getAllEntries(): Promise<Entry[]>;
  createFinanceEntry(
    amount: number,
    entryType: string,
    category: string,
    description: string,
    date: string,
  ): Promise<Entry>;
  deleteEntry(entryId: bigint): Promise<void>;
  getSummary(): Promise<FinanceSummary>;

  // Notes
  getAllNotes(): Promise<Note[]>;
  createNote(
    title: string,
    body: string,
    folderId: bigint,
    tags: string[],
  ): Promise<Note>;
  updateNote(
    noteId: bigint,
    title: string,
    body: string,
    folderId: bigint,
    tags: string[],
  ): Promise<Note>;
  deleteNote(noteId: bigint): Promise<void>;

  // Folders
  getAllFolders(): Promise<Folder[]>;
  createFolder(name: string, color: string): Promise<Folder>;
  deleteFolder(folderId: bigint): Promise<void>;

  // Outfits
  getAllOutfits(): Promise<Outfit[]>;
  createOutfit(
    name: string,
    occasion: string,
    description: string,
    photoUrl: string,
    tags: string[],
  ): Promise<Outfit>;
  updateOutfit(
    outfitId: bigint,
    name: string,
    occasion: string,
    description: string,
    photoUrl: string,
    tags: string[],
  ): Promise<Outfit>;
  deleteOutfit(outfitId: bigint): Promise<void>;

  // Clothing
  getAllClothingItems(): Promise<ClothingItem[]>;
  createClothingItem(
    name: string,
    category: string,
    photoUrl: string,
  ): Promise<ClothingItem>;
  updateClothingItem(
    itemId: bigint,
    name: string,
    category: string,
    photoUrl: string,
  ): Promise<ClothingItem>;
  deleteClothingItem(itemId: bigint): Promise<void>;

  // Planner outfits
  getAllPlannerDayOutfits(): Promise<PlannerDayOutfit[]>;
  setPlannerDayOutfit(
    date: string,
    outfitId: bigint,
  ): Promise<PlannerDayOutfit>;
  deletePlannerDayOutfit(date: string): Promise<void>;

  // Routines
  getAllRoutines(): Promise<Routine[]>;
  createRoutine(name: string, timeOfDay: string): Promise<Routine>;
  updateRoutine(
    routineId: bigint,
    name: string,
    timeOfDay: string,
  ): Promise<Routine>;
  deleteRoutine(routineId: bigint): Promise<void>;
  setRoutineCompletion(
    date: string,
    completedRoutineIds: bigint[],
  ): Promise<RoutineCompletion>;
  getAllRoutineCompletions(): Promise<RoutineCompletion[]>;

  // Gym state
  getUserGymState(): Promise<string | null>;
  saveUserGymState(json: string): Promise<void>;

  // Budget Limits
  getAllBudgetLimits(): Promise<BudgetLimit[]>;
  createBudgetLimit(
    category: string,
    monthlyLimit: number,
  ): Promise<BudgetLimit>;
  updateBudgetLimit(
    id: bigint,
    category: string,
    monthlyLimit: number,
  ): Promise<BudgetLimit | null>;
  deleteBudgetLimit(id: bigint): Promise<boolean>;

  // Access control (internal — called for re-registration after canister deploys)
  _initializeAccessControl(): Promise<void>;

  // User registration — call once after login to register this principal as a user.
  // Idempotent and safe to call multiple times.
  registerCaller(): Promise<void>;
}

const RE_REGISTER_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
// Only re-register on focus if the page was hidden for at least 60 seconds
const MIN_HIDDEN_MS_FOR_REREGISTER = 60 * 1000;

/**
 * Runs the full registration sequence: _initializeAccessControl + registerCaller.
 * Both are idempotent. Errors are swallowed so a backend hiccup never crashes the hook.
 */
async function runRegistration(a: BackendActor): Promise<void> {
  try {
    await a._initializeAccessControl();
  } catch (err: unknown) {
    console.warn("[useActor] _initializeAccessControl failed:", err);
  }
  try {
    await a.registerCaller();
  } catch (err: unknown) {
    console.warn("[useActor] registerCaller failed:", err);
  }
}

export function useActor(): {
  actor: BackendActor | null;
  isFetching: boolean;
} {
  const result = _useActor(createActor);
  const typedActor = result.actor as unknown as BackendActor | null;

  // Keep a stable ref to the actor so the interval/focus handler always
  // calls the most recent version without needing to re-register them.
  const actorRef = useRef<BackendActor | null>(typedActor);
  actorRef.current = typedActor;

  // Track whether we've called the full registration for the current actor
  // instance to avoid calling it on every render.
  const lastRegisteredActorRef = useRef<BackendActor | null>(null);

  // Track when the page last became hidden so we can skip trivial re-registrations
  const hiddenAtRef = useRef<number | null>(null);

  // Run full registration (_initializeAccessControl + registerCaller) when the
  // actor first becomes available, and whenever the actor instance changes
  // (e.g. after a canister redeployment). This is the single authoritative place
  // where registration happens — App.tsx does NOT need to call registerCaller().
  useEffect(() => {
    if (!typedActor) return;
    if (typedActor === lastRegisteredActorRef.current) return;
    lastRegisteredActorRef.current = typedActor;
    void runRegistration(typedActor);
  }, [typedActor]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      }
    }

    async function handleFocus() {
      const hiddenAt = hiddenAtRef.current;
      if (
        hiddenAt !== null &&
        Date.now() - hiddenAt >= MIN_HIDDEN_MS_FOR_REREGISTER
      ) {
        const a = actorRef.current;
        if (a) await runRegistration(a);
      }
      hiddenAtRef.current = null;
    }

    const intervalId = setInterval(async () => {
      const a = actorRef.current;
      if (a) await runRegistration(a);
    }, RE_REGISTER_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", () => void handleFocus());

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", () => void handleFocus());
    };
  }, []); // intentionally empty — interval/focus listener registered once

  return {
    actor: typedActor,
    isFetching: result.isFetching,
  };
}
