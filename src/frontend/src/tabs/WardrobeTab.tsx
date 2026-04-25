import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Camera,
  Loader2,
  MessageCircle,
  Plus,
  Shirt,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import ImageCropModal from "../components/ImageCropModal";
import { useI18n } from "../contexts/I18nContext";
import {
  useCreateClothingItem,
  useCreateOutfit,
  useDeleteClothingItem,
  useDeleteOutfit,
  useGetAllClothingItems,
  useGetAllOutfits,
  useUpdateOutfit,
} from "../hooks/useQueries";
import { useImageUpload } from "../hooks/useStorageUpload";
import type { ClothingItem, Outfit } from "../types";
import {
  validateImageFile,
  validateImageMagicBytes,
} from "../utils/fileValidation";

type Gender = "male" | "female" | null;

const OCCASIONS = [
  "Casual",
  "Formal",
  "Wedding",
  "Work",
  "Date Night",
  "Gym",
  "Party",
  "Travel",
];

const MALE_CATEGORIES = [
  "Kurta",
  "Shirt",
  "T-Shirt",
  "Suit",
  "Sherwani",
  "Shorts",
  "Trousers",
  "Jeans",
  "Blazer",
  "Dhoti",
  "Accessories",
  "Footwear",
  "Other",
];

const FEMALE_CATEGORIES = [
  "Saree",
  "Kurti",
  "Salwar",
  "Lehenga",
  "Dress",
  "Top",
  "Shorts",
  "Skirt",
  "Jeans",
  "Jacket",
  "Dupatta",
  "Accessories",
  "Footwear",
  "Other",
];

const DEFAULT_CATEGORIES = [
  "Shorts",
  "Tops",
  "Bottoms",
  "Dress",
  "Jacket",
  "Shoes",
  "Accessories",
  "Other",
];

function getCategoriesForGender(gender: Gender): string[] {
  if (gender === "male") return MALE_CATEGORIES;
  if (gender === "female") return FEMALE_CATEGORIES;
  return DEFAULT_CATEGORIES;
}

const OCCASION_COLORS: Record<string, string> = {
  Casual: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Formal: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  Wedding: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  Work: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Date Night": "bg-rose-500/15 text-rose-400 border-rose-500/20",
  Gym: "bg-green-500/15 text-green-400 border-green-500/20",
  Party: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  Travel: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
};

function getOccasionColor(occasion: string): string {
  return (
    OCCASION_COLORS[occasion] ||
    "bg-muted/50 text-muted-foreground border-border"
  );
}

// ─── Outfit Clothing IDs storage ─────────────────────────────────────────────

const OUTFIT_CLOTHING_KEY = "sha_outfit_clothing_ids";

export function saveOutfitClothingIds(outfitId: string, ids: string[]) {
  try {
    const all = JSON.parse(localStorage.getItem(OUTFIT_CLOTHING_KEY) || "{}");
    all[outfitId] = ids;
    localStorage.setItem(OUTFIT_CLOTHING_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function getOutfitClothingIds(outfitId: string): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(OUTFIT_CLOTHING_KEY) || "{}");
    return all[outfitId] || [];
  } catch {
    return [];
  }
}

// ─── Outfit Collage Component ─────────────────────────────────────────────────

