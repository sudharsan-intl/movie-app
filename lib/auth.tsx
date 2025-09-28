import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  signInToOdoo,
  signOutFromOdoo,
  type OdooSession,
  type OdooUserProfile,
  type SignInParams,
} from "./odooClient";

type AuthStatus = "unauthenticated" | "authenticating" | "authenticated";

type AuthContextValue = {
  status: AuthStatus;
  session: OdooSession | null;
  user: OdooUserProfile | null;
  error: string | null;
  signIn: (params: SignInParams) => Promise<void>;
  signOut: () => void;
  lastServerUrl: string;
  lastUsername: string;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>("unauthenticated");
  const [session, setSession] = useState<OdooSession | null>(null);
  const [user, setUser] = useState<OdooUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastServerUrl, setLastServerUrl] = useState<string>("");
  const [lastUsername, setLastUsername] = useState<string>("");

  const signIn = useCallback(async (params: SignInParams) => {
    const trimmedServer = params.serverUrl.trim();
    const trimmedUsername = params.username.trim();
    const trimmedDatabase = params.database?.trim();

    setLastServerUrl(trimmedServer);
    setLastUsername(trimmedUsername);
    setStatus("authenticating");
    setError(null);

    try {
      const result = await signInToOdoo({
        serverUrl: trimmedServer,
        username: trimmedUsername,
        password: params.password,
        database: trimmedDatabase && trimmedDatabase.length > 0 ? trimmedDatabase : undefined,
      });

      setSession(result.session);
      setUser(result.user);
      setStatus("authenticated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign in. Please try again.";
      setSession(null);
      setUser(null);
      setStatus("unauthenticated");
      setError(message);
      throw new Error(message);
    }
  }, []);

  const signOut = useCallback(() => {
    signOutFromOdoo();
    setSession(null);
    setUser(null);
    setStatus("unauthenticated");
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user,
      error,
      signIn,
      signOut,
      lastServerUrl,
      lastUsername,
    }),
    [status, session, user, error, signIn, signOut, lastServerUrl, lastUsername]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};