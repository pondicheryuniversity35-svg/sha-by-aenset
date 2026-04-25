import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Note {
    id: bigint;
    title: string;
    body: string;
    tags: Array<string>;
    timestamp: Time;
    folderId: bigint;
}
export type Time = bigint;
export type User = Principal;
export interface Preferences {
    geminiApiKey: string;
    language: string;
    darkMode: boolean;
    currency: string;
}
export interface Task {
    id: bigint;
    title: string;
    date: string;
    user: User;
    completed: boolean;
    description: string;
    timestamp: Time;
}
export interface ClothingItem {
    id: bigint;
    name: string;
    photoUrl: string;
    timestamp: Time;
    category: string;
}
export interface PlannerDayOutfit {
    outfitId: bigint;
    date: string;
}
export interface RoutineCompletion {
    date: string;
    completedRoutineIds: Array<bigint>;
}
export interface Entry {
    id: bigint;
    entryType: string;
    date: string;
    description: string;
    timestamp: Time;
    category: string;
    amount: number;
}
export interface BudgetLimit {
    id: bigint;
    monthlyLimit: number;
    createdAt: bigint;
    category: string;
}
export interface UserProfileView {
    tasks: Array<Task>;
    name: string;
    email: string;
    preferences: Preferences;
    registrationTime: Time;
    finances: Array<Entry>;
}
export interface Outfit {
    id: bigint;
    name: string;
    tags: Array<string>;
    description: string;
    photoUrl: string;
    occasion: string;
    timestamp: Time;
}
export interface Folder {
    id: bigint;
    name: string;
    color: string;
    timestamp: Time;
}
export interface Routine {
    id: bigint;
    name: string;
    timestamp: Time;
    timeOfDay: string;
}
export interface FinanceSummary {
    balance: number;
    totalIncome: number;
    totalExpenses: number;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createBudgetLimit(category: string, monthlyLimit: number): Promise<BudgetLimit>;
    createClothingItem(name: string, category: string, photoUrl: string): Promise<ClothingItem>;
    createFinanceEntry(amount: number, entryType: string, category: string, description: string, date: string): Promise<Entry>;
    createFolder(name: string, color: string): Promise<Folder>;
    createNote(title: string, body: string, folderId: bigint, tags: Array<string>): Promise<Note>;
    createOutfit(name: string, occasion: string, description: string, photoUrl: string, tags: Array<string>): Promise<Outfit>;
    createRoutine(name: string, timeOfDay: string): Promise<Routine>;
    createTask(title: string, description: string, date: string): Promise<Task>;
    deleteBudgetLimit(id: bigint): Promise<boolean>;
    deleteClothingItem(itemId: bigint): Promise<void>;
    deleteEntry(entryId: bigint): Promise<void>;
    deleteFolder(folderId: bigint): Promise<void>;
    deleteNote(noteId: bigint): Promise<void>;
    deleteOutfit(outfitId: bigint): Promise<void>;
    deletePlannerDayOutfit(date: string): Promise<void>;
    deleteRoutine(routineId: bigint): Promise<void>;
    deleteTask(taskId: bigint): Promise<void>;
    ensureUserRegistered(): Promise<boolean>;
    getAllBudgetLimits(): Promise<Array<BudgetLimit>>;
    getAllClothingItems(): Promise<Array<ClothingItem>>;
    getAllEntries(): Promise<Array<Entry>>;
    getAllFolders(): Promise<Array<Folder>>;
    getAllNotes(): Promise<Array<Note>>;
    getAllOutfits(): Promise<Array<Outfit>>;
    getAllPlannerDayOutfits(): Promise<Array<PlannerDayOutfit>>;
    getAllRoutineCompletions(): Promise<Array<RoutineCompletion>>;
    getAllRoutines(): Promise<Array<Routine>>;
    getAllTasks(): Promise<Array<Task>>;
    getCallerUserProfile(): Promise<UserProfileView | null>;
    getCallerUserRole(): Promise<UserRole>;
    getPlannerDayOutfit(date: string): Promise<PlannerDayOutfit | null>;
    getRoutineCompletion(date: string): Promise<RoutineCompletion | null>;
    getSummary(): Promise<FinanceSummary>;
    getUserGymState(): Promise<string | null>;
    getUserProfile(user: Principal): Promise<UserProfileView | null>;
    isCallerAdmin(): Promise<boolean>;
    listEntriesByType(entryType: string): Promise<Array<Entry>>;
    listTasksByDate(date: string): Promise<Array<Task>>;
    registerCaller(): Promise<void>;
    saveCallerUserProfile(profile: UserProfileView): Promise<void>;
    saveUserGymState(json: string): Promise<void>;
    setPlannerDayOutfit(date: string, outfitId: bigint): Promise<PlannerDayOutfit>;
    setRoutineCompletion(date: string, completedRoutineIds: Array<bigint>): Promise<RoutineCompletion>;
    updateBudgetLimit(id: bigint, category: string, monthlyLimit: number): Promise<BudgetLimit | null>;
    updateClothingItem(itemId: bigint, name: string, category: string, photoUrl: string): Promise<ClothingItem>;
    updateNote(noteId: bigint, title: string, body: string, folderId: bigint, tags: Array<string>): Promise<Note>;
    updateOutfit(outfitId: bigint, name: string, occasion: string, description: string, photoUrl: string, tags: Array<string>): Promise<Outfit>;
    updatePreferences(language: string, darkMode: boolean, geminiApiKey: string, currency: string): Promise<void>;
    updateRoutine(routineId: bigint, name: string, timeOfDay: string): Promise<Routine>;
    updateTask(taskId: bigint, title: string, description: string, completed: boolean): Promise<Task>;
}
