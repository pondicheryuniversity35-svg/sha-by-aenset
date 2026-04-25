import { Toaster } from "@/components/ui/sonner";
import {
  CalendarCheck,
  DollarSign,
  Dumbbell,
  Home,
  NotebookPen,
  Shirt,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { I18nProvider, RTL_LANGUAGES, useI18n } from "./contexts/I18nContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { useActor } from "./hooks/useActor";
import { useBackgroundContrast } from "./hooks/useBackgroundContrast";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useGetAllTasks } from "./hooks/useQueries";
import { useTaskNotifications } from "./hooks/useTaskNotifications";
import AuthScreen from "./screens/AuthScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import FinanceTab from "./tabs/FinanceTab";
import GymTab from "./tabs/GymTab";
import HomeTab from "./tabs/HomeTab";
import NotesTab from "./tabs/NotesTab";
import PlannerTab from "./tabs/PlannerTab";
import ProfileTab, {
  getTabBackgrounds,
  getProfilePicture,
} from "./tabs/ProfileTab";
import type { TabBackgrounds } from "./tabs/ProfileTab";
import WardrobeTab from "./tabs/WardrobeTab";
import type { UserProfileView } from "./types";
import { CACHE_KEYS, localCache } from "./utils/localCache";

type Tab =
  | "home"
  | "notes"
  | "planner"
  | "finance"
  | "profile"
  | "wardrobe"
  | "gym";

