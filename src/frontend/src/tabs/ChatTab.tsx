import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../contexts/I18nContext";

interface Message {
  role: "user" | "model";
  text: string;
  id: string;
}

export default function ChatTab() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: `Hi ${user?.name || "there"}! I'm Sha, your AI assistant. How can I help you today?`,
      id: "init",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const apiKey = user?.preferences?.geminiApiKey;
  const userName = user?.name;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const send = async () => {
    const text = input.trim();
    if (!text || !apiKey) return;
    setInput("");
    const newMsg: Message = { role: "user", text, id: `u-${Date.now()}` };
    const newMessages: Message[] = [...messages, newMsg];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const contents = newMessages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [
                {
                  text: `You are Sha, a warm and helpful AI personal assistant. The user's name is ${userName || "friend"}.`,
                },
              ],
            },
            contents,
          }),
        },
      );
      const data = await res.json();
      const reply: string =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, I couldn't respond. Please try again.";
      setMessages((prev) => [
        ...prev,
        { role: "model", text: reply, id: `m-${Date.now()}` },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "Network error. Please check your connection and try again.",
          id: `err-${Date.now()}`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!apiKey && (
          <div
            data-ocid="chat.error_state"
            className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-start gap-2"
          >
            <Sparkles className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">{t.addApiKey}</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "model" && (
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-accent" />
                </div>
              )}
              <div
                className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent text-white rounded-br-sm"
                    : "bg-card border border-border text-foreground rounded-bl-sm"
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center mr-2 flex-shrink-0">
              <Bot className="w-4 h-4 text-accent" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-border bg-background flex gap-2">
        <Input
          data-ocid="chat.input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t.typeMessage}
          disabled={!apiKey || isTyping}
          className="flex-1"
        />
        <Button
          data-ocid="chat.submit_button"
          type="button"
          size="icon"
          onClick={send}
          disabled={!input.trim() || !apiKey || isTyping}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