export function OutfitCollage({
  outfitId,
  photoUrl,
  clothingItems,
  resolvePhoto,
  className = "",
}: {
  outfitId: string;
  photoUrl: string;
  clothingItems: ClothingItem[];
  resolvePhoto: (url: string) => string;
  className?: string;
}) {
  const clothingIds = getOutfitClothingIds(outfitId);
  const pieces = clothingItems.filter((item) =>
    clothingIds.includes(item.id.toString()),
  );

  // If there's a single outfit photo, prefer it
  if (photoUrl && pieces.length === 0) {
    return (
      <img
        src={resolvePhoto(photoUrl)}
        alt="outfit"
        className={`w-full aspect-[4/3] object-cover ${className}`}
      />
    );
  }

  if (pieces.length === 0) {
    return (
      <div
        className={`w-full aspect-[4/3] bg-muted flex items-center justify-center ${className}`}
      >
        <Shirt className="w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  // Show a grid collage of clothing piece photos
  const withPhoto = pieces.filter((p) => p.photoUrl);
  const cols =
    withPhoto.length === 1
      ? 1
      : withPhoto.length === 2
        ? 2
        : withPhoto.length <= 4
          ? 2
          : 3;

  if (withPhoto.length === 0) {
    return (
      <div
        className={`w-full aspect-[4/3] bg-muted flex flex-col items-center justify-center gap-1 ${className}`}
      >
        <Shirt className="w-6 h-6 text-muted-foreground" />
        <p className="text-[9px] text-muted-foreground">
          {pieces.length} pieces
        </p>
      </div>
    );
  }

  return (
    <div
      className={`w-full aspect-[4/3] bg-muted overflow-hidden grid gap-0.5 ${className}`}
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows:
          withPhoto.length <= 2
            ? "1fr"
            : withPhoto.length <= 4
              ? "1fr 1fr"
              : "1fr 1fr",
      }}
    >
      {withPhoto.slice(0, cols === 3 ? 6 : 4).map((item) => (
        <img
          key={item.id.toString()}
          src={resolvePhoto(item.photoUrl)}
          alt={item.name}
          className="w-full h-full object-cover"
        />
      ))}
      {withPhoto.length === 1 && photoUrl && (
        <img
          src={resolvePhoto(photoUrl)}
          alt="outfit"
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}

type StyleMessage = { role: "user" | "assistant"; text: string };

function getStyleAdvice(message: string, gender: Gender): string {
  const msg = message.toLowerCase();

  if (msg.includes("color") || msg.includes("colour")) {
    if (msg.includes("complement"))
      return "Complementary colors sit opposite on the color wheel. Try red + green, blue + orange, or yellow + purple for bold, eye-catching combos.";
    if (msg.includes("neutral"))
      return "Neutrals (black, white, grey, beige, camel) pair with everything. A neutral base with one pop of color is a timeless formula.";
    if (msg.includes("navy") || msg.includes("blue"))
      return "Navy + white is classic. Sky blue + beige is fresh. Blue + rust is stunning. Blue + yellow is vibrant.";
    if (msg.includes("green"))
      return "Olive and sage pair well with rust, brown, and white. Emerald green looks stunning with black, gold, and cream.";
    if (msg.includes("red") || msg.includes("burgundy"))
      return "Red pairs beautifully with black, white, navy, or camel. Avoid pairing with other warm brights unless going maximalist.";
    if (msg.includes("black"))
      return "Black is the ultimate neutral. Try black + cobalt blue, black + emerald, or a tonal all-black look with texture variation.";
    return "A 3-color rule works great: one dominant, one secondary, one accent. Keep it balanced and intentional!";
  }

  if (msg.includes("wedding")) {
    if (gender === "female")
      return "For a wedding, great options include Lehenga, Saree, or an Anarkali suit. Colors: dusty rose, sage green, champagne, navy, or deep burgundy. Avoid white/ivory — that's reserved for the bride!";
    if (gender === "male")
      return "For a wedding, a Sherwani or well-tailored suit works perfectly. Colors: ivory, beige, navy, deep maroon, or royal blue. Pair with matching dupatta or pocket square for a polished look.";
    return "For weddings, avoid white/ivory (reserved for the bride). Great guest choices: dusty rose, sage green, navy, burgundy, or champagne.";
  }

  if (
    msg.includes("formal") ||
    msg.includes("office") ||
    msg.includes("work")
  ) {
    if (gender === "female")
      return "For formal/office settings: a well-fitted Salwar Kameez, Saree, or a blazer + trousers combo works beautifully. Stick to muted tones — navy, grey, black, or soft pastels.";
    if (gender === "male")
      return "For formal occasions, a suit or Kurta Pajama in navy, charcoal, or black works best. Ensure a perfect fit — a well-tailored piece always outperforms an expensive ill-fitting one.";
    return "For formal occasions, stick to a classic suit or tailored separates. Navy, charcoal, or black are always safe. Ensure perfect fit above all else.";
  }

  if (msg.includes("casual")) {
    if (gender === "female")
      return "Casual looks: Kurti + leggings, Jeans + Top, or a simple Dress. Layer with a light jacket or dupatta for dimension. White sneakers or flats complete the look effortlessly.";
    if (gender === "male")
      return "Casual essentials: a clean Shirt or T-Shirt + well-fitted Jeans + clean sneakers. A light jacket or open button-down shirt over a tee adds dimension without effort.";
    return "Casual looks work best with well-fitted basics. Try a clean white tee + quality jeans + white sneakers. Add a light jacket for dimension.";
  }

  if (msg.includes("summer") || msg.includes("hot"))
    return "Summer dressing: light fabrics (linen, cotton), lighter colors to reflect heat. Loose fits allow airflow. Whites, pastels, and earth tones all work.";
  if (msg.includes("winter") || msg.includes("cold"))
    return "Winter layering: thermal base + mid-layer (sweater/fleece) + outer layer (coat). Rich colors like burgundy, forest green, and camel feel season-appropriate.";
  if (msg.includes("date"))
    return "Date night: wear something that makes you feel confident. A well-fitted outfit in a flattering color + subtle accessories. Keep it polished but authentic.";
  if (msg.includes("gym") || msg.includes("workout"))
    return "Gym wear: prioritize comfort + performance. Moisture-wicking fabrics, proper support. Coordinated sets look put-together with minimal effort.";
  if (msg.includes("accessory") || msg.includes("accessories"))
    return "Accessories can make or break an outfit. Rule of three: max 3 visible accessories. Let one statement piece be the focal point.";
  return "Great style is about confidence and intention. Start with fit, then color, then details. What specific occasion or piece would you like advice on?";
}

// ─── Gender Selector ──────────────────────────────────────────────────────────

function GenderSelector({
  gender,
  onChange,
}: {
  gender: Gender;
  onChange: (g: Gender) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="px-4 pt-3 pb-1 flex-shrink-0">
      <div className="flex items-center justify-between bg-muted/40 border border-border rounded-xl px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t.genderPreference}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            data-ocid="wardrobe.toggle"
            onClick={() => onChange(gender === "male" ? null : "male")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              gender === "male"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.genderMale}
          </button>
          <button
            type="button"
            data-ocid="wardrobe.toggle"
            onClick={() => onChange(gender === "female" ? null : "female")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              gender === "female"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.genderFemale}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Photo Upload Helper ──────────────────────────────────────────────────────

function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], filename, { type: mime });
}

function PhotoUpload({
  value,
  onChange,
  label = "Photo",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const { storePhoto, resolvePhoto } = useImageUpload();
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    // OWASP A03/A04: validate MIME type, size, and magic bytes before processing
    const mimeCheck = validateImageFile(file);
    if (!mimeCheck.valid) {
      toast.error(mimeCheck.error ?? "Invalid file");
      return;
    }
    const magicCheck = await validateImageMagicBytes(file);
    if (!magicCheck.valid) {
      toast.error(magicCheck.error ?? "Invalid file content");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) setCropSrc(dataUrl);
    };
    reader.readAsDataURL(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleCropConfirm = async (croppedDataUrl: string) => {
    setCropSrc(null);
    setUploading(true);
    try {
      const file = dataUrlToFile(croppedDataUrl, "photo.jpg");
      const url = await storePhoto(file);
      onChange(url);
    } catch {
      toast.error("Failed to process image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
      <Label className="text-xs font-medium mb-1.5 block">{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative w-16 h-16 flex-shrink-0">
            <img
              src={resolvePhoto(value)}
              alt="outfit"
              className="w-16 h-16 rounded-xl object-cover border border-border"
            />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="w-16 h-16 flex-shrink-0 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
            <Camera className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="h-8 text-xs gap-1.5"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            {uploading ? "Processing..." : value ? "Change" : "Upload Photo"}
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1">
            Tap to use camera or pick from gallery
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── My Clothes Section ───────────────────────────────────────────────────────

function MyClothesSection({ gender }: { gender: Gender }) {
  const { t } = useI18n();
  const { resolvePhoto: resPhoto, deletePhoto } = useImageUpload();
  const { data: items = [], isLoading } = useGetAllClothingItems();
  const createItem = useCreateClothingItem();
  const deleteItem = useDeleteClothingItem();
  const [formOpen, setFormOpen] = useState(false);
  const categories = getCategoriesForGender(gender);
  const [form, setForm] = useState({
    name: "",
    category: categories[0],
    photoUrl: "",
  });
  const [deletingId, setDeletingId] = useState<bigint | null>(null);

  useEffect(() => {
    setForm((f) => ({ ...f, category: getCategoriesForGender(gender)[0] }));
  }, [gender]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      await createItem.mutateAsync({
        name: form.name.trim(),
        category: form.category,
        photoUrl: form.photoUrl,
      });
      setForm({ name: "", category: categories[0], photoUrl: "" });
      setFormOpen(false);
      toast.success("Clothing item added");
    } catch {
      toast.error("Failed to add item");
    }
  };

  const handleDelete = async (id: bigint) => {
    setDeletingId(id);
    try {
      const item = (items as ClothingItem[]).find((i) => i.id === id);
      await deleteItem.mutateAsync(id);
      if (item?.photoUrl) deletePhoto(item.photoUrl);
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">{t.myClothes}</h2>
          <p className="text-xs text-muted-foreground">
            {(items as ClothingItem[]).length} items
          </p>
        </div>
        <Button
          data-ocid="wardrobe.primary_button"
          size="sm"
          onClick={() => setFormOpen(true)}
          className="h-8 gap-1.5 text-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </div>

      {isLoading ? (
        <div
          data-ocid="wardrobe.loading_state"
          className="flex items-center justify-center py-16"
        >
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : (items as ClothingItem[]).length === 0 ? (
        <motion.div
          data-ocid="wardrobe.empty_state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center py-16 px-8 text-center"
        >
          <ShoppingBag className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">{t.noClothingItems}</p>
        </motion.div>
      ) : (
        <div className="px-4 grid grid-cols-3 gap-3">
          {(items as ClothingItem[]).map((item, i) => (
            <motion.div
              key={item.id.toString()}
              data-ocid={`wardrobe.item.${i + 1}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              {item.photoUrl ? (
                <img
                  src={resPhoto(item.photoUrl)}
                  alt={item.name}
                  className="w-full aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square bg-muted flex items-center justify-center">
                  <Shirt className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-2">
                <p className="text-xs font-semibold text-foreground truncate">
                  {item.name}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-muted-foreground">
                    {item.category}
                  </span>
                  <button
                    type="button"
                    data-ocid={`wardrobe.delete_button.${i + 1}`}
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Clothing Sheet */}
      {createPortal(
        <AnimatePresence>
          {formOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              style={{ zIndex: 200 }}
              onClick={() => setFormOpen(false)}
            />
          )}
          {formOpen && (
            <motion.div
              data-ocid="wardrobe.modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
              style={{ zIndex: 201 }}
            >
              <div
                className="pointer-events-auto w-full max-w-[430px] max-h-[90vh] overflow-y-auto bg-background rounded-2xl px-5 pt-4 pb-8 mx-4"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm">{t.addClothingItem}</h3>
                  <button
                    type="button"
                    data-ocid="wardrobe.close_button"
                    onClick={() => setFormOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  <Input
                    data-ocid="wardrobe.input"
                    placeholder="e.g. White Oxford Shirt"
                    value={form.name}
                    maxLength={100}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        name: e.target.value.slice(0, 100),
                      }))
                    }
                    className="h-9 text-sm"
                  />
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">
                      {t.category}
                      {gender && (
                        <span className="ml-1 text-accent font-normal">
                          ({gender === "male" ? "Men's" : "Women's"})
                        </span>
                      )}
                    </Label>
                    <div
                      className="flex gap-2 overflow-x-auto pb-1"
                      style={{ scrollbarWidth: "none" }}
                      data-ocid="wardrobe.select"
                    >
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, category: cat }))
                          }
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            form.category === cat
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-transparent hover:border-primary/50"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <PhotoUpload
                    value={form.photoUrl}
                    onChange={(url) =>
                      setForm((f) => ({ ...f, photoUrl: url }))
                    }
                    label="Photo (optional)"
                  />
                </div>
                <Button
                  data-ocid="wardrobe.submit_button"
                  type="button"
                  className="w-full mt-4"
                  onClick={handleSave}
                  disabled={createItem.isPending || !form.name.trim()}
                >
                  {createItem.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  {t.addItem}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

// ─── Outfits Section ──────────────────────────────────────────────────────────

function OutfitsSection({ gender }: { gender: Gender }) {
  const { t } = useI18n();
  const { resolvePhoto, deletePhoto } = useImageUpload();
  const { data: outfits = [], isLoading } = useGetAllOutfits();
  const { data: clothingItems = [] } = useGetAllClothingItems();
  const createOutfit = useCreateOutfit();
  const updateOutfit = useUpdateOutfit();
  const deleteOutfit = useDeleteOutfit();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<StyleMessage[]>([
    {
      role: "assistant",
      text: "Hi! I'm your style assistant. Ask me about color combos, occasion dressing, or outfit tips!",
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Outfit Builder state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedClothingIds, setSelectedClothingIds] = useState<Set<string>>(
    new Set(),
  );
  const [builderStep, setBuilderStep] = useState<"pick" | "details">("pick");

  const [form, setForm] = useState({
    name: "",
    occasion: "Casual",
    customOccasion: "",
    description: "",
    tags: "",
    photoUrl: "",
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({
      name: "",
      occasion: "Casual",
      customOccasion: "",
      description: "",
      tags: "",
      photoUrl: "",
    });
    setFormOpen(true);
  };

  const openEdit = (outfit: Outfit) => {
    setEditingId(outfit.id);
    setForm({
      name: outfit.name,
      occasion: outfit.occasion,
      customOccasion: "",
      description: outfit.description,
      tags: outfit.tags.join(", "),
      photoUrl: outfit.photoUrl,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    const occasion =
      form.occasion === "__custom__"
        ? form.customOccasion.trim()
        : form.occasion;
    const tagsArray = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      if (editingId) {
        await updateOutfit.mutateAsync({
          outfitId: editingId,
          name: form.name,
          occasion,
          description: form.description,
          photoUrl: form.photoUrl,
          tags: tagsArray,
        });
      } else {
        await createOutfit.mutateAsync({
          name: form.name,
          occasion,
          description: form.description,
          photoUrl: form.photoUrl,
          tags: tagsArray,
        });
      }
      setFormOpen(false);
      toast.success(editingId ? "Outfit updated" : "Outfit saved");
    } catch {
      toast.error("Failed to save outfit");
    }
  };

  const handleDelete = async (id: bigint) => {
    setDeletingId(id);
    try {
      const outfit = (outfits as Outfit[]).find((o) => o.id === id);
      await deleteOutfit.mutateAsync(id);
      if (outfit?.photoUrl) deletePhoto(outfit.photoUrl);
      if (formOpen) setFormOpen(false);
    } catch {
      toast.error("Failed to delete outfit");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBuildOutfitSave = async () => {
    const occasion =
      form.occasion === "__custom__"
        ? form.customOccasion.trim()
        : form.occasion;
    const selectedItems = (clothingItems as ClothingItem[]).filter((item) =>
      selectedClothingIds.has(item.id.toString()),
    );
    const itemsDesc = selectedItems
      .map((i) => `${i.category}: ${i.name}`)
      .join(", ");
    const description = form.description
      ? `${form.description}\nItems: ${itemsDesc}`
      : `Items: ${itemsDesc}`;
    const tagsArray = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      const newOutfit = await createOutfit.mutateAsync({
        name: form.name,
        occasion,
        description,
        photoUrl: form.photoUrl,
        tags: tagsArray,
      });
      // Save clothing item IDs linked to this outfit
      saveOutfitClothingIds(
        newOutfit.id.toString(),
        Array.from(selectedClothingIds),
      );
      setBuilderOpen(false);
      setSelectedClothingIds(new Set());
      setBuilderStep("pick");
      setForm({
        name: "",
        occasion: "Casual",
        customOccasion: "",
        description: "",
        tags: "",
        photoUrl: "",
      });
      toast.success("Outfit built and saved!");
    } catch {
      toast.error("Failed to save outfit");
    }
  };

  const handleChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    const userMsg: StyleMessage = { role: "user", text };
    const reply: StyleMessage = {
      role: "assistant",
      text: getStyleAdvice(text, gender),
    };
    setMessages((prev) => [...prev, userMsg, reply]);
    setChatInput("");
  };

  const saving = createOutfit.isPending || updateOutfit.isPending;

  return (
    <div className="flex-1 overflow-y-auto pb-24 relative">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">My Outfits</h2>
          <p className="text-xs text-muted-foreground">
            {(outfits as Outfit[]).length}{" "}
            {(outfits as Outfit[]).length === 1 ? "outfit" : "outfits"} saved
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setBuilderStep("pick");
              setSelectedClothingIds(new Set());
              setForm({
                name: "",
                occasion: "Casual",
                customOccasion: "",
                description: "",
                tags: "",
                photoUrl: "",
              });
              setBuilderOpen(true);
            }}
            className="h-8 gap-1 text-xs"
          >
            {t.buildOutfit}
          </Button>
          <Button
            data-ocid="wardrobe.primary_button"
            size="sm"
            onClick={openCreate}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
      </div>

      {/* Outfit Grid */}
      {isLoading ? (
        <div
          data-ocid="wardrobe.loading_state"
          className="flex items-center justify-center py-16"
        >
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : (outfits as Outfit[]).length === 0 ? (
        <motion.div
          data-ocid="wardrobe.empty_state"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 px-8 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
            <Shirt className="w-8 h-8 text-accent/60" />
          </div>
          <p className="font-semibold text-foreground mb-1">{t.noOutfits}</p>
          <p className="text-xs text-muted-foreground mb-5">
            Start planning your wardrobe by adding your first outfit.
          </p>
          <Button
            data-ocid="wardrobe.secondary_button"
            size="sm"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Outfit
          </Button>
        </motion.div>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-3 pt-2">
          {(outfits as Outfit[]).map((outfit, i) => (
            <motion.div
              key={outfit.id.toString()}
              data-ocid={`wardrobe.item.${i + 1}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => openEdit(outfit)}
            >
              {/* Collage or single photo */}
              <OutfitCollage
                outfitId={outfit.id.toString()}
                photoUrl={outfit.photoUrl}
                clothingItems={clothingItems as ClothingItem[]}
                resolvePhoto={resolvePhoto}
              />
              <div className="p-3">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug flex-1">
                    {outfit.name}
                  </p>
                  <button
                    type="button"
                    data-ocid={`wardrobe.delete_button.${i + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(outfit.id);
                    }}
                    disabled={deletingId === outfit.id}
                    className="text-muted-foreground hover:text-destructive shrink-0 p-0.5"
                  >
                    {deletingId === outfit.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <span
                  className={`inline-flex self-start text-[9px] font-semibold px-2 py-0.5 rounded-full border mt-1.5 ${getOccasionColor(
                    outfit.occasion,
                  )}`}
                >
                  {outfit.occasion}
                </span>
                {/* Piece count badge for builder outfits */}
                {(() => {
                  const ids = getOutfitClothingIds(outfit.id.toString());
                  return ids.length > 0 ? (
                    <span className="ml-1 text-[9px] text-muted-foreground">
                      {ids.length} pieces
                    </span>
                  ) : null;
                })()}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create / Edit Form Sheet */}
      {createPortal(
        <AnimatePresence>
          {formOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              style={{ zIndex: 200 }}
              onClick={() => setFormOpen(false)}
            />
          )}
          {formOpen && (
            <motion.div
              data-ocid="wardrobe.modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
              style={{ zIndex: 201 }}
            >
              <div
                className="pointer-events-auto w-full max-w-[430px] max-h-[90vh] overflow-y-auto bg-background rounded-2xl px-5 pt-4 pb-8 mx-4"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-foreground">
                    {editingId ? "Edit Outfit" : "New Outfit"}
                  </h3>
                  <button
                    type="button"
                    data-ocid="wardrobe.close_button"
                    onClick={() => setFormOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-1">
                  <Input
                    data-ocid="wardrobe.input"
                    placeholder="e.g. Summer Brunch Look"
                    value={form.name}
                    maxLength={100}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        name: e.target.value.slice(0, 100),
                      }))
                    }
                    className="h-9 text-sm"
                  />
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">
                      Occasion
                    </Label>
                    <Select
                      value={form.occasion}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, occasion: v }))
                      }
                    >
                      <SelectTrigger
                        data-ocid="wardrobe.select"
                        className="h-9 text-sm"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {OCCASIONS.map((occ) => (
                          <SelectItem key={occ} value={occ}>
                            {occ}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">Custom...</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.occasion === "__custom__" && (
                      <Input
                        placeholder="Enter custom occasion"
                        value={form.customOccasion}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            customOccasion: e.target.value,
                          }))
                        }
                        className="mt-2 h-9 text-sm"
                      />
                    )}
                  </div>
                  <Textarea
                    data-ocid="wardrobe.textarea"
                    placeholder="Describe your outfit..."
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    className="text-sm resize-none"
                    rows={3}
                  />
                  <PhotoUpload
                    value={form.photoUrl}
                    onChange={(url) =>
                      setForm((f) => ({ ...f, photoUrl: url }))
                    }
                  />
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">
                      Tags
                      <span className="text-muted-foreground font-normal ml-1">
                        (comma-separated)
                      </span>
                    </Label>
                    <Input
                      data-ocid="wardrobe.input"
                      placeholder="e.g. minimalist, spring, linen"
                      value={form.tags}
                      maxLength={300}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          tags: e.target.value.slice(0, 300),
                        }))
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <Button
                  data-ocid="wardrobe.submit_button"
                  type="button"
                  className="w-full mt-5"
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  {saving ? "Saving..." : editingId ? t.save : t.save}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Outfit Builder Sheet */}
      {createPortal(
        <AnimatePresence>
          {builderOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              style={{ zIndex: 200 }}
              onClick={() => setBuilderOpen(false)}
            />
          )}
          {builderOpen && (
            <motion.div
              data-ocid="wardrobe.modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
              style={{ zIndex: 201 }}
            >
              <div
                className="pointer-events-auto w-full max-w-[430px] max-h-[90vh] overflow-y-auto bg-background rounded-2xl px-5 pt-4 pb-8 mx-4 flex flex-col"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <h3 className="font-bold text-sm text-foreground">
                    {t.buildOutfit}
                  </h3>
                  <button
                    type="button"
                    data-ocid="wardrobe.close_button"
                    onClick={() => setBuilderOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {builderStep === "pick" ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-3 flex-shrink-0">
                      Select clothing items to combine:
                    </p>
                    {(clothingItems as ClothingItem[]).length === 0 ? (
                      <div className="text-center py-8 flex-1">
                        <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          No clothing items yet. Add some in "My Clothes" first.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-y-auto flex-1 grid grid-cols-3 gap-2 mb-4">
                        {(clothingItems as ClothingItem[]).map((item) => {
                          const selected = selectedClothingIds.has(
                            item.id.toString(),
                          );
                          return (
                            <button
                              type="button"
                              key={item.id.toString()}
                              onClick={() => {
                                setSelectedClothingIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.id.toString())) {
                                    next.delete(item.id.toString());
                                  } else {
                                    next.add(item.id.toString());
                                  }
                                  return next;
                                });
                              }}
                              className={`rounded-xl overflow-hidden border-2 transition-all ${
                                selected
                                  ? "border-accent"
                                  : "border-transparent"
                              }`}
                            >
                              {item.photoUrl ? (
                                <img
                                  src={resolvePhoto(item.photoUrl)}
                                  alt={item.name}
                                  className="w-full aspect-square object-cover"
                                />
                              ) : (
                                <div className="w-full aspect-square bg-muted flex items-center justify-center">
                                  <Shirt className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <div className="p-1 bg-card">
                                <p className="text-[9px] text-foreground truncate">
                                  {item.name}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {/* Preview collage of selected items */}
                    {selectedClothingIds.size > 0 && (
                      <div className="mb-3 flex-shrink-0">
                        <p className="text-[10px] text-muted-foreground mb-1">
                          Preview:
                        </p>
                        <div
                          className="w-full rounded-xl overflow-hidden bg-muted"
                          style={{ height: 80 }}
                        >
                          <div
                            className="w-full h-full grid gap-0.5"
                            style={{
                              gridTemplateColumns: `repeat(${Math.min(selectedClothingIds.size, 4)}, 1fr)`,
                            }}
                          >
                            {(clothingItems as ClothingItem[])
                              .filter((item) =>
                                selectedClothingIds.has(item.id.toString()),
                              )
                              .slice(0, 4)
                              .map((item) =>
                                item.photoUrl ? (
                                  <img
                                    key={item.id.toString()}
                                    src={resolvePhoto(item.photoUrl)}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div
                                    key={item.id.toString()}
                                    className="w-full h-full bg-muted/80 flex items-center justify-center"
                                  >
                                    <Shirt className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                ),
                              )}
                          </div>
                        </div>
                      </div>
                    )}
                    <Button
                      className="w-full flex-shrink-0"
                      disabled={selectedClothingIds.size === 0}
                      onClick={() => setBuilderStep("details")}
                    >
                      Next ({selectedClothingIds.size} selected)
                    </Button>
                  </>
                ) : (
                  <div className="overflow-y-auto flex-1 space-y-3 pr-1">
                    {/* Collage preview in details step */}
                    <div
                      className="w-full rounded-xl overflow-hidden bg-muted mb-1"
                      style={{ height: 100 }}
                    >
                      <div
                        className="w-full h-full grid gap-0.5"
                        style={{
                          gridTemplateColumns: `repeat(${Math.min(selectedClothingIds.size, 4)}, 1fr)`,
                        }}
                      >
                        {(clothingItems as ClothingItem[])
                          .filter((item) =>
                            selectedClothingIds.has(item.id.toString()),
                          )
                          .slice(0, 4)
                          .map((item) =>
                            item.photoUrl ? (
                              <img
                                key={item.id.toString()}
                                src={resolvePhoto(item.photoUrl)}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div
                                key={item.id.toString()}
                                className="w-full h-full bg-muted/80 flex items-center justify-center"
                              >
                                <Shirt className="w-5 h-5 text-muted-foreground" />
                              </div>
                            ),
                          )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(clothingItems as ClothingItem[])
                        .filter((item) =>
                          selectedClothingIds.has(item.id.toString()),
                        )
                        .map((item) => (
                          <Badge
                            key={item.id.toString()}
                            variant="secondary"
                            className="text-xs"
                          >
                            {item.name}
                          </Badge>
                        ))}
                    </div>
                    <Input
                      data-ocid="wardrobe.input"
                      placeholder="Outfit name..."
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="h-9 text-sm"
                    />
                    <Select
                      value={form.occasion}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, occasion: v }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {OCCASIONS.map((occ) => (
                          <SelectItem key={occ} value={occ}>
                            {occ}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      placeholder="Optional description..."
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                      className="text-sm resize-none"
                      rows={2}
                    />
                    <PhotoUpload
                      value={form.photoUrl}
                      onChange={(url) =>
                        setForm((f) => ({ ...f, photoUrl: url }))
                      }
                      label="Full outfit photo (optional)"
                    />
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setBuilderStep("pick")}
                      >
                        Back
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleBuildOutfitSave}
                        disabled={createOutfit.isPending || !form.name.trim()}
                      >
                        {createOutfit.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          t.save
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Chat Button */}
      <button
        type="button"
        data-ocid="wardrobe.open_modal_button"
        onClick={() => setChatOpen(true)}
        className="fixed bottom-20 right-4 z-30 w-12 h-12 rounded-full bg-accent text-accent-foreground shadow-lg flex items-center justify-center"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {/* Chat Panel */}
      {createPortal(
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              style={{ zIndex: 200 }}
              onClick={() => setChatOpen(false)}
            />
          )}
          {chatOpen && (
            <motion.div
              data-ocid="wardrobe.modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
              style={{ zIndex: 201 }}
            >
              <div
                className="pointer-events-auto w-full max-w-[430px] bg-background rounded-2xl mx-4 flex flex-col overflow-hidden"
                style={{ height: "65vh" }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
                  <div>
                    <h3 className="font-bold text-sm">{t.styleAssistant}</h3>
                    <p className="text-[10px] text-muted-foreground">
                      {gender
                        ? `Personalized for ${gender === "male" ? "men" : "women"}`
                        : "Rule-based fashion advice"}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-ocid="wardrobe.close_button"
                    onClick={() => setChatOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {messages.map((msg, i) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: message index is stable
                      key={i}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                          msg.role === "user"
                            ? "bg-accent text-accent-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="px-4 pb-5 pt-2 border-t border-border shrink-0 flex gap-2">
                  <Input
                    data-ocid="wardrobe.input"
                    placeholder={t.chatPlaceholder}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChat()}
                    className="flex-1 h-9 text-xs"
                  />
                  <Button
                    data-ocid="wardrobe.primary_button"
                    size="sm"
                    onClick={handleChat}
                    className="h-9 px-3"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

// ─── WardrobeTab (main) ───────────────────────────────────────────────────────

export default function WardrobeTab() {
  const { t } = useI18n();
  const [activeSection, setActiveSection] = useState<"outfits" | "clothes">(
    "outfits",
  );

  const [gender, setGender] = useState<Gender>(() => {
    const saved = localStorage.getItem("wardrobe_gender");
    if (saved === "male" || saved === "female") return saved;
    return null;
  });

  const handleGenderChange = (g: Gender) => {
    setGender(g);
    if (g) {
      localStorage.setItem("wardrobe_gender", g);
    } else {
      localStorage.removeItem("wardrobe_gender");
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Segmented Control */}
      <div className="px-4 pt-3 pb-0 flex-shrink-0">
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          <button
            type="button"
            data-ocid="wardrobe.tab"
            onClick={() => setActiveSection("outfits")}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors ${
              activeSection === "outfits"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {t.outfits}
          </button>
          <button
            type="button"
            data-ocid="wardrobe.tab"
            onClick={() => setActiveSection("clothes")}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors ${
              activeSection === "clothes"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {t.myClothes}
          </button>
        </div>
      </div>

      {/* Gender Selector */}
      <GenderSelector gender={gender} onChange={handleGenderChange} />

      <div className="flex-1 overflow-y-auto">
        {activeSection === "outfits" ? (
          <OutfitsSection gender={gender} />
        ) : (
          <MyClothesSection gender={gender} />
        )}
      </div>
    </div>
  );
}
