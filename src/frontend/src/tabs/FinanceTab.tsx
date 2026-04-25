import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  Loader2,
  Plus,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrency } from "../contexts/CurrencyContext";
import { useI18n } from "../contexts/I18nContext";
import {
  useCreateBudgetLimit,
  useCreateEntry,
  useDeleteBudgetLimit,
  useDeleteEntry,
  useGetAllBudgetLimits,
  useGetAllEntries,
  useGetSummary,
} from "../hooks/useQueries";

const FINANCE_CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Entertainment",
  "Health",
  "Utilities",
  "Education",
  "Travel",
  "Other",
];

// ── Budget Modal ───────────────────────────────────────────────────────────────
function BudgetModal({
  onClose,
  formatAmount,
}: {
  onClose: () => void;
  formatAmount: (n: number) => string;
}) {
  const [category, setCategory] = useState("Food");
  const [limitAmount, setLimitAmount] = useState("");
  const createBudget = useCreateBudgetLimit();

  const submit = async () => {
    const num = Number.parseFloat(limitAmount);
    if (!num || num <= 0) {
      toast.error("Enter a valid limit amount");
      return;
    }
    try {
      await createBudget.mutateAsync({ category, monthlyLimit: num });
      toast.success(`Budget set: ${formatAmount(num)}/month for ${category}`);
      onClose();
    } catch {
      // error toast handled in hook
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.93 }}
        transition={{ duration: 0.18 }}
        className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-foreground">Set Monthly Budget</p>
          <button
            type="button"
            data-ocid="finance.close_button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Category</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {["All", ...FINANCE_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                    category === cat
                      ? "bg-accent text-white border-accent"
                      : "bg-muted text-muted-foreground border-transparent hover:border-border"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Monthly Limit</Label>
            <Input
              data-ocid="finance.input"
              type="number"
              placeholder="0.00"
              value={limitAmount}
              onChange={(e) => setLimitAmount(e.target.value)}
              className="mt-1"
              autoFocus
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              data-ocid="finance.cancel_button"
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              data-ocid="finance.confirm_button"
              type="button"
              className="flex-1"
              onClick={submit}
              disabled={createBudget.isPending}
            >
              {createBudget.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : null}
              Save Budget
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── BudgetSection ──────────────────────────────────────────────────────────────
function BudgetSection({
  entries,
  formatAmount,
}: {
  entries: Array<{
    category: string;
    entryType: string;
    amount: number;
    date: string;
  }>;
  formatAmount: (n: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { data: limits = [] } = useGetAllBudgetLimits();
  const deleteBudget = useDeleteBudgetLimit();

  // Current month spend per category
  const monthlySpend = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const spend: Record<string, number> = {};
    for (const e of entries) {
      if (e.entryType === "expense" && e.date.startsWith(ym)) {
        spend[e.category] = (spend[e.category] ?? 0) + e.amount;
      }
    }
    return spend;
  }, [entries]);

  const totalMonthlyExpenses = useMemo(
    () => Object.values(monthlySpend).reduce((a, b) => a + b, 0),
    [monthlySpend],
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="mx-4 mt-4"
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            data-ocid="finance.tab"
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
          >
            <Target className="w-3.5 h-3.5" />
            Budget Limits
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            {limits.length > 0 && (
              <span className="ml-1 bg-accent/20 text-accent text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {limits.length}
              </span>
            )}
          </button>
          <Button
            data-ocid="finance.open_modal_button"
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 px-2"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-3 h-3" />
            Set Budget
          </Button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {limits.length === 0 ? (
                <div
                  data-ocid="finance.empty_state"
                  className="bg-card border border-border rounded-xl p-4 text-center"
                >
                  <p className="text-xs text-muted-foreground">
                    No budget limits set yet. Tap "Set Budget" to add one.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {limits.map((limit, idx) => {
                    const spent =
                      limit.category === "All"
                        ? totalMonthlyExpenses
                        : (monthlySpend[limit.category] ?? 0);
                    const pct = Math.min(
                      100,
                      Math.round((spent / limit.monthlyLimit) * 100),
                    );
                    const isOver = spent > limit.monthlyLimit;
                    const isNear = !isOver && pct >= 80;
                    const barColor = isOver
                      ? "bg-destructive"
                      : isNear
                        ? "bg-amber-500"
                        : "bg-success";
                    return (
                      <motion.div
                        key={limit.id.toString()}
                        data-ocid={`finance.item.${idx + 1}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`bg-card border rounded-xl px-4 py-3 ${
                          isOver
                            ? "border-destructive/40"
                            : isNear
                              ? "border-amber-500/40"
                              : "border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-semibold text-foreground truncate">
                              {limit.category}
                            </span>
                            {isOver && (
                              <Badge
                                variant="destructive"
                                className="text-[10px] py-0 px-1.5 shrink-0"
                              >
                                Over limit
                              </Badge>
                            )}
                            {isNear && !isOver && (
                              <Badge className="text-[10px] py-0 px-1.5 shrink-0 bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                Near limit
                              </Badge>
                            )}
                          </div>
                          <button
                            type="button"
                            data-ocid={`finance.delete_button.${idx + 1}`}
                            onClick={() => deleteBudget.mutate(limit.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors ml-2 flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground">
                            {formatAmount(spent)} spent
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Limit: {formatAmount(limit.monthlyLimit)} / month
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <BudgetModal
            onClose={() => setShowModal(false)}
            formatAmount={formatAmount}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── FinanceTab ─────────────────────────────────────────────────────────────────
export default function FinanceTab() {
  const { t } = useI18n();
  const { formatAmount } = useCurrency();
  const { data: entries = [], isLoading } = useGetAllEntries();
  const { data: summary } = useGetSummary();
  const { data: budgetLimits = [] } = useGetAllBudgetLimits();
  const createEntry = useCreateEntry();
  const deleteEntry = useDeleteEntry();

  const [amount, setAmount] = useState("");
  const [entryType, setEntryType] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Check budget limits after adding an expense
  const checkBudgetAlerts = (
    newCategory: string,
    allEntries: Array<{
      category: string;
      entryType: string;
      amount: number;
      date: string;
    }>,
  ) => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Compute current month totals
    const monthSpend: Record<string, number> = {};
    let totalMonthExpenses = 0;
    for (const e of allEntries) {
      if (e.entryType === "expense" && e.date.startsWith(ym)) {
        monthSpend[e.category] = (monthSpend[e.category] ?? 0) + e.amount;
        totalMonthExpenses += e.amount;
      }
    }

    for (const limit of budgetLimits) {
      if (limit.category === "All") {
        if (totalMonthExpenses > limit.monthlyLimit) {
          const over = totalMonthExpenses - limit.monthlyLimit;
          toast.error(
            `Budget alert: you have exceeded your overall monthly limit by ${formatAmount(over)}`,
            { duration: 6000, id: "budget-alert-all" },
          );
        }
      } else if (limit.category === newCategory) {
        const spent = monthSpend[newCategory] ?? 0;
        if (spent > limit.monthlyLimit) {
          const over = spent - limit.monthlyLimit;
          toast.error(
            `Budget alert: you have exceeded your ${newCategory} limit by ${formatAmount(over)}`,
            { duration: 6000, id: `budget-alert-${newCategory}` },
          );
        }
      }
    }
  };

  const submit = async () => {
    const num = Number.parseFloat(amount);
    if (!num || num <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!category.trim()) {
      toast.error("Enter a category");
      return;
    }
    try {
      const newEntry = await createEntry.mutateAsync({
        amount: num,
        entryType,
        category,
        description,
        date,
      });
      setAmount("");
      setCategory("");
      setDescription("");
      toast.success("Entry added!");

      // Check budget alerts only for expenses
      if (entryType === "expense") {
        const updatedEntries = [
          ...entries,
          { ...newEntry, entryType, category, amount: num, date },
        ];
        checkBudgetAlerts(category, updatedEntries);
      }
    } catch {
      // onError in useCreateEntry already shows toast
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      {/* Summary cards */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card border border-border rounded-xl p-3 text-center"
        >
          <TrendingUp className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">{t.totalIncome}</p>
          <p className="text-sm font-bold text-success">
            {formatAmount(summary?.totalIncome ?? 0)}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-3 text-center"
        >
          <TrendingDown className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">{t.totalExpenses}</p>
          <p className="text-sm font-bold text-destructive">
            {formatAmount(summary?.totalExpenses ?? 0)}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-xl p-3 text-center"
        >
          <DollarSign className="w-5 h-5 text-accent mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">{t.balance}</p>
          <p
            className={`text-sm font-bold ${
              (summary?.balance ?? 0) >= 0 ? "text-success" : "text-destructive"
            }`}
          >
            {formatAmount(summary?.balance ?? 0)}
          </p>
        </motion.div>
      </div>

      {/* Add Entry Form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mx-4 mt-4 bg-card border border-border rounded-2xl p-4"
      >
        <p className="text-sm font-semibold text-foreground mb-3">
          {t.addEntry}
        </p>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            data-ocid="finance.toggle"
            onClick={() => setEntryType("income")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              entryType === "income"
                ? "bg-success/20 border border-success/40 text-success"
                : "bg-muted text-muted-foreground border border-transparent"
            }`}
          >
            + {t.income}
          </button>
          <button
            type="button"
            data-ocid="finance.toggle"
            onClick={() => setEntryType("expense")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              entryType === "expense"
                ? "bg-destructive/20 border border-destructive/40 text-destructive"
                : "bg-muted text-muted-foreground border border-transparent"
            }`}
          >
            - {t.expense}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <Label className="text-xs">{t.amount}</Label>
            <Input
              data-ocid="finance.input"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">{t.category}</Label>
            <div className="mt-1">
              <select
                data-ocid="finance.select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
              >
                <option value="">Select category</option>
                {FINANCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="mb-2">
          <Label className="text-xs">{t.description}</Label>
          <Input
            data-ocid="finance.input"
            placeholder="Optional note"
            value={description}
            maxLength={255}
            onChange={(e) => setDescription(e.target.value.slice(0, 255))}
            className="mt-1"
          />
        </div>
        <div className="mb-3">
          <Label className="text-xs">{t.date}</Label>
          <Input
            data-ocid="finance.input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button
          data-ocid="finance.submit_button"
          type="button"
          className="w-full"
          onClick={submit}
          disabled={createEntry.isPending}
        >
          {createEntry.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          {t.addEntry}
        </Button>
      </motion.div>

      {/* Budget Limits */}
      <BudgetSection entries={entries} formatAmount={formatAmount} />

      {/* Entries list */}
      <div className="mx-4 mt-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Recent Entries
        </p>
        {isLoading ? (
          <div data-ocid="finance.loading_state" className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : entries && entries.length > 0 ? (
          <div className="space-y-2">
            {[...entries].reverse().map((entry, idx) => (
              <motion.div
                key={entry.id.toString()}
                data-ocid={`finance.item.${idx + 1}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold ${
                        entry.entryType === "income"
                          ? "text-success"
                          : "text-destructive"
                      }`}
                    >
                      {entry.entryType === "income" ? "+" : "-"}
                      {formatAmount(entry.amount)}
                    </span>
                    <Badge variant="secondary" className="text-xs py-0 px-1.5">
                      {entry.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {entry.description || entry.date}
                  </p>
                </div>
                <button
                  type="button"
                  data-ocid={`finance.delete_button.${idx + 1}`}
                  onClick={() => deleteEntry.mutate(entry.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div
            data-ocid="finance.empty_state"
            className="bg-card border border-border rounded-xl p-6 text-center"
          >
            <p className="text-muted-foreground text-sm">
              No entries yet. Add your first income or expense.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
