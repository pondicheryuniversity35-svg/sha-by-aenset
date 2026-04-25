import {
  AuthClient,
  type AuthClientCreateOptions,
  type AuthClientLoginOptions,
} from "@dfinity/auth-client";
import type { Identity } from "@icp-sdk/core/agent";
import {
  type PropsWithChildren,
  type ReactNode,
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type Status =
  | "initializing"
  | "idle"
  | "logging-in"
  | "success"
  | "loginError";

export type InternetIdentityContext = {
  /** The identity is available after successfully loading the identity from local storage
   * or completing the login process. */
  identity?: Identity;

  /** Connect to Internet Identity to login the user. */
  login: () => void;

  /** Clears the identity from the state and local storage. Effectively "logs the user out". */
  clear: () => void;

  /** The loginStatus of the login process. Note: The login loginStatus is not affected when a stored
   * identity is loaded on mount. */
  loginStatus: Status;

  /** `loginStatus === "initializing"` */
  isInitializing: boolean;

  /** `loginStatus === "idle"` */
  isLoginIdle: boolean;

  /** `loginStatus === "logging-in"` */
  isLoggingIn: boolean;

  /** `loginStatus === "success"` */
  isLoginSuccess: boolean;

  /** `loginStatus === "loginError"` */
  isLoginError: boolean;

  loginError?: Error;
};

const ONE_HOUR_IN_NANOSECONDS = BigInt(3_600_000_000_000);
const DEFAULT_IDENTITY_PROVIDER = process.env.II_URL;

type ProviderValue = InternetIdentityContext;
const InternetIdentityReactContext = createContext<ProviderValue | undefined>(
  undefined,
);

/**
 * Create the auth client with default options or options provided by the user.
 */
async function createAuthClient(
  createOptions?: AuthClientCreateOptions,
): Promise<AuthClient> {
  const options: AuthClientCreateOptions = {
    idleOptions: {
      // Default behaviour of this hook is not to logout and reload window on identity expiration
      disableDefaultIdleCallback: true,
      disableIdle: true,
      ...createOptions?.idleOptions,
    },
    ...createOptions,
  };
  const authClient = await AuthClient.create(options);
  return authClient;
}

/** Safe no-op default returned when context is not yet available (before provider mounts). */
const DEFAULT_CONTEXT: InternetIdentityContext = {
  identity: undefined,
  login: () => {},
  clear: () => {},
  loginStatus: "initializing",
  isInitializing: true,
  isLoginIdle: false,
  isLoggingIn: false,
  isLoginSuccess: false,
  isLoginError: false,
  loginError: undefined,
};

/**
 * Hook to access the internet identity as well as loginStatus along with
 * login and clear functions.
 *
 * Returns a safe default (isInitializing: true) if called before the provider
 * has mounted, rather than throwing. This prevents crashes during the first
 * render pass in React 18/19 strict mode or when the component tree is still
 * being constructed.
 */
export const useInternetIdentity = (): InternetIdentityContext => {
  const context = useContext(InternetIdentityReactContext);
  // If context is undefined the provider hasn't mounted yet — return a safe
  // initializing state instead of throwing so the UI can render gracefully.
  if (!context) {
    return DEFAULT_CONTEXT;
  }
  return context;
};

/**
 * The InternetIdentityProvider component makes the saved identity available
 * after page reloads. It also allows you to configure default options
 * for AuthClient and login.
 *
 *
 * @example
 * ```tsx
 * <InternetIdentityProvider>
 *   <App />
 * </InternetIdentityProvider>
 * ```
 */
export function InternetIdentityProvider({
  children,
  createOptions,
}: PropsWithChildren<{
  /** The child components that the InternetIdentityProvider will wrap. This allows any child
   * component to access the authentication context provided by the InternetIdentityProvider. */
  children: ReactNode;

  /** Options for creating the {@link AuthClient}. See AuthClient documentation for list of options
   *
   * defaults to disabling the AuthClient idle handling (clearing identities
   * from store and reloading the window on identity expiry). If that behaviour is preferred, set these settings:
   *
   * ```
   * const options = {
   *   idleOptions: {
   *     disableDefaultIdleCallback: false,
   *     disableIdle: false,
   *   },
   * }
   * ```
   */
  createOptions?: AuthClientCreateOptions;
}>) {
  // Store the AuthClient in a ref so login() always has the latest instance
  // without needing it in the dependency array (which would cause loops).
  const authClientRef = useRef<AuthClient | null>(null);

  const [identity, setIdentity] = useState<Identity | undefined>(undefined);
  const [loginStatus, setStatus] = useState<Status>("initializing");
  const [loginError, setError] = useState<Error | undefined>(undefined);

  // Capture createOptions in a ref so the mount-only useEffect can read it
  // without needing createOptions in its dependency array (which would cause
  // an infinite re-initialization loop).
  const createOptionsRef = useRef(createOptions);

  const setErrorMessage = useCallback((message: string) => {
    setStatus("loginError");
    setError(new Error(message));
  }, []);

  /**
   * Initialize (or re-initialize) the AuthClient and restore any existing session.
   * This is called once on mount and again after logout so login() always has a
   * valid authClient to work with.
   */
  const initAuthClient = useCallback(async () => {
    try {
      setStatus("initializing");
      const newClient = await createAuthClient(createOptionsRef.current);
      authClientRef.current = newClient;
      const isAuthenticated = await newClient.isAuthenticated();
      if (isAuthenticated) {
        const loadedIdentity = newClient.getIdentity();
        setIdentity(loadedIdentity);
      }
    } catch (unknownError) {
      setStatus("loginError");
      setError(
        unknownError instanceof Error
          ? unknownError
          : new Error("Initialization failed"),
      );
      return;
    }
    setStatus("idle");
  }, []);

  const handleLoginSuccess = useCallback(() => {
    const client = authClientRef.current;
    if (!client) {
      setErrorMessage("Identity not found after successful login");
      return;
    }
    const latestIdentity = client.getIdentity();
    if (!latestIdentity) {
      setErrorMessage("Identity not found after successful login");
      return;
    }
    setIdentity(latestIdentity);
    setStatus("success");
  }, [setErrorMessage]);

  const handleLoginError = useCallback(
    (maybeError?: string) => {
      setErrorMessage(maybeError ?? "Login failed");
    },
    [setErrorMessage],
  );

  const login = useCallback(() => {
    const client = authClientRef.current;
    if (!client) {
      setErrorMessage(
        "AuthClient is not initialized yet, make sure to call `login` on user interaction e.g. click.",
      );
      return;
    }

    // NOTE: The "already authenticated" check has been intentionally removed.
    // The login function must always open the II popup so returning users can
    // re-authenticate after session expiry or a canister redeployment.

    const options: AuthClientLoginOptions = {
      identityProvider: DEFAULT_IDENTITY_PROVIDER,
      onSuccess: handleLoginSuccess,
      onError: handleLoginError,
      maxTimeToLive: ONE_HOUR_IN_NANOSECONDS * BigInt(24 * 30), // 30 days
    };

    setStatus("logging-in");
    void client.login(options);
  }, [handleLoginError, handleLoginSuccess, setErrorMessage]);

  const clear = useCallback(() => {
    const client = authClientRef.current;
    if (!client) {
      // No client to logout from — just reset state and re-initialize
      setIdentity(undefined);
      setError(undefined);
      void initAuthClient();
      return;
    }

    void client
      .logout()
      .catch(() => {
        // Swallow logout errors — we still want to clear local state
      })
      .finally(() => {
        authClientRef.current = null;
        setIdentity(undefined);
        setError(undefined);
        // Re-initialize so login() has a fresh AuthClient for the next sign-in
        void initAuthClient();
      });
  }, [initAuthClient]);

  // Initialise the auth client ONCE on mount.
  // Use a ref guard (initStartedRef) to prevent double-invocation in React StrictMode
  // or any re-render before the async init completes.
  const initStartedRef = useRef(false);
  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    void initAuthClient();
    // initAuthClient is stable (useCallback with empty deps) — safe to exclude from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initAuthClient]); // initAuthClient is stable — this runs effectively once

  const value = useMemo<ProviderValue>(
    () => ({
      identity,
      login,
      clear,
      loginStatus,
      isInitializing: loginStatus === "initializing",
      isLoginIdle: loginStatus === "idle",
      isLoggingIn: loginStatus === "logging-in",
      isLoginSuccess: loginStatus === "success",
      isLoginError: loginStatus === "loginError",
      loginError,
    }),
    [identity, login, clear, loginStatus, loginError],
  );

  return createElement(InternetIdentityReactContext.Provider, {
    value,
    children,
  });
}
