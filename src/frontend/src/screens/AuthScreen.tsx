import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export default function AuthScreen() {
  const { login, isLoggingIn, isLoginError, loginError } =
    useInternetIdentity();
  const [showPopupWarning, setShowPopupWarning] = useState(false);

  useEffect(() => {
    if (!isLoggingIn) {
      setShowPopupWarning(false);
      return;
    }
    const timer = setTimeout(() => setShowPopupWarning(true), 8000);
    return () => clearTimeout(timer);
  }, [isLoggingIn]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        {/* Branding */}
        <div className="text-center mb-12">
          <motion.h1
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-6xl font-black tracking-tight text-foreground"
          >
            Sha
          </motion.h1>
          <p className="text-xs text-accent font-bold tracking-widest uppercase mt-1">
            by Aenset
          </p>
          <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
            Your personal assistant.
            <br />
            Sign in to get started.
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 card-glow space-y-5">
          <div className="flex items-center gap-3 text-muted-foreground">
            <ShieldCheck className="w-5 h-5 text-accent flex-shrink-0" />
            <p className="text-sm">Secure, passwordless login powered by ICP</p>
          </div>

          <Button
            data-ocid="auth.submit_button"
            className="w-full"
            size="lg"
            onClick={login}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting…
              </>
            ) : (
              "Sign in with Internet Identity"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            A secure popup will open. If nothing happens, allow popups for this
            site in your browser settings.
          </p>

          {showPopupWarning && !isLoginError && (
            <p className="text-yellow-600 dark:text-yellow-400 text-xs text-center pt-1">
              If nothing happened, please allow popups for this site in your
              browser settings, then try again.
            </p>
          )}

          {isLoginError && (
            <p
              data-ocid="auth.error_state"
              className="text-destructive text-xs text-center pt-1"
            >
              {loginError?.message ?? "Sign-in failed. Please try again."}
            </p>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
          Internet Identity is ICP's secure, passwordless login. <br />
          No passwords. No email required.
        </p>
      </motion.div>
    </div>
  );
}
