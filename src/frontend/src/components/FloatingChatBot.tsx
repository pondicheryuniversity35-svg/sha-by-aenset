import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useActor } from "../hooks/useActor";
import {
  useGetAllEntries,
  useGetAllNotes,
  useGetAllTasks,
  useGetSummary,
} from "../hooks/useQueries";
import type { Entry, FinanceSummary, Note, Task } from "../types";
import { parseDateInput } from "../utils/dateParser";

interface FloatingChatBotProps {
  userName: string;
  routines?: Array<{
    id: bigint;
    name: string;
    timeOfDay: string;
    completedToday: boolean;
  }>;
  plannerOutfits?: Array<{ date: string; outfitId: bigint }>;
  outfits?: Array<{
    id: bigint;
    name: string;
    occasion: string;
    photoUrl: string[];
  }>;
}

interface Message {
  role: "assistant" | "user";
  text: string;
  id: number;
}

const TIPS = [
  "Break big goals into small daily actions — consistency beats intensity.",
  "Review your finances weekly to stay aware of your spending patterns.",
  "Write down at least one thing you're grateful for each day.",
  "Tackle your hardest task first thing in the morning when energy is high.",
  "A 10-minute walk can reset your focus better than another coffee.",
  "Use the 2-minute rule: if a task takes less than 2 minutes, do it now.",
  "Keep your notes organized in folders so you can find them quickly.",
  "Set a weekly budget review — even 5 minutes keeps surprises away.",
  "Celebrate small wins; momentum comes from recognizing progress.",
  "Plan tomorrow the night before so you wake up with clear intent.",
];

let tipIndex = 0;
function nextTip() {
  const tip = TIPS[tipIndex % TIPS.length];
  tipIndex++;
  return tip;
}

const HELP_TEXT = `I can help you with:

📋 Tasks: "Add task: go to gym tomorrow" or "Add tasks: task1, task2, task3"
📝 Notes: "Create note: meeting notes"
💰 Finance: "Add expense: coffee 5" or "Add income: salary 3000"
🏋️ Gym: "Log workout: chest day"
📊 Data: Ask about your tasks, notes, finance, routines, workouts, outfits
💡 Tips: Ask for advice or motivation`;

function getGymLogs(): Array<{
  date: string;
  dayName: string;
  timestamp: number;
}> {
  try {
    return JSON.parse(localStorage.getItem("sha_gym_logs") || "[]");
  } catch {
    return [];
  }
}

