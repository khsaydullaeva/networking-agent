import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { addPlan as apiAddPlan, authSession as apiAuthSession } from "@/lib/api";
import type { Person, Plan, User } from "@/lib/types";

const SESSION_KEY = "networking-agent.session";

interface Session {
  idToken: string | null; // null in USE_FIXTURES dev-login mode
  user: User;
}

interface PendingConnect {
  person: Person;
}

interface StoreState {
  user: User | null;
  authLoading: boolean;
  login: (idToken: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  addPlan: (title: string) => Promise<Plan>;
  pendingConnect: PendingConnect | null;
  setPendingConnect: (p: PendingConnect | null) => void;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pendingConnect, setPendingConnect] = useState<PendingConnect | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (raw) setSession(JSON.parse(raw));
      } catch {
        // corrupt or inaccessible store — fall through to logged-out state
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: Session | null) => {
    if (next) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    else await SecureStore.deleteItemAsync(SESSION_KEY);
  }, []);

  const login = useCallback(
    async (idToken: string) => {
      const user = await apiAuthSession(idToken);
      const next: Session = { idToken, user };
      setSession(next);
      await persist(next);
      return user;
    },
    [persist]
  );

  const logout = useCallback(async () => {
    setSession(null);
    await persist(null);
  }, [persist]);

  const setUser = useCallback(
    (user: User) => {
      setSession((prev) => {
        const next: Session = prev ? { ...prev, user } : { idToken: null, user };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const addPlan = useCallback(
    async (title: string) => {
      if (!session) throw new Error("not logged in");
      const plan = await apiAddPlan(session.user.id, title);
      setUser({ ...session.user, plans: [...session.user.plans, plan] });
      return plan;
    },
    [session, setUser]
  );

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      authLoading,
      login,
      logout,
      setUser,
      addPlan,
      pendingConnect,
      setPendingConnect,
    }),
    [session, authLoading, login, logout, setUser, addPlan, pendingConnect]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
