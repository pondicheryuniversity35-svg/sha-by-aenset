// Central type definitions mirrored from the Motoko backend.
// All frontend files should import types from here.
// This file provides the types that backend.d.ts is expected to contain
// once `pnpm bindgen` is run against a deployed canister.

import type { Principal } from "@icp-sdk/core/principal";

export type { Principal };

export interface Preferences {
  darkMode: boolean;
  language: string;
  geminiApiKey: string;
  currency: string;
}

export interface Task {
  id: bigint;
  user: Principal;
  title: string;
  description: string;
  completed: boolean;
  date: string;
  timestamp: bigint;
}

export interface Entry {
  id: bigint;
  amount: number;
  category: string;
  entryType: string;
  timestamp: bigint;
  description: string;
  date: string;
}

export interface UserProfileView {
  name: string;
  email: string;
  preferences: Preferences;
  tasks: Task[];
  finances: Entry[];
  registrationTime: bigint;
}

export interface Folder {
  id: bigint;
  name: string;
  color: string;
  timestamp: bigint;
}

export interface Note {
  id: bigint;
  title: string;
  body: string;
  folderId: bigint;
  tags: string[];
  timestamp: bigint;
}

export interface Outfit {
  id: bigint;
  name: string;
  occasion: string;
  description: string;
  photoUrl: string;
  tags: string[];
  timestamp: bigint;
}

export interface ClothingItem {
  id: bigint;
  name: string;
  category: string;
  photoUrl: string;
  timestamp: bigint;
}

export interface PlannerDayOutfit {
  date: string;
  outfitId: bigint;
}

export interface Routine {
  id: bigint;
  name: string;
  timeOfDay: string;
  timestamp: bigint;
}

export interface RoutineCompletion {
  date: string;
  completedRoutineIds: bigint[];
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export interface BudgetLimit {
  id: bigint;
  category: string;
  monthlyLimit: number;
  createdAt: bigint;
}
