import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, CalendarCheck, TrendingUp, User } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

interface Props {
  onFinish: (name: string) => void;
}

export default function OnboardingScreen({ onFinish }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");

  const TOTAL_STEPS = 3;

  const next = () => {
    if (step === 0) {
      if (!name.trim()) return;
      setStep(1);
    } else if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      onFinish(name.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black tracking-tight text-foreground">
          Sha
        </h1>
        <p className="text-xs text-accent font-semibold tracking-widest uppercase mt-1">
          by Aenset
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="name"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center text-center max-w-xs w-full"
          >
            <div className="w-32 h-32 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-8 text-accent">
              <User className="w-16 h-16" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              What should we call you?
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Enter your name so Sha can greet you personally.
            </p>
            <Input
              data-ocid="onboarding.input"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && next()}
              className="w-full text-center text-lg"
              autoFocus
            />
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="plan"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center text-center max-w-xs w-full"
          >
            <div className="w-32 h-32 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-8 text-accent">
              <CalendarCheck className="w-16 h-16" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Plan Your Days
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              A calendar planner and checklists keep you on track every single
              day.
            </p>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="track"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center text-center max-w-xs w-full"
          >
            <div className="w-32 h-32 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-8 text-accent">
              <TrendingUp className="w-16 h-16" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Track What Matters
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Monitor your finances, notes, and habits — all in one place, saved
              securely to your account.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 my-10">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static dot
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === step ? "w-8 bg-accent" : "w-2 bg-muted"
            }`}
          />
        ))}
      </div>

      <Button
        data-ocid="onboarding.primary_button"
        onClick={next}
        className="w-full max-w-xs"
        size="lg"
        disabled={step === 0 && !name.trim()}
      >
        {step < TOTAL_STEPS - 1 ? (
          <>
            Continue <ArrowRight className="w-4 h-4 ml-2" />
          </>
        ) : (
          "Get Started"
        )}
      </Button>
    </div>
  );
}
