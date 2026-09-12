import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import { createUser as apiCreateUser } from "@/lib/api";
import type { Person, User } from "@/lib/types";

// Hardcoded dev user until Auth0 is wired in (README §7 — deliberately last).
const DEV_USER: User = { id: "dev-user-1", name: "You", goals: [], links: {}, xp: 0, streak: 0 };

interface PendingConnect {
  person: Person;
}

interface StoreState {
  user: User;
  setUser: (u: User) => void;
  onboard: (name: string, goals: string[]) => Promise<void>;
  pendingConnect: PendingConnect | null;
  setPendingConnect: (p: PendingConnect | null) => void;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(DEV_USER);
  const [pendingConnect, setPendingConnect] = useState<PendingConnect | null>(null);

  const onboard = useCallback(async (name: string, goals: string[]) => {
    const created = await apiCreateUser(name, goals);
    setUser(created);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, onboard, pendingConnect, setPendingConnect }),
    [user, onboard, pendingConnect]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