function buildBgStyle(
  bg: TabBackgrounds[keyof TabBackgrounds] | undefined,
): React.CSSProperties {
  if (!bg) return {};
  const isGradient =
    bg.imageUrl.startsWith("linear-gradient") ||
    bg.imageUrl.startsWith("radial-gradient");
  return {
    backgroundImage: isGradient ? bg.imageUrl : `url(${bg.imageUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

function TabWrapper({
  tabId,
  activeTab,
  bg,
  children,
}: {
  tabId: Tab;
  activeTab: Tab;
  bg: TabBackgrounds[keyof TabBackgrounds] | undefined;
  children: React.ReactNode;
}) {
  const bgMode = useBackgroundContrast(bg?.imageUrl, bg?.opacity ?? 0);

  return (
    <div
      className="flex-col flex-1 overflow-hidden relative"
      style={{
        display: activeTab === tabId ? "flex" : "none",
        ...buildBgStyle(bg),
      }}
    >
      {bg && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `rgba(0,0,0,${bg.opacity})`, zIndex: 0 }}
        />
      )}
      <div
        className="relative flex flex-col flex-1 overflow-hidden"
        style={{ zIndex: 1 }}
        data-bg-mode={bg ? bgMode : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function SplashScreen() {
  return (
    <div className="splash-fullscreen">
      <img
        src="/assets/splash_screen-019d612d-bd8e-71b4-8343-e64498d89c30.png"
        alt="Sha by Aenset"
      />
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ zIndex: 10 }}
      >
        <div className="flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-white animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { actor, isFetching } = useActor();
  const {
    identity,
    isInitializing,
    clear: clearIdentity,
  } = useInternetIdentity();
  const { user, setUser, isLoading, setIsLoading } = useAuth();
  const { t, lang } = useI18n();
  const { data: allTasksForNotif } = useGetAllTasks();
  useTaskNotifications(allTasksForNotif);
  const { setIsDark } = useTheme();
  const setIsDarkRef = useRef(setIsDark);
  useEffect(() => {
    setIsDarkRef.current = setIsDark;
  }, [setIsDark]);

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [mountedTabs, setMountedTabs] = useState<Set<Tab>>(
    () => new Set<Tab>(["home"]),
  );
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tabBackgrounds, setTabBackgrounds] = useState<TabBackgrounds>(() =>
    getTabBackgrounds(),
  );

  const isRTL = RTL_LANGUAGES.includes(lang);

  const handleBackgroundChange = useCallback(() => {
    setTabBackgrounds(getTabBackgrounds());
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  const [profilePicture, setProfilePicture] = useState<string>(() =>
    getProfilePicture(),
  );

  useEffect(() => {
    if (!identity) return;
    const principalId = identity.getPrincipal().toString();
    const done =
      localStorage.getItem(`sha_onboarding_done_${principalId}`) === "1";
    if (done && !user) {
      const cached = localCache.get<UserProfileView>(CACHE_KEYS.profile);
      if (cached) {
        setUser(cached);
        setIsLoading(false);
        if (cached.preferences?.darkMode !== undefined) {
          setIsDarkRef.current(cached.preferences.darkMode);
        }
      }
    }
  }, [identity, user, setUser, setIsLoading]);

  useEffect(() => {
    const handler = () => setProfilePicture(getProfilePicture());
    window.addEventListener("profilePictureChanged", handler);
    return () => window.removeEventListener("profilePictureChanged", handler);
  }, []);

  useEffect(() => {
    const handler = () => handleTabChange("profile");
    window.addEventListener("navigateToProfile", handler);
    return () => window.removeEventListener("navigateToProfile", handler);
  }, [handleTabChange]);

  useEffect(() => {
    // Compute principal-scoped onboarding key so session persists across app restarts
    const principalId = identity?.getPrincipal().toString();
    const onboardingKey = principalId
      ? `sha_onboarding_done_${principalId}`
      : "sha_onboarding_done";

    if (!identity) {
      setIsLoading(false);
      return;
    }

    // If actor is still loading but we have a cached profile, render from cache immediately
    if (isFetching && !actor) {
      const cached = localCache.get<UserProfileView>(CACHE_KEYS.profile);
      if (cached) {
        setUser(cached);
        setIsLoading(false);
        if (cached.preferences?.darkMode !== undefined) {
          setIsDarkRef.current(cached.preferences.darkMode);
        }
      }
      return;
    }

    if (!actor) {
      setIsLoading(false);
      return;
    }

    const cached = localCache.get<UserProfileView>(CACHE_KEYS.profile);
    if (cached) {
      setUser(cached);
      setIsLoading(false);
      if (cached.preferences?.darkMode !== undefined) {
        setIsDarkRef.current(cached.preferences.darkMode);
      }
      // Sync with backend in background (non-blocking)
      actor
        .getCallerUserProfile()
        .then((profile) => {
          if (profile) {
            setUser(profile);
            localCache.set(CACHE_KEYS.profile, profile);
            if (profile.preferences?.darkMode !== undefined) {
              setIsDarkRef.current(profile.preferences.darkMode);
            }
          }
        })
        .catch(() => {});
      return;
    }

    setIsLoading(true);
    const timeout = setTimeout(() => {
      setIsLoading(false);
      // Only show onboarding if this principal hasn't done it yet
      if (localStorage.getItem(onboardingKey) !== "1") {
        setShowOnboarding(true);
      }
    }, 5000);

    actor
      .getCallerUserProfile()
      .then((profile) => {
        clearTimeout(timeout);
        if (profile) {
          // Returning user — mark onboarding done for this principal and go straight in
          localStorage.setItem(onboardingKey, "1");
          setUser(profile);
          localCache.set(CACHE_KEYS.profile, profile);
          if (profile.preferences?.darkMode !== undefined) {
            setIsDarkRef.current(profile.preferences.darkMode);
          }
        } else {
          // New user — check if they've already done onboarding on this device for this principal
          if (localStorage.getItem(onboardingKey) !== "1") {
            setShowOnboarding(true);
          } else {
            setIsLoading(false);
          }
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        if (localStorage.getItem(onboardingKey) !== "1") {
          setShowOnboarding(true);
        }
      })
      .finally(() => setIsLoading(false));

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, actor, isFetching, setUser, setIsLoading]);

  useEffect(() => {
    if (!identity) {
      setUser(null);
      localCache.remove(CACHE_KEYS.profile);
    }
  }, [identity, setUser]);

  // Safety net: if not loading and we have an identity but no user and not showing
  // onboarding, force onboarding so the app never gets stuck on a blank screen.
  useEffect(() => {
    const principalKey = identity
      ? `sha_onboarding_done_${identity.getPrincipal().toString()}`
      : "sha_onboarding_done";
    if (
      !isLoading &&
      !isInitializing &&
      !isFetching &&
      identity &&
      !user &&
      !showOnboarding &&
      localStorage.getItem(principalKey) !== "1"
    ) {
      setShowOnboarding(true);
    }
  }, [isLoading, isInitializing, isFetching, identity, user, showOnboarding]);

  // 10-second actor timeout: if actor hasn't loaded but onboarding is done and
  // there's no cached profile, synthesize a minimal user so the app never hangs
  // stuck on the splash screen forever.
  const actorTimeoutFiredRef = useRef(false);
  useEffect(() => {
    if (!identity) return;
    if (user) return;
    const principalId = identity.getPrincipal().toString();
    if (localStorage.getItem(`sha_onboarding_done_${principalId}`) !== "1") {
      return;
    }
    if (actorTimeoutFiredRef.current) return;
    const tid = setTimeout(() => {
      actorTimeoutFiredRef.current = true;
      // Only set if still no user (actor may have loaded by now)
      if (!user) {
        setUser({
          name: "User",
          email: "",
          preferences: {
            language: "en",
            darkMode: false,
            geminiApiKey: "",
            currency: "USD",
          },
          registrationTime: BigInt(Date.now()),
          tasks: [],
          finances: [],
        });
      }
      setIsLoading(false);
    }, 10000);
    return () => clearTimeout(tid);
  }, [identity, user, setUser, setIsLoading]);

  const onLogout = () => {
    // Remove principal-scoped onboarding key so the login screen appears after logout
    if (identity) {
      const pid = identity.getPrincipal().toString();
      localStorage.removeItem(`sha_onboarding_done_${pid}`);
    }
    clearIdentity();
    setUser(null);
    setShowOnboarding(false);
    setActiveTab("home");
    setMountedTabs(new Set<Tab>(["home"]));
    localCache.remove(CACHE_KEYS.profile);
  };

  const handleOnboardingFinish = async (name: string) => {
    const defaultProfile: UserProfileView = {
      name: name || "User",
      email: "",
      preferences: {
        language: "en",
        darkMode: false,
        geminiApiKey: "",
        currency: "USD",
      },
      registrationTime: BigInt(Date.now()),
      tasks: [],
      finances: [],
    };

    // Always set user so the app doesn't loop back to onboarding
    setUser(defaultProfile);
    localCache.set(CACHE_KEYS.profile, defaultProfile);
    setShowOnboarding(false);
    // Store onboarding completion scoped to this ICP principal
    const principalId = identity?.getPrincipal().toString();
    const key = principalId
      ? `sha_onboarding_done_${principalId}`
      : "sha_onboarding_done";
    localStorage.setItem(key, "1");

    // Save to backend in background (non-blocking)
    if (actor) {
      actor.saveCallerUserProfile(defaultProfile).catch(() => {});
    }
  };

  // Only block on isInitializing (II SDK loading), not isFetching (actor init)
  if (isInitializing) {
    return <SplashScreen />;
  }

  if (!identity) return <AuthScreen />;

  const principalId = identity.getPrincipal().toString();
  const onboardingDoneKey = `sha_onboarding_done_${principalId}`;
  const hasCompletedOnboarding =
    localStorage.getItem(onboardingDoneKey) === "1";
  const hasCachedProfile = !!localCache.get(CACHE_KEYS.profile);

  // If the user has previously completed onboarding and we have a cached profile,
  // go straight to the app without waiting for the actor or showing any login screen.
  if (hasCompletedOnboarding && hasCachedProfile && !showOnboarding) {
    // user may be null while actor is loading — that's fine, the useEffect above
    // handles hydration from cache asynchronously to avoid setState-during-render.
  } else {
    if (isLoading && !hasCachedProfile) {
      return <SplashScreen />;
    }

    if (showOnboarding || (!user && !hasCompletedOnboarding)) {
      return <OnboardingScreen onFinish={handleOnboardingFinish} />;
    }
  }

  // Final safety: if still no user after all checks, wait for the 10s timeout above.
  // Show a non-blocking spinner rather than SplashScreen (which has no exit path).
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/assets/splash_screen-019d612d-bd8e-71b4-8343-e64498d89c30.png"
            alt="Sha"
            className="w-20 h-20 object-contain rounded-2xl"
          />
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-accent animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: t.home, icon: <Home className="w-5 h-5" /> },
    { id: "notes", label: t.notes, icon: <NotebookPen className="w-5 h-5" /> },
    {
      id: "planner",
      label: t.planner,
      icon: <CalendarCheck className="w-5 h-5" />,
    },
    {
      id: "finance",
      label: t.finance,
      icon: <DollarSign className="w-5 h-5" />,
    },
    {
      id: "wardrobe",
      label: t.wardrobe,
      icon: <Shirt className="w-5 h-5" />,
    },
    {
      id: "gym",
      label: "Gym",
      icon: <Dumbbell className="w-5 h-5" />,
    },
    { id: "profile", label: t.profile, icon: <User className="w-5 h-5" /> },
  ];

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="flex flex-col min-h-screen max-w-[430px] mx-auto bg-background relative overflow-hidden"
    >
      <header className="flex-shrink-0 h-12 bg-gradient-to-r from-card to-background border-b border-border flex items-center justify-between px-4 relative z-10">
        <div className="w-8" />
        <h1 className="text-xs font-bold tracking-[0.2em] uppercase text-foreground">
          {tabs.find((tab) => tab.id === activeTab)?.label}
        </h1>
        <button
          type="button"
          data-ocid="nav.profile.link"
          onClick={() => handleTabChange("profile")}
          className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 overflow-hidden flex items-center justify-center flex-shrink-0"
        >
          {profilePicture ? (
            <img
              src={profilePicture}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs font-bold text-accent">
              {(user?.name || "U").charAt(0).toUpperCase()}
            </span>
          )}
        </button>
      </header>

      <main className="flex flex-col flex-1 overflow-hidden relative">
        {mountedTabs.has("home") && (
          <TabWrapper
            tabId="home"
            activeTab={activeTab}
            bg={tabBackgrounds.home}
          >
            <HomeTab />
          </TabWrapper>
        )}

        {mountedTabs.has("notes") && (
          <TabWrapper
            tabId="notes"
            activeTab={activeTab}
            bg={tabBackgrounds.notes}
          >
            <NotesTab />
          </TabWrapper>
        )}

        {mountedTabs.has("planner") && (
          <TabWrapper
            tabId="planner"
            activeTab={activeTab}
            bg={tabBackgrounds.planner}
          >
            <PlannerTab />
          </TabWrapper>
        )}

        {mountedTabs.has("finance") && (
          <TabWrapper
            tabId="finance"
            activeTab={activeTab}
            bg={tabBackgrounds.finance}
          >
            <FinanceTab />
          </TabWrapper>
        )}

        {mountedTabs.has("wardrobe") && (
          <TabWrapper
            tabId="wardrobe"
            activeTab={activeTab}
            bg={tabBackgrounds.wardrobe}
          >
            <WardrobeTab />
          </TabWrapper>
        )}

        {mountedTabs.has("gym") && (
          <TabWrapper
            tabId="gym"
            activeTab={activeTab}
            bg={
              (
                tabBackgrounds as Record<
                  string,
                  TabBackgrounds[keyof TabBackgrounds]
                >
              ).gym
            }
          >
            <GymTab />
          </TabWrapper>
        )}

        {mountedTabs.has("profile") && (
          <TabWrapper
            tabId="profile"
            activeTab={activeTab}
            bg={tabBackgrounds.profile}
          >
            <ProfileTab
              onLogout={onLogout}
              onBackgroundChange={handleBackgroundChange}
            />
          </TabWrapper>
        )}
      </main>

      <nav className="flex-shrink-0 border-t border-border bg-card tab-safe-bottom relative z-10">
        <div className="flex items-center justify-around h-16">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                data-ocid={`nav.${tab.id}.link`}
                onClick={() => handleTabChange(tab.id)}
                className="flex flex-col items-center gap-1 flex-1 py-2 relative"
              >
                <div
                  className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 ${
                    isActive ? "bg-accent/20" : ""
                  }`}
                >
                  <span
                    className={`transition-colors duration-200 ${
                      isActive ? "text-accent" : "text-muted-foreground"
                    }`}
                  >
                    {tab.icon}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="activeNavPill"
                      className="absolute inset-0 rounded-full bg-accent/15 glow-accent"
                      transition={{
                        type: "spring",
                        bounce: 0.3,
                        duration: 0.4,
                      }}
                    />
                  )}
                </div>
                <span
                  className={`text-[9px] font-semibold transition-colors ${
                    isActive ? "text-accent" : "text-muted-foreground"
                  }`}
                >
                  {tab.label.length > 7
                    ? `${tab.label.slice(0, 6)}…`
                    : tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <CurrencyProvider>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <AppContent />
            <Toaster position="top-center" />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </CurrencyProvider>
  );
}