function generateResponse(
  input: string,
  data: {
    tasks: Task[];
    notes: Note[];
    entries: Entry[];
    summary: FinanceSummary | undefined;
    userName: string;
    routines?: FloatingChatBotProps["routines"];
    plannerOutfits?: FloatingChatBotProps["plannerOutfits"];
    outfits?: FloatingChatBotProps["outfits"];
  },
): string {
  const q = input.toLowerCase().trim();
  const {
    tasks,
    notes,
    entries,
    summary,
    userName,
    routines,
    plannerOutfits,
    outfits,
  } = data;

  if (/^(hi|hello|hey|sup|howdy)/.test(q)) {
    return `Hey ${userName}! I'm Sha, your personal assistant. Ask me about your tasks, notes, finances, routines, or workouts — or type "help" to see all commands!`;
  }

  if (/\bhelp\b|what can you do|commands/.test(q)) {
    return HELP_TEXT;
  }

  if (/balance|money|spend|income|expense|finance|budget|cash/.test(q)) {
    if (!summary) {
      return "I couldn't load your finance data right now. Try again in a moment.";
    }
    const balance = summary.balance.toFixed(2);
    const inc = summary.totalIncome.toFixed(2);
    const exp = summary.totalExpenses.toFixed(2);
    let reply = `Your current balance is $${balance}\nTotal income: $${inc}\nTotal expenses: $${exp}`;
    if (/recent|last|entr/.test(q) && entries.length > 0) {
      const recent = [...entries]
        .sort((a, b) => Number(b.timestamp - a.timestamp))
        .slice(0, 3);
      reply += `\n\nRecent entries:\n${recent
        .map(
          (e) =>
            `- ${e.description || e.category}: $${e.amount.toFixed(2)} (${e.entryType})`,
        )
        .join("\n")}`;
    }
    return reply;
  }

  if (/task|todo|planner|schedule|today|checklist/.test(q)) {
    if (tasks.length === 0) {
      return "You have no tasks yet! Head to the Planner tab to add some.";
    }
    const total = tasks.length;
    const done = tasks.filter((t) => t.completed).length;
    const pending = tasks.filter((t) => !t.completed);
    let reply = `You have ${total} tasks (${done} completed, ${total - done} pending).`;
    if (pending.length > 0) {
      const titles = pending
        .slice(0, 5)
        .map((t) => `- ${t.title}`)
        .join("\n");
      reply += `\n\nPending:\n${titles}`;
      if (pending.length > 5) reply += `\n- ...and ${pending.length - 5} more`;
    }
    return reply;
  }

  if (/note|notes|folder/.test(q)) {
    if (notes.length === 0) {
      return "You haven't created any notes yet. Head to the Notes tab to start writing!";
    }
    const recent = [...notes]
      .sort((a, b) => Number(b.timestamp - a.timestamp))
      .slice(0, 3);
    const titles = recent.map((n) => `- ${n.title || "Untitled"}`).join("\n");
    return `You have ${notes.length} notes. Recent ones:\n${titles}`;
  }

  if (/routine|streak|habit/.test(q)) {
    if (!routines || routines.length === 0) {
      return "You haven't set up any routines yet. Go to Planner > Routine tab to add some!";
    }
    const completedToday = routines.filter((r) => r.completedToday);
    const pct = Math.round((completedToday.length / routines.length) * 100);
    const pending = routines.filter((r) => !r.completedToday);
    let reply = `📅 Routines today: ${completedToday.length}/${routines.length} complete (${pct}%)`;
    if (pending.length > 0) {
      reply += `\n\nStill pending:\n${pending.map((r) => `- ${r.name} (${r.timeOfDay})`).join("\n")}`;
    } else {
      reply += "\n\n🎉 All routines complete for today!";
    }
    return reply;
  }

  if (/wardrobe|outfit|what did i wear/.test(q)) {
    if (!plannerOutfits || plannerOutfits.length === 0) {
      return "No outfits have been assigned to planner days yet. Go to Planner and pick an outfit for a day!";
    }
    const recent = [...plannerOutfits]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 5);
    const lines = recent.map((po) => {
      const outfit = outfits?.find((o) => o.id === po.outfitId);
      return `- ${po.date}: ${outfit?.name ?? "Unknown outfit"}`;
    });
    return `Recent outfit assignments:\n${lines.join("\n")}`;
  }

  if (/gym|workout|exercise|how many workout/.test(q)) {
    const logs = getGymLogs();
    const now = new Date();
    const thisMonth = logs.filter((l) => {
      const d = new Date(l.timestamp);
      return (
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      );
    });
    if (logs.length === 0) {
      return `You haven't logged any workouts yet. Type "Log workout: chest day" to start!`;
    }
    return `🏋️ This month: ${thisMonth.length} workout${thisMonth.length !== 1 ? "s" : ""} logged\n📊 All time: ${logs.length} total\n\nRecent sessions:\n${logs
      .slice(-3)
      .reverse()
      .map((l) => `- ${l.date}: ${l.dayName}`)
      .join("\n")}`;
  }

  if (/advice|tip|motivat|should|suggest|idea/.test(q)) {
    return `Here's a tip for you:\n\n"${nextTip()}"`;
  }

  if (/summar|overview|status|how am i|dashboard/.test(q)) {
    const pendingCount = tasks.filter((t) => !t.completed).length;
    const balance = summary ? `$${summary.balance.toFixed(2)}` : "unavailable";
    const routinePct =
      routines && routines.length > 0
        ? `${Math.round((routines.filter((r) => r.completedToday).length / routines.length) * 100)}%`
        : "N/A";
    return `Overview for ${userName}:\n- Pending tasks: ${pendingCount}\n- Notes saved: ${notes.length}\n- Current balance: ${balance}\n- Routines today: ${routinePct} complete`;
  }

  return `I can help you with tasks, notes, finances, routines, and workouts. Type "help" to see all commands!`;
}

