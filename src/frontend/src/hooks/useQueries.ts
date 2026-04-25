import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
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
import { CACHE_KEYS, localCache } from "../utils/localCache";
import { type BackendActor, useActor } from "./useActor";

// Queries that change often (tasks, finance) — shorter stale window
const STALE_TIME_ACTIVE = 2 * 60 * 1000; // 2 minutes
// Queries that change rarely (notes, clothing, outfits, gym, folders) — longer stale window
const STALE_TIME_STATIC = 5 * 60 * 1000; // 5 minutes
// Keep data in memory for 10 minutes after all subscribers unmount (tab switches)
const GC_TIME = 10 * 60 * 1000;

function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Something went wrong. Please try again.";
}

function isUnauthorizedError(e: unknown): boolean {
  const msg = extractErrorMessage(e).toLowerCase();
  return (
    msg.includes("unauthorized") ||
    msg.includes("not authorized") ||
    msg.includes("user is not registered") ||
    msg.includes("caller is not registered")
  );
}

/**
 * Wraps a backend call with automatic re-registration on Unauthorized errors.
 * If the first call fails with an auth error, it calls registerCaller() and retries once.
 */
async function withAutoRegister<T>(
  actor: BackendActor,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e: unknown) {
    if (isUnauthorizedError(e)) {
      try {
        await actor._initializeAccessControl();
        await actor.registerCaller();
      } catch {
        // ignore re-registration errors, attempt the call anyway
      }
      return await fn();
    }
    throw e;
  }
}

/**
 * Returns a ref that always points to the latest actor.
 * Mutations must read actorRef.current INSIDE mutationFn so they never
 * capture a stale null reference from hook initialization time.
 */
function useActorRef(): React.MutableRefObject<BackendActor | null> {
  const { actor } = useActor();
  const actorRef = useRef<BackendActor | null>(actor);
  useEffect(() => {
    actorRef.current = actor;
  }, [actor]);
  return actorRef;
}

// ── Task hooks ────────────────────────────────────────────────────────────────

export function useGetAllTasks() {
  const { actor, isFetching } = useActor();
  return useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      if (!actor) return localCache.get<Task[]>(CACHE_KEYS.tasks) ?? [];
      const data = await actor.getAllTasks();
      localCache.set(CACHE_KEYS.tasks, data);
      return data;
    },
    enabled: !!actor && !isFetching,
    staleTime: STALE_TIME_ACTIVE,
    gcTime: GC_TIME,
    initialData: () => localCache.get<Task[]>(CACHE_KEYS.tasks) ?? [],
  });
}

export function useListTasksByDate(date: string) {
  const { actor, isFetching } = useActor();
  return useQuery<Task[]>({
    queryKey: ["tasks", date],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listTasksByDate(date);
    },
    enabled: !!actor && !isFetching && !!date,
    staleTime: STALE_TIME_ACTIVE,
    gcTime: GC_TIME,
  });
}

export function useCreateTask() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      title: string;
      description: string;
      date: string;
    }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.createTask(vars.title, vars.description, vars.date),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useUpdateTask() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      taskId: bigint;
      title: string;
      description: string;
      completed: boolean;
    }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.updateTask(vars.taskId, vars.title, vars.description, vars.completed),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useDeleteTask() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: bigint) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () => a.deleteTask(taskId));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

// ── Finance hooks ──────────────────────────────────────────────────────────────

export function useGetAllEntries() {
  const { actor, isFetching } = useActor();
  return useQuery<Entry[]>({
    queryKey: ["entries"],
    queryFn: async () => {
      if (!actor) return localCache.get<Entry[]>(CACHE_KEYS.entries) ?? [];
      const data = await actor.getAllEntries();
      localCache.set(CACHE_KEYS.entries, data);
      return data;
    },
    enabled: !!actor && !isFetching,
    staleTime: STALE_TIME_ACTIVE,
    gcTime: GC_TIME,
    initialData: () => localCache.get<Entry[]>(CACHE_KEYS.entries) ?? [],
  });
}

export function useGetSummary() {
  const { actor, isFetching } = useActor();
  return useQuery<FinanceSummary>({
    queryKey: ["summary"],
    queryFn: async () => {
      if (!actor) return { balance: 0, totalIncome: 0, totalExpenses: 0 };
      return actor.getSummary();
    },
    enabled: !!actor && !isFetching,
    staleTime: STALE_TIME_ACTIVE,
    gcTime: GC_TIME,
  });
}

export function useCreateEntry() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      amount: number;
      entryType: string;
      category: string;
      description: string;
      date: string;
    }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.createFinanceEntry(
          vars.amount,
          vars.entryType,
          vars.category,
          vars.description,
          vars.date,
        ),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useDeleteEntry() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: bigint) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () => a.deleteEntry(entryId));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

