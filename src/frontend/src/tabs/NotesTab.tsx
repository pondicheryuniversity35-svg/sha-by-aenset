import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckSquare,
  FolderPlus,
  NotebookPen,
  Plus,
  Search,
  ShoppingCart,
  Square,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useActor } from "../hooks/useActor";

interface Note {
  id: bigint;
  title: string;
  body: string;
  folderId: bigint;
  tags: string[];
  timestamp: bigint;
}

interface Folder {
  id: bigint;
  name: string;
  color: string;
  timestamp: bigint;
}

interface NotesActor {
  getAllNotes(): Promise<Note[]>;
  getAllFolders(): Promise<Folder[]>;
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
  createFolder(name: string, color: string): Promise<Folder>;
  deleteFolder(folderId: bigint): Promise<void>;
}

const FOLDER_COLORS = [
  "#f87171",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#60a5fa",
  "#c084fc",
];

type NoteType = "normal" | "grocery";

interface GroceryItem {
  id: number;
  name: string;
  qty: string;
  checked: boolean;
}

function parseGroceryBody(body: string): GroceryItem[] {
  try {
    const parsed = JSON.parse(body);
    if (parsed.type === "grocery" && Array.isArray(parsed.items)) {
      return parsed.items;
    }
  } catch {}
  return [];
}

function serializeGrocery(items: GroceryItem[]): string {
  return JSON.stringify({ type: "grocery", items });
}

function detectNoteType(body: string): NoteType {
  try {
    const p = JSON.parse(body);
    if (p.type === "grocery") return "grocery";
  } catch {}
  return "normal";
}

function relativeTime(ns: bigint): string {
  const nowMs = Date.now();
  const noteMs = Number(ns / 1_000_000n);
  const diffMs = nowMs - noteMs;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(noteMs).toLocaleDateString();
}

// ─── Grocery List View ────────────────────────────────────────────────────────

interface GroceryListViewProps {
  items: GroceryItem[];
  onChange: (items: GroceryItem[]) => void;
}