export default function FloatingChatBot({
  userName,
  routines,
  plannerOutfits,
  outfits,
}: FloatingChatBotProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [msgId, setMsgId] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const msgCountRef = useRef(0);
  msgCountRef.current = messages.length;

  const { actor } = useActor();
  const { data: tasks = [] } = useGetAllTasks();
  const { data: rawNotes = [] } = useGetAllNotes();
  const { data: entries = [] } = useGetAllEntries();
  const { data: summary } = useGetSummary();

  const notes = rawNotes as Note[];

  useEffect(() => {
    if (open && msgCountRef.current === 0) {
      setMessages([
        {
          role: "assistant",
          id: 0,
          text: `Hi ${userName}! I'm Sha, your personal assistant. I can help with tasks, notes, finances, routines, workouts, and outfits. Type "help" to see all commands!`,
        },
      ]);
      setMsgId(1);
    }
  }, [open, userName]);

  const scrollToBottom = () =>
    setTimeout(
      () => endRef.current?.scrollIntoView({ behavior: "smooth" }),
      60,
    );

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = { role: "user", text, id: msgId };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    let nextId = msgId + 1;

    // Intent: create note
    const noteMatch = text.match(/^(?:create|add|make a?|new) note[:\s]+(.+)/i);
    if (noteMatch && actor) {
      const title = noteMatch[1].trim();
      try {
        const a = actor as any;
        await a.createNote(title, "", BigInt(0), []);
        const botMsg: Message = {
          role: "assistant",
          text: `✅ Created note: "${title}"`,
          id: nextId,
        };
        setMessages((prev) => [...prev, botMsg]);
        setMsgId(nextId + 1);
        scrollToBottom();
        return;
      } catch {
        /* fall through */
      }
    }

    // Intent: create MULTIPLE tasks
    const multiTaskMatch = text.match(/^(?:add|create) tasks?[:\s]+(.+)/i);
    if (multiTaskMatch && actor) {
      const rawList = multiTaskMatch[1];
      const titles = rawList
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (titles.length > 1) {
        const today = new Date().toISOString().split("T")[0];
        const results: string[] = [];
        const errors: string[] = [];
        await Promise.all(
          titles.map(async (title) => {
            try {
              await actor.createTask(title, "", today);
              results.push(title);
            } catch {
              errors.push(title);
            }
          }),
        );
        let reply = `✅ Added ${results.length} task${results.length !== 1 ? "s" : ""}:\n${results.map((t) => `- ${t}`).join("\n")}`;
        if (errors.length > 0) {
          reply += `\n\n⚠️ Failed to add:\n${errors.map((t) => `- ${t}`).join("\n")}`;
        }
        const botMsg: Message = { role: "assistant", text: reply, id: nextId };
        setMessages((prev) => [...prev, botMsg]);
        setMsgId(nextId + 1);
        scrollToBottom();
        return;
      }
    }

    // Intent: create single task
    const taskMatch = text.match(
      /^(?:add|create|remind me to) task[:\s]+(.+)|^(?:remind me to) (.+)/i,
    );
    const taskTitle = taskMatch?.[1] || taskMatch?.[2];
    if (taskTitle && actor) {
      const dateWords = taskTitle.match(
        /(?:on|for|next|tomorrow|today) (.+)$/i,
      );
      const rawDate = dateWords ? dateWords[0].replace(/^(on|for) /i, "") : "";
      const parsedDate = rawDate
        ? parseDateInput(rawDate)
        : new Date().toISOString().split("T")[0];
      const cleanTitle = dateWords
        ? taskTitle.replace(dateWords[0], "").trim()
        : taskTitle.trim();
      try {
        await actor.createTask(cleanTitle || taskTitle.trim(), "", parsedDate);
        const botMsg: Message = {
          role: "assistant",
          text: `✅ Added task: "${cleanTitle || taskTitle.trim()}" for ${parsedDate}`,
          id: nextId,
        };
        setMessages((prev) => [...prev, botMsg]);
        setMsgId(nextId + 1);
        scrollToBottom();
        return;
      } catch {
        /* fall through */
      }
    }

    // Intent: log gym workout
    const gymMatch = text.match(/^(?:log workout|log gym|i did)[:\s]+(.+)/i);
    if (gymMatch) {
      const dayName = gymMatch[1].trim();
      const today = new Date().toISOString().split("T")[0];
      try {
        const logs = getGymLogs();
        logs.push({ date: today, dayName, timestamp: Date.now() });
        localStorage.setItem("sha_gym_logs", JSON.stringify(logs));
        const botMsg: Message = {
          role: "assistant",
          text: `✅ Logged workout: ${dayName} for today`,
          id: nextId,
        };
        setMessages((prev) => [...prev, botMsg]);
        setMsgId(nextId + 1);
        scrollToBottom();
        return;
      } catch {
        /* fall through */
      }
    }

    // Intent: add finance entry
    const financeMatch = text.match(
      /^(?:add|log) (expense|income)[:\s]+(.+?)\s+(\d+(?:\.\d+)?)\s*$/i,
    );
    if (financeMatch && actor) {
      const entryType = financeMatch[1].toLowerCase() as "expense" | "income";
      const category = financeMatch[2].trim();
      const amount = Number.parseFloat(financeMatch[3]);
      try {
        const a = actor as any;
        await a.createEntry(
          category,
          amount,
          entryType,
          category,
          BigInt(Date.now()),
        );
        const botMsg: Message = {
          role: "assistant",
          text: `✅ Logged ${entryType}: ${category} — $${amount.toFixed(2)}`,
          id: nextId,
        };
        setMessages((prev) => [...prev, botMsg]);
        setMsgId(nextId + 1);
        scrollToBottom();
        return;
      } catch {
        /* fall through */
      }
    }

    const response = generateResponse(text, {
      tasks,
      notes,
      entries,
      summary,
      userName,
      routines,
      plannerOutfits,
      outfits,
    });
    const botMsg: Message = { role: "assistant", text: response, id: nextId };
    setMessages((prev) => [...prev, botMsg]);
    setMsgId(nextId + 1);
    scrollToBottom();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <>
      <motion.button
        type="button"
        data-ocid="chatbot.open_modal_button"
        onClick={() => {
          setOpen(true);
          scrollToBottom();
        }}
        className="fixed bottom-20 right-4 z-[250] w-12 h-12 rounded-full bg-accent text-accent-foreground shadow-lg flex items-center justify-center"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        aria-label="Open Sha Assistant"
        style={{ zIndex: 250, display: open ? "none" : "flex" }}
      >
        <MessageCircle className="w-5 h-5" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            data-ocid="chatbot.modal"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[260] flex flex-col bg-background border-t border-x border-border rounded-t-2xl shadow-2xl"
            style={{ height: "75dvh", zIndex: 260 }}
          >
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground leading-none">
                    Sha Assistant
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Your personal helper
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-ocid="chatbot.close_button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-accent text-accent-foreground rounded-br-sm"
                          : "bg-card border border-border text-foreground rounded-bl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            </ScrollArea>

            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-t border-border">
              <Input
                data-ocid="chatbot.input"
                placeholder="Ask me anything…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 h-9 text-sm"
                autoComplete="off"
              />
              <Button
                data-ocid="chatbot.submit_button"
                size="icon"
                className="h-9 w-9 bg-accent text-accent-foreground hover:bg-accent/90 flex-shrink-0"
                onClick={sendMessage}
                disabled={!input.trim()}
                aria-label="Send"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