// ── Profile hooks ──────────────────────────────────────────────────────────────

export function useGetUserProfile() {
  const { actor, isFetching } = useActor();
  return useQuery<UserProfileView | null>({
    queryKey: ["profile"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !isFetching,
    staleTime: STALE_TIME_STATIC,
    gcTime: GC_TIME,
  });
}

export function useSaveUserProfile() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profile: UserProfileView) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () => a.saveCallerUserProfile(profile));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useUpdatePreferences() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      language: string;
      darkMode: boolean;
      geminiApiKey: string;
      currency: string;
    }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.updatePreferences(
          vars.language,
          vars.darkMode,
          vars.geminiApiKey,
          vars.currency,
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

// ── Notes hooks ────────────────────────────────────────────────────────────────

export function useGetAllNotes() {
  const { actor, isFetching } = useActor();
  return useQuery<Note[]>({
    queryKey: ["notes"],
    queryFn: async () => {
      if (!actor) return localCache.get<Note[]>(CACHE_KEYS.notes) ?? [];
      const data = await actor.getAllNotes();
      localCache.set(CACHE_KEYS.notes, data);
      return data;
    },
    enabled: !!actor && !isFetching,
    staleTime: STALE_TIME_STATIC,
    gcTime: GC_TIME,
    initialData: () => localCache.get<Note[]>(CACHE_KEYS.notes) ?? [],
  });
}

export function useDeleteNote() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: bigint) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () => a.deleteNote(noteId));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useCreateNote() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      title: string;
      body: string;
      folderId: bigint;
      tags: string[];
    }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.createNote(vars.title, vars.body, vars.folderId, vars.tags),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useUpdateNote() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      noteId: bigint;
      title: string;
      body: string;
      folderId: bigint;
      tags: string[];
    }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.updateNote(
          vars.noteId,
          vars.title,
          vars.body,
          vars.folderId,
          vars.tags,
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

// ── Folder hooks ────────────────────────────────────────────────────────────────

export function useGetAllFolders() {
  const { actor, isFetching } = useActor();
  return useQuery<Folder[]>({
    queryKey: ["folders"],
    queryFn: async () => {
      if (!actor) return localCache.get<Folder[]>(CACHE_KEYS.folders) ?? [];
      const data = await actor.getAllFolders();
      localCache.set(CACHE_KEYS.folders, data);
      return data;
    },
    enabled: !!actor && !isFetching,
    staleTime: STALE_TIME_STATIC,
    gcTime: GC_TIME,
    initialData: () => localCache.get<Folder[]>(CACHE_KEYS.folders) ?? [],
  });
}

export function useCreateFolder() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; color: string }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () => a.createFolder(vars.name, vars.color));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folders"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useDeleteFolder() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (folderId: bigint) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () => a.deleteFolder(folderId));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folders"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

// ── Outfit hooks ────────────────────────────────────────────────────────────────

export function useGetAllOutfits() {
  const { actor, isFetching } = useActor();
  return useQuery<Outfit[]>({
    queryKey: ["outfits"],
    queryFn: async () => {
      if (!actor) return localCache.get<Outfit[]>(CACHE_KEYS.outfits) ?? [];
      const data = await actor.getAllOutfits();
      localCache.set(CACHE_KEYS.outfits, data);
      return data;
    },
    enabled: !!actor && !isFetching,
    staleTime: STALE_TIME_STATIC,
    gcTime: GC_TIME,
    initialData: () => localCache.get<Outfit[]>(CACHE_KEYS.outfits) ?? [],
  });
}

