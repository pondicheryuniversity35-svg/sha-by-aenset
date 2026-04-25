import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Bool "mo:core/Bool";
import Int "mo:core/Int";
import Runtime "mo:core/Runtime";
import Order "mo:core/Order";
import Array "mo:core/Array";
import Float "mo:core/Float";
import Iter "mo:core/Iter";
import Time "mo:core/Time";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import AccessControl "mo:caffeineai-authorization/access-control";



actor {
  type User = Principal;

  // ── Types ────────────────────────────────────────────────────────────────────

  type Preferences = {
    darkMode : Bool;
    language : Text;
    geminiApiKey : Text;
    currency : Text;
  };

  type Task = {
    id : Nat;
    user : User;
    title : Text;
    description : Text;
    completed : Bool;
    date : Text;
    timestamp : Time.Time;
  };

  type Entry = {
    id : Nat;
    amount : Float;
    category : Text;
    entryType : Text;
    timestamp : Time.Time;
    description : Text;
    date : Text;
  };

  type UserProfile = {
    name : Text;
    email : Text;
    preferences : Preferences;
    tasks : Map.Map<Nat, Task>;
    finances : Map.Map<Nat, Entry>;
    registrationTime : Time.Time;
  };

  type UserProfileView = {
    name : Text;
    email : Text;
    preferences : Preferences;
    tasks : [Task];
    finances : [Entry];
    registrationTime : Time.Time;
  };

  type Folder = {
    id : Nat;
    name : Text;
    color : Text;
    timestamp : Time.Time;
  };

  type Note = {
    id : Nat;
    title : Text;
    body : Text;
    folderId : Nat;
    tags : [Text];
    timestamp : Time.Time;
  };

  type Outfit = {
    id : Nat;
    name : Text;
    occasion : Text;
    description : Text;
    photoUrl : Text;
    tags : [Text];
    timestamp : Time.Time;
  };

  type ClothingItem = {
    id : Nat;
    name : Text;
    category : Text;
    photoUrl : Text;
    timestamp : Time.Time;
  };

  type PlannerDayOutfit = {
    date : Text;
    outfitId : Nat;
  };

  type Routine = {
    id : Nat;
    name : Text;
    timeOfDay : Text;
    timestamp : Time.Time;
  };

  type RoutineCompletion = {
    date : Text;
    completedRoutineIds : [Nat];
  };

  type FinanceSummary = { totalIncome : Float; totalExpenses : Float; balance : Float };

  type BudgetLimit = {
    id : Nat;
    category : Text;
    monthlyLimit : Float;
    createdAt : Int;
  };

  // ── Legacy stable variable (kept for upgrade compatibility) ──────────────────────
  // The previous deployment stored user profiles here. We migrate the data
  // to the new flat stable vars in postupgrade, then clear this.

  type LegacyPreferences = {
    darkMode : Bool;
    language : Text;
    geminiApiKey : Text;
  };

  type LegacyUserProfile = {
    name : Text;
    email : Text;
    preferences : LegacyPreferences;
    tasks : Map.Map<Nat, Task>;
    finances : Map.Map<Nat, Entry>;
    registrationTime : Time.Time;
  };

  stable var appState : {
    var userProfiles : Map.Map<User, LegacyUserProfile>;
    var taskIdCounter : Nat;
    var entryIdCounter : Nat;
  } = {
    var userProfiles = Map.empty();
    var taskIdCounter = 0;
    var entryIdCounter = 0;
  };

  // ── Stable State (new, persists across upgrades) ────────────────────────────────

  stable var userProfilesMap : Map.Map<User, UserProfile> = Map.empty();
  stable var taskIdCounter : Nat = 0;
  stable var entryIdCounter : Nat = 0;
  stable var noteIdCounter : Nat = 0;
  stable var folderIdCounter : Nat = 0;
  stable var outfitIdCounter : Nat = 0;
  stable var clothingItemIdCounter : Nat = 0;
  stable var routineIdCounter : Nat = 0;
  stable var budgetLimitIdCounter : Nat = 0;

  stable var userNotes : Map.Map<User, Map.Map<Nat, Note>> = Map.empty();
  stable var userFolders : Map.Map<User, Map.Map<Nat, Folder>> = Map.empty();
  stable var userOutfits : Map.Map<User, Map.Map<Nat, Outfit>> = Map.empty();
  stable var userClothingItems : Map.Map<User, Map.Map<Nat, ClothingItem>> = Map.empty();
  stable var userPlannerOutfits : Map.Map<User, Map.Map<Text, PlannerDayOutfit>> = Map.empty();
  stable var userRoutines : Map.Map<User, Map.Map<Nat, Routine>> = Map.empty();
  stable var userRoutineCompletions : Map.Map<User, Map.Map<Text, RoutineCompletion>> = Map.empty();
  stable var userGymState : Map.Map<User, Text> = Map.empty();
  stable var userBudgetLimits : Map.Map<User, Map.Map<Nat, BudgetLimit>> = Map.empty();

  // ── Migration (runs once after upgrade) ──────────────────────────────────────────

  system func postupgrade() {
    // Migrate profiles from old appState into new userProfilesMap
    for ((user, oldProfile) in appState.userProfiles.entries()) {
      switch (userProfilesMap.get(user)) {
        case (null) {
          userProfilesMap.add(user, {
            name = oldProfile.name;
            email = oldProfile.email;
            preferences = {
              darkMode = oldProfile.preferences.darkMode;
              language = oldProfile.preferences.language;
              geminiApiKey = oldProfile.preferences.geminiApiKey;
              currency = "USD";
            };
            tasks = oldProfile.tasks;
            finances = oldProfile.finances;
            registrationTime = oldProfile.registrationTime;
          });
        };
        case (?_) {}; // Already migrated
      };
    };
    // Carry forward counters if new ones are still at zero
    if (taskIdCounter == 0 and appState.taskIdCounter > 0) {
      taskIdCounter := appState.taskIdCounter;
    };
    if (entryIdCounter == 0 and appState.entryIdCounter > 0) {
      entryIdCounter := appState.entryIdCounter;
    };
    // Clear legacy state so it no longer consumes stable memory
    appState.userProfiles := Map.empty();
    appState.taskIdCounter := 0;
    appState.entryIdCounter := 0;
  };

  // ── Authorization ─────────────────────────────────────────────────────────────

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Returns true if caller has the #user (or #admin) role already registered.
  func isRegistered(caller : Principal) : Bool {
    if (caller.isAnonymous()) { return false };
    switch (accessControlState.userRoles.get(caller)) {
      case (?role) { role == #user or role == #admin };
      case (null) { false };
    };
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────

  func getOrCreateProfile(caller : User) : UserProfile {
    switch (userProfilesMap.get(caller)) {
      case (?profile) { profile };
      case (null) {
        {
          name = "";
          email = "";
          preferences = { darkMode = false; language = "en"; geminiApiKey = ""; currency = "USD" };
          tasks = Map.empty();
          finances = Map.empty();
          registrationTime = Time.now();
        };
      };
    };
  };

  func getUserNotes(caller : User) : Map.Map<Nat, Note> {
    switch (userNotes.get(caller)) {
      case (?notes) { notes };
      case (null) { Map.empty() };
    };
  };

  func getUserFolders(caller : User) : Map.Map<Nat, Folder> {
    switch (userFolders.get(caller)) {
      case (?folders) { folders };
      case (null) { Map.empty() };
    };
  };

  func getUserOutfits(caller : User) : Map.Map<Nat, Outfit> {
    switch (userOutfits.get(caller)) {
      case (?outfits) { outfits };
      case (null) { Map.empty() };
    };
  };

  func getUserClothingItems(caller : User) : Map.Map<Nat, ClothingItem> {
    switch (userClothingItems.get(caller)) {
      case (?items) { items };
      case (null) { Map.empty() };
    };
  };

  func getUserPlannerOutfits(caller : User) : Map.Map<Text, PlannerDayOutfit> {
    switch (userPlannerOutfits.get(caller)) {
      case (?map) { map };
      case (null) { Map.empty() };
    };
  };

  func getUserRoutines(caller : User) : Map.Map<Nat, Routine> {
    switch (userRoutines.get(caller)) {
      case (?map) { map };
      case (null) { Map.empty() };
    };
  };

  func getUserRoutineCompletions(caller : User) : Map.Map<Text, RoutineCompletion> {
    switch (userRoutineCompletions.get(caller)) {
      case (?map) { map };
      case (null) { Map.empty() };
    };
  };

  func getUserBudgetLimits(caller : User) : Map.Map<Nat, BudgetLimit> {
    switch (userBudgetLimits.get(caller)) {
      case (?map) { map };
      case (null) { Map.empty() };
    };
  };

  func profileToView(profile : UserProfile) : UserProfileView {
    {
      name = profile.name;
      email = profile.email;
      preferences = profile.preferences;
      tasks = profile.tasks.values().toArray();
      finances = profile.finances.values().toArray();
      registrationTime = profile.registrationTime;
    };
  };

  // ── User Profile ──────────────────────────────────────────────────────────────

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfileView {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    switch (userProfilesMap.get(caller)) {
      case (?profile) { ?profileToView(profile) };
      case (null) { null };
    };
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfileView {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized");
    };
    switch (userProfilesMap.get(user)) {
      case (?profile) { ?profileToView(profile) };
      case (null) { null };
    };
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfileView) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    let existing = getOrCreateProfile(caller);
    let newProfile : UserProfile = {
      name = profile.name;
      email = profile.email;
      preferences = profile.preferences;
      registrationTime = profile.registrationTime;
      tasks = existing.tasks;
      finances = existing.finances;
    };
    userProfilesMap.add(caller, newProfile);
  };

  // ── Tasks ─────────────────────────────────────────────────────────────────────

  public shared ({ caller }) func createTask(title : Text, description : Text, date : Text) : async Task {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    let id = taskIdCounter;
    let newTask : Task = { id; user = caller; title; description; completed = false; date; timestamp = Time.now() };
    let profile = getOrCreateProfile(caller);
    let updatedTasks = profile.tasks.clone();
    updatedTasks.add(id, newTask);
    userProfilesMap.add(caller, { profile with tasks = updatedTasks });
    taskIdCounter += 1;
    newTask;
  };

  public shared ({ caller }) func updateTask(taskId : Nat, title : Text, description : Text, completed : Bool) : async Task {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    switch (userProfilesMap.get(caller)) {
      case (?profile) {
        switch (profile.tasks.get(taskId)) {
          case (?existingTask) {
            let updated : Task = { id = taskId; user = caller; title; description; completed; date = existingTask.date; timestamp = existingTask.timestamp };
            let updatedTasks = profile.tasks.clone();
            updatedTasks.add(taskId, updated);
            userProfilesMap.add(caller, { profile with tasks = updatedTasks });
            updated;
          };
          case (null) { Runtime.trap("Task not found") };
        };
      };
      case (null) { Runtime.trap("User profile not found") };
    };
  };

  public shared ({ caller }) func deleteTask(taskId : Nat) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    switch (userProfilesMap.get(caller)) {
      case (?profile) {
        let updatedTasks = profile.tasks.clone();
        updatedTasks.remove(taskId);
        userProfilesMap.add(caller, { profile with tasks = updatedTasks });
      };
      case (null) { Runtime.trap("User profile not found") };
    };
  };

  public query ({ caller }) func getAllTasks() : async [Task] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    switch (userProfilesMap.get(caller)) {
      case (?profile) {
        let arr = profile.tasks.values().toArray();
        arr.sort(func(a : Task, b : Task) : Order.Order { Int.compare(a.timestamp, b.timestamp) });
      };
      case (null) { [] };
    };
  };

  public query ({ caller }) func listTasksByDate(date : Text) : async [Task] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    switch (userProfilesMap.get(caller)) {
      case (?profile) {
        profile.tasks.values().toArray().filter(func(t : Task) : Bool { t.date == date });
      };
      case (null) { [] };
    };
  };

  // ── Finance ───────────────────────────────────────────────────────────────────

  public shared ({ caller }) func createFinanceEntry(amount : Float, entryType : Text, category : Text, description : Text, date : Text) : async Entry {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    let id = entryIdCounter;
    let newEntry : Entry = { id; amount; category; entryType; timestamp = Time.now(); description; date };
    let profile = getOrCreateProfile(caller);
    let updatedFinances = profile.finances.clone();
    updatedFinances.add(id, newEntry);
    userProfilesMap.add(caller, { profile with finances = updatedFinances });
    entryIdCounter += 1;
    newEntry;
  };

  public query ({ caller }) func getAllEntries() : async [Entry] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    switch (userProfilesMap.get(caller)) {
      case (?profile) {
        let arr = profile.finances.values().toArray();
        arr.sort(func(a : Entry, b : Entry) : Order.Order { Int.compare(a.timestamp, b.timestamp) });
      };
      case (null) { [] };
    };
  };

  public query ({ caller }) func listEntriesByType(entryType : Text) : async [Entry] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    switch (userProfilesMap.get(caller)) {
      case (?profile) {
        profile.finances.values().toArray().filter(func(e : Entry) : Bool { e.entryType == entryType });
      };
      case (null) { [] };
    };
  };

  public shared ({ caller }) func deleteEntry(entryId : Nat) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    switch (userProfilesMap.get(caller)) {
      case (?profile) {
        let updatedFinances = profile.finances.clone();
        updatedFinances.remove(entryId);
        userProfilesMap.add(caller, { profile with finances = updatedFinances });
      };
      case (null) { Runtime.trap("User profile not found") };
    };
  };

  public query ({ caller }) func getSummary() : async FinanceSummary {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    switch (userProfilesMap.get(caller)) {
      case (?profile) {
        var totalIncome : Float = 0.0;
        var totalExpenses : Float = 0.0;
        for (entry in profile.finances.values()) {
          if (entry.entryType == "income") { totalIncome += entry.amount }
          else if (entry.entryType == "expense") { totalExpenses += entry.amount };
        };
        { totalIncome; totalExpenses; balance = totalIncome - totalExpenses };
      };
      case (null) { { totalIncome = 0.0; totalExpenses = 0.0; balance = 0.0 } };
    };
  };

  public shared ({ caller }) func updatePreferences(language : Text, darkMode : Bool, geminiApiKey : Text, currency : Text) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    let profile = getOrCreateProfile(caller);
    userProfilesMap.add(caller, { profile with preferences = { language; darkMode; geminiApiKey; currency } });
  };

  // ── Budget Limits ──────────────────────────────────────────────────────────────

  public shared ({ caller }) func createBudgetLimit(category : Text, monthlyLimit : Float) : async BudgetLimit {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let id = budgetLimitIdCounter;
    let newLimit : BudgetLimit = { id; category; monthlyLimit; createdAt = Time.now() };
    let limits = getUserBudgetLimits(caller).clone();
    limits.add(id, newLimit);
    userBudgetLimits.add(caller, limits);
    budgetLimitIdCounter += 1;
    newLimit;
  };

  public shared ({ caller }) func deleteBudgetLimit(id : Nat) : async Bool {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let limits = getUserBudgetLimits(caller).clone();
    switch (limits.get(id)) {
      case (null) { false };
      case (?_) {
        limits.remove(id);
        userBudgetLimits.add(caller, limits);
        true;
      };
    };
  };

  public query ({ caller }) func getAllBudgetLimits() : async [BudgetLimit] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    getUserBudgetLimits(caller).values().toArray();
  };

  public shared ({ caller }) func updateBudgetLimit(id : Nat, category : Text, monthlyLimit : Float) : async ?BudgetLimit {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let limits = getUserBudgetLimits(caller).clone();
    switch (limits.get(id)) {
      case (null) { null };
      case (?existing) {
        let updated : BudgetLimit = { existing with category; monthlyLimit };
        limits.add(id, updated);
        userBudgetLimits.add(caller, limits);
        ?updated;
      };
    };
  };

  // ── Notes ─────────────────────────────────────────────────────────────────────

  public shared ({ caller }) func createNote(title : Text, body : Text, folderId : Nat, tags : [Text]) : async Note {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let id = noteIdCounter;
    let newNote : Note = { id; title; body; folderId; tags; timestamp = Time.now() };
    let notes = getUserNotes(caller).clone();
    notes.add(id, newNote);
    userNotes.add(caller, notes);
    noteIdCounter += 1;
    newNote;
  };

  public shared ({ caller }) func updateNote(noteId : Nat, title : Text, body : Text, folderId : Nat, tags : [Text]) : async Note {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let notes = getUserNotes(caller).clone();
    switch (notes.get(noteId)) {
      case (?existing) {
        let updated : Note = { id = noteId; title; body; folderId; tags; timestamp = existing.timestamp };
        notes.add(noteId, updated);
        userNotes.add(caller, notes);
        updated;
      };
      case (null) { Runtime.trap("Note not found") };
    };
  };

  public shared ({ caller }) func deleteNote(noteId : Nat) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let notes = getUserNotes(caller).clone();
    notes.remove(noteId);
    userNotes.add(caller, notes);
  };

  public query ({ caller }) func getAllNotes() : async [Note] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let arr = getUserNotes(caller).values().toArray();
    arr.sort(func(a : Note, b : Note) : Order.Order { Int.compare(b.timestamp, a.timestamp) });
  };

  // ── Folders ───────────────────────────────────────────────────────────────────

  public shared ({ caller }) func createFolder(name : Text, color : Text) : async Folder {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let id = folderIdCounter;
    let newFolder : Folder = { id; name; color; timestamp = Time.now() };
    let folders = getUserFolders(caller).clone();
    folders.add(id, newFolder);
    userFolders.add(caller, folders);
    folderIdCounter += 1;
    newFolder;
  };

  public shared ({ caller }) func deleteFolder(folderId : Nat) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let folders = getUserFolders(caller).clone();
    folders.remove(folderId);
    userFolders.add(caller, folders);
  };

  public query ({ caller }) func getAllFolders() : async [Folder] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    getUserFolders(caller).values().toArray();
  };

  // ── Outfits ───────────────────────────────────────────────────────────────────

  public shared ({ caller }) func createOutfit(name : Text, occasion : Text, description : Text, photoUrl : Text, tags : [Text]) : async Outfit {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let id = outfitIdCounter;
    let newOutfit : Outfit = { id; name; occasion; description; photoUrl; tags; timestamp = Time.now() };
    let outfits = getUserOutfits(caller).clone();
    outfits.add(id, newOutfit);
    userOutfits.add(caller, outfits);
    outfitIdCounter += 1;
    newOutfit;
  };

  public shared ({ caller }) func updateOutfit(outfitId : Nat, name : Text, occasion : Text, description : Text, photoUrl : Text, tags : [Text]) : async Outfit {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let outfits = getUserOutfits(caller).clone();
    switch (outfits.get(outfitId)) {
      case (?existing) {
        let updated : Outfit = { id = outfitId; name; occasion; description; photoUrl; tags; timestamp = existing.timestamp };
        outfits.add(outfitId, updated);
        userOutfits.add(caller, outfits);
        updated;
      };
      case (null) { Runtime.trap("Outfit not found") };
    };
  };

  public shared ({ caller }) func deleteOutfit(outfitId : Nat) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let outfits = getUserOutfits(caller).clone();
    outfits.remove(outfitId);
    userOutfits.add(caller, outfits);
  };

  public query ({ caller }) func getAllOutfits() : async [Outfit] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let arr = getUserOutfits(caller).values().toArray();
    arr.sort(func(a : Outfit, b : Outfit) : Order.Order { Int.compare(b.timestamp, a.timestamp) });
  };

  // ── Clothing Items ────────────────────────────────────────────────────────────

  public shared ({ caller }) func createClothingItem(name : Text, category : Text, photoUrl : Text) : async ClothingItem {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let id = clothingItemIdCounter;
    let newItem : ClothingItem = { id; name; category; photoUrl; timestamp = Time.now() };
    let items = getUserClothingItems(caller).clone();
    items.add(id, newItem);
    userClothingItems.add(caller, items);
    clothingItemIdCounter += 1;
    newItem;
  };

  public shared ({ caller }) func updateClothingItem(itemId : Nat, name : Text, category : Text, photoUrl : Text) : async ClothingItem {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let items = getUserClothingItems(caller).clone();
    switch (items.get(itemId)) {
      case (?existing) {
        let updated : ClothingItem = { id = itemId; name; category; photoUrl; timestamp = existing.timestamp };
        items.add(itemId, updated);
        userClothingItems.add(caller, items);
        updated;
      };
      case (null) { Runtime.trap("Clothing item not found") };
    };
  };

  public shared ({ caller }) func deleteClothingItem(itemId : Nat) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let items = getUserClothingItems(caller).clone();
    items.remove(itemId);
    userClothingItems.add(caller, items);
  };

  public query ({ caller }) func getAllClothingItems() : async [ClothingItem] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let arr = getUserClothingItems(caller).values().toArray();
    arr.sort(func(a : ClothingItem, b : ClothingItem) : Order.Order { Int.compare(b.timestamp, a.timestamp) });
  };

  // ── Planner Day Outfits ───────────────────────────────────────────────────────

  public shared ({ caller }) func setPlannerDayOutfit(date : Text, outfitId : Nat) : async PlannerDayOutfit {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let entry : PlannerDayOutfit = { date; outfitId };
    let plannerMap = getUserPlannerOutfits(caller).clone();
    plannerMap.add(date, entry);
    userPlannerOutfits.add(caller, plannerMap);
    entry;
  };

  public shared ({ caller }) func deletePlannerDayOutfit(date : Text) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let plannerMap = getUserPlannerOutfits(caller).clone();
    plannerMap.remove(date);
    userPlannerOutfits.add(caller, plannerMap);
  };

  public query ({ caller }) func getPlannerDayOutfit(date : Text) : async ?PlannerDayOutfit {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    getUserPlannerOutfits(caller).get(date);
  };

  public query ({ caller }) func getAllPlannerDayOutfits() : async [PlannerDayOutfit] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    getUserPlannerOutfits(caller).values().toArray();
  };

  // ── Routines ──────────────────────────────────────────────────────────────────

  public shared ({ caller }) func createRoutine(name : Text, timeOfDay : Text) : async Routine {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let id = routineIdCounter;
    let newRoutine : Routine = { id; name; timeOfDay; timestamp = Time.now() };
    let routines = getUserRoutines(caller).clone();
    routines.add(id, newRoutine);
    userRoutines.add(caller, routines);
    routineIdCounter += 1;
    newRoutine;
  };

  public shared ({ caller }) func updateRoutine(routineId : Nat, name : Text, timeOfDay : Text) : async Routine {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let routines = getUserRoutines(caller).clone();
    switch (routines.get(routineId)) {
      case (?existing) {
        let updated : Routine = { id = routineId; name; timeOfDay; timestamp = existing.timestamp };
        routines.add(routineId, updated);
        userRoutines.add(caller, routines);
        updated;
      };
      case (null) { Runtime.trap("Routine not found") };
    };
  };

  public shared ({ caller }) func deleteRoutine(routineId : Nat) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let routines = getUserRoutines(caller).clone();
    routines.remove(routineId);
    userRoutines.add(caller, routines);
  };

  public query ({ caller }) func getAllRoutines() : async [Routine] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let arr = getUserRoutines(caller).values().toArray();
    arr.sort(func(a : Routine, b : Routine) : Order.Order { Int.compare(a.timestamp, b.timestamp) });
  };

  // ── Routine Completions ───────────────────────────────────────────────────────

  public shared ({ caller }) func setRoutineCompletion(date : Text, completedRoutineIds : [Nat]) : async RoutineCompletion {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    let entry : RoutineCompletion = { date; completedRoutineIds };
    let completions = getUserRoutineCompletions(caller).clone();
    completions.add(date, entry);
    userRoutineCompletions.add(caller, completions);
    entry;
  };

  public query ({ caller }) func getRoutineCompletion(date : Text) : async ?RoutineCompletion {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    getUserRoutineCompletions(caller).get(date);
  };

  public query ({ caller }) func getAllRoutineCompletions() : async [RoutineCompletion] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    getUserRoutineCompletions(caller).values().toArray();
  };

  // ── Gym State (persisted as JSON blob per user) ───────────────────────────────

  public shared ({ caller }) func saveUserGymState(json : Text) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    userGymState.add(caller, json);
  };

  public query ({ caller }) func getUserGymState() : async ?Text {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) { Runtime.trap("Unauthorized") };
    userGymState.get(caller);
  };

  // ── User Registration ──────────────────────────────────────────────────────────
  // Called by the frontend immediately after login to register the caller as a user.
  // Safe to call multiple times — idempotent. Any authenticated caller can call this.
  public shared ({ caller }) func registerCaller() : async () {
    if (caller.isAnonymous()) { Runtime.trap("Anonymous callers cannot register") };
    // Always call initialize — it is idempotent (skips if already registered)
    AccessControl.initialize(accessControlState, caller);
  };

  // Safety-net method: checks if user has permission and registers them if not.
  // Frontend can call this before any mutation to ensure the user is always registered.
  // Returns true if the caller now has the #user role.
  public shared ({ caller }) func ensureUserRegistered() : async Bool {
    if (caller.isAnonymous()) { return false };
    if (not isRegistered(caller)) {
      AccessControl.initialize(accessControlState, caller);
    };
    isRegistered(caller);
  };
};
