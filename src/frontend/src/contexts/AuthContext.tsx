import { type ReactNode, createContext, useContext, useState } from "react";
import type { UserProfileView } from "../types";

interface AuthContextType {
  user: UserProfileView | null;
  setUser: (u: UserProfileView | null) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  isLoading: false,
  setIsLoading: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfileView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  return (
    <AuthContext.Provider value={{ user, setUser, isLoading, setIsLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