export function useCreateOutfit() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name: string;
      occasion: string;
      description: string;
      photoUrl: string;
      tags: string[];
    }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.createOutfit(
          vars.name,
          vars.occasion,
          vars.description,
          vars.photoUrl,
          vars.tags,
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outfits"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useUpdateOutfit() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      outfitId: bigint;
      name: string;
      occasion: string;
      description: string;
      photoUrl: string;
      tags: string[];
    }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.updateOutfit(
          vars.outfitId,
          vars.name,
          vars.occasion,
          vars.description,
          vars.photoUrl,
          vars.tags,
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outfits"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useDeleteOutfit() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (outfitId: bigint) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () => a.deleteOutfit(outfitId));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outfits"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

// ── Clothing hooks ────────────────────────────────────────────────────────────

export function useGetAllClothingItems() {
  const { actor, isFetching } = useActor();
  return useQuery<ClothingItem[]>({
    queryKey: ["clothing"],
    queryFn: async () => {
      if (!actor)
        return localCache.get<ClothingItem[]>(CACHE_KEYS.clothing) ?? [];
      const data = await actor.getAllClothingItems();
      localCache.set(CACHE_KEYS.clothing, data);
      return data;
    },
    enabled: !!actor && !isFetching,
    staleTime: STALE_TIME_STATIC,
    gcTime: GC_TIME,
    initialData: () =>
      localCache.get<ClothingItem[]>(CACHE_KEYS.clothing) ?? [],
  });
}

export function useCreateClothingItem() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name: string;
      category: string;
      photoUrl: string;
    }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.createClothingItem(vars.name, vars.category, vars.photoUrl),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clothing"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useUpdateClothingItem() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      itemId: bigint;
      name: string;
      category: string;
      photoUrl: string;
    }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.updateClothingItem(
          vars.itemId,
          vars.name,
          vars.category,
          vars.photoUrl,
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clothing"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useDeleteClothingItem() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: bigint) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () => a.deleteClothingItem(itemId));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clothing"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

// ── Planner outfit hooks ────────────────────────────────────────────────────────

export function useGetAllPlannerDayOutfits() {
  const { actor, isFetching } = useActor();
  return useQuery<PlannerDayOutfit[]>({
    queryKey: ["plannerOutfits"],
    queryFn: async () => {
      if (!actor)
        return (
          localCache.get<PlannerDayOutfit[]>(CACHE_KEYS.plannerOutfits) ?? []
        );
      const data = await actor.getAllPlannerDayOutfits();
      localCache.set(CACHE_KEYS.plannerOutfits, data);
      return data;
    },
    enabled: !!actor && !isFetching,
    staleTime: STALE_TIME_STATIC,
    gcTime: GC_TIME,
    initialData: () =>
      localCache.get<PlannerDayOutfit[]>(CACHE_KEYS.plannerOutfits) ?? [],
  });
}

export function useSetPlannerDayOutfit() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { date: string; outfitId: bigint }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.setPlannerDayOutfit(vars.date, vars.outfitId),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plannerOutfits"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useDeletePlannerDayOutfit() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () => a.deletePlannerDayOutfit(date));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plannerOutfits"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

// ── Routine hooks ────────────────────────────────────────────────────────────────────────

export function useGetAllRoutines() {
  const { actor, isFetching } = useActor();
  return useQuery<Routine[]>({
    queryKey: ["routines"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllRoutines();
    },
    enabled: !!actor && !isFetching,
    staleTime: STALE_TIME_STATIC,
    gcTime: GC_TIME,
  });
}

export function useCreateRoutine() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; timeOfDay: string }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.createRoutine(vars.name, vars.timeOfDay),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useUpdateRoutine() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      routineId: bigint;
      name: string;
      timeOfDay: string;
    }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.updateRoutine(vars.routineId, vars.name, vars.timeOfDay),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useDeleteRoutine() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routineId: bigint) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () => a.deleteRoutine(routineId));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useSetRoutineCompletion() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { date: string; completedRoutineIds: bigint[] }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.setRoutineCompletion(vars.date, vars.completedRoutineIds),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routineCompletions"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useGetAllRoutineCompletions() {
  const { actor, isFetching } = useActor();
  return useQuery<RoutineCompletion[]>({
    queryKey: ["routineCompletions"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllRoutineCompletions();
    },
    enabled: !!actor && !isFetching,
    staleTime: STALE_TIME_STATIC,
    gcTime: GC_TIME,
  });
}

// ── Gym State hooks ────────────────────────────────────────────────────────────────────────

export function useGetGymState() {
  const { actor, isFetching } = useActor();
  return useQuery<string | null>({
    queryKey: ["gymState"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getUserGymState();
    },
    enabled: !!actor && !isFetching,
    staleTime: STALE_TIME_STATIC,
    gcTime: GC_TIME,
  });
}

export function useSaveGymState() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: string) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () => a.saveUserGymState(json));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gymState"] }),
    onError: (e) =>
      console.error("Failed to save gym state to ICP:", extractErrorMessage(e)),
  });
}

// ── Budget Limit hooks ──────────────────────────────────────────────────────────────────

export function useGetAllBudgetLimits() {
  const { actor, isFetching } = useActor();
  return useQuery<BudgetLimit[]>({
    queryKey: ["budgetLimits"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllBudgetLimits();
    },
    enabled: !!actor && !isFetching,
    staleTime: STALE_TIME_ACTIVE,
    gcTime: GC_TIME,
  });
}

export function useCreateBudgetLimit() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { category: string; monthlyLimit: number }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.createBudgetLimit(vars.category, vars.monthlyLimit),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgetLimits"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useUpdateBudgetLimit() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: bigint;
      category: string;
      monthlyLimit: number;
    }) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () =>
        a.updateBudgetLimit(vars.id, vars.category, vars.monthlyLimit),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgetLimits"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

export function useDeleteBudgetLimit() {
  const actorRef = useActorRef();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: bigint) => {
      const a = actorRef.current;
      if (!a) throw new Error("Not authenticated");
      return withAutoRegister(a, () => a.deleteBudgetLimit(id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgetLimits"] }),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}