function GroceryListView({ items, onChange }: GroceryListViewProps) {
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");

  const addItem = () => {
    if (!newName.trim()) return;
    const newItem: GroceryItem = {
      id: Date.now(),
      name: newName.trim(),
      qty: newQty.trim() || "1",
      checked: false,
    };
    onChange([...items, newItem]);
    setNewName("");
    setNewQty("1");
  };

  const toggleItem = (id: number) => {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    );
  };

  const deleteItem = (id: number) => {
    onChange(items.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 py-1">
          <button
            type="button"
            onClick={() => toggleItem(item.id)}
            className="flex-shrink-0"
          >
            {item.checked ? (
              <CheckSquare className="w-4 h-4 text-accent" />
            ) : (
              <Square className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <span
            className={`flex-1 text-sm ${
              item.checked
                ? "line-through text-muted-foreground"
                : "text-foreground"
            }`}
          >
            {item.name}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {item.qty}
          </span>
          <button
            type="button"
            onClick={() => deleteItem(item.id)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        <Input
          placeholder="Item name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          className="flex-1 h-8 text-xs"
        />
        <Input
          placeholder="Qty"
          value={newQty}
          onChange={(e) => setNewQty(e.target.value)}
          className="w-14 h-8 text-xs"
        />
        <Button size="sm" onClick={addItem} className="h-8 px-2">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main NotesTab ────────────────────────────────────────────────────────────

export default function NotesTab() {
  const { actor } = useActor();
  const notesActor = actor as unknown as NotesActor | null;

  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<bigint | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Note editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [noteForm, setNoteForm] = useState({
    title: "",
    body: "",
    folderId: 0n,
    tags: "",
    noteType: "normal" as NoteType,
  });
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Folder creator
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[4]);

  const loadData = useCallback(async () => {
    if (!notesActor) return;
    try {
      const [notesData, foldersData] = await Promise.all([
        notesActor.getAllNotes(),
        notesActor.getAllFolders(),
      ]);
      const sorted = [...notesData].sort((a, b) =>
        b.timestamp > a.timestamp ? 1 : b.timestamp < a.timestamp ? -1 : 0,
      );
      setNotes(sorted);
      setFolders(foldersData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [notesActor]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const note of notes) {
      for (const tag of note.tags) tagSet.add(tag);
    }
    return Array.from(tagSet);
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      if (
        search &&
        !note.title.toLowerCase().includes(search.toLowerCase()) &&
        !note.body.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (selectedFolderId !== null && note.folderId !== selectedFolderId) {
        return false;
      }
      if (
        selectedTags.length > 0 &&
        !selectedTags.every((tag) => note.tags.includes(tag))
      ) {
        return false;
      }
      return true;
    });
  }, [notes, search, selectedFolderId, selectedTags]);

  const openCreate = () => {
    setEditingId(null);
    setNoteForm({
      title: "",
      body: "",
      folderId: 0n,
      tags: "",
      noteType: "normal",
    });
    setGroceryItems([]);
    setEditorOpen(true);
  };

  const openEdit = (note: Note) => {
    const noteType = detectNoteType(note.body);
    setEditingId(note.id);
    setNoteForm({
      title: note.title,
      body: noteType === "grocery" ? "" : note.body,
      folderId: note.folderId,
      tags: note.tags.join(", "),
      noteType,
    });
    if (noteType === "grocery") {
      setGroceryItems(parseGroceryBody(note.body));
    } else {
      setGroceryItems([]);
    }
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!notesActor) {
      toast.error("Not authenticated. Please wait a moment and try again.");
      return;
    }
    setSaving(true);
    const tagsArray = noteForm.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    let bodyToSave = noteForm.body;
    if (noteForm.noteType === "grocery") {
      bodyToSave = serializeGrocery(groceryItems);
    }
    try {
      if (editingId) {
        const updated = await notesActor.updateNote(
          editingId,
          noteForm.title,
          bodyToSave,
          noteForm.folderId,
          tagsArray,
        );
        setNotes((prev) =>
          [updated, ...prev.filter((n) => n.id !== editingId)].sort((a, b) =>
            b.timestamp > a.timestamp ? 1 : -1,
          ),
        );
      } else {
        const created = await notesActor.createNote(
          noteForm.title,
          bodyToSave,
          noteForm.folderId,
          tagsArray,
        );
        setNotes((prev) => [created, ...prev]);
      }
      setEditorOpen(false);
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: bigint) => {
    if (!notesActor) {
      toast.error("Not authenticated. Please wait a moment and try again.");
      return;
    }
    try {
      await notesActor.deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setEditorOpen(false);
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const handleCreateFolder = async () => {
    if (!notesActor) {
      toast.error("Not authenticated. Please wait a moment and try again.");
      return;
    }
    if (!newFolderName.trim()) return;
    try {
      const folder = await notesActor.createFolder(
        newFolderName.trim(),
        newFolderColor,
      );
      setFolders((prev) => [...prev, folder]);
      setNewFolderName("");
      setFolderDialogOpen(false);
    } catch {
      toast.error("Failed to create folder");
    }
  };

  const handleDeleteFolder = async (folderId: bigint) => {
    if (!notesActor) return;
    try {
      await notesActor.deleteFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (selectedFolderId === folderId) setSelectedFolderId(null);
    } catch {
      toast.error("Failed to delete folder");
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const getFolderColor = (folderId: bigint): string => {
    return folders.find((f) => f.id === folderId)?.color || "#6b7280";
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search + action bar */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2 flex-shrink-0">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            data-ocid="notes.search_input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="pl-8 h-9 text-sm"
          />
        </div>
        <button
          type="button"
          data-ocid="notes.open_modal_button"
          onClick={() => setFolderDialogOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
        <button
          type="button"
          data-ocid="notes.primary_button"
          onClick={openCreate}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Folders */}
      {folders.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none flex-shrink-0">
          <button
            type="button"
            onClick={() => setSelectedFolderId(null)}
            className={`flex-shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${
              selectedFolderId === null
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted-foreground"
            }`}
          >
            All
          </button>
          {folders.map((folder) => (
            <button
              type="button"
              key={folder.id.toString()}
              onClick={() =>
                setSelectedFolderId(
                  selectedFolderId === folder.id ? null : folder.id,
                )
              }
              className={`flex-shrink-0 text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                selectedFolderId === folder.id
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted-foreground"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: folder.color }}
              />
              {folder.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFolder(folder.id);
                }}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>
      )}

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none flex-shrink-0">
          {allTags.map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 transition-colors ${
                selectedTags.includes(tag)
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted-foreground"
              }`}
            >
              <Tag className="w-3 h-3" />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {loading ? (
          <div data-ocid="notes.loading_state" className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl p-4 space-y-2"
              >
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-2 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div
            data-ocid="notes.empty_state"
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <NotebookPen className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No notes yet. Tap + to create your first note.
            </p>
          </div>
        ) : (
          <div className="space-y-2 pt-2">
            {filteredNotes.map((note, i) => {
              const noteType = detectNoteType(note.body);
              return (
                <motion.div
                  key={note.id.toString()}
                  data-ocid={`notes.item.${i + 1}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => openEdit(note)}
                  className="bg-card border border-border rounded-2xl p-4 cursor-pointer active:scale-[0.99] transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {noteType === "grocery" && (
                        <ShoppingCart className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                      )}
                      <p className="text-sm font-semibold text-foreground truncate">
                        {note.title || "Untitled"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {note.folderId !== 0n && (
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: getFolderColor(note.folderId),
                          }}
                        />
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {relativeTime(note.timestamp)}
                      </span>
                      <button
                        type="button"
                        data-ocid={`notes.delete_button.${i + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Delete this note?"))
                            handleDelete(note.id);
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                        aria-label="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {noteType === "grocery" ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      {parseGroceryBody(note.body).length} items
                    </p>
                  ) : (
                    note.body && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {note.body}
                      </p>
                    )
                  )}
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {note.tags.slice(0, 4).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0 h-4"
                        >
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Note Editor Sheet */}
      <AnimatePresence>
        {editorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setEditorOpen(false)}
          />
        )}
        {editorOpen && (
          <motion.div
            data-ocid="notes.modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div
              className="pointer-events-auto w-full max-w-[430px] max-h-[90vh] overflow-y-auto bg-background rounded-2xl px-5 pt-4 pb-8 mx-4"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-foreground">
                  {editingId ? "Edit Note" : "New Note"}
                </h3>
                <div className="flex items-center gap-2">
                  {editingId && (
                    <button
                      type="button"
                      data-ocid="notes.delete_button"
                      onClick={() => editingId && handleDelete(editingId)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    data-ocid="notes.close_button"
                    onClick={() => setEditorOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-1">
                {/* Note type */}
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">
                    Type
                  </Label>
                  <div className="flex gap-2">
                    {(["normal", "grocery"] as NoteType[]).map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => {
                          setNoteForm((f) => ({ ...f, noteType: type }));
                          if (type === "grocery" && groceryItems.length === 0) {
                            setGroceryItems([]);
                          }
                        }}
                        className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors capitalize ${
                          noteForm.noteType === type
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {type === "grocery" ? "Grocery" : "Normal"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <Input
                    data-ocid="notes.input"
                    placeholder="Note title..."
                    value={noteForm.title}
                    maxLength={255}
                    onChange={(e) =>
                      setNoteForm((f) => ({
                        ...f,
                        title: e.target.value.slice(0, 255),
                      }))
                    }
                    className="h-9 text-sm"
                  />
                </div>

                {/* Body or Grocery */}
                {noteForm.noteType === "grocery" ? (
                  <GroceryListView
                    items={groceryItems}
                    onChange={setGroceryItems}
                  />
                ) : (
                  <Textarea
                    data-ocid="notes.textarea"
                    placeholder="Write your note here..."
                    value={noteForm.body}
                    maxLength={10000}
                    onChange={(e) =>
                      setNoteForm((f) => ({
                        ...f,
                        body: e.target.value.slice(0, 10000),
                      }))
                    }
                    className="text-sm resize-none"
                    rows={5}
                  />
                )}

                {/* Folder */}
                {folders.length > 0 && (
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">
                      Folder
                    </Label>
                    <Select
                      value={noteForm.folderId.toString()}
                      onValueChange={(v) =>
                        setNoteForm((f) => ({ ...f, folderId: BigInt(v) }))
                      }
                    >
                      <SelectTrigger
                        data-ocid="notes.select"
                        className="h-9 text-sm"
                      >
                        <SelectValue placeholder="No folder" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No folder</SelectItem>
                        {folders.map((folder) => (
                          <SelectItem
                            key={folder.id.toString()}
                            value={folder.id.toString()}
                          >
                            {folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Tags */}
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">
                    Tags
                    <span className="text-muted-foreground font-normal ml-1">
                      (comma-separated)
                    </span>
                  </Label>
                  <Input
                    data-ocid="notes.input"
                    placeholder="e.g. study, work, ideas"
                    value={noteForm.tags}
                    maxLength={510}
                    onChange={(e) =>
                      setNoteForm((f) => ({
                        ...f,
                        tags: e.target.value.slice(0, 510),
                      }))
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <Button
                data-ocid="notes.submit_button"
                type="button"
                className="w-full mt-4"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : editingId ? "Update Note" : "Save Note"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-sm">New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              data-ocid="notes.input"
              placeholder="Folder name"
              value={newFolderName}
              maxLength={100}
              onChange={(e) => setNewFolderName(e.target.value.slice(0, 100))}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              className="h-9 text-sm"
            />
            <div className="flex gap-2">
              {FOLDER_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setNewFolderColor(color)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    newFolderColor === color
                      ? "scale-125 ring-2 ring-offset-1 ring-accent"
                      : ""
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              data-ocid="notes.cancel_button"
              variant="ghost"
              size="sm"
              onClick={() => setFolderDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              data-ocid="notes.confirm_button"
              size="sm"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
